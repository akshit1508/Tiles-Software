/**
 * Customers Module Unit Tests
 *
 * Tests CustomersService and CustomersController in isolation using Jest mocks.
 * No real MongoDB connection required.
 */

import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Customer } from './schemas/customer.schema';
import { Order } from '../orders/schemas/order.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole, OrderStatus, PaymentMethod } from '../../common/enums';
import { CreateCustomerDto, UpdateCustomerDto, ListCustomersDto } from './dto';

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers & Mock Factories
// ─────────────────────────────────────────────────────────────────────────────

function makeCustomerId(): Types.ObjectId {
  return new Types.ObjectId();
}

function makeCustomer(
  overrides: Record<string, unknown> = {},
): any {
  const id = makeCustomerId();
  return {
    _id: id,
    name: 'Sharma Builders',
    phone: '+91 98765 43210',
    address: '123 MG Road, Jaipur',
    isActive: true,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    save: jest
      .fn()
      .mockImplementation(function (this: Record<string, unknown>) {
        return Promise.resolve(this);
      }),
    ...overrides,
  };
}

function makeOrder(
  overrides: Record<string, unknown> = {},
): any {
  return {
    _id: new Types.ObjectId(),
    orderNumber: 'GT-20260101-0001',
    customerId: makeCustomerId(),
    status: OrderStatus.COMPLETED,
    totalAmount: Types.Decimal128.fromString('50000.00'),
    createdAt: new Date('2026-01-02T10:00:00Z'),
    ...overrides,
  };
}

function makePayment(
  overrides: Record<string, unknown> = {},
): any {
  return {
    _id: new Types.ObjectId(),
    orderId: new Types.ObjectId(),
    customerId: makeCustomerId(),
    amount: Types.Decimal128.fromString('20000.00'),
    paymentMethod: PaymentMethod.CASH,
    paymentDate: new Date('2026-01-03T10:00:00Z'),
    notes: 'Initial token advance',
    createdAt: new Date('2026-01-03T10:00:00Z'),
    ...overrides,
  };
}

describe('Customers Module Unit Tests', () => {
  let service: CustomersService;
  let controller: CustomersController;
  let customerModel: {
    create: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    countDocuments: jest.Mock;
  };
  let orderModel: {
    find: jest.Mock;
  };
  let paymentModel: {
    find: jest.Mock;
  };

  beforeEach(async () => {
    customerModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
    };

    orderModel = {
      find: jest.fn(),
    };

    paymentModel = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        CustomersService,
        { provide: getModelToken(Customer.name), useValue: customerModel },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<CustomersService>(CustomersService);
    controller = module.get<CustomersController>(CustomersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. DTO Validation Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('DTO Validation', () => {
    it('1.1 validates CreateCustomerDto successfully with valid data', async () => {
      const dto = plainToInstance(CreateCustomerDto, {
        name: ' Ramesh Kumar ',
        phone: ' +91 99999 88888 ',
        address: ' Jaipur, Rajasthan ',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.name).toBe('Ramesh Kumar');
      expect(dto.phone).toBe('+91 99999 88888');
      expect(dto.address).toBe('Jaipur, Rajasthan');
    });

    it('1.2 rejects CreateCustomerDto when name is missing or empty', async () => {
      const dto = plainToInstance(CreateCustomerDto, {
        phone: '9876543210',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);

      const emptyNameDto = plainToInstance(CreateCustomerDto, {
        name: '   ',
        phone: '9876543210',
      });
      const emptyErrors = await validate(emptyNameDto);
      expect(emptyErrors.some((e) => e.property === 'name')).toBe(true);
    });

    it('1.3 rejects CreateCustomerDto when phone is missing or empty', async () => {
      const dto = plainToInstance(CreateCustomerDto, {
        name: 'Ramesh',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'phone')).toBe(true);

      const emptyPhoneDto = plainToInstance(CreateCustomerDto, {
        name: 'Ramesh',
        phone: '   ',
      });
      const emptyErrors = await validate(emptyPhoneDto);
      expect(emptyErrors.some((e) => e.property === 'phone')).toBe(true);
    });

    it('1.4 allows optional address to be omitted in CreateCustomerDto', async () => {
      const dto = plainToInstance(CreateCustomerDto, {
        name: 'Ramesh',
        phone: '9876543210',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('1.5 validates UpdateCustomerDto with partial fields', async () => {
      const dto = plainToInstance(UpdateCustomerDto, {
        name: ' Updated Name ',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.name).toBe('Updated Name');
    });

    it('1.6 rejects empty strings in UpdateCustomerDto fields', async () => {
      const dto = plainToInstance(UpdateCustomerDto, {
        name: '   ',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('1.7 validates ListCustomersDto with valid query parameters', async () => {
      const dto = plainToInstance(ListCustomersDto, {
        page: '2',
        limit: '50',
        search: ' Sharma ',
        isActive: 'true',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(50);
      expect(dto.search).toBe('Sharma');
      expect(dto.isActive).toBe(true);
    });

    it('1.8 rejects invalid pagination in ListCustomersDto (limit > 100, page < 1)', async () => {
      const dto = plainToInstance(ListCustomersDto, {
        page: '0',
        limit: '150',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'page')).toBe(true);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('1.9 rejects non-boolean isActive strings in ListCustomersDto (e.g. invalid, abc)', async () => {
      const invalidDto = plainToInstance(ListCustomersDto, {
        isActive: 'invalid',
      });
      const errors = await validate(invalidDto);
      expect(errors.some((e) => e.property === 'isActive')).toBe(true);
      expect(
        errors.find((e) => e.property === 'isActive')?.constraints,
      ).toHaveProperty('isBoolean');

      const abcDto = plainToInstance(ListCustomersDto, {
        isActive: 'abc',
      });
      const abcErrors = await validate(abcDto);
      expect(abcErrors.some((e) => e.property === 'isActive')).toBe(true);
    });

    it('1.10 validates UpdateCustomerDto with boolean isActive and rejects invalid isActive', async () => {
      const validFalse = plainToInstance(UpdateCustomerDto, {
        isActive: false,
      });
      expect(await validate(validFalse)).toHaveLength(0);

      const validTrue = plainToInstance(UpdateCustomerDto, {
        isActive: true,
      });
      expect(await validate(validTrue)).toHaveLength(0);

      const invalid = plainToInstance(UpdateCustomerDto, {
        isActive: 'not-a-boolean',
      });
      const errors = await validate(invalid);
      expect(errors.some((e) => e.property === 'isActive')).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Authorization & Controller Route Guards
  // ───────────────────────────────────────────────────────────────────────────
  describe('Authorization & Controller Guarding', () => {
    it('2.1 has JwtAuthGuard and RolesGuard applied to controller', () => {
      const guards = Reflect.getMetadata('__guards__', CustomersController);
      expect(guards).toBeDefined();
      expect(guards.length).toBe(2);
    });

    it('2.2 requires UserRole.OWNER for mutation routes (create, update, activate, deactivate)', () => {
      const reflector = new Reflector();

      const createRoles = reflector.get<UserRole[]>(
        ROLES_KEY,
        CustomersController.prototype.create,
      );
      expect(createRoles).toEqual([UserRole.OWNER]);

      const updateRoles = reflector.get<UserRole[]>(
        ROLES_KEY,
        CustomersController.prototype.update,
      );
      expect(updateRoles).toEqual([UserRole.OWNER]);

      const activateRoles = reflector.get<UserRole[]>(
        ROLES_KEY,
        CustomersController.prototype.activate,
      );
      expect(activateRoles).toEqual([UserRole.OWNER]);

      const deactivateRoles = reflector.get<UserRole[]>(
        ROLES_KEY,
        CustomersController.prototype.deactivate,
      );
      expect(deactivateRoles).toEqual([UserRole.OWNER]);
    });

    it('2.3 does not restrict read routes (findAll, findOne) to OWNER role', () => {
      const reflector = new Reflector();

      const findAllRoles = reflector.get<UserRole[]>(
        ROLES_KEY,
        CustomersController.prototype.findAll,
      );
      expect(findAllRoles).toBeUndefined();

      const findOneRoles = reflector.get<UserRole[]>(
        ROLES_KEY,
        CustomersController.prototype.findOne,
      );
      expect(findOneRoles).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Customer Creation
  // ───────────────────────────────────────────────────────────────────────────
  describe('CustomersService.create', () => {
    it('3.1 creates a customer successfully with isActive = true', async () => {
      const mockCreated = makeCustomer({
        name: 'Gupta Enterprises',
        phone: '9829012345',
        address: 'Tonk Road, Jaipur',
      });
      customerModel.create.mockResolvedValue(mockCreated);

      const result = await service.create({
        name: '  Gupta Enterprises  ',
        phone: '  9829012345  ',
        address: '  Tonk Road, Jaipur  ',
      });

      expect(customerModel.create).toHaveBeenCalledWith({
        name: 'Gupta Enterprises',
        phone: '9829012345',
        address: 'Tonk Road, Jaipur',
        isActive: true,
      });
      expect(result.name).toBe('Gupta Enterprises');
      expect(result.isActive).toBe(true);
    });

    it('3.2 allows duplicate-looking phone numbers because phone is non-unique in V1', async () => {
      const mock1 = makeCustomer({ phone: '9829012345' });
      customerModel.create.mockResolvedValue(mock1);

      const result = await service.create({
        name: 'Second Customer Same Phone',
        phone: '9829012345',
      });

      expect(result).toBeDefined();
      expect(result.phone).toBe('9829012345');
    });

    it('3.3 delegating create through controller returns { customer }', async () => {
      const mockCreated = makeCustomer();
      customerModel.create.mockResolvedValue(mockCreated);

      const response = await controller.create({
        name: 'Sharma Builders',
        phone: '9876543210',
      });

      expect(response).toHaveProperty('customer');
      expect(response.customer._id).toEqual(mockCreated._id);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. List Customers (findAll) with Derived Totals
  // ───────────────────────────────────────────────────────────────────────────
  describe('CustomersService.findAll', () => {
    it('4.1 returns paginated customers with default isActive=true and derived metrics', async () => {
      const cust1 = makeCustomer({ name: 'Customer 1' });
      const cust2 = makeCustomer({ name: 'Customer 2' });

      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([cust1, cust2]),
      };
      customerModel.find.mockReturnValue(mockQuery);
      customerModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });

      // Orders for cust1: 1 COMPLETED (50,000), cust2: 1 COMPLETED (30,000), 1 CANCELLED (20,000)
      const order1Cust1 = makeOrder({
        _id: new Types.ObjectId(),
        customerId: cust1._id,
        status: OrderStatus.COMPLETED,
        totalAmount: Types.Decimal128.fromString('50000.00'),
      });
      const order2Cust2 = makeOrder({
        _id: new Types.ObjectId(),
        customerId: cust2._id,
        status: OrderStatus.COMPLETED,
        totalAmount: Types.Decimal128.fromString('30000.00'),
      });
      const cancelledCust2 = makeOrder({
        _id: new Types.ObjectId(),
        customerId: cust2._id,
        status: OrderStatus.CANCELLED,
        totalAmount: Types.Decimal128.fromString('20000.00'),
      });

      orderModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([order1Cust1, order2Cust2, cancelledCust2]),
      });

      // Payments: 20,000 for order1Cust1
      const payment1Cust1 = makePayment({
        customerId: cust1._id,
        orderId: order1Cust1._id,
        amount: Types.Decimal128.fromString('20000.00'),
      });
      paymentModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([payment1Cust1]),
      });

      const result = await service.findAll({});

      expect(customerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data.length).toBe(2);

      // cust1: 1 order, 50,000 - 20,000 = 30,000 outstanding
      const res1 = result.data.find((c) => c._id === cust1._id.toString());
      expect(res1?.totalOrders).toBe(1);
      expect(res1?.outstandingBalance).toBe(30000);

      // cust2: 2 total orders (1 completed, 1 cancelled), outstanding = 30,000 (cancelled does not add)
      const res2 = result.data.find((c) => c._id === cust2._id.toString());
      expect(res2?.totalOrders).toBe(2);
      expect(res2?.outstandingBalance).toBe(30000);
    });

    it('4.2 filters by search term across name and phone', async () => {
      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      customerModel.find.mockReturnValue(mockQuery);
      customerModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({ search: '9829' });

      expect(customerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { name: { $regex: '9829', $options: 'i' } },
            { phone: { $regex: '9829', $options: 'i' } },
          ],
        }),
      );
    });

    it('4.3 allows explicit retrieval of inactive customers when isActive=false', async () => {
      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      customerModel.find.mockReturnValue(mockQuery);
      customerModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({ isActive: false });

      expect(customerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('4.4 returns 0 orders and 0 outstanding when customer has no orders', async () => {
      const cust = makeCustomer();
      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([cust]),
      };
      customerModel.find.mockReturnValue(mockQuery);
      customerModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      orderModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      paymentModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findAll({});
      expect(result.data[0].totalOrders).toBe(0);
      expect(result.data[0].outstandingBalance).toBe(0);
    });

    it('4.5 correctly derives negative outstanding for an overpaid completed order without clamping to zero', async () => {
      const cust = makeCustomer();
      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([cust]),
      };
      customerModel.find.mockReturnValue(mockQuery);
      customerModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const order1 = makeOrder({
        _id: new Types.ObjectId(),
        customerId: cust._id,
        status: OrderStatus.COMPLETED,
        totalAmount: Types.Decimal128.fromString('40000.00'),
      });

      orderModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([order1]),
      });

      const overpayment = makePayment({
        customerId: cust._id,
        orderId: order1._id,
        amount: Types.Decimal128.fromString('50000.00'),
      });

      paymentModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([overpayment]),
      });

      const result = await service.findAll({});
      expect(result.data[0].totalOrders).toBe(1);
      expect(result.data[0].outstandingBalance).toBe(-10000);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Customer Detail (findOne)
  // ───────────────────────────────────────────────────────────────────────────
  describe('CustomersService.findOne', () => {
    it('5.1 returns complete customer detail with order history and payment ledger', async () => {
      const cust = makeCustomer();
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(cust),
      });

      const order1 = makeOrder({
        _id: new Types.ObjectId(),
        orderNumber: 'GT-20260101-0001',
        customerId: cust._id,
        status: OrderStatus.COMPLETED,
        totalAmount: Types.Decimal128.fromString('45000.00'),
      });
      const order2 = makeOrder({
        _id: new Types.ObjectId(),
        orderNumber: 'GT-20260102-0002',
        customerId: cust._id,
        status: OrderStatus.CANCELLED,
        totalAmount: Types.Decimal128.fromString('15000.00'),
      });

      orderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([order1, order2]),
      });

      const payment1 = makePayment({
        _id: new Types.ObjectId(),
        customerId: cust._id,
        orderId: order1._id,
        amount: Types.Decimal128.fromString('20000.00'),
      });

      paymentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([payment1]),
      });

      const result = await service.findOne(cust._id.toString());

      expect(result.customer._id).toEqual(cust._id);
      expect(result.totalOrders).toBe(2);
      // Outstanding: only completed order (45,000 - 20,000 = 25,000)
      expect(result.outstandingBalance).toBe(25000);
      expect(result.orders.length).toBe(2);
      expect(result.payments.length).toBe(1);

      // Verify order 1 derived values
      const o1 = result.orders.find((o) => o._id === order1._id.toString());
      expect(o1?.paidAmount).toBe(20000);
      expect(o1?.outstandingAmount).toBe(25000);

      // Verify cancelled order 2 has 0 outstanding
      const o2 = result.orders.find((o) => o._id === order2._id.toString());
      expect(o2?.outstandingAmount).toBe(0);
    });

    it('5.2 throws BadRequestException for invalid MongoDB ObjectId', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('5.3 throws NotFoundException when customer is not found', async () => {
      const validId = new Types.ObjectId().toString();
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne(validId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('5.4 correctly sums multiple payments against a single completed order', async () => {
      const cust = makeCustomer();
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(cust),
      });

      const order1 = makeOrder({
        _id: new Types.ObjectId(),
        orderNumber: 'GT-20260101-0001',
        customerId: cust._id,
        status: OrderStatus.COMPLETED,
        totalAmount: Types.Decimal128.fromString('50000.00'),
      });

      orderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([order1]),
      });

      const payment1 = makePayment({
        _id: new Types.ObjectId(),
        customerId: cust._id,
        orderId: order1._id,
        amount: Types.Decimal128.fromString('15000.00'),
      });
      const payment2 = makePayment({
        _id: new Types.ObjectId(),
        customerId: cust._id,
        orderId: order1._id,
        amount: Types.Decimal128.fromString('20000.00'),
      });
      const payment3 = makePayment({
        _id: new Types.ObjectId(),
        customerId: cust._id,
        orderId: order1._id,
        amount: Types.Decimal128.fromString('5000.00'),
      });

      paymentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([payment1, payment2, payment3]),
      });

      const result = await service.findOne(cust._id.toString());

      expect(result.customer._id).toEqual(cust._id);
      expect(result.totalOrders).toBe(1);
      expect(result.payments.length).toBe(3);
      // Order total: 50,000. Payments: 15,000 + 20,000 + 5,000 = 40,000. Outstanding: 10,000.
      expect(result.orders[0].totalAmount).toBe(50000);
      expect(result.orders[0].paidAmount).toBe(40000);
      expect(result.orders[0].outstandingAmount).toBe(10000);
      expect(result.outstandingBalance).toBe(10000);
    });

    it('5.5 correctly derives negative outstanding for an overpaid completed order without clamping to zero', async () => {
      const cust = makeCustomer();
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(cust),
      });

      const order1 = makeOrder({
        _id: new Types.ObjectId(),
        orderNumber: 'GT-20260101-0001',
        customerId: cust._id,
        status: OrderStatus.COMPLETED,
        totalAmount: Types.Decimal128.fromString('40000.00'),
      });

      orderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([order1]),
      });

      const overpayment = makePayment({
        _id: new Types.ObjectId(),
        customerId: cust._id,
        orderId: order1._id,
        amount: Types.Decimal128.fromString('50000.00'),
      });

      paymentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([overpayment]),
      });

      const result = await service.findOne(cust._id.toString());

      expect(result.customer._id).toEqual(cust._id);
      expect(result.totalOrders).toBe(1);
      expect(result.payments.length).toBe(1);
      expect(result.orders[0].totalAmount).toBe(40000);
      expect(result.orders[0].paidAmount).toBe(50000);
      expect(result.orders[0].outstandingAmount).toBe(-10000);
      expect(result.outstandingBalance).toBe(-10000);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Customer Update
  // ───────────────────────────────────────────────────────────────────────────
  describe('CustomersService.update', () => {
    it('6.1 updates mutable fields (name, phone, address) and trims strings', async () => {
      const custId = new Types.ObjectId();
      const updatedCust = makeCustomer({
        _id: custId,
        name: 'New Name Ltd',
        phone: '+91 91234 56789',
        address: 'New Industrial Area',
      });

      customerModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedCust),
      });

      const result = await service.update(custId.toString(), {
        name: '  New Name Ltd  ',
        phone: '  +91 91234 56789  ',
        address: '  New Industrial Area  ',
      });

      expect(customerModel.findByIdAndUpdate).toHaveBeenCalledWith(
        custId.toString(),
        {
          $set: {
            name: 'New Name Ltd',
            phone: '+91 91234 56789',
            address: 'New Industrial Area',
          },
        },
        { new: true, runValidators: true },
      );
      expect(result.name).toBe('New Name Ltd');
    });

    it('6.2 throws BadRequestException for invalid ObjectId on update', async () => {
      await expect(service.update('bad-id', { name: 'New' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('6.3 throws NotFoundException if customer to update does not exist', async () => {
      const validId = new Types.ObjectId().toString();
      customerModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.update(validId, { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('6.4 updates isActive to false via update (deactivation via PATCH /customers/:id)', async () => {
      const custId = new Types.ObjectId();
      const deactivatedCust = makeCustomer({
        _id: custId,
        isActive: false,
      });

      customerModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deactivatedCust),
      });

      const result = await service.update(custId.toString(), {
        isActive: false,
      });

      expect(customerModel.findByIdAndUpdate).toHaveBeenCalledWith(
        custId.toString(),
        {
          $set: {
            isActive: false,
          },
        },
        { new: true, runValidators: true },
      );
      expect(result.isActive).toBe(false);
    });

    it('6.5 updates isActive to true via update (reactivation via PATCH /customers/:id)', async () => {
      const custId = new Types.ObjectId();
      const activatedCust = makeCustomer({
        _id: custId,
        isActive: true,
      });

      customerModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(activatedCust),
      });

      const result = await service.update(custId.toString(), {
        isActive: true,
      });

      expect(customerModel.findByIdAndUpdate).toHaveBeenCalledWith(
        custId.toString(),
        {
          $set: {
            isActive: true,
          },
        },
        { new: true, runValidators: true },
      );
      expect(result.isActive).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Soft Deactivation & Activation
  // ───────────────────────────────────────────────────────────────────────────
  describe('Activation and Deactivation (Soft Delete)', () => {
    it('7.1 soft-deactivates an active customer by setting isActive = false', async () => {
      const activeCust = makeCustomer({ isActive: true });
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(activeCust),
      });

      const result = await service.deactivate(activeCust._id.toString());
      expect(result.isActive).toBe(false);
      expect(activeCust.save).toHaveBeenCalled();
    });

    it('7.2 throws ConflictException when deactivating an already inactive customer', async () => {
      const inactiveCust = makeCustomer({ isActive: false });
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(inactiveCust),
      });

      await expect(
        service.deactivate(inactiveCust._id.toString()),
      ).rejects.toThrow(ConflictException);
    });

    it('7.3 activates an inactive customer by setting isActive = true', async () => {
      const inactiveCust = makeCustomer({ isActive: false });
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(inactiveCust),
      });

      const result = await service.activate(inactiveCust._id.toString());
      expect(result.isActive).toBe(true);
      expect(inactiveCust.save).toHaveBeenCalled();
    });

    it('7.4 throws ConflictException when activating an already active customer', async () => {
      const activeCust = makeCustomer({ isActive: true });
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(activeCust),
      });

      await expect(
        service.activate(activeCust._id.toString()),
      ).rejects.toThrow(ConflictException);
    });

    it('7.5 throws NotFoundException when activating or deactivating nonexistent customer', async () => {
      const validId = new Types.ObjectId().toString();
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.activate(validId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deactivate(validId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Controller Delegation
  // ───────────────────────────────────────────────────────────────────────────
  describe('CustomersController Method Execution', () => {
    it('8.1 findAll delegates to service and returns paginated envelope', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      jest.spyOn(service, 'findAll').mockResolvedValue(mockResult);

      const result = await controller.findAll({});
      expect(result).toEqual(mockResult);
    });

    it('8.2 findOne delegates to service and returns customer detail', async () => {
      const mockDetail = {
        customer: makeCustomer() as any,
        totalOrders: 0,
        outstandingBalance: 0,
        orders: [],
        payments: [],
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockDetail);

      const result = await controller.findOne(new Types.ObjectId().toString());
      expect(result).toEqual(mockDetail);
    });

    it('8.3 update delegates to service and returns { customer }', async () => {
      const mockCust = makeCustomer() as any;
      jest.spyOn(service, 'update').mockResolvedValue(mockCust);

      const result = await controller.update(mockCust._id.toString(), {
        name: 'Updated',
      });
      expect(result).toEqual({ customer: mockCust });
    });

    it('8.4 activate delegates to service and returns { customer }', async () => {
      const mockCust = makeCustomer({ isActive: true }) as any;
      jest.spyOn(service, 'activate').mockResolvedValue(mockCust);

      const result = await controller.activate(mockCust._id.toString());
      expect(result).toEqual({ customer: mockCust });
    });

    it('8.5 deactivate delegates to service and returns { customer }', async () => {
      const mockCust = makeCustomer({ isActive: false }) as any;
      jest.spyOn(service, 'deactivate').mockResolvedValue(mockCust);

      const result = await controller.deactivate(mockCust._id.toString());
      expect(result).toEqual({ customer: mockCust });
    });
  });
});
