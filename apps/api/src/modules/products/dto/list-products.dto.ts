import { IsOptional, IsInt, Min, Max, IsString, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * ListProductsDto — query parameters for GET /products.
 *
 * V1 pagination + minimal filtering only.
 * Advanced search is out of scope per the implementation plan.
 *
 * Defaults:
 *   page  = 1
 *   limit = 20
 *   isActive = true (only active products returned by default)
 */
export class ListProductsDto {
  /** Page number (1-based). */
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  @IsOptional()
  page?: number = 1;

  /** Number of products per page. Maximum 100. */
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  @IsOptional()
  limit?: number = 20;

  /** Filter by brand name (case-insensitive partial match). */
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  brand?: string;

  /** Filter by category (case-insensitive partial match). */
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  category?: string;

  /**
   * Filter by active status. Defaults to true (active products only).
   * Pass isActive=false to list deactivated products (admin use).
   */
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;
}
