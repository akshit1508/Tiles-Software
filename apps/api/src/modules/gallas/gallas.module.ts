import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Galla, GallaSchema } from './schemas/galla.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { GallasService } from './gallas.service';
import { GallasController } from './gallas.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Galla.name, schema: GallaSchema },
      { name: Inventory.name, schema: InventorySchema },
    ]),
  ],
  controllers: [GallasController],
  providers: [GallasService],
  exports: [GallasService, MongooseModule],
})
export class GallasModule {}
