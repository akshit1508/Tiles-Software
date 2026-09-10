import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './schemas/order.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import {
  InventoryTransaction,
  InventoryTransactionSchema,
} from '../inventory/schemas/inventory-transaction.schema';
import {
  Payment,
  PaymentSchema,
} from '../payments/schemas/payment.schema';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: InventoryTransaction.name, schema: InventoryTransactionSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    AuthModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
