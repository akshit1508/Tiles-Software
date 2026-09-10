import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * UpdateCustomerDto — payload for PATCH /customers/:id.
 *
 * Requirements:
 * - fields are optional
 * - if provided, values must be trimmed and non-empty (for name/phone)
 * - isActive can be updated directly per docs/API.md ("Updates customer profile or deactivates (isActive = false)")
 */
export class UpdateCustomerDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name cannot be empty if provided' })
  @IsOptional()
  name?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'phone must be a string' })
  @IsNotEmpty({ message: 'phone cannot be empty if provided' })
  @IsOptional()
  phone?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'address must be a string' })
  @IsOptional()
  address?: string;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;
}
