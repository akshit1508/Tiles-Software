import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateGallaDto {
  @IsString({ message: 'gallaNumber must be a string' })
  @IsNotEmpty({ message: 'gallaNumber is required' })
  @MaxLength(50, { message: 'gallaNumber cannot exceed 50 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  gallaNumber: string;

  @IsString({ message: 'name must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'name cannot exceed 100 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsString({ message: 'description must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'description cannot exceed 500 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;
}
