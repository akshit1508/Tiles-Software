import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { OrderStatus, SalesUnit } from '../../../common/enums';

export type OrderDocument = Order & Document;

/**
 * OrderItem — embedded sub-document within an Order.
 *
 * Items are embedded (not a separate collection) because an order is a
 * bounded historical document. Items belong to its permanent record.
 * (DATABASE.md Section 19)
 *
 * Snapshots required at order creation (DATABASE.md Section 20):
 *   productId           — reference for future lookups only
 *   productNameSnapshot — denormalised so product name changes don't rewrite history
 *   brandSnapshot       — same rationale
 *   salesQuantity       — the customer-facing quantity (Decimal128 for SQ_FT, integer for BOX/PIECE)
 *   salesUnit           — BOX | PIECE | SQ_FT
 *   physicalPieces      — integer pieces consumed from inventory
 *   unitPrice           — price at time of sale (Decimal128)
 *   lineTotal           — salesQuantity × unitPrice (Decimal128)
 */
const OrderItemSchema = new MongooseSchema(
  {
    productId: {
      type: MongooseSchema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productNameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    brandSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    /**
     * Customer-facing quantity at time of sale.
     * For SQ_FT this can be decimal → stored as Decimal128.
     * For BOX and PIECE this is an integer but stored in the same field.
     */
    salesQuantity: {
      type: MongooseSchema.Types.Decimal128,
      required: true,
    },
    salesUnit: {
      type: String,
      enum: Object.values(SalesUnit),
      required: true,
    },
    /**
     * Integer pieces consumed from inventory.
     * This is the canonical physical unit for stock calculations.
     */
    physicalPieces: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'physicalPieces must be a positive integer',
      },
    },
    unitPrice: {
      type: MongooseSchema.Types.Decimal128,
      required: true,
    },
    lineTotal: {
      type: MongooseSchema.Types.Decimal128,
      required: true,
    },
  },
  { _id: false },
);

/**
 * Order — historical sales document.
 *
 * DATABASE.md Section 19 — Fields:
 *   orderNumber  string       GT-YYYYMMDD-XXXX (unique, atomic counter)
 *   customerId   ObjectId     (required reference to customers)
 *   items        OrderItem[]  (embedded)
 *   subtotal     Decimal128   (sum of line totals before any adjustments)
 *   totalAmount  Decimal128   (final order amount)
 *   status       enum         COMPLETED | CANCELLED  (NO DRAFT in V1)
 *   createdBy    ObjectId     (authenticated user)
 *   createdAt    Date         (auto)
 *   updatedAt    Date         (auto)
 *
 * Outstanding amount is DERIVED: totalAmount – sum(valid payments).
 * It is NOT a stored field in V1 (DATABASE.md Section 28).
 */
@Schema({
  collection: 'orders',
  timestamps: true,
})
export class Order {
  /**
   * Human-readable unique order identifier.
   * Format: GT-YYYYMMDD-XXXX (e.g. GT-20240115-0001)
   * Generated atomically using the Counter collection to prevent duplicates
   * under concurrent order creation.
   */
  @Prop({
    type: String,
    required: true,
    unique: true,
    match: /^GT-\d{8}-\d{4}$/,
  })
  orderNumber: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  })
  customerId: Types.ObjectId;

  /** Order items are embedded — see OrderItem sub-document definition above */
  @Prop({
    type: [OrderItemSchema],
    required: true,
    validate: {
      validator: (items: unknown[]) => Array.isArray(items) && items.length > 0,
      message: 'An order must contain at least one item',
    },
  })
  items: {
    productId: Types.ObjectId;
    productNameSnapshot: string;
    brandSnapshot: string;
    salesQuantity: Types.Decimal128;
    salesUnit: SalesUnit;
    physicalPieces: number;
    unitPrice: Types.Decimal128;
    lineTotal: Types.Decimal128;
  }[];

  /** Sum of all line totals (Decimal128 for precision) */
  @Prop({
    type: MongooseSchema.Types.Decimal128,
    required: true,
  })
  subtotal: Types.Decimal128;

  /** Final order amount charged to the customer */
  @Prop({
    type: MongooseSchema.Types.Decimal128,
    required: true,
  })
  totalAmount: Types.Decimal128;

  /**
   * V1 statuses: COMPLETED | CANCELLED only.
   * There is NO DRAFT status in V1.
   * An order is created only when the transaction completes successfully.
   */
  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    required: true,
    default: OrderStatus.COMPLETED,
  })
  status: OrderStatus;

  /** The authenticated user who created this order */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: Types.ObjectId;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.set('toObject', { getters: true });
OrderSchema.set('toJSON', { getters: true });

// ── Indexes (DATABASE.md Section 46) ─────────────────────────────────────────
// Note: orderNumber unique index is handled by @Prop({ unique: true }) above.
// Adding compound/secondary indexes here.
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
