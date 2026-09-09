import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type InventoryDocument = Inventory & Document;

/**
 * Inventory — canonical current physical stock state for one product.
 *
 * DATABASE.md Section 9 mandates:
 *   - Exactly ONE inventory document per product in V1.
 *   - The ONLY stored quantity is `totalPieces` (integer >= 0).
 *   - fullBoxes, loosePieces, and totalSqFt are DERIVED and must NOT be persisted here.
 *   - productId must have a UNIQUE index.
 *
 * Derived calculations (for display/API only — not stored):
 *   fullBoxes  = Math.floor(totalPieces / product.piecesPerBox)
 *   loosePieces = totalPieces % product.piecesPerBox
 *   totalSqFt  = totalPieces * (product.areaPerBox / product.piecesPerBox)
 */
@Schema({
  collection: 'inventories',
  timestamps: true,
})
export class Inventory {
  /**
   * Reference to the product whose stock this document tracks.
   * Must be unique — one inventory document per product.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Product',
    required: true,
    unique: true,
  })
  productId: Types.ObjectId;

  /**
   * Canonical physical stock: total individual tile pieces on hand.
   * This is the ONLY persisted stock value.
   * Must be a non-negative integer.
   * Fractional pieces are never permitted (DATABASE.md Section 4.4).
   */
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

// Note: productId unique index is handled by @Prop({ unique: true }) above.
// No additional schema.index() call required to avoid duplicate index warnings.

