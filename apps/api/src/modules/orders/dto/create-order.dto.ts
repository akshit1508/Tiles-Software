import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  Min,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SalesUnit } from '../../../common/enums';

/**
 * Validates individual item in an order creation request.
 */
export class CreateOrderItemDto {
  @IsMongoId({ message: 'productId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'productId is required' })
  productId: string;

  @IsNumber({}, { message: 'salesQuantity must be a number' })
  @IsPositive({ message: 'salesQuantity must be positive' })
  @Min(0.0001, { message: 'salesQuantity must be greater than 0' })
  salesQuantity: number;

  @IsEnum(SalesUnit, { message: 'salesUnit must be BOX, PIECE, or SQ_FT' })
  @IsNotEmpty({ message: 'salesUnit is required' })
  salesUnit: SalesUnit;

  /**
   * Optional transaction unit price negotiated/recorded by OWNER.
   * If omitted, the backend authoritatively derives it from Product.sellingPrice.
   */
  @IsOptional()
  @IsNumber({}, { message: 'unitPrice must be a number' })
  @Min(0, { message: 'unitPrice must be non-negative' })
  unitPrice?: number;
}

/**
 * Validates order creation request.
 * In V1, the order is created directly in COMPLETED status.
 * Client does NOT supply lineTotal, subtotal, or totalAmount.
 */
export class CreateOrderDto {
  @IsMongoId({ message: 'customerId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'customerId is required' })
  customerId: string;

  @IsArray({ message: 'items must be an array' })
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
