import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsMongoId,
  IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../../common/enums';

/**
 * ListPaymentsDto — query parameters for GET /payments.
 */
export class ListPaymentsDto {
  /** Page number (1-based). */
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  @IsOptional()
  page?: number = 1;

  /** Number of payments per page. Maximum 100. */
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  @IsOptional()
  limit?: number = 20;

  /** Filter by referenced orderId */
  @IsMongoId({ message: 'orderId must be a valid MongoDB ObjectId' })
  @IsOptional()
  orderId?: string;

  /** Filter by referenced customerId */
  @IsMongoId({ message: 'customerId must be a valid MongoDB ObjectId' })
  @IsOptional()
  customerId?: string;

  /** Filter by paymentMethod: CASH | UPI | BANK_TRANSFER | CHEQUE */
  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be CASH, UPI, BANK_TRANSFER, or CHEQUE',
  })
  @IsOptional()
  paymentMethod?: PaymentMethod;

  /** Filter by payment date start (ISO8601 format) */
  @IsISO8601({}, { message: 'startDate must be a valid ISO8601 date string' })
  @IsOptional()
  startDate?: string;

  /** Filter by payment date end (ISO8601 format) */
  @IsISO8601({}, { message: 'endDate must be a valid ISO8601 date string' })
  @IsOptional()
  endDate?: string;
}
