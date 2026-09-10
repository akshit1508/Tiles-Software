/**
 * Orders Module Unit Tests
 *
 * Exhaustive tests for OrdersService and OrdersController in isolation using Jest mocks.
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
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './schemas/order.schema';
import { Counter } from './schemas/counter.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Product } from '../products/schemas/product.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { InventoryTransaction } from '../inventory/schemas/inventory-transaction.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import {
  OrderStatus,
  SalesUnit,
  UserRole,
  InventoryTransactionType,
  PaymentMethod,
} from '../../common/enums';
import { CreateOrderDto, CreateOrderItemDto, ListOrdersDto } from './dto';
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

function makeProduct(overrides: Record<string, unknown> = {}) {
  const id = makeObjectId();
  return {
    _id: id,
    brand: 'Kajaria',
    productName: 'Eternity Glazed Vitrified',
    gallaNumber: 'GAL-001',
    category: 'Floor',
    size: '600x600',
    finish: 'Glossy',
    color: 'White',
    piecesPerBox: 4,
    areaPerBox: Types.Decimal128.fromString('16.0'), // 16 sq.ft/box -> 4 sq.ft/piece
    purchasePrice: Types.Decimal128.fromString('400.00'),
    sellingPrice: Types.Decimal128.fromString('600.00'), // 600/box -> 150/piece, 37.5/sq.ft
    minimumStockPieces: 20,
    isActive: true,
    ...overrides,
  };
}

function makeInventory(productId: Types.ObjectId, totalPieces = 40) {
  const id = makeObjectId();
  return {
    _id: id,
    productId,
    totalPieces,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  const id = makeObjectId();
  const prodId = makeObjectId();
  const custId = makeObjectId();
  const userId = makeObjectId();

  return {
    _id: id,
    orderNumber: 'GT-20260910-0001',
    customerId: custId,
    items: [
      {
        productId: prodId,
        productNameSnapshot: 'Eternity Glazed Vitrified',
        brandSnapshot: 'Kajaria',
        salesQuantity: Types.Decimal128.fromString('2'),
        salesUnit: SalesUnit.BOX,
        physicalPieces: 8,
        unitPrice: Types.Decimal128.fromString('600.00'),
        lineTotal: Types.Decimal128.fromString('1200.00'),
      },
    ],
    subtotal: Types.Decimal128.fromString('1200.00'),
    totalAmount: Types.Decimal128.fromString('1200.00'),
    status: OrderStatus.COMPLETED,
    createdBy: userId,
    createdAt: new Date('2026-09-10T10:00:00Z'),
    updatedAt: new Date('2026-09-10T10:00:00Z'),
    save: jest.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  const id = makeObjectId();
  return {
    _id: id,
    orderId: makeObjectId(),
    customerId: makeObjectId(),
    amount: Types.Decimal128.fromString('500.00'),
    paymentMethod: PaymentMethod.UPI,
    paymentDate: new Date('2026-09-10T11:00:00Z'),
    toObject: function () {
      return { ...this };
    },
    ...overrides,
  };
}

const mockOwnerUser: AuthenticatedUser = {
  id: makeObjectId().toString(),
  name: 'Owner Brother',
  email: 'owner@goverdhan.com',
  role: UserRole.OWNER,
  isActive: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Orders Module Unit Tests', () => {
  let service: OrdersService;
  let controller: OrdersController;

  let mockSession: {
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    abortTransaction: jest.Mock;
    endSession: jest.Mock;
  };

  let connection: {
    startSession: jest.Mock;
  };

  let orderModel: {
    create: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    countDocuments: jest.Mock;
  };

  let counterModel: {
    findOneAndUpdate: jest.Mock;
  };

  let customerModel: {
    findById: jest.Mock;
    find: jest.Mock;
  };

  let productModel: {
    find: jest.Mock;
    findById: jest.Mock;
  };

  let inventoryModel: {
    find: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };

  let transactionModel: {
    create: jest.Mock;
  };

  let paymentModel: {
    find: jest.Mock;
  };

  beforeEach(async () => {
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    connection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
    };

    orderModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
    };

    counterModel = {
      findOneAndUpdate: jest.fn(),
    };

    customerModel = {
      findById: jest.fn(),
      find: jest.fn(),
    };

    productModel = {
      find: jest.fn(),
      findById: jest.fn(),
    };

    inventoryModel = {
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    transactionModel = {
      create: jest.fn(),
    };

    paymentModel = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        OrdersService,
        { provide: getConnectionToken(), useValue: connection },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Counter.name), useValue: counterModel },
        { provide: getModelToken(Customer.name), useValue: customerModel },
        { provide: getModelToken(Product.name), useValue: productModel },
        { provide: getModelToken(Inventory.name), useValue: inventoryModel },
        {
          provide: getModelToken(InventoryTransaction.name),
          useValue: transactionModel,
        },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<OrdersService>(OrdersService);
    controller = module.get<OrdersController>(OrdersController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // DTO Validation Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('DTO Validation', () => {
    describe('CreateOrderItemDto', () => {
      it('validates a correct order item', async () => {
        const dto = plainToInstance(CreateOrderItemDto, {
          productId: makeObjectId().toString(),
          salesQuantity: 5,
          salesUnit: SalesUnit.BOX,
          unitPrice: 500,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      });

      it('allows unitPrice to be omitted (backend derives it)', async () => {
        const dto = plainToInstance(CreateOrderItemDto, {
          productId: makeObjectId().toString(),
          salesQuantity: 5,
          salesUnit: SalesUnit.BOX,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      });

      it('rejects invalid productId', async () => {
        const dto = plainToInstance(CreateOrderItemDto, {
          productId: 'invalid-id',
          salesQuantity: 1,
          salesUnit: SalesUnit.BOX,
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'productId')).toBe(true);
      });

      it('rejects non-positive salesQuantity', async () => {
        const dto = plainToInstance(CreateOrderItemDto, {
          productId: makeObjectId().toString(),
          salesQuantity: 0,
          salesUnit: SalesUnit.BOX,
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'salesQuantity')).toBe(true);
      });

      it('rejects invalid salesUnit', async () => {
        const dto = plainToInstance(CreateOrderItemDto, {
          productId: makeObjectId().toString(),
          salesQuantity: 1,
          salesUnit: 'PALLET' as any,
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'salesUnit')).toBe(true);
      });

      it('rejects negative unitPrice', async () => {
        const dto = plainToInstance(CreateOrderItemDto, {
          productId: makeObjectId().toString(),
          salesQuantity: 1,
          salesUnit: SalesUnit.BOX,
          unitPrice: -50,
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'unitPrice')).toBe(true);
      });
    });

    describe('CreateOrderDto', () => {
      it('validates a valid order dto with items', async () => {
        const dto = plainToInstance(CreateOrderDto, {
          customerId: makeObjectId().toString(),
          items: [
            {
              productId: makeObjectId().toString(),
              salesQuantity: 2,
              salesUnit: SalesUnit.BOX,
            },
          ],
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      });

      it('rejects empty items array', async () => {
        const dto = plainToInstance(CreateOrderDto, {
          customerId: makeObjectId().toString(),
          items: [],
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'items')).toBe(true);
      });
    });

    describe('ListOrdersDto', () => {
      it('uses defaults when query is empty', () => {
        const dto = plainToInstance(ListOrdersDto, {});
        expect(dto.page).toBe(1);
        expect(dto.limit).toBe(20);
      });

      it('trims search string', () => {
        const dto = plainToInstance(ListOrdersDto, { search: '  GT-001  ' });
        expect(dto.search).toBe('GT-001');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OrdersService.create
  // ─────────────────────────────────────────────────────────────────────────

  describe('OrdersService.create', () => {
    it('throws NotFoundException if customer does not exist', async () => {
      customerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      const dto: CreateOrderDto = {
        customerId: makeObjectId().toString(),
        items: [
          {
            productId: makeObjectId().toString(),
            salesQuantity: 2,
            salesUnit: SalesUnit.BOX,
          },
        ],
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if customer is deactivated', async () => {
      const customer = makeCustomer({ isActive: false });
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });

      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: makeObjectId().toString(),
            salesQuantity: 2,
            salesUnit: SalesUnit.BOX,
          },
        ],
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException if product does not exist', async () => {
      const customer = makeCustomer();
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      productModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      inventoryModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: makeObjectId().toString(),
            salesQuantity: 2,
            salesUnit: SalesUnit.BOX,
          },
        ],
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if product is deactivated', async () => {
      const customer = makeCustomer();
      const product = makeProduct({ isActive: false });
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      productModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([product]),
      });
      inventoryModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([makeInventory(product._id, 100)]),
      });

      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: product._id.toString(),
            salesQuantity: 2,
            salesUnit: SalesUnit.BOX,
          },
        ],
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects BOX sale with fractional quantity', async () => {
      const customer = makeCustomer();
      const product = makeProduct();
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      productModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([product]),
      });
      inventoryModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([makeInventory(product._id, 100)]),
      });

      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: product._id.toString(),
            salesQuantity: 1.5,
            salesUnit: SalesUnit.BOX,
          },
        ],
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        'salesQuantity for BOX sales must be a positive integer',
      );
    });

    it('rejects BOX sale if not enough complete boxes available (even if enough loose pieces exist)', async () => {
      const customer = makeCustomer();
      // piecesPerBox = 4. Inventory has 7 pieces = 1 complete box + 3 loose pieces.
      const product = makeProduct({ piecesPerBox: 4 });
      const inventory = makeInventory(product._id, 7);

      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      productModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([product]),
      });
      inventoryModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([inventory]),
      });

      // Customer requests 2 boxes (= 8 pieces)
      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: product._id.toString(),
            salesQuantity: 2,
            salesUnit: SalesUnit.BOX,
          },
        ],
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects PIECE sale with fractional quantity', async () => {
      const customer = makeCustomer();
      const product = makeProduct();
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      productModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([product]),
      });
      inventoryModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([makeInventory(product._id, 100)]),
      });

      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: product._id.toString(),
            salesQuantity: 3.5,
            salesUnit: SalesUnit.PIECE,
          },
        ],
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        'salesQuantity for PIECE sales must be a positive integer',
      );
    });

    it('rejects PIECE sale if total pieces insufficient', async () => {
      const customer = makeCustomer();
      const product = makeProduct();
      const inventory = makeInventory(product._id, 2);

      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      productModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([product]),
      });
      inventoryModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([inventory]),
      });

      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: product._id.toString(),
            salesQuantity: 5,
            salesUnit: SalesUnit.PIECE,
          },
        ],
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        'Insufficient stock',
      );
    });

    it('rejects SQ_FT sale if requested area does not correspond to whole tiles', async () => {
      const customer = makeCustomer();
      // piecesPerBox = 4, areaPerBox = 16 => areaPerPiece = 4 sq.ft
      const product = makeProduct({
        piecesPerBox: 4,
        areaPerBox: Types.Decimal128.fromString('16.0'),
      });
      const inventory = makeInventory(product._id, 40);

      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      productModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([product]),
      });
      inventoryModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([inventory]),
      });

      // 6 sq.ft is 1.5 tiles -> invalid (tiles cannot be cut)
      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: product._id.toString(),
            salesQuantity: 6,
            salesUnit: SalesUnit.SQ_FT,
          },
        ],
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        'does not correspond to a whole number of tiles',
      );
    });

    it('creates order successfully with derived unitPrice for BOX, PIECE, and SQ_FT sales', async () => {
      const customer = makeCustomer();
      // Product: 4 pcs/box, 16 sq.ft/box, sellingPrice = 600/box
      // => BOX = 600, PIECE = 150, SQ_FT = 37.5
      const product = makeProduct({
        piecesPerBox: 4,
        areaPerBox: Types.Decimal128.fromString('16.0'),
        sellingPrice: Types.Decimal128.fromString('600.00'),
      });
      const inventory = makeInventory(product._id, 100); // 25 boxes

      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      productModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([product]),
      });
      inventoryModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([inventory]),
      });

      counterModel.findOneAndUpdate.mockResolvedValue({ seq: 1 });
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...inventory, totalPieces: 85 }),
      });

      const savedOrder = makeOrder({
        customerId: customer._id,
        items: [
          {
            productId: product._id,
            productNameSnapshot: product.productName,
            brandSnapshot: product.brand,
            salesQuantity: Types.Decimal128.fromString('2'),
            salesUnit: SalesUnit.BOX,
            physicalPieces: 8,
            unitPrice: Types.Decimal128.fromString('600.00'),
            lineTotal: Types.Decimal128.fromString('1200.00'),
          },
          {
            productId: product._id,
            productNameSnapshot: product.productName,
            brandSnapshot: product.brand,
            salesQuantity: Types.Decimal128.fromString('3'),
            salesUnit: SalesUnit.PIECE,
            physicalPieces: 3,
            unitPrice: Types.Decimal128.fromString('150.00'),
            lineTotal: Types.Decimal128.fromString('450.00'),
          },
          {
            productId: product._id,
            productNameSnapshot: product.productName,
            brandSnapshot: product.brand,
            salesQuantity: Types.Decimal128.fromString('16'),
            salesUnit: SalesUnit.SQ_FT,
            physicalPieces: 4,
            unitPrice: Types.Decimal128.fromString('37.50'),
            lineTotal: Types.Decimal128.fromString('600.00'),
          },
        ],
        subtotal: Types.Decimal128.fromString('2250.00'),
        totalAmount: Types.Decimal128.fromString('2250.00'),
      });

      orderModel.create.mockResolvedValue([savedOrder]);
      transactionModel.create.mockResolvedValue([]);

      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: product._id.toString(),
            salesQuantity: 2,
            salesUnit: SalesUnit.BOX,
            // unitPrice omitted -> should derive 600
          },
          {
            productId: product._id.toString(),
            salesQuantity: 3,
            salesUnit: SalesUnit.PIECE,
            // unitPrice omitted -> should derive 150
          },
          {
            productId: product._id.toString(),
            salesQuantity: 16,
            salesUnit: SalesUnit.SQ_FT,
            // unitPrice omitted -> should derive 37.50
          },
        ],
      };

      const result = await service.create(dto, mockOwnerUser.id);

      expect(result).toBeDefined();
      expect(result.status).toBe(OrderStatus.COMPLETED);
      expect(result.subtotal).toBe(2250.0);
      expect(result.totalAmount).toBe(2250.0);
      expect(result.paidAmount).toBe(0);
      expect(result.outstandingAmount).toBe(2250.0);
      expect(result.items.length).toBe(3);

      // Verify transaction commit
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();

      // Verify inventory decrement called
      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: product._id,
          totalPieces: { $gte: 15 }, // 8 + 3 + 4 = 15 pieces
        }),
        { $inc: { totalPieces: -15 } },
        expect.anything(),
      );

      // Verify SALE transactions recorded with signed negative physicalPieces
      expect(transactionModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            transactionType: InventoryTransactionType.SALE,
            physicalPieces: -8,
          }),
          expect.objectContaining({
            transactionType: InventoryTransactionType.SALE,
            physicalPieces: -3,
          }),
          expect.objectContaining({
            transactionType: InventoryTransactionType.SALE,
            physicalPieces: -4,
          }),
        ]),
        expect.anything(),
      );
    });

    it('honors and validates explicit OWNER negotiated unitPrice', async () => {
      const customer = makeCustomer();
      const product = makeProduct({
        piecesPerBox: 4,
        sellingPrice: Types.Decimal128.fromString('600.00'),
      });
      const inventory = makeInventory(product._id, 100);

      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      productModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([product]),
      });
      inventoryModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([inventory]),
      });
      counterModel.findOneAndUpdate.mockResolvedValue({ seq: 5 });
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...inventory, totalPieces: 96 }),
      });

      const savedOrder = makeOrder({
        customerId: customer._id,
        items: [
          {
            productId: product._id,
            productNameSnapshot: product.productName,
            brandSnapshot: product.brand,
            salesQuantity: Types.Decimal128.fromString('1'),
            salesUnit: SalesUnit.BOX,
            physicalPieces: 4,
            unitPrice: Types.Decimal128.fromString('550.00'), // Discounted negotiated price
            lineTotal: Types.Decimal128.fromString('550.00'),
          },
        ],
        subtotal: Types.Decimal128.fromString('550.00'),
        totalAmount: Types.Decimal128.fromString('550.00'),
      });

      orderModel.create.mockResolvedValue([savedOrder]);
      transactionModel.create.mockResolvedValue([]);

      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: product._id.toString(),
            salesQuantity: 1,
            salesUnit: SalesUnit.BOX,
            unitPrice: 550, // Negotiated owner price
          },
        ],
      };

      const result = await service.create(dto, mockOwnerUser.id);
      expect(result.totalAmount).toBe(550.0);
      expect(result.items[0].unitPrice).toBe(550.0);
    });

    it('aborts transaction if an error occurs during persistence', async () => {
      const customer = makeCustomer();
      const product = makeProduct();
      const inventory = makeInventory(product._id, 100);

      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      productModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([product]),
      });
      inventoryModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([inventory]),
      });

      counterModel.findOneAndUpdate.mockResolvedValue({ seq: 1 });
      // Simulate concurrent race condition failure
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const dto: CreateOrderDto = {
        customerId: customer._id.toString(),
        items: [
          {
            productId: product._id.toString(),
            salesQuantity: 1,
            salesUnit: SalesUnit.BOX,
          },
        ],
      };

      await expect(service.create(dto, mockOwnerUser.id)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OrdersService.findAll
  // ─────────────────────────────────────────────────────────────────────────

  describe('OrdersService.findAll', () => {
    it('returns paginated orders with derived payments', async () => {
      const order1 = makeOrder({ totalAmount: Types.Decimal128.fromString('1000.00') });
      const order2 = makeOrder({
        totalAmount: Types.Decimal128.fromString('2000.00'),
        status: OrderStatus.CANCELLED,
      });

      orderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([order1, order2]),
      });
      orderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });

      const cust1 = makeCustomer({ _id: order1.customerId });
      customerModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([cust1]),
      });

      // Partial payment of 400 for order1
      const p1 = makePayment({
        orderId: order1._id,
        amount: Types.Decimal128.fromString('400.00'),
      });
      paymentModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([p1]),
      });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(2);
      expect(result.data.length).toBe(2);

      // Order 1 is COMPLETED: paid = 400, outstanding = 1000 - 400 = 600
      expect(result.data[0].paidAmount).toBe(400);
      expect(result.data[0].outstandingAmount).toBe(600);

      // Order 2 is CANCELLED: outstanding is strictly 0
      expect(result.data[1].status).toBe(OrderStatus.CANCELLED);
      expect(result.data[1].outstandingAmount).toBe(0);
    });

    it('filters orders by search term on orderNumber and customer fields', async () => {
      customerModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      orderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      orderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await service.findAll({ search: 'GT-2026' });
      expect(result.data).toEqual([]);
      expect(orderModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({
              orderNumber: { $regex: 'GT-2026', $options: 'i' },
            }),
          ]),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OrdersService.findOne
  // ─────────────────────────────────────────────────────────────────────────

  describe('OrdersService.findOne', () => {
    it('throws NotFoundException if order does not exist', async () => {
      orderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne(makeObjectId().toString())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns full order details with payment history and derived balance', async () => {
      const order = makeOrder({ totalAmount: Types.Decimal128.fromString('1500.00') });
      const customer = makeCustomer({ _id: order.customerId });
      const payment = makePayment({
        orderId: order._id,
        amount: Types.Decimal128.fromString('1000.00'),
      });

      orderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(order),
      });
      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      paymentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([payment]),
      });

      const result = await service.findOne(order._id.toString());

      expect(result._id).toBe(order._id.toString());
      expect(result.customer?.name).toBe(customer.name);
      expect(result.totalAmount).toBe(1500);
      expect(result.paidAmount).toBe(1000);
      expect(result.outstandingAmount).toBe(500);
      expect(result.payments?.length).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OrdersService.cancel
  // ─────────────────────────────────────────────────────────────────────────

  describe('OrdersService.cancel', () => {
    it('throws NotFoundException if order does not exist', async () => {
      orderModel.findById.mockReturnValue({
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.cancel(makeObjectId().toString(), mockOwnerUser.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('strictly rejects already cancelled order (idempotent rejection, no stock re-restoration)', async () => {
      const order = makeOrder({ status: OrderStatus.CANCELLED });
      orderModel.findById.mockReturnValue({
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(order),
      });

      await expect(
        service.cancel(order._id.toString(), mockOwnerUser.id),
      ).rejects.toThrow('Order is already cancelled');

      // Verify inventory was NOT updated
      expect(inventoryModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(transactionModel.create).not.toHaveBeenCalled();
    });

    it('cancels COMPLETED order, restores inventory, logs SALE_REVERSAL, and sets status to CANCELLED', async () => {
      const order = makeOrder({
        status: OrderStatus.COMPLETED,
        totalAmount: Types.Decimal128.fromString('1200.00'),
      });
      const customer = makeCustomer({ _id: order.customerId });

      orderModel.findById.mockReturnValue({
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(order),
      });

      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      transactionModel.create.mockResolvedValue([]);

      customerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(customer),
      });
      paymentModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.cancel(order._id.toString(), mockOwnerUser.id);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.outstandingAmount).toBe(0);

      // Verify inventory restoration called with +physicalPieces
      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: order.items[0].productId },
        { $inc: { totalPieces: order.items[0].physicalPieces } },
        expect.anything(),
      );

      // Verify SALE_REVERSAL created with positive physicalPieces and reason
      expect(transactionModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            transactionType: InventoryTransactionType.SALE_REVERSAL,
            physicalPieces: order.items[0].physicalPieces, // Positive
            reason: 'Order cancelled',
          }),
        ]),
        expect.anything(),
      );

      // Verify atomic commit
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Controller Guard & Role Metadata
  // ─────────────────────────────────────────────────────────────────────────

  describe('OrdersController Security & Roles', () => {
    const reflector = new Reflector();

    it('protects OrdersController with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', OrdersController);
      expect(guards).toBeDefined();
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('enforces OWNER role on POST /orders (create)', () => {
      const roles = reflector.get<UserRole[]>(
        ROLES_KEY,
        OrdersController.prototype.create,
      );
      expect(roles).toEqual([UserRole.OWNER]);
    });

    it('enforces OWNER role on GET /orders (findAll)', () => {
      const roles = reflector.get<UserRole[]>(
        ROLES_KEY,
        OrdersController.prototype.findAll,
      );
      expect(roles).toEqual([UserRole.OWNER]);
    });

    it('enforces OWNER role on GET /orders/:id (findOne)', () => {
      const roles = reflector.get<UserRole[]>(
        ROLES_KEY,
        OrdersController.prototype.findOne,
      );
      expect(roles).toEqual([UserRole.OWNER]);
    });

    it('enforces OWNER role on POST /orders/:id/cancel (cancel)', () => {
      const roles = reflector.get<UserRole[]>(
        ROLES_KEY,
        OrdersController.prototype.cancel,
      );
      expect(roles).toEqual([UserRole.OWNER]);
    });

    it('delegates create to service', async () => {
      const dto: CreateOrderDto = {
        customerId: makeObjectId().toString(),
        items: [
          {
            productId: makeObjectId().toString(),
            salesQuantity: 1,
            salesUnit: SalesUnit.BOX,
          },
        ],
      };

      const spy = jest.spyOn(service, 'create').mockResolvedValue({} as any);
      await controller.create(dto, mockOwnerUser);
      expect(spy).toHaveBeenCalledWith(dto, mockOwnerUser.id);
    });

    it('delegates findAll to service', async () => {
      const query: ListOrdersDto = { page: 1, limit: 10 };
      const spy = jest.spyOn(service, 'findAll').mockResolvedValue({} as any);
      await controller.findAll(query);
      expect(spy).toHaveBeenCalledWith(query);
    });

    it('delegates findOne to service', async () => {
      const id = makeObjectId().toString();
      const spy = jest.spyOn(service, 'findOne').mockResolvedValue({} as any);
      await controller.findOne(id);
      expect(spy).toHaveBeenCalledWith(id);
    });

    it('delegates cancel to service', async () => {
      const id = makeObjectId().toString();
      const spy = jest.spyOn(service, 'cancel').mockResolvedValue({} as any);
      await controller.cancel(id, mockOwnerUser);
      expect(spy).toHaveBeenCalledWith(id, mockOwnerUser.id);
    });
  });
});
