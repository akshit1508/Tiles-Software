import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CounterDocument = Counter & Document;

/**
 * Counter — atomic sequence document used to generate order numbers.
 *
 * Order numbers follow the format: GT-YYYYMMDD-XXXX
 * (e.g. GT-20240115-0001, GT-20240115-0002, …)
 *
 * Each counter document has a `key` that encodes the date prefix (GT-YYYYMMDD).
 * The `seq` field is incremented atomically via:
 *
 *   CounterModel.findOneAndUpdate(
 *     { key: 'GT-YYYYMMDD' },
 *     { $inc: { seq: 1 } },
 *     { upsert: true, new: true }
 *   )
 *
 * A new counter document is automatically created on the first order of each day
 * (upsert: true). This approach ensures uniqueness under concurrent requests
 * without application-level locking.
 *
 * See: DECISIONS.md ADR-014 — Atomic order number generation
 *
 * Format assembly (service layer):
 *   const seq = result.seq.toString().padStart(4, '0');
 *   const orderNumber = `${key}-${seq}`;  // e.g. 'GT-20240115-0001'
 */
@Schema({
  collection: 'counters',
  timestamps: false, // Counters do not need audit timestamps
})
export class Counter {
  /**
   * Unique key for this counter series.
   * For daily order sequences: 'GT-YYYYMMDD'
   */
  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  key: string;

  /**
   * Current sequence value.
   * The service layer reads the post-increment value (new: true)
   * so the first order of each day gets seq = 1.
   */
  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  seq: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);

// Note: key unique index is handled by @Prop({ unique: true }) above.
// No additional schema.index() call required to avoid duplicate index warnings.

