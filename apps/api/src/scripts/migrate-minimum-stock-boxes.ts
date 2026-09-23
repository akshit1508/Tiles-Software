import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../modules/products/schemas/product.schema';
import { Logger } from '@nestjs/common';

async function migrate() {
  const logger = new Logger('MigrateMinimumStockBoxes');
  logger.log('Starting migration for minimumStockBoxes...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const productModel = app.get<Model<ProductDocument>>(getModelToken(Product.name));

  const products = await productModel.find({ minimumStockBoxes: { $exists: false } }).exec();
  logger.log(`Found ${products.length} products to migrate`);

  for (const product of products) {
    const rawDoc = product.toObject() as unknown as { minimumStockPieces?: number };
    const piecesPerBox = product.piecesPerBox || 1;
    let minBoxes = 0;

    if (rawDoc.minimumStockPieces !== undefined && rawDoc.minimumStockPieces > 0) {
      // In development, values like 2 were entered as boxes directly or pieces.
      // If it's a small number <= 10, it's typically boxes (e.g. 2 boxes).
      // If it's a multiple of piecesPerBox, divide; otherwise use as boxes.
      if (rawDoc.minimumStockPieces % piecesPerBox === 0) {
        minBoxes = rawDoc.minimumStockPieces / piecesPerBox;
      } else {
        // e.g. BT601 had minimumStockPieces: 2 with piecesPerBox: 4 (intended as 2 boxes)
        minBoxes = rawDoc.minimumStockPieces;
      }
    }

    product.minimumStockBoxes = minBoxes;
    product.minimumStockPieces = minBoxes * piecesPerBox;
    await product.save();
    logger.log(`Migrated product ${product.gallaNumber} (${product.productName}): minimumStockBoxes = ${minBoxes}`);
  }

  logger.log('Migration completed successfully');
  await app.close();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
