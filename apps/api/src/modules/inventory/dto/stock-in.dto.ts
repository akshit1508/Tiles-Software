import { IsMongoId, IsNotEmpty, IsInt, Min, IsIn, IsOptional } from 'class-validator';
import { SalesUnit } from '../../../common/enums';

/**
 * StockInDto — validates incoming stock-in requests.
 *
 * DATABASE.md Section 11:
 * Stock arrives exclusively in complete boxes.
 * Accepts quantity (boxes) and unit = BOX.
 * physicalPieces = quantity * piecesPerBox.
 */
export class StockInDto {
  @IsMongoId({ message: 'productId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'productId is required' })
  productId: string;

  /** Target physical storage location / Galla to receive the stock */
  @IsMongoId({ message: 'gallaId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'Target Galla (gallaId) is required for stock-in operations' })
  gallaId: string;

  @IsOptional()
  gallaNumber?: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1 box' })
  quantity: number;

  @IsIn([SalesUnit.BOX], { message: 'unit must be BOX for stock-in' })
  @IsNotEmpty({ message: 'unit is required' })
  unit: SalesUnit.BOX;
}
