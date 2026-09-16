/**
 * Dashboard & Outstanding Module Unit Tests
 *
 * Exhaustive unit tests for DashboardService and DashboardController in isolation using Jest mocks.
 * Zero external MongoDB connection required.
 */

import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Customer } from '../customers/schemas/customer.schema';
import { Order } from '../orders/schemas/order.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { Product } from '../products/schemas/product.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { OrderStatus, UserRole, PaymentMethod } from '../../common/enums';
import {
  ListOutstandingCustomersDto,
  DashboardSummaryQueryDto,
} from './dto';

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers & Mock Factories
// ─────────────────────────────────────────────────────────────────────────────

function makeObjectId(): Types.ObjectId {
  return new Types.ObjectId();
}

function makeCustomer(overrides: Record<string, unknown> = {}) {
  const id = makeObjectId();
  return {
    _id: id,
    name: 'Sharma Builders',
    phone: '+91 98765 43210',
    address: '123 MG Road, Jaipur',
    isActive: true,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  const id = makeObjectId();
  const customerId = makeObjectId();
  return {
    _id: id,
    orderNumber: 'GT-20260910-0001',
    customerId,
    items: [],
    subtotal: Types.Decimal128.fromString('1000.00'),
    totalAmount: Types.Decimal128.fromString('1000.00'),
    status: OrderStatus.COMPLETED,
    createdBy: makeObjectId(),
    createdAt: new Date('2026-09-10T10:00:00Z'),
    updatedAt: new Date('2026-09-10T10:00:00Z'),
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  const id = makeObjectId();
  const orderId = makeObjectId();
  const customerId = makeObjectId();
  return {
    _id: id,
    orderId,
    customerId,
    amount: Types.Decimal128.fromString('500.00'),
    paymentMethod: PaymentMethod.CASH,
    paymentDate: new Date('2026-09-10T11:00:00Z'),
    notes: 'Advance payment',
    createdBy: makeObjectId(),
    createdAt: new Date('2026-09-10T11:00:00Z'),
    ...overrides,
  };
}

describe('Dashboard & Outstanding Module Unit Tests', () => {
  let service: DashboardService;
  let controller: DashboardController;

  let customerModel: any;
  let orderModel: any;
  let paymentModel: any;
  let productModel: any;
  let inventoryModel: any;

  const mockQuery = (resolvedValue: any) => {
    const q: any = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(resolvedValue),
    };
    return q;
  };

  beforeEach(async () => {
    customerModel = {
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
    };

    orderModel = {
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };

    paymentModel = {
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };

    productModel = {
      countDocuments: jest.fn(),
    };

    inventoryModel = {
      aggregate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        { provide: getModelToken(Customer.name), useValue: customerModel },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: getModelToken(Product.name), useValue: productModel },
        { provide: getModelToken(Inventory.name), useValue: inventoryModel },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    controller = module.get<DashboardController>(DashboardController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. DTO Validation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('DTO Validation', () => {
    it('validates ListOutstandingCustomersDto defaults and constraints', async () => {
      const dto = plainToInstance(ListOutstandingCustomersDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);

      const invalidDto = plainToInstance(ListOutstandingCustomersDto, {
        page: 0,
        limit: 150,
      });
      const invalidErrors = await validate(invalidDto);
      expect(invalidErrors.some((e) => e.property === 'page')).toBe(true);
      expect(invalidErrors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('validates DashboardSummaryQueryDto with valid and invalid ISO dates', async () => {
      const validDto = plainToInstance(DashboardSummaryQueryDto, {
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-10T00:00:00.000Z',
      });
      const validErrors = await validate(validDto);
      expect(validErrors.length).toBe(0);

      const invalidDto = plainToInstance(DashboardSummaryQueryDto, {
        startDate: 'invalid-date',
      });
      const invalidErrors = await validate(invalidDto);
      expect(invalidErrors.some((e) => e.property === 'startDate')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Outstanding Customers List (getOutstandingCustomers)
  // ─────────────────────────────────────────────────────────────────────────

  describe('DashboardService.getOutstandingCustomers', () => {
    it('1. Customer with no orders is excluded from outstanding list', async () => {
      const cust = makeCustomer();
      customerModel.find.mockReturnValue(mockQuery([cust]));
      orderModel.find.mockReturnValue(mockQuery([]));
      paymentModel.find.mockReturnValue(mockQuery([]));

      const result = await service.getOutstandingCustomers({});
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('2. Customer with completed order and no payment appears with full order total as outstanding', async () => {
      const cust = makeCustomer();
      const order = makeOrder({
        customerId: cust._id,
        totalAmount: Types.Decimal128.fromString('15000.00'),
        status: OrderStatus.COMPLETED,
      });

      customerModel.find.mockReturnValue(mockQuery([cust]));
      orderModel.find.mockReturnValue(mockQuery([order]));
      paymentModel.find.mockReturnValue(mockQuery([]));

      const result = await service.getOutstandingCustomers({});
      expect(result.data.length).toBe(1);
      expect(result.data[0].customerId).toBe(cust._id.toString());
      expect(result.data[0].totalSales).toBe(15000);
      expect(result.data[0].totalPaid).toBe(0);
      expect(result.data[0].outstanding).toBe(15000);
    });

    it('3. Customer with partially paid order has correct derived outstanding', async () => {
      const cust = makeCustomer();
      const order = makeOrder({
        customerId: cust._id,
        totalAmount: Types.Decimal128.fromString('20000.00'),
        status: OrderStatus.COMPLETED,
      });
      const payment = makePayment({
        customerId: cust._id,
        orderId: order._id,
        amount: Types.Decimal128.fromString('7500.00'),
      });

      customerModel.find.mockReturnValue(mockQuery([cust]));
      orderModel.find.mockReturnValue(mockQuery([order]));
      paymentModel.find.mockReturnValue(mockQuery([payment]));

      const result = await service.getOutstandingCustomers({});
      expect(result.data.length).toBe(1);
      expect(result.data[0].totalSales).toBe(20000);
      expect(result.data[0].totalPaid).toBe(7500);
      expect(result.data[0].outstanding).toBe(12500);
    });

    it('4. Customer with fully paid order is excluded from outstanding list (outstanding == 0)', async () => {
      const cust = makeCustomer();
      const order = makeOrder({
        customerId: cust._id,
        totalAmount: Types.Decimal128.fromString('5000.00'),
        status: OrderStatus.COMPLETED,
      });
      const payment = makePayment({
        customerId: cust._id,
        orderId: order._id,
        amount: Types.Decimal128.fromString('5000.00'),
      });

      customerModel.find.mockReturnValue(mockQuery([cust]));
      orderModel.find.mockReturnValue(mockQuery([order]));
      paymentModel.find.mockReturnValue(mockQuery([payment]));

      const result = await service.getOutstandingCustomers({});
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('5. Multiple completed orders for same customer aggregate accurately', async () => {
      const cust = makeCustomer();
      const o1 = makeOrder({
        customerId: cust._id,
        totalAmount: Types.Decimal128.fromString('10000.00'),
      });
      const o2 = makeOrder({
        customerId: cust._id,
        totalAmount: Types.Decimal128.fromString('5000.00'),
      });
      const p1 = makePayment({
        customerId: cust._id,
        orderId: o1._id,
        amount: Types.Decimal128.fromString('4000.00'),
      });

      customerModel.find.mockReturnValue(mockQuery([cust]));
      orderModel.find.mockReturnValue(mockQuery([o1, o2]));
      paymentModel.find.mockReturnValue(mockQuery([p1]));

      const result = await service.getOutstandingCustomers({});
      expect(result.data.length).toBe(1);
      expect(result.data[0].totalSales).toBe(15000);
      expect(result.data[0].totalPaid).toBe(4000);
      expect(result.data[0].outstanding).toBe(11000);
    });

    it('6. Cancelled orders are excluded from completed orders and contribute zero outstanding', async () => {
      const cust = makeCustomer();
      // Service queries orderModel.find with { status: OrderStatus.COMPLETED }
      customerModel.find.mockReturnValue(mockQuery([cust]));
      orderModel.find.mockReturnValue(mockQuery([])); // Cancelled order is not returned by query
      paymentModel.find.mockReturnValue(mockQuery([]));

      const result = await service.getOutstandingCustomers({});
      expect(orderModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: OrderStatus.COMPLETED,
        }),
      );
      expect(result.data.length).toBe(0);
    });

    it('7. Deactivated customer (isActive = false) still appears in outstanding list if balance exists', async () => {
      const inactiveCust = makeCustomer({ isActive: false });
      const order = makeOrder({
        customerId: inactiveCust._id,
        totalAmount: Types.Decimal128.fromString('8000.00'),
      });

      customerModel.find.mockReturnValue(mockQuery([inactiveCust]));
      orderModel.find.mockReturnValue(mockQuery([order]));
      paymentModel.find.mockReturnValue(mockQuery([]));

      const result = await service.getOutstandingCustomers({});
      expect(result.data.length).toBe(1);
      expect(result.data[0].customerId).toBe(inactiveCust._id.toString());
      expect(result.data[0].isActive).toBe(false);
      expect(result.data[0].outstanding).toBe(8000);
    });

    it('8. Customer outstanding calculation uses paise-safe money arithmetic avoiding float drift', async () => {
      const cust = makeCustomer();
      const order = makeOrder({
        customerId: cust._id,
        totalAmount: Types.Decimal128.fromString('100.50'),
      });
      const p1 = makePayment({
        customerId: cust._id,
        orderId: order._id,
        amount: Types.Decimal128.fromString('33.30'),
      });
      const p2 = makePayment({
        customerId: cust._id,
        orderId: order._id,
        amount: Types.Decimal128.fromString('33.10'),
      });

      customerModel.find.mockReturnValue(mockQuery([cust]));
      orderModel.find.mockReturnValue(mockQuery([order]));
      paymentModel.find.mockReturnValue(mockQuery([p1, p2]));

      const result = await service.getOutstandingCustomers({});
      expect(result.data.length).toBe(1);
      // 100.50 - 66.40 = 34.10 exactly
      expect(result.data[0].outstanding).toBe(34.1);
    });

    it('9. Pagination and search filtering work correctly', async () => {
      const cust1 = makeCustomer({ name: 'Rahul Builders' });
      const cust2 = makeCustomer({ name: 'Rohit Enterprises' });

      customerModel.find.mockReturnValue(mockQuery([cust1, cust2]));

      const o1 = makeOrder({
        customerId: cust1._id,
        totalAmount: Types.Decimal128.fromString('1000.00'),
      });
      const o2 = makeOrder({
        customerId: cust2._id,
        totalAmount: Types.Decimal128.fromString('2000.00'),
      });

      orderModel.find.mockReturnValue(mockQuery([o1, o2]));
      paymentModel.find.mockReturnValue(mockQuery([]));

      const result = await service.getOutstandingCustomers({
        search: 'Rohit',
        page: 1,
        limit: 1,
      });

      expect(customerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { name: { $regex: 'Rohit', $options: 'i' } },
            { phone: { $regex: 'Rohit', $options: 'i' } },
          ],
        }),
      );
      expect(result.limit).toBe(1);
      expect(result.page).toBe(1);
      expect(result.total).toBe(2);
      expect(result.data.length).toBe(1);
      // Sorted descending by outstanding: Rohit (2000) first
      expect(result.data[0].customerId).toBe(cust2._id.toString());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Customer Outstanding Detail (getCustomerOutstandingDetail)
  // ─────────────────────────────────────────────────────────────────────────

  describe('DashboardService.getCustomerOutstandingDetail', () => {
    it('throws NotFoundException if customer does not exist', async () => {
      customerModel.findById.mockReturnValue(mockQuery(null));

      await expect(
        service.getCustomerOutstandingDetail(makeObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns complete breakdown with order-level details and excludes cancelled orders from outstanding', async () => {
      const cust = makeCustomer();
      customerModel.findById.mockReturnValue(mockQuery(cust));

      const o1 = makeOrder({
        customerId: cust._id,
        status: OrderStatus.COMPLETED,
        totalAmount: Types.Decimal128.fromString('25000.00'),
      });
      const o2 = makeOrder({
        customerId: cust._id,
        status: OrderStatus.CANCELLED,
        totalAmount: Types.Decimal128.fromString('10000.00'),
      });

      orderModel.find.mockReturnValue(mockQuery([o1, o2]));

      const p1 = makePayment({
        customerId: cust._id,
        orderId: o1._id,
        amount: Types.Decimal128.fromString('10000.00'),
      });

      paymentModel.find.mockReturnValue(mockQuery([p1]));

      const result = await service.getCustomerOutstandingDetail(
        cust._id.toString(),
      );

      expect(result.customer._id).toBe(cust._id.toString());
      expect(result.totalCompletedSales).toBe(25000);
      expect(result.totalPaid).toBe(10000);
      expect(result.outstanding).toBe(15000);
      expect(result.orders.length).toBe(2);

      const ord1 = result.orders.find((o) => o.orderId === o1._id.toString());
      expect(ord1?.outstanding).toBe(15000);
      expect(ord1?.paidAmount).toBe(10000);

      const ord2 = result.orders.find((o) => o.orderId === o2._id.toString());
      expect(ord2?.outstanding).toBe(0); // Cancelled order outstanding = 0
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Dashboard Summary (getDashboardSummary)
  // ─────────────────────────────────────────────────────────────────────────

  describe('DashboardService.getDashboardSummary', () => {
    it('returns all top-level KPIs, derived financials, and low-stock alerts', async () => {
      productModel.countDocuments
        .mockReturnValueOnce(mockQuery(150)) // totalProducts
        .mockReturnValueOnce(mockQuery(140)); // activeProducts

      customerModel.countDocuments
        .mockReturnValueOnce(mockQuery(50)) // totalCustomers
        .mockReturnValueOnce(mockQuery(45)); // activeCustomers

      orderModel.aggregate
        .mockReturnValueOnce(
          mockQuery([
            { _id: OrderStatus.COMPLETED, count: 80, totalAmountSum: 500000 },
            { _id: OrderStatus.CANCELLED, count: 5, totalAmountSum: 25000 },
          ]),
        )
        .mockReturnValueOnce(
          mockQuery([
            {
              _id: makeObjectId(),
              totalAmountDouble: 500000,
              paidTotalDouble: 350000,
            },
          ]),
        );

      paymentModel.aggregate.mockReturnValue(
        mockQuery([{ _id: null, totalCollected: 350000 }]),
      );

      inventoryModel.aggregate.mockReturnValue(
        mockQuery([
          {
            productId: makeObjectId(),
            productName: 'Kajaria White 600x600',
            brand: 'Kajaria',
            currentPieces: 10,
            minimumStockPieces: 20,
          },
        ]),
      );

      const summary = await service.getDashboardSummary({});

      expect(summary.totalProducts).toBe(150);
      expect(summary.activeProducts).toBe(140);
      expect(summary.totalCustomers).toBe(50);
      expect(summary.activeCustomers).toBe(45);
      expect(summary.totalOrders).toBe(85);
      expect(summary.completedOrders).toBe(80);
      expect(summary.cancelledOrders).toBe(5);
      expect(summary.totalSales).toBe(500000);
      expect(summary.totalCollected).toBe(350000);
      expect(summary.totalOutstanding).toBe(150000); // 500k - 350k
      expect(summary.lowStock.totalLowStockProducts).toBe(1);
      expect(summary.lowStock.items[0].productName).toBe(
        'Kajaria White 600x600',
      );
    });

    it('filters dashboard metrics with date range using exclusive upper bound ($lt next day)', async () => {
      productModel.countDocuments.mockReturnValue(mockQuery(10));
      customerModel.countDocuments.mockReturnValue(mockQuery(10));
      orderModel.aggregate.mockReturnValue(mockQuery([]));
      paymentModel.aggregate.mockReturnValue(mockQuery([]));
      inventoryModel.aggregate.mockReturnValue(mockQuery([]));

      const query: DashboardSummaryQueryDto = {
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-10',
      };

      const summary = await service.getDashboardSummary(query);

      // Verify orderModel aggregation received createdAt filter with exclusive next day
      expect(orderModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $match: {
              createdAt: {
                $gte: new Date('2026-09-01T00:00:00.000Z'),
                $lt: new Date('2026-09-11T00:00:00.000Z'),
              },
            },
          },
        ]),
      );

      // Verify paymentModel aggregation received paymentDate filter
      expect(paymentModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $match: {
              paymentDate: {
                $gte: new Date('2026-09-01T00:00:00.000Z'),
                $lt: new Date('2026-09-11T00:00:00.000Z'),
              },
            },
          },
        ]),
      );

      expect(summary.dateFilter).toBeDefined();
      expect(summary.dateFilter?.salesFilteredBy).toBe('order.createdAt');
      expect(summary.dateFilter?.collectedFilteredBy).toBe(
        'payment.paymentDate',
      );
    });

    it('regression: order created Sept 1 (₹10,000) paid Sept 10 (₹10,000), filter Sept 1-5 correctly shows totalOutstanding = 0', async () => {
      productModel.countDocuments.mockReturnValue(mockQuery(5));
      customerModel.countDocuments.mockReturnValue(mockQuery(5));

      // Order created Sept 1 falls inside Sept 1-5 date filter
      orderModel.aggregate
        .mockReturnValueOnce(
          mockQuery([
            { _id: OrderStatus.COMPLETED, count: 1, totalAmountSum: 10000 },
          ]),
        )
        // Completed orders pipeline looks up all payments for this order (including payment on Sept 10)
        .mockReturnValueOnce(
          mockQuery([
            {
              _id: makeObjectId(),
              totalAmountDouble: 10000,
              paidTotalDouble: 10000,
            },
          ]),
        );

      // Payment collected Sept 10 falls OUTSIDE Sept 1-5 filter, so totalCollected in window is 0
      paymentModel.aggregate.mockReturnValue(mockQuery([]));
      inventoryModel.aggregate.mockReturnValue(mockQuery([]));

      const query: DashboardSummaryQueryDto = {
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-05T00:00:00.000Z',
      };

      const summary = await service.getDashboardSummary(query);

      // Sales in period: ₹10,000
      expect(summary.totalSales).toBe(10000);
      // Collections in period: ₹0 (since payment was made Sept 10)
      expect(summary.totalCollected).toBe(0);
      // REAL Outstanding for the matching order: ₹0 (not ₹10,000, because the order was fully paid!)
      expect(summary.totalOutstanding).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Controller Roles & Guards
  // ─────────────────────────────────────────────────────────────────────────

  describe('DashboardController', () => {
    it('enforces OWNER role on all dashboard and outstanding endpoints', () => {
      const reflector = new Reflector();

      const getOutstandingRoles = reflector.get<string[]>(
        ROLES_KEY,
        controller.getOutstandingCustomers,
      );
      expect(getOutstandingRoles).toEqual([UserRole.OWNER]);

      const getDetailRoles = reflector.get<string[]>(
        ROLES_KEY,
        controller.getCustomerOutstandingDetail,
      );
      expect(getDetailRoles).toEqual([UserRole.OWNER]);

      const getDashboardRoles = reflector.get<string[]>(
        ROLES_KEY,
        controller.getDashboardSummary,
      );
      expect(getDashboardRoles).toEqual([UserRole.OWNER]);
    });
  });
});
