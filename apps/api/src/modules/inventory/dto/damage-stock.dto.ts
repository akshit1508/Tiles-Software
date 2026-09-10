import { IsMongoId, IsNotEmpty, IsInt, Min, IsIn, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { SalesUnit } from '../../../common/enums';

/**
 * DamageStockDto — validates damage recording requests.
 *
 * DATABASE.md Section 35:
 * Records damaged physical pieces or complete boxes with a mandatory reason.
 * Allowed units: BOX or PIECE.
 */
export class DamageStockDto {
  @IsMongoId({ message: 'productId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'productId is required' })
  productId: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity: number;

  @IsIn([SalesUnit.BOX, SalesUnit.PIECE], {
    message: 'unit must be either BOX or PIECE for damaged stock',
  })
  @IsNotEmpty({ message: 'unit is required' })
  unit: SalesUnit.BOX | SalesUnit.PIECE;

  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is mandatory for damaged stock' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason: string;
}
