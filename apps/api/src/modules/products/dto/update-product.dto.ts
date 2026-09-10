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

class UpdateImageReferenceDto {
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
 * UpdateProductDto — validates fields that may be patched on an existing product.
 *
 * All fields are optional. The same validation constraints from CreateProductDto apply
 * when a field is present.
 *
 * isActive is intentionally excluded — use the dedicated
 * PATCH /products/:id/activate and PATCH /products/:id/deactivate endpoints.
 *
 * gallaNumber MAY be updated. If provided the service normalizes it (trim + uppercase)
 * and checks for collision with any OTHER existing product before persisting.
 *
 * _id, createdAt, updatedAt are ignored — the schema/Mongoose controls them.
 */
export class UpdateProductDto {
  @IsString({ message: 'brand must be a string' })
  @IsNotEmpty({ message: 'brand cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  brand?: string;

  @IsString({ message: 'productName must be a string' })
  @IsNotEmpty({ message: 'productName cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  productName?: string;

  /**
   * If updated, gallaNumber will be normalized and checked for collision with
   * any other product. MongoDB _id never changes.
   */
  @IsString({ message: 'gallaNumber must be a string' })
  @IsNotEmpty({ message: 'gallaNumber cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  gallaNumber?: string;

  @IsString({ message: 'category must be a string' })
  @IsNotEmpty({ message: 'category cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  category?: string;

  @IsString({ message: 'size must be a string' })
  @IsNotEmpty({ message: 'size cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  size?: string;

  @IsString({ message: 'finish must be a string' })
  @IsNotEmpty({ message: 'finish cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  finish?: string;

  @IsString({ message: 'color must be a string' })
  @IsNotEmpty({ message: 'color cannot be empty' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  color?: string;

  @IsInt({ message: 'piecesPerBox must be an integer' })
  @Min(1, { message: 'piecesPerBox must be at least 1' })
  @IsOptional()
  piecesPerBox?: number;

  @IsNumber({}, { message: 'areaPerBox must be a number' })
  @Min(0.001, { message: 'areaPerBox must be greater than 0' })
  @IsOptional()
  areaPerBox?: number;

  @IsNumber({}, { message: 'purchasePrice must be a number' })
  @Min(0, { message: 'purchasePrice must be 0 or greater' })
  @IsOptional()
  purchasePrice?: number;

  @IsNumber({}, { message: 'sellingPrice must be a number' })
  @Min(0, { message: 'sellingPrice must be 0 or greater' })
  @IsOptional()
  sellingPrice?: number;

  @IsInt({ message: 'minimumStockPieces must be an integer' })
  @Min(0, { message: 'minimumStockPieces must be 0 or greater' })
  @IsOptional()
  minimumStockPieces?: number;

  @IsArray({ message: 'images must be an array' })
  @ValidateNested({ each: true })
  @Type(() => UpdateImageReferenceDto)
  @IsOptional()
  images?: UpdateImageReferenceDto[];
}
