import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUrl,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * DTO for creating an image reference attached to a product.
 * Images are external references (URL-based), never binary blobs stored in MongoDB.
 */
export class ImageReferenceDto {
  @IsUrl({}, { message: 'Image url must be a valid URL' })
  @IsNotEmpty({ message: 'Image url is required' })
  url: string;

  @IsString()
  @IsOptional()
  publicId?: string;

  @IsString()
  @IsOptional()
  alt?: string;
}

/**
 * CreateProductDto — validates all fields required to create a new tile product.
 *
 * Business rules:
 * - gallaNumber is the unique business identifier. Normalized to UPPERCASE + trim in service.
 * - piecesPerBox must be a positive integer (>= 1).
 * - areaPerBox must be > 0.
 * - purchasePrice / sellingPrice must be >= 0 (reference values).
 * - minimumStockPieces must be a non-negative integer (default 0).
 * - isActive is server-controlled; cannot be set by client at create time.
 */
export class CreateProductDto {
  @IsString({ message: 'brand must be a string' })
  @IsNotEmpty({ message: 'brand is required and cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  brand: string;

  @IsString({ message: 'productName must be a string' })
  @IsNotEmpty({ message: 'productName is required and cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  productName: string;

  /**
   * Galla Number — unique business reference identifier for the tile model (SKU equivalent).
   * Normalized to UPPERCASE + trimmed in the service layer before persistence.
   */
  @IsString({ message: 'gallaNumber must be a string' })
  @IsNotEmpty({ message: 'gallaNumber is required and cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  gallaNumber: string;

  @IsString({ message: 'category must be a string' })
  @IsNotEmpty({ message: 'category is required and cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  category: string;

  @IsString({ message: 'size must be a string' })
  @IsNotEmpty({ message: 'size is required and cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  size: string;

  @IsString({ message: 'finish must be a string' })
  @IsNotEmpty({ message: 'finish is required and cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  finish: string;

  @IsString({ message: 'color must be a string' })
  @IsNotEmpty({ message: 'color is required and cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  color: string;

  /**
   * Number of tile pieces in one complete box. Must be a positive integer >= 1.
   */
  @IsInt({ message: 'piecesPerBox must be an integer' })
  @Min(1, { message: 'piecesPerBox must be at least 1' })
  piecesPerBox: number;

  /**
   * Total area (sq.ft) covered by one complete box. Must be > 0.
   * Stored as Decimal128 to avoid floating-point precision issues.
   */
  @IsNumber({}, { message: 'areaPerBox must be a number' })
  @Min(0.001, { message: 'areaPerBox must be greater than 0' })
  areaPerBox: number;

  /** Purchase price per box (business reference value). Must be >= 0. */
  @IsNumber({}, { message: 'purchasePrice must be a number' })
  @Min(0, { message: 'purchasePrice must be 0 or greater' })
  purchasePrice: number;

  /**
   * Selling price per box (business reference value). Must be >= 0.
   * Actual order prices are snapshotted at order creation time.
   */
  @IsNumber({}, { message: 'sellingPrice must be a number' })
  @Min(0, { message: 'sellingPrice must be 0 or greater' })
  sellingPrice: number;

  /** Minimum physical piece threshold for low-stock alerts. Non-negative integer. */
  @IsInt({ message: 'minimumStockPieces must be an integer' })
  @Min(0, { message: 'minimumStockPieces must be 0 or greater' })
  @IsOptional()
  minimumStockPieces?: number;

  /** External image references (URL, publicId, alt). Not binary blobs. */
  @IsArray({ message: 'images must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ImageReferenceDto)
  @IsOptional()
  images?: ImageReferenceDto[];
}
