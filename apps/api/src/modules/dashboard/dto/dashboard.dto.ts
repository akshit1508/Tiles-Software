import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsISO8601,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * ListOutstandingCustomersDto — query parameters for GET /outstanding/customers.
 */
export class ListOutstandingCustomersDto {
  /** Page number (1-based). */
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  @IsOptional()
  page?: number = 1;

  /** Number of customers per page. Maximum 100. */
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  @IsOptional()
  limit?: number = 20;

  /** Filter by customer name or phone */
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
}

/**
 * DashboardSummaryQueryDto — query parameters for GET /dashboard/summary.
 *
 * Date filtering semantics:
 * - startDate: inclusive start date ($gte)
 * - endDate: exclusive upper bound ($lt next day 00:00:00 UTC)
 *
 * In summary calculation:
 * - Order and Sales metrics (totalOrders, completedOrders, cancelledOrders, totalSales)
 *   are filtered by order createdAt.
 * - Payment and Collection metrics (totalCollected)
 *   are filtered by payment paymentDate.
 * - Outstanding metrics reflect orders and payments according to these authoritative business boundaries.
 */
export class DashboardSummaryQueryDto {
  /** Filter start date (ISO8601 format) */
  @IsISO8601({}, { message: 'startDate must be a valid ISO8601 date string' })
  @IsOptional()
  startDate?: string;

  /** Filter end date (ISO8601 format) */
  @IsISO8601({}, { message: 'endDate must be a valid ISO8601 date string' })
  @IsOptional()
  endDate?: string;
}
