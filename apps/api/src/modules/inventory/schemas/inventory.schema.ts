import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type InventoryDocument = Inventory & Document;

/**
 * Inventory — Location-segmented stock record for one product in one physical Galla.
 *
 * Final Normalized Architecture:
 * - Galla 1 ── N Inventory Location Records
 * - Product 1 ── N Inventory Location Records (e.g. 20 boxes in Galla 01, 30 boxes in Galla 02)
 * - Unique constraint on (productId + gallaId).
 * - Location inventory records are the AUTHORITATIVE physical stock.
 * - Product total stock is derived by summing its location inventory records.
 * - Stored in complete BOXES (user-facing business model) and totalPieces (internal conversion).
 */
@Schema({
  collection: 'inventories',
  timestamps: true,
})
export class Inventory {
  /** Reference to the product */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Product',
    required: true,
  })
  productId: Types.ObjectId;

  /** Reference to the physical storage location / Galla */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Galla',
    required: false, // Optional for unmigrated legacy records during transition
  })
  gallaId?: Types.ObjectId;

  /** Denormalized snapshot of Galla code for audit and display */
  @Prop({
    type: String,
    trim: true,
    uppercase: true,
  })
  gallaNumber?: string;

  /** Complete boxes physically present in this Galla location (>= 0 integer) */
  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'boxes must be a non-negative integer',
    },
  })
  boxes: number;

  /** Canonical total individual tile pieces (boxes * piecesPerBox) */
  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'totalPieces must be a non-negative integer',
    },
  })
  totalPieces: number;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

// Unique compound index: one stock record per product per Galla
InventorySchema.index({ productId: 1, gallaId: 1 }, { unique: true, sparse: true });
InventorySchema.index({ gallaId: 1 });
InventorySchema.index({ productId: 1 });
