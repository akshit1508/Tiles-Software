import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, ListCustomersDto } from './dto';
import {
  PaginatedCustomers,
  CustomerDetailResponse,
} from './interfaces/customer.interface';
import { CustomerDocument } from './schemas/customer.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

/**
 * CustomersController — manages customer master data and business views.
 *
 * All endpoints require authentication via JwtAuthGuard.
 * Mutation endpoints (create, update, activate, deactivate) require UserRole.OWNER.
 * Query endpoints (list, get detail) are accessible to any authenticated user.
 * Customers are NEVER hard-deleted; deactivation is performed via soft delete.
 */
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * POST /customers
   * Creates a new customer master record.
   * Restricted to OWNER role.
   */
  @Post()
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCustomerDto,
  ): Promise<{ customer: CustomerDocument }> {
    const customer = await this.customersService.create(dto);
    return { customer };
  }

  /**
   * GET /customers
   * Returns paginated list of customers with derived totalOrders and outstandingBalance.
   * Supports pagination, search, and active/inactive filtering.
   */
  @Get()
  async findAll(
    @Query() query: ListCustomersDto,
  ): Promise<PaginatedCustomers> {
    return this.customersService.findAll(query);
  }

  /**
   * GET /customers/:id
   * Returns customer profile, order history, payment ledger, and derived balance.
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ): Promise<CustomerDetailResponse> {
    return this.customersService.findOne(id);
  }

  /**
   * PATCH /customers/:id
   * Partially updates mutable customer profile fields (name, phone, address, isActive).
   * Restricted to OWNER role.
   */
  @Patch(':id')
  @Roles(UserRole.OWNER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<{ customer: CustomerDocument }> {
    const customer = await this.customersService.update(id, dto);
    return { customer };
  }

  /**
   * PATCH /customers/:id/activate
   * Reactivates a deactivated customer. Returns 409 if already active.
   * Restricted to OWNER role.
   */
  @Patch(':id/activate')
  @Roles(UserRole.OWNER)
  async activate(
    @Param('id') id: string,
  ): Promise<{ customer: CustomerDocument }> {
    const customer = await this.customersService.activate(id);
    return { customer };
  }

  /**
   * PATCH /customers/:id/deactivate
   * Soft-deactivates the customer (isActive = false). Never hard-deletes.
   * Returns 409 if already inactive.
   * Restricted to OWNER role.
   */
  @Patch(':id/deactivate')
  @Roles(UserRole.OWNER)
  async deactivate(
    @Param('id') id: string,
  ): Promise<{ customer: CustomerDocument }> {
    const customer = await this.customersService.deactivate(id);
    return { customer };
  }
}
