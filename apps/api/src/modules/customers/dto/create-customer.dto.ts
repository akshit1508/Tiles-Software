import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * CreateCustomerDto — payload for POST /customers.
 *
 * Requirements:
 * - name: string, required, non-empty after trimming
 * - phone: string, required, non-empty after trimming (non-unique per DATABASE.md)
 * - address: string, optional, trimmed
 * - isActive: controlled by server (defaults to true)
 */
export class CreateCustomerDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required and cannot be empty' })
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'phone must be a string' })
  @IsNotEmpty({ message: 'phone is required and cannot be empty' })
  phone: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'address must be a string' })
  @IsOptional()
  address?: string;
}
