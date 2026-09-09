import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { InventoryTransactionType, SalesUnit } from '../../../common/enums';

export type InventoryTransactionDocument = InventoryTransaction & Document;

/**
 * InventoryTransaction — immutable audit record of every physical stock movement.
 *
 * DATABASE.md Section 31 — Fields:
 *   productId        ObjectId  (required)
 *   transactionType  enum      (STOCK_IN | SALE | DAMAGE | ADJUSTMENT | SALE_REVERSAL)
 *   physicalPieces   integer   (signed: positive = added, negative = removed)
 *   salesQuantity?   Decimal128 or integer (the customer-facing quantity, optional)
 *   salesUnit?       enum      (BOX | PIECE | SQ_FT, optional)
 *   orderId?         ObjectId  (present for SALE and SALE_REVERSAL types)
 *   reason?          string    (mandatory for DAMAGE and ADJUSTMENT)
 *   createdAt        Date      (auto)
 *   createdBy        ObjectId  (the user who performed the action)
 *
 * DATABASE.md Section 32 — Types:
 *   STOCK_IN      → stock added via purchase
 *   SALE          → stock deducted by a completed order
 *   DAMAGE        → stock removed due to damage
 *   ADJUSTMENT    → manual stock correction
 *   SALE_REVERSAL → stock restored when an order is cancelled
 */
@Schema({
  collection: 'inventory_transactions',
  timestamps: true,
})
export class InventoryTransaction {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Product',
    required: true,
  })
  productId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(InventoryTransactionType),
    required: true,
  })
  transactionType: InventoryTransactionType;

  /**
   * Signed integer representing the physical movement of pieces.
   *   positive (+) = stock added   (STOCK_IN, ADJUSTMENT+, SALE_REVERSAL)
   *   negative (-) = stock removed (SALE, DAMAGE, ADJUSTMENT-)
   * Fractional values are not permitted.
   */
  @Prop({
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: 'physicalPieces must be an integer',
    },
  })
  physicalPieces: number;

  /**
   * The customer-facing quantity for this movement.
   * - For BOX/PIECE sales this is an integer.
   * - For SQ_FT sales this may be decimal, stored as Decimal128.
   * Optional — not present for DAMAGE/ADJUSTMENT.
   */
  @Prop({
    type: MongooseSchema.Types.Decimal128,
  })
  salesQuantity?: Types.Decimal128;

  @Prop({
    type: String,
    enum: Object.values(SalesUnit),
  })
  salesUnit?: SalesUnit;

  /** Present for SALE and SALE_REVERSAL transaction types */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Order',
  })
  orderId?: Types.ObjectId;

  /** Reason is required for DAMAGE and ADJUSTMENT types (enforced at service layer) */
  @Prop({ type: String, trim: true })
  reason?: string;

  /** The authenticated user who performed this action */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: Types.ObjectId;
}

export const InventoryTransactionSchema =
  SchemaFactory.createForClass(InventoryTransaction);

InventoryTransactionSchema.set('toObject', { getters: true });
InventoryTransactionSchema.set('toJSON', { getters: true });

// ── Indexes (DATABASE.md Section 46) ─────────────────────────────────────────
InventoryTransactionSchema.index({ productId: 1, createdAt: -1 });
InventoryTransactionSchema.index({ orderId: 1 });
InventoryTransactionSchema.index({ transactionType: 1, createdAt: -1 });
