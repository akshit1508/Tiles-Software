import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for querying size-wise tile stock reports.
 *
 * Rules:
 * - `size` is required and non-empty string.
 * - `availableOnly` defaults to true (only in-stock designs with boxes > 0).
 */
export class TileStockReportQueryDto {
  @IsString({ message: 'size must be a string' })
  @IsNotEmpty({ message: 'size is required' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  size: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return true;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'availableOnly must be a boolean' })
  @IsOptional()
  availableOnly?: boolean = true;
}
