import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsMongoId,
  IsISO8601,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OrderStatus } from '../../../common/enums';

/**
 * ListOrdersDto — query parameters for GET /orders.
 */
export class ListOrdersDto {
  /** Page number (1-based). */
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  @IsOptional()
  page?: number = 1;

  /** Number of orders per page. Maximum 100. */
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  @IsOptional()
  limit?: number = 20;

  /** Filter by order status: COMPLETED | CANCELLED */
  @IsEnum(OrderStatus, { message: 'status must be COMPLETED or CANCELLED' })
  @IsOptional()
  status?: OrderStatus;

  /** Filter by customer MongoDB ObjectId */
  @IsMongoId({ message: 'customerId must be a valid MongoDB ObjectId' })
  @IsOptional()
  customerId?: string;

  /** Filter by order creation start date (ISO8601 format) */
  @IsISO8601({}, { message: 'startDate must be a valid ISO8601 date string' })
  @IsOptional()
  startDate?: string;

  /** Filter by order creation end date (ISO8601 format) */
  @IsISO8601({}, { message: 'endDate must be a valid ISO8601 date string' })
  @IsOptional()
  endDate?: string;

  /** Filter by search term across orderNumber or customer name/phone */
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
}
