import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomerDocument = Customer & Document;

/**
 * Customer — master record for a tile shop customer.
 *
 * DATABASE.md Section 22:
 *   name     string   (required)
 *   phone    string   (required)
 *   address  string   (optional)
 *   isActive boolean  (soft-deactivation flag)
 *
 * IMPORTANT — Outstanding amount is DERIVED, NOT stored here:
 *   outstanding = Sum(COMPLETED order amounts) - Sum(valid payments)
 *   (DATABASE.md Sections 28–29)
 *
 * Customer deactivation follows the same soft-delete pattern as products:
 *   isActive = false  (hard deletion is forbidden when historical orders exist)
 */
@Schema({
  collection: 'customers',
  timestamps: true,
})
export class Customer {
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  name: string;

  /**
   * Primary contact phone number.
   * Stored as a string to accommodate formatting variations (e.g. +91 prefixes).
   * Phone uniqueness is NOT enforced at schema level — business has not
   * explicitly required one customer per phone number (DATABASE.md Section 46).
   */
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  phone: string;

  @Prop({
    type: String,
    trim: true,
  })
  address?: string;

  /**
   * Soft-deactivation flag.
   * Customers with historical orders should not be hard-deleted.
   * Set isActive = false to deactivate.
   */
  @Prop({
    type: Boolean,
    default: true,
    required: true,
  })
  isActive: boolean;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

// ── Indexes (DATABASE.md Section 46) ─────────────────────────────────────────
CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ name: 1 });
CustomerSchema.index({ isActive: 1 });
