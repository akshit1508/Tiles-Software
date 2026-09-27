import { IsMongoId, IsNotEmpty, IsInt, NotEquals, IsString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * AdjustmentDto — validates manual stock correction requests.
 *
 * DATABASE.md Section 36:
 * Manual physical stock corrections use signed pieces (+ or -).
 * Cannot adjust by 0 pieces.
 * Mandatory reason required.
 */
export class AdjustmentDto {
  @IsMongoId({ message: 'productId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'productId is required' })
  productId: string;

  @IsOptional()
  @IsMongoId({ message: 'gallaId must be a valid MongoDB ObjectId' })
  gallaId?: string;

  @IsInt({ message: 'physicalPieces must be an integer' })
  @NotEquals(0, { message: 'physicalPieces cannot be zero' })
  physicalPieces: number;

  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is mandatory for inventory adjustments' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason: string;
}
