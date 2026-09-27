import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GallaDocument = Galla & Document;

/**
 * Galla — Physical storage location / section / rack in the godown.
 *
 * In the real tile shop/warehouse:
 * - A Galla is a physical storage space (not a product).
 * - One Galla can contain MULTIPLE tile products.
 * - The same product can physically exist across multiple Gallas.
 * - Galla Number is unique within this master collection.
 */
@Schema({
  collection: 'gallas',
  timestamps: true,
})
export class Galla {
  /**
   * Unique business code / identifier for the physical location (e.g. "G-01", "GALLA-01").
   * Stored trimmed and uppercase.
   */
  @Prop({
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  })
  gallaNumber: string;

  /** Optional descriptive label (e.g. "Main Godown North Section", "Rack B-2") */
  @Prop({ type: String, trim: true })
  name?: string;

  /** Optional physical notes (e.g. "Floor tiles section, ground level") */
  @Prop({ type: String, trim: true })
  description?: string;

  /**
   * Active state for soft deactivation.
   * Inactive Gallas cannot receive new stock, but historical stock & transactions remain intact.
   */
  @Prop({
    type: Boolean,
    default: true,
    required: true,
  })
  isActive: boolean;
}

export const GallaSchema = SchemaFactory.createForClass(Galla);

// Indexes
GallaSchema.index({ isActive: 1 });
