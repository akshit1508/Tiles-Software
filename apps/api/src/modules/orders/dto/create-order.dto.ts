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
  IsISO8601,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SalesUnit, PaymentMethod } from '../../../common/enums';

/**
 * Validates optional initial payment recorded alongside order creation.
 */
export class InitialPaymentDto {
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'amount cannot be negative' })
  amount: number;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be CASH, UPI, BANK_TRANSFER, or CHEQUE',
  })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsISO8601({}, { message: 'paymentDate must be a valid ISO8601 date string' })
  paymentDate?: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes cannot exceed 500 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;
}

/**
 * Validates individual item in an order creation request.
 * In the BOX-ONLY business model, quantity is measured in complete boxes.
 */
export class CreateOrderItemDto {
  @IsMongoId({ message: 'productId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'productId is required' })
  productId: string;

  /**
   * Sold quantity. For BOX sales, this represents the count of complete boxes.
   * Backward-compatible with existing clients and tests.
   */
  @IsOptional()
  @IsNumber({}, { message: 'salesQuantity must be a number' })
  @IsPositive({ message: 'salesQuantity must be positive' })
  @Min(0.0001, { message: 'salesQuantity must be greater than 0' })
  salesQuantity?: number;

  /**
   * Preferred explicit box quantity field for the BOX-only sales workflow.
   */
  @IsOptional()
  @IsNumber({}, { message: 'quantityBoxes must be a number' })
  @IsPositive({ message: 'quantityBoxes must be positive' })
  @Min(1, { message: 'quantityBoxes must be at least 1' })
  quantityBoxes?: number;

  /**
   * Sales unit. Defaults to BOX for the box-only tile sales workflow.
   */
  @IsOptional()
  @IsEnum(SalesUnit, { message: 'salesUnit must be BOX, PIECE, or SQ_FT' })
  salesUnit?: SalesUnit = SalesUnit.BOX;

  /**
   * Optional transaction unit price negotiated/recorded by OWNER.
   * For BOX sales, this is ₹ / BOX.
   * If omitted, backend derives it authoritatively from Product.sellingPrice.
   */
  @IsOptional()
  @IsNumber({}, { message: 'unitPrice must be a number' })
  @Min(0, { message: 'unitPrice must be non-negative' })
  unitPrice?: number;
}

/**
 * Validates order creation request.
 * In V1, the order is created directly in COMPLETED status.
 * Optionally includes an atomic initial payment (paidNow).
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

  /**
   * Optional initial payment object.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialPaymentDto)
  initialPayment?: InitialPaymentDto;

  /**
   * Optional flat paidNow field for convenient client submission.
   */
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'paidNow must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'paidNow cannot be negative' })
  paidNow?: number;

  /**
   * Optional flat paymentMethod field if paidNow is used.
   */
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be CASH, UPI, BANK_TRANSFER, or CHEQUE',
  })
  paymentMethod?: PaymentMethod;

  /**
   * Optional notes for the initial payment or order.
   */
  @IsOptional()
  @IsString({ message: 'paymentNotes must be a string' })
  @MaxLength(500, { message: 'paymentNotes cannot exceed 500 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  paymentNotes?: string;
}
