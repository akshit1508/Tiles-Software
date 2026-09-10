import { IsOptional, IsInt, Min, Max, IsString, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * ListCustomersDto — query parameters for GET /customers.
 *
 * Defaults:
 *   page     = 1
 *   limit    = 20 (max 100)
 *   isActive = true (only active customers returned by default)
 */
export class ListCustomersDto {
  /** Page number (1-based). */
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  @IsOptional()
  page?: number = 1;

  /** Number of customers per page. Maximum 100. */
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  @IsOptional()
  limit?: number = 20;

  /** Filter by search term across name or phone (case-insensitive partial match). */
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;

  /**
   * Filter by active status. Defaults to true (active customers only).
   * Pass isActive=false to retrieve deactivated customers.
   */
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;
}
