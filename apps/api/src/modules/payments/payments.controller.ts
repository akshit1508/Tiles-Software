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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, ListPaymentsDto } from './dto';
import {
  PaymentResponse,
  PaginatedPaymentsResponse,
} from './interfaces';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { UserRole } from '../../common/enums';

/**
 * PaymentsController — manages financial payments against orders.
 *
 * In V1, all payment operations are restricted to the business owner (UserRole.OWNER).
 * Payments are immutable records: no PUT, PATCH, or DELETE endpoints exist.
 */
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments
   * Records a payment against an order.
   * Transaction-safe, serializes per order using __v, validates positive amount and no overpayment.
   */
  @Post()
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentResponse> {
    return this.paymentsService.create(dto, user.id);
  }

  /**
   * GET /payments
   * Returns paginated list of payment transactions with filters (orderId, customerId, paymentMethod, date range).
   */
  @Get()
  @Roles(UserRole.OWNER)
  async findAll(
    @Query() query: ListPaymentsDto,
  ): Promise<PaginatedPaymentsResponse> {
    return this.paymentsService.findAll(query);
  }

  /**
   * GET /payments/:id
   * Returns details of a specific payment including populated order and customer.
   */
  @Get(':id')
  @Roles(UserRole.OWNER)
  async findOne(@Param('id') id: string): Promise<PaymentResponse> {
    return this.paymentsService.findOne(id);
  }
}
