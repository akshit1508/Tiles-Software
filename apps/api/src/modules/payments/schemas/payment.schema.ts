import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { PaymentMethod } from '../../../common/enums';

export type PaymentDocument = Payment & Document;

/**
 * Payment — individual financial transaction record.
 *
 * DATABASE.md Section 24 — Fields:
 *   customerId     ObjectId       (required — must match order.customerId)
 *   orderId        ObjectId       (required — every payment belongs to an order)
 *   amount         Decimal128     (required — must be > 0)
 *   paymentMethod  enum           (CASH | UPI | BANK_TRANSFER | CHEQUE)
 *   paymentDate    Date           (required — the actual date of the payment)
 *   notes?         string         (optional)
 *   createdAt      Date           (auto — document creation timestamp)
 *   createdBy      ObjectId       (required — authenticated user who recorded this)
 *
 * LOCKED RULES (DATABASE.md Sections 25–26):
 *   - orderId is REQUIRED. There are no unallocated payments in V1.
 *   - The backend must reject payments that would make total payments > order total.
 *   - customerId must match the referenced order's customerId (validated at service level).
 *   - Payments are financial history and must NOT be hard-deleted.
 *   - amount must be > 0.
 *
 * Note: updatedAt is not included as payments represent immutable financial events.
 * Corrections should be recorded as separate adjustment entries, not silent overwrites.
 */
@Schema({
  collection: 'payments',
  timestamps: { createdAt: true, updatedAt: false }, // Only createdAt — payments are immutable events
})
export class Payment {
  /**
   * The customer who made this payment.
   * Must match the customer on the referenced order.
   * Validated at service layer before persistence.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  })
  customerId: Types.ObjectId;

  /**
   * The order this payment is applied to.
   * All payments in V1 must belong to an existing order.
   * There are no unallocated / advance payments.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Order',
    required: true,
  })
  orderId: Types.ObjectId;

  /**
   * The payment amount.
   * Stored as Decimal128 to avoid floating-point rounding errors.
   * Must be > 0.
   * Must not cause cumulative order payments to exceed totalAmount (service-layer check).
   */
  @Prop({
    type: MongooseSchema.Types.Decimal128,
    required: true,
  })
  amount: Types.Decimal128;

  @Prop({
    type: String,
    enum: Object.values(PaymentMethod),
    required: true,
  })
  paymentMethod: PaymentMethod;

  /** The actual date/time the payment was received */
  @Prop({
    type: Date,
    required: true,
  })
  paymentDate: Date;

  @Prop({
    type: String,
    trim: true,
  })
  notes?: string;

  /** The authenticated user who recorded this payment */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: Types.ObjectId;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.set('toObject', { getters: true });
PaymentSchema.set('toJSON', { getters: true });

// ── Indexes (DATABASE.md Section 46) ─────────────────────────────────────────
PaymentSchema.index({ orderId: 1, paymentDate: -1 });
PaymentSchema.index({ customerId: 1, paymentDate: -1 });
