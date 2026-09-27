import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class MigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.runMigrations();
    } catch (err: unknown) {
      this.logger.warn(
        `Database index migration check skipped or encountered error (safe in test/disconnected environment): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Safe migration to clean up obsolete unique indexes and ensure Option C Normalized Location Stock.
   */
  async runMigrations(): Promise<void> {
    if (this.connection.readyState !== 1) {
      // Not connected yet or in mock test environment
      return;
    }

    const db = this.connection.db;
    if (!db) return;

    // 1. Check and drop obsolete unique index on products.gallaNumber
    try {
      const productIndexes = await db.collection('products').indexes();
      const gallaNumberIndex = productIndexes.find(
        (idx) => idx.name === 'gallaNumber_1' || (idx.key && idx.key.gallaNumber === 1),
      );

      if (gallaNumberIndex && gallaNumberIndex.unique && gallaNumberIndex.name) {
        this.logger.log('Dropping obsolete unique index on products.gallaNumber...');
        await db.collection('products').dropIndex(gallaNumberIndex.name);
        this.logger.log('Successfully dropped obsolete unique index products.gallaNumber_1.');
      }
    } catch (err) {
      this.logger.debug(`Products index inspection: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Check and drop obsolete unique index on inventories.productId
    try {
      const inventoryIndexes = await db.collection('inventories').indexes();
      const productIdIndex = inventoryIndexes.find(
        (idx) =>
          (idx.name === 'productId_1' || (idx.key && idx.key.productId === 1 && Object.keys(idx.key).length === 1)) &&
          idx.unique,
      );

      if (productIdIndex && productIdIndex.name) {
        this.logger.log('Dropping obsolete unique index on inventories.productId...');
        await db.collection('inventories').dropIndex(productIdIndex.name);
        this.logger.log('Successfully dropped obsolete unique index inventories.productId_1.');
      }
    } catch (err) {
      this.logger.debug(`Inventories index inspection: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 3. Ensure compound index on inventories: (productId + gallaId)
    try {
      await db.collection('inventories').createIndex(
        { productId: 1, gallaId: 1 },
        { unique: true, sparse: true, background: true },
      );
    } catch (err) {
      this.logger.debug(`Compound index creation: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Backfill legacy inventory records missing gallaId
    try {
      const legacyInventories = await db
        .collection('inventories')
        .find({ $or: [{ gallaId: { $exists: false } }, { gallaId: null }] })
        .toArray();

      if (legacyInventories.length > 0) {
        this.logger.log(`Found ${legacyInventories.length} legacy inventory records. Migrating to Galla locations...`);

        // Ensure default GALLA 01 exists
        let defaultGalla = await db.collection('gallas').findOne({ gallaNumber: 'GALLA 01' });
        if (!defaultGalla) {
          const insertRes = await db.collection('gallas').insertOne({
            gallaNumber: 'GALLA 01',
            name: 'Main Location',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          defaultGalla = { _id: insertRes.insertedId, gallaNumber: 'GALLA 01' };
        }

        for (const inv of legacyInventories) {
          const product = await db.collection('products').findOne({ _id: inv.productId });
          const piecesPerBox = product?.piecesPerBox || 1;
          const boxes = Math.floor((inv.totalPieces || 0) / piecesPerBox);

          let targetGallaId = defaultGalla._id;
          let targetGallaNumber = defaultGalla.gallaNumber;

          if (product?.gallaNumber && product.gallaNumber.trim()) {
            const normNumber = product.gallaNumber.trim().toUpperCase();
            let pGalla = await db.collection('gallas').findOne({ gallaNumber: normNumber });
            if (!pGalla) {
              const res = await db.collection('gallas').insertOne({
                gallaNumber: normNumber,
                name: `Location ${normNumber}`,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              pGalla = { _id: res.insertedId, gallaNumber: normNumber };
            }
            targetGallaId = pGalla._id;
            targetGallaNumber = pGalla.gallaNumber;
          }

          await db.collection('inventories').updateOne(
            { _id: inv._id },
            {
              $set: {
                gallaId: targetGallaId,
                gallaNumber: targetGallaNumber,
                boxes: inv.boxes !== undefined ? inv.boxes : boxes,
              },
            },
          );

          if (product && !product.gallaId) {
            await db.collection('products').updateOne(
              { _id: product._id },
              { $set: { gallaId: targetGallaId } },
            );
          }
        }

        this.logger.log('Successfully completed Galla location backfill.');
      }
    } catch (err) {
      this.logger.warn(`Galla backfill: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
