import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryTransactionType } from '../../../common/enums';

/**
 * ListHistoryDto — query parameters for GET /inventory/:productId/history.
 *
 * Supports pagination and transaction type filtering.
 */
export class ListHistoryDto {
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  @IsOptional()
  limit?: number = 20;

  @IsEnum(InventoryTransactionType, {
    message: 'transactionType must be one of STOCK_IN, SALE, DAMAGE, ADJUSTMENT, SALE_REVERSAL',
  })
  @IsOptional()
  transactionType?: InventoryTransactionType;
}
