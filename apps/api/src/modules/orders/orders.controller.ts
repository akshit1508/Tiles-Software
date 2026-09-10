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
import { OrdersService } from './orders.service';
import { CreateOrderDto, ListOrdersDto } from './dto';
import {
  OrderDetailResponse,
  PaginatedOrdersResponse,
} from './interfaces/order.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { UserRole } from '../../common/enums';

/**
 * OrdersController — manages orders and sales commands.
 *
 * In V1, all order operations are restricted to the business owner (UserRole.OWNER).
 * Orders are created directly in COMPLETED status upon sale.
 * Generic order updates are NOT supported; cancellation is via POST /orders/:id/cancel.
 */
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /orders
   * Atomically completes a sale, validates and deducts inventory,
   * generates unique order number, and creates the order in COMPLETED status.
   */
  @Post()
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderDetailResponse> {
    return this.ordersService.create(dto, user.id);
  }

  /**
   * GET /orders
   * Returns paginated list of orders with filters (status, customerId, date range, search)
   * and derived payment summaries.
   */
  @Get()
  @Roles(UserRole.OWNER)
  async findAll(
    @Query() query: ListOrdersDto,
  ): Promise<PaginatedOrdersResponse> {
    return this.ordersService.findAll(query);
  }

  /**
   * GET /orders/:id
   * Returns full order details with snapshotted line items and recorded payment history.
   */
  @Get(':id')
  @Roles(UserRole.OWNER)
  async findOne(@Param('id') id: string): Promise<OrderDetailResponse> {
    return this.ordersService.findOne(id);
  }

  /**
   * POST /orders/:id/cancel
   * Dedicated business command for order cancellation (ADR-015).
   * Restores consumed inventory via SALE_REVERSAL and sets status to CANCELLED.
   */
  @Post(':id/cancel')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderDetailResponse> {
    return this.ordersService.cancel(id, user.id);
  }
}
