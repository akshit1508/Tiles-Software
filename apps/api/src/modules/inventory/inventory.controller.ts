import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  StockInDto,
  DamageStockDto,
  AdjustmentDto,
  ListInventoryDto,
  ListHistoryDto,
} from './dto';
import {
  InventoryItemResponse,
  PaginatedInventoryResponse,
  PaginatedHistoryResponse,
} from './interfaces/inventory-details.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { UserRole } from '../../common/enums';

/**
 * InventoryController — manages tile inventory operations.
 *
 * All endpoints require authentication via JwtAuthGuard.
 * Mutation operations (stock-in, damage, adjustment) require UserRole.OWNER.
 * Read operations (list, single item, history) are accessible to any authenticated user.
 */
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * GET /inventory
   * Returns current physical stock list with derived quantities (fullBoxes,
   * loosePieces, totalSqFt) and low-stock flags (totalPieces <= minimumStockPieces).
   */
  @Get()
  async findAll(
    @Query() query: ListInventoryDto,
  ): Promise<PaginatedInventoryResponse> {
    return this.inventoryService.findAll(query);
  }

  /**
   * GET /inventory/:productId
   * Returns inventory details and derived unit values for a single product.
   */
  @Get(':productId')
  async findOne(
    @Param('productId') productId: string,
  ): Promise<{ inventory: InventoryItemResponse }> {
    const inventory = await this.inventoryService.findOneByProductId(productId);
    return { inventory };
  }

  /**
   * GET /inventory/:productId/history
   * Returns paginated history of inventory transactions for a product.
   */
  @Get(':productId/history')
  async getHistory(
    @Param('productId') productId: string,
    @Query() query: ListHistoryDto,
  ): Promise<PaginatedHistoryResponse> {
    return this.inventoryService.getHistory(productId, query);
  }

  /**
   * POST /inventory/stock-in
   * Accepts complete boxes (quantity, unit = BOX).
   * Increments totalPieces += quantity * piecesPerBox and logs STOCK_IN transaction.
   * Restricted to OWNER role.
   */
  @Post('stock-in')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async stockIn(
    @Body() dto: StockInDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ inventory: InventoryItemResponse }> {
    const inventory = await this.inventoryService.stockIn(dto, user.id);
    return { inventory };
  }

  /**
   * POST /inventory/damage
   * Records damaged physical pieces or complete boxes with a mandatory reason.
   * Decrements stock and logs a DAMAGE inventory transaction.
   * Restricted to OWNER role.
   */
  @Post('damage')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async recordDamage(
    @Body() dto: DamageStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ inventory: InventoryItemResponse }> {
    const inventory = await this.inventoryService.recordDamage(dto, user.id);
    return { inventory };
  }

  /**
   * POST /inventory/adjustment
   * Adjusts physical pieces with a mandatory reason.
   * Records an ADJUSTMENT inventory transaction (signed pieces).
   * Restricted to OWNER role.
   */
  @Post('adjustment')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async adjustStock(
    @Body() dto: AdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ inventory: InventoryItemResponse }> {
    const inventory = await this.inventoryService.adjustStock(dto, user.id);
    return { inventory };
  }
}
