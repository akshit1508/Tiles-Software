import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ProductDocument = Product & Document;

/**
 * ImageReference — reference to an external image (URL, publicId, alt text).
 * Images are NOT stored as binary blobs inside the product document.
 * The final image provider (e.g. Cloudinary) is a separate implementation decision.
 * Provider credentials must NEVER be stored inside this document.
 */
const ImageReferenceSchema = new MongooseSchema(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    alt: { type: String },
  },
  { _id: false },
);

@Schema({
  collection: 'products',
  timestamps: true,
})
export class Product {
  @Prop({ type: String, required: true, trim: true })
  brand: string;

  @Prop({ type: String, required: true, trim: true })
  productName: string;

  /** Galla Number — business reference identifier for the tile model */
  @Prop({ type: String, required: true, trim: true })
  gallaNumber: string;

  @Prop({ type: String, required: true, trim: true })
  category: string;

  @Prop({ type: String, required: true, trim: true })
  size: string;

  @Prop({ type: String, required: true, trim: true })
  finish: string;

  @Prop({ type: String, required: true, trim: true })
  color: string;

  /**
   * Number of tile pieces in one complete box.
   * Must be a positive integer > 0.
   * CAUTION: changing this value after inventory exists has far-reaching consequences.
   */
  @Prop({
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'piecesPerBox must be a positive integer',
    },
  })
  piecesPerBox: number;

  /**
   * Total area (sq.ft) covered by one complete box.
   * Stored as MongoDB Decimal128 to avoid floating-point precision issues.
   * Must be > 0.
   */
  @Prop({
    type: MongooseSchema.Types.Decimal128,
    required: true,
  })
  areaPerBox: Types.Decimal128;

  /**
   * The business purchase price per box (reference value).
   * Stored as Decimal128 for precision.
   * Must be >= 0.
   */
  @Prop({
    type: MongooseSchema.Types.Decimal128,
    required: true,
  })
  purchasePrice: Types.Decimal128;

  /**
   * The business selling price per box (reference value).
   * Actual order prices are snapshotted into the order item at order time.
   * Stored as Decimal128 for precision.
   * Must be >= 0.
   */
  @Prop({
    type: MongooseSchema.Types.Decimal128,
    required: true,
  })
  sellingPrice: Types.Decimal128;

  /**
   * Minimum stock threshold in pieces.
   * Product is considered "low stock" when inventory.totalPieces <= minimumStockPieces.
   * Must be a non-negative integer.
   */
  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'minimumStockPieces must be a non-negative integer',
    },
  })
  minimumStockPieces: number;

  /** External image references. Not binary blobs. */
  @Prop({
    type: [ImageReferenceSchema],
    default: [],
  })
  images: { url: string; publicId?: string; alt?: string }[];

  /**
   * Soft-deactivation flag.
   * Products must NEVER be hard-deleted once they have historical references.
   * Set isActive = false to deactivate.
   */
  @Prop({
    type: Boolean,
    default: true,
    required: true,
  })
  isActive: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Enable getters on toObject / toJSON so Decimal128 fields are serialised correctly
ProductSchema.set('toObject', { getters: true });
ProductSchema.set('toJSON', { getters: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
// Justified by documented query patterns (see DATABASE.md Section 46)
ProductSchema.index({ brand: 1 });
ProductSchema.index({ productName: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ gallaNumber: 1 });
