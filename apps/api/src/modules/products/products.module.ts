import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './schemas/product.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import {
  InventoryTransaction,
  InventoryTransactionSchema,
} from '../inventory/schemas/inventory-transaction.schema';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

/**
 * ProductsModule — provides REST API for tile product master data.
 *
 * Registers Product, Inventory, and InventoryTransaction schemas because POST /products
 * initializes the corresponding Inventory document and logs the initial STOCK_IN audit transaction.
 *
 * Authentication is provided by importing AuthModule which exports JwtAuthGuard.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: InventoryTransaction.name, schema: InventoryTransactionSchema },
    ]),
    AuthModule,
    CloudinaryModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
