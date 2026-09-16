import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import {
  ListOutstandingCustomersDto,
  DashboardSummaryQueryDto,
} from './dto';
import {
  PaginatedOutstandingCustomersResponse,
  CustomerOutstandingDetailResponse,
  DashboardSummaryResponse,
} from './interfaces';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

/**
 * DashboardController — handles read-only Dashboard and Outstanding endpoints.
 *
 * All endpoints are strictly restricted to OWNER (UserRole.OWNER) and JWT-guarded.
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /outstanding/customers
   * Returns paginated list of customers having derived outstanding balance > 0.
   */
  @Get('outstanding/customers')
  @Roles(UserRole.OWNER)
  async getOutstandingCustomers(
    @Query() query: ListOutstandingCustomersDto,
  ): Promise<PaginatedOutstandingCustomersResponse> {
    return this.dashboardService.getOutstandingCustomers(query);
  }

  /**
   * GET /outstanding/customers/:customerId
   * Returns customer details and order-level breakdown for a customer.
   */
  @Get('outstanding/customers/:customerId')
  @Roles(UserRole.OWNER)
  async getCustomerOutstandingDetail(
    @Param('customerId') customerId: string,
  ): Promise<CustomerOutstandingDetailResponse> {
    return this.dashboardService.getCustomerOutstandingDetail(customerId);
  }

  /**
   * GET /dashboard/summary
   * Returns top-level KPIs, derived financials, and low-stock alerts.
   */
  @Get('dashboard/summary')
  @Roles(UserRole.OWNER)
  async getDashboardSummary(
    @Query() query: DashboardSummaryQueryDto,
  ): Promise<DashboardSummaryResponse> {
    return this.dashboardService.getDashboardSummary(query);
  }
}
