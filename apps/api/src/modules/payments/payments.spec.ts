/**
 * Payments Module Unit Tests
 *
 * Exhaustive unit tests for PaymentsService and PaymentsController in isolation using Jest mocks.
 * Zero external MongoDB connection required.
 */

import {
  NotFoundException,
  BadRequestException,
  ExecutionContext,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './schemas/payment.schema';
import { Order } from '../orders/schemas/order.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import {
  OrderStatus,
  UserRole,
  PaymentMethod,
} from '../../common/enums';
import { CreatePaymentDto, ListPaymentsDto } from './dto';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';

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
    __v: 0,
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
    notes: 'Advance installment',
    createdBy: makeObjectId(),
    createdAt: new Date('2026-09-10T11:00:00Z'),
    toObject: function () {
      return { ...this };
    },
    ...overrides,
  };
}

const mockOwnerUser: AuthenticatedUser = {
  id: makeObjectId().toString(),
  name: 'Owner User',
  email: 'owner@goverdhan.com',
  role: UserRole.OWNER,
  isActive: true,
};

describe('Payments Module Unit Tests', () => {
  let service: PaymentsService;
  let controller: PaymentsController;

  let paymentModel: any;
  let orderModel: any;
  let customerModel: any;
  let mockConnection: any;

  let mockSession: {
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    abortTransaction: jest.Mock;
    endSession: jest.Mock;
  };

  const mockQuery = (resolvedValue: any) => {
    const q: any = {
      session: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(resolvedValue),
    };
    return q;
  };

  beforeEach(async () => {
    paymentModel = {
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
      create: jest.fn(),
    };

    orderModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    customerModel = {
      find: jest.fn(),
      findById: jest.fn(),
    };

    mockSession = {
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Customer.name), useValue: customerModel },
        { provide: getConnectionToken(), useValue: mockConnection },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    controller = module.get<PaymentsController>(PaymentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. DTO Validation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('CreatePaymentDto Validation', () => {
    it('validates a valid CreatePaymentDto', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        orderId: makeObjectId().toString(),
        amount: 500.5,
        paymentMethod: PaymentMethod.UPI,
        paymentDate: '2026-09-10T12:00:00.000Z',
        notes: 'Partial payment',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('rejects invalid or missing orderId', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        orderId: 'invalid-id',
        amount: 100,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'orderId')).toBe(true);
    });

    it('rejects non-positive amount (0 or negative)', async () => {
      const dtoZero = plainToInstance(CreatePaymentDto, {
        orderId: makeObjectId().toString(),
        amount: 0,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      });
      const errorsZero = await validate(dtoZero);
      expect(errorsZero.some((e) => e.property === 'amount')).toBe(true);

      const dtoNegative = plainToInstance(CreatePaymentDto, {
        orderId: makeObjectId().toString(),
        amount: -50,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      });
      const errorsNegative = await validate(dtoNegative);
      expect(errorsNegative.some((e) => e.property === 'amount')).toBe(true);
    });

    it('rejects amount with more than 2 decimal places', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        orderId: makeObjectId().toString(),
        amount: 100.125,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('rejects invalid payment method enum', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        orderId: makeObjectId().toString(),
        amount: 100,
        paymentMethod: 'BITCOIN' as any,
        paymentDate: '2026-09-10T12:00:00.000Z',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
    });

    it('rejects invalid paymentDate', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        orderId: makeObjectId().toString(),
        amount: 100,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: 'not-a-date',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'paymentDate')).toBe(true);
    });
  });

  describe('ListPaymentsDto Validation', () => {
    it('validates default query parameters', async () => {
      const dto = plainToInstance(ListPaymentsDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('rejects invalid pagination parameters', async () => {
      const dto = plainToInstance(ListPaymentsDto, { page: 0, limit: 150 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'page')).toBe(true);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. PaymentsService.create Tests (Transactions, Concurrency, Rules)
  // ─────────────────────────────────────────────────────────────────────────

  describe('PaymentsService.create', () => {
    it('successfully records a payment against a completed order and commits transaction', async () => {
      const customer = makeCustomer();
      const order = makeOrder({
        customerId: customer._id,
        totalAmount: Types.Decimal128.fromString('1000.00'),
      });

      // 1. Order serialization lock via findOneAndUpdate
      orderModel.findOneAndUpdate.mockReturnValue(mockQuery(order));
      // 2. Customer lookup
      customerModel.findById.mockReturnValue(mockQuery(customer));
      // 3. Existing payments: empty
      paymentModel.find.mockReturnValue(mockQuery([]));
      // 4. Payment persistence
      const createdPayment = makePayment({
        orderId: order._id,
        customerId: customer._id,
        amount: Types.Decimal128.fromString('400.00'),
      });
      paymentModel.create.mockResolvedValue([createdPayment]);

      const dto: CreatePaymentDto = {
        orderId: order._id.toString(),
        amount: 400,
        paymentMethod: PaymentMethod.UPI,
        paymentDate: '2026-09-10T12:00:00.000Z',
        notes: 'Partial 400',
      };

      const result = await service.create(dto, mockOwnerUser.id);

      // Verify serialization call: findOneAndUpdate with $inc: { __v: 1 } and session
      expect(orderModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: order._id,
          status: OrderStatus.COMPLETED,
        },
        { $inc: { __v: 1 } },
        expect.objectContaining({ new: true, session: mockSession }),
      );

      // Verify payment was created with authoritative order.customerId
      expect(paymentModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            orderId: order._id,
            customerId: order.customerId,
            amount: Types.Decimal128.fromString('400.00'),
            paymentMethod: PaymentMethod.UPI,
          }),
        ],
        expect.objectContaining({ session: mockSession }),
      );

      // Verify calculated remaining outstanding: 1000 - 400 = 600
      expect(result.remainingOutstanding).toBe(600);
      expect(result.amount).toBe(400);

      // Verify transaction committed
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('successfully records exact full payment settling remaining balance to 0', async () => {
      const customer = makeCustomer();
      const order = makeOrder({
        customerId: customer._id,
        totalAmount: Types.Decimal128.fromString('1000.00'),
      });

      orderModel.findOneAndUpdate.mockReturnValue(mockQuery(order));
      customerModel.findById.mockReturnValue(mockQuery(customer));
      paymentModel.find.mockReturnValue(mockQuery([]));

      const createdPayment = makePayment({
        orderId: order._id,
        customerId: customer._id,
        amount: Types.Decimal128.fromString('1000.00'),
      });
      paymentModel.create.mockResolvedValue([createdPayment]);

      const dto: CreatePaymentDto = {
        orderId: order._id.toString(),
        amount: 1000,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      const result = await service.create(dto, mockOwnerUser.id);

      expect(result.remainingOutstanding).toBe(0);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('successfully handles multiple partial payments up to total using integer paise precision', async () => {
      const customer = makeCustomer();
      const order = makeOrder({
        customerId: customer._id,
        totalAmount: Types.Decimal128.fromString('100.50'),
      });

      orderModel.findOneAndUpdate.mockReturnValue(mockQuery(order));
      customerModel.findById.mockReturnValue(mockQuery(customer));

      // Prior payment of 33.30
      const existingP1 = makePayment({
        orderId: order._id,
        customerId: customer._id,
        amount: Types.Decimal128.fromString('33.30'),
      });
      // Prior payment of 33.10
      const existingP2 = makePayment({
        orderId: order._id,
        customerId: customer._id,
        amount: Types.Decimal128.fromString('33.10'),
      });
      // Total existing paid = 66.40 paise (6640), remaining = 34.10 paise (3410)
      paymentModel.find.mockReturnValue(mockQuery([existingP1, existingP2]));

      const createdPayment = makePayment({
        orderId: order._id,
        customerId: customer._id,
        amount: Types.Decimal128.fromString('34.10'),
      });
      paymentModel.create.mockResolvedValue([createdPayment]);

      const dto: CreatePaymentDto = {
        orderId: order._id.toString(),
        amount: 34.1, // Floating point input
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      const result = await service.create(dto, mockOwnerUser.id);

      expect(result.remainingOutstanding).toBe(0);
      expect(result.amount).toBe(34.1);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('rejects overpayment: amount exceeding remaining outstanding balance', async () => {
      const customer = makeCustomer();
      const order = makeOrder({
        customerId: customer._id,
        totalAmount: Types.Decimal128.fromString('1000.00'),
      });

      orderModel.findOneAndUpdate.mockReturnValue(mockQuery(order));
      customerModel.findById.mockReturnValue(mockQuery(customer));

      // Existing payments = 800. Remaining = 200.
      const existingP1 = makePayment({
        orderId: order._id,
        amount: Types.Decimal128.fromString('800.00'),
      });
      paymentModel.find.mockReturnValue(mockQuery([existingP1]));

      const dto: CreatePaymentDto = {
        orderId: order._id.toString(),
        amount: 200.01, // 1 paisa over remaining balance!
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        'exceeds remaining order outstanding balance',
      );

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(paymentModel.create).not.toHaveBeenCalled();
    });

    it('rejects payment on a fully-paid order: order total 1000, existing 1000, new 1.00', async () => {
      const customer = makeCustomer();
      const order = makeOrder({
        customerId: customer._id,
        totalAmount: Types.Decimal128.fromString('1000.00'),
      });

      orderModel.findOneAndUpdate.mockReturnValue(mockQuery(order));
      customerModel.findById.mockReturnValue(mockQuery(customer));

      // Existing payment = 1000.00
      const existingPayment = makePayment({
        orderId: order._id,
        amount: Types.Decimal128.fromString('1000.00'),
      });
      paymentModel.find.mockReturnValue(mockQuery([existingPayment]));

      const dto: CreatePaymentDto = {
        orderId: order._id.toString(),
        amount: 1.0,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        'exceeds remaining order outstanding balance',
      );

      expect(paymentModel.create).not.toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('defensively rejects payment on an already-overpaid/corrupted order: order total 1000, existing 1000.01, new 0.01', async () => {
      const customer = makeCustomer();
      const order = makeOrder({
        customerId: customer._id,
        totalAmount: Types.Decimal128.fromString('1000.00'),
      });

      orderModel.findOneAndUpdate.mockReturnValue(mockQuery(order));
      customerModel.findById.mockReturnValue(mockQuery(customer));

      // Existing payments total = 1000.01 (remaining = -0.01)
      const existingPayment = makePayment({
        orderId: order._id,
        amount: Types.Decimal128.fromString('1000.01'),
      });
      paymentModel.find.mockReturnValue(mockQuery([existingPayment]));

      const dto: CreatePaymentDto = {
        orderId: order._id.toString(),
        amount: 0.01,
        paymentMethod: PaymentMethod.UPI,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        'exceeds remaining order outstanding balance',
      );

      expect(paymentModel.create).not.toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('throws NotFoundException when referenced order does not exist at all', async () => {
      // findOneAndUpdate returns null
      orderModel.findOneAndUpdate.mockReturnValue(mockQuery(null));
      // findById fallback returns null
      orderModel.findById.mockReturnValue(mockQuery(null));

      const dto: CreatePaymentDto = {
        orderId: makeObjectId().toString(),
        amount: 100,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(paymentModel.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when order exists but is in CANCELLED status', async () => {
      // findOneAndUpdate returns null (because status filter failed)
      orderModel.findOneAndUpdate.mockReturnValue(mockQuery(null));
      // findById fallback confirms order exists but is CANCELLED
      const cancelledOrder = makeOrder({ status: OrderStatus.CANCELLED });
      orderModel.findById.mockReturnValue(mockQuery(cancelledOrder));

      const dto: CreatePaymentDto = {
        orderId: cancelledOrder._id.toString(),
        amount: 100,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        'Cannot record payment for a cancelled order',
      );
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(paymentModel.create).not.toHaveBeenCalled();
    });

    it('succeeds even if customer is deactivated (isActive = false) since order already exists', async () => {
      const deactivatedCustomer = makeCustomer({ isActive: false });
      const order = makeOrder({
        customerId: deactivatedCustomer._id,
        totalAmount: Types.Decimal128.fromString('500.00'),
      });

      orderModel.findOneAndUpdate.mockReturnValue(mockQuery(order));
      customerModel.findById.mockReturnValue(mockQuery(deactivatedCustomer));
      paymentModel.find.mockReturnValue(mockQuery([]));

      const createdPayment = makePayment({
        orderId: order._id,
        customerId: deactivatedCustomer._id,
        amount: Types.Decimal128.fromString('500.00'),
      });
      paymentModel.create.mockResolvedValue([createdPayment]);

      const dto: CreatePaymentDto = {
        orderId: order._id.toString(),
        amount: 500,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      const result = await service.create(dto, mockOwnerUser.id);

      expect(result.customer?.isActive).toBe(false);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('rejects payment if optional supplied customerId does not match order customer', async () => {
      const customer = makeCustomer();
      const order = makeOrder({ customerId: customer._id });

      orderModel.findOneAndUpdate.mockReturnValue(mockQuery(order));
      customerModel.findById.mockReturnValue(mockQuery(customer));

      const dto: CreatePaymentDto = {
        orderId: order._id.toString(),
        customerId: makeObjectId().toString(), // Mismatched customerId
        amount: 100,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        'Supplied customerId does not match the customer on the referenced order',
      );
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('safely handles concurrent write conflict / TransientTransactionError by aborting transaction', async () => {
      // Simulate MongoDB WriteConflict on the serialization point
      const writeConflictError: any = new Error('WriteConflict');
      writeConflictError.errorLabels = ['TransientTransactionError'];

      const queryWithConflict = {
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(writeConflictError),
      };
      orderModel.findOneAndUpdate.mockReturnValue(queryWithConflict);

      const dto: CreatePaymentDto = {
        orderId: makeObjectId().toString(),
        amount: 100,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        'WriteConflict',
      );

      // Verify that transaction was cleanly aborted
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
      expect(paymentModel.create).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PaymentsService.findAll Tests (Filters & Pagination)
  // ─────────────────────────────────────────────────────────────────────────

  describe('PaymentsService.findAll', () => {
    it('returns paginated payments with populated order and customer', async () => {
      const customer = makeCustomer();
      const order = makeOrder({ customerId: customer._id });
      const payment = makePayment({
        orderId: order._id,
        customerId: customer._id,
      });

      paymentModel.find.mockReturnValue(mockQuery([payment]));
      paymentModel.countDocuments.mockReturnValue(mockQuery(1));
      orderModel.find.mockReturnValue(mockQuery([order]));
      customerModel.find.mockReturnValue(mockQuery([customer]));

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.data[0].order?.orderNumber).toBe(order.orderNumber);
      expect(result.data[0].customer?.name).toBe(customer.name);
    });

    it('filters payments by endDate using exclusive upper bound ($lt next day)', async () => {
      paymentModel.find.mockReturnValue(mockQuery([]));
      paymentModel.countDocuments.mockReturnValue(mockQuery(0));

      await service.findAll({ endDate: '2026-09-10' });

      expect(paymentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentDate: {
            $lt: new Date('2026-09-11T00:00:00.000Z'),
          },
        }),
      );
    });

    it('filters payments by orderId, customerId, and paymentMethod', async () => {
      paymentModel.find.mockReturnValue(mockQuery([]));
      paymentModel.countDocuments.mockReturnValue(mockQuery(0));

      const orderId = makeObjectId().toString();
      const customerId = makeObjectId().toString();

      await service.findAll({
        orderId,
        customerId,
        paymentMethod: PaymentMethod.CHEQUE,
      });

      expect(paymentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: new Types.ObjectId(orderId),
          customerId: new Types.ObjectId(customerId),
          paymentMethod: PaymentMethod.CHEQUE,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. PaymentsService.findOne Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('PaymentsService.findOne', () => {
    it('throws NotFoundException if payment does not exist', async () => {
      paymentModel.findById.mockReturnValue(mockQuery(null));

      await expect(service.findOne(makeObjectId().toString())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns payment with populated order and customer and remaining outstanding', async () => {
      const customer = makeCustomer();
      const order = makeOrder({
        customerId: customer._id,
        totalAmount: Types.Decimal128.fromString('1000.00'),
      });
      const payment = makePayment({
        orderId: order._id,
        customerId: customer._id,
        amount: Types.Decimal128.fromString('400.00'),
      });

      paymentModel.findById.mockReturnValue(mockQuery(payment));
      orderModel.findById.mockReturnValue(mockQuery(order));
      customerModel.findById.mockReturnValue(mockQuery(customer));
      paymentModel.find.mockReturnValue(mockQuery([payment])); // all payments for order

      const result = await service.findOne(payment._id.toString());

      expect(result._id).toBe(payment._id.toString());
      expect(result.amount).toBe(400);
      expect(result.remainingOutstanding).toBe(600);
      expect(result.order?.orderNumber).toBe(order.orderNumber);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. PaymentsController Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('PaymentsController', () => {
    it('enforces OWNER role metadata on create, findAll, and findOne', () => {
      const reflector = new Reflector();

      const createRoles = reflector.get<string[]>(
        ROLES_KEY,
        controller.create,
      );
      expect(createRoles).toEqual([UserRole.OWNER]);

      const findAllRoles = reflector.get<string[]>(
        ROLES_KEY,
        controller.findAll,
      );
      expect(findAllRoles).toEqual([UserRole.OWNER]);

      const findOneRoles = reflector.get<string[]>(
        ROLES_KEY,
        controller.findOne,
      );
      expect(findOneRoles).toEqual([UserRole.OWNER]);
    });

    it('controller delegates create to service with current user id', async () => {
      const mockResult: any = { _id: 'payment-1' };
      jest.spyOn(service, 'create').mockResolvedValue(mockResult);

      const dto: CreatePaymentDto = {
        orderId: makeObjectId().toString(),
        amount: 250,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: '2026-09-10T12:00:00.000Z',
      };

      const res = await controller.create(dto, mockOwnerUser);
      expect(service.create).toHaveBeenCalledWith(dto, mockOwnerUser.id);
      expect(res).toBe(mockResult);
    });

    it('controller delegates findAll to service', async () => {
      const mockResult: any = { data: [], total: 0 };
      jest.spyOn(service, 'findAll').mockResolvedValue(mockResult);

      const res = await controller.findAll({});
      expect(service.findAll).toHaveBeenCalledWith({});
      expect(res).toBe(mockResult);
    });

    it('controller delegates findOne to service', async () => {
      const mockResult: any = { _id: 'payment-1' };
      jest.spyOn(service, 'findOne').mockResolvedValue(mockResult);

      const res = await controller.findOne('payment-1');
      expect(service.findOne).toHaveBeenCalledWith('payment-1');
      expect(res).toBe(mockResult);
    });
  });
});
