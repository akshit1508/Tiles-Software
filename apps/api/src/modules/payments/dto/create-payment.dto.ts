import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  IsString,
  IsISO8601,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentMethod } from '../../../common/enums';

/**
 * CreatePaymentDto — input payload for recording a payment against an order.
 *
 * Rules:
 * - orderId is required and must be a valid Mongo ObjectId.
 * - amount must be > 0 and a valid number.
 * - paymentMethod is required and must be a valid enum (CASH | UPI | BANK_TRANSFER | CHEQUE).
 * - paymentDate is required and must be a valid ISO8601 date string.
 * - notes is optional (max 500 chars).
 * - customerId is optional: if supplied, service validates that it matches order.customerId.
 */
export class CreatePaymentDto {
  @IsMongoId({ message: 'orderId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'orderId is required' })
  orderId: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount must be a number with at most 2 decimal places' },
  )
  @IsPositive({ message: 'amount must be positive' })
  @IsNotEmpty({ message: 'amount is required' })
  amount: number;

  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be CASH, UPI, BANK_TRANSFER, or CHEQUE',
  })
  @IsNotEmpty({ message: 'paymentMethod is required' })
  paymentMethod: PaymentMethod;

  @IsISO8601({}, { message: 'paymentDate must be a valid ISO8601 date string' })
  @IsNotEmpty({ message: 'paymentDate is required' })
  paymentDate: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes cannot exceed 500 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;

  /**
   * Optional customerId.
   * If provided by the client, service validates that it strictly matches order.customerId.
   */
  @IsOptional()
  @IsMongoId({ message: 'customerId must be a valid MongoDB ObjectId' })
  customerId?: string;
}
