import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './schemas/product.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

/**
 * ProductsModule — provides REST API for tile product master data.
 *
 * Registers both Product and Inventory schemas because POST /products must
 * atomically initialize the corresponding Inventory document with totalPieces = 0
 * (per API.md contract). No other inventory business logic lives here.
 *
 * Authentication is provided by importing AuthModule which exports JwtAuthGuard.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Inventory.name, schema: InventorySchema },
    ]),
    AuthModule,
    CloudinaryModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
