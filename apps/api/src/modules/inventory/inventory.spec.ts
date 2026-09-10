/**
 * Inventory Module Unit Tests
 *
 * Comprehensive tests for InventoryService and InventoryController.
 * Zero external MongoDB connection required.
 */

import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Inventory } from './schemas/inventory.schema';
import { InventoryTransaction } from './schemas/inventory-transaction.schema';
import { Product } from '../products/schemas/product.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { InventoryTransactionType, SalesUnit, UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & Mock Data
// ─────────────────────────────────────────────────────────────────────────────

function makeObjectId(): Types.ObjectId {
  return new Types.ObjectId();
}

function makeMockProduct(overrides: Record<string, unknown> = {}) {
  const id = makeObjectId();
  return {
    _id: id,
    brand: 'Somany',
    productName: 'Living Room Glazed Vitrified',
    gallaNumber: 'GT-SOM-001',
    category: 'Floor',
    size: '600x600mm',
    finish: 'Glossy',
    color: 'Beige',
    piecesPerBox: 4,
    areaPerBox: Types.Decimal128.fromString('15.5'),
    purchasePrice: Types.Decimal128.fromString('600'),
    sellingPrice: Types.Decimal128.fromString('850'),
    minimumStockPieces: 20,
    images: [],
    isActive: true,
    ...overrides,
  };
}

function makeMockInventory(productId: Types.ObjectId, totalPieces = 40) {
  const id = makeObjectId();
  return {
    _id: id,
    productId,
    totalPieces,
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject: function () {
      return { ...this };
    },
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

describe('Inventory Module Unit Tests', () => {
  let service: InventoryService;
  let controller: InventoryController;

  let mockSession: {
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    abortTransaction: jest.Mock;
    endSession: jest.Mock;
  };

  let connection: {
    startSession: jest.Mock;
  };

  let inventoryModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findOneAndUpdate: jest.Mock;
    create: jest.Mock;
    aggregate: jest.Mock;
    countDocuments: jest.Mock;
  };

  let transactionModel: {
    create: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
  };

  let productModel: {
    find: jest.Mock;
    findById: jest.Mock;
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

    inventoryModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
      countDocuments: jest.fn(),
    };

    transactionModel = {
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

    productModel = {
      find: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        InventoryService,
        { provide: getConnectionToken(), useValue: connection },
        { provide: getModelToken(Inventory.name), useValue: inventoryModel },
        {
          provide: getModelToken(InventoryTransaction.name),
          useValue: transactionModel,
        },
        { provide: getModelToken(Product.name), useValue: productModel },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<InventoryService>(InventoryService);
    controller = module.get<InventoryController>(InventoryController);
  });

  afterEach(() => jest.clearAllMocks());

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Derived Quantities & Single Inventory Retrieval
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /inventory/:productId', () => {
    it('1. returns inventory details and accurately derived unit metrics', async () => {
      const mockProduct = makeMockProduct({
        piecesPerBox: 4,
        areaPerBox: Types.Decimal128.fromString('8'), // 8 / 4 = 2 sq.ft per piece
        minimumStockPieces: 10,
      });
      // 37 pieces: fullBoxes = floor(37/4)=9, loosePieces = 37%4=1, totalSqFt = 37*2=74
      const mockInventory = makeMockInventory(mockProduct._id, 37);

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockInventory),
      });

      const result = await service.findOneByProductId(mockProduct._id.toString());

      expect(result).toBeDefined();
      expect(result.totalPieces).toBe(37);
      expect(result.fullBoxes).toBe(9);
      expect(result.loosePieces).toBe(1);
      expect(result.totalSqFt).toBe(74);
      expect(result.isLowStock).toBe(false); // 37 > 10
    });

    it('2. correctly marks isLowStock = true when totalPieces <= minimumStockPieces', async () => {
      const mockProduct = makeMockProduct({
        piecesPerBox: 4,
        areaPerBox: Types.Decimal128.fromString('16'),
        minimumStockPieces: 20,
      });
      const mockInventory = makeMockInventory(mockProduct._id, 20); // exactly at threshold

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockInventory),
      });

      const result = await service.findOneByProductId(mockProduct._id.toString());
      expect(result.isLowStock).toBe(true);
    });

    it('3. throws NotFoundException (404) if product does not exist', async () => {
      const unknownId = makeObjectId().toString();
      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOneByProductId(unknownId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('4. throws NotFoundException (404) if inventory record does not exist for product', async () => {
      const mockProduct = makeMockProduct();
      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.findOneByProductId(mockProduct._id.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('5. throws BadRequestException (400) for invalid ObjectId format', async () => {
      await expect(service.findOneByProductId('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. List Inventory
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /inventory', () => {
    it('6. returns paginated inventory items with derived calculations', async () => {
      const mockProduct = makeMockProduct({ piecesPerBox: 4, areaPerBox: 16 });
      const aggregateResult = [
        {
          data: [
            {
              _id: makeObjectId(),
              productId: mockProduct._id,
              totalPieces: 40,
              product: mockProduct,
            },
          ],
          totalCount: [{ count: 1 }],
        },
      ];

      inventoryModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      });

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data[0].fullBoxes).toBe(10);
      expect(result.data[0].loosePieces).toBe(0);
    });

    it('7. returns empty list with totalPages = 0 when no records match', async () => {
      inventoryModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ data: [], totalCount: [] }]),
      });

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Stock-In (Receiving Complete Boxes)
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /inventory/stock-in', () => {
    it('8. atomically increments totalPieces and logs transaction in a single session', async () => {
      const mockProduct = makeMockProduct({ piecesPerBox: 4 });
      const updatedInventory = makeMockInventory(mockProduct._id, 120); // 40 + (20 * 4) = 120

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedInventory),
      });
      transactionModel.create.mockResolvedValue([{}]);

      const dto = {
        productId: mockProduct._id.toString(),
        quantity: 20,
        unit: SalesUnit.BOX as const,
      };

      const result = await service.stockIn(dto, mockOwnerUser.id);

      expect(result).toBeDefined();
      expect(result.totalPieces).toBe(120);

      // Verify transaction lifecycle
      expect(connection.startSession).toHaveBeenCalledTimes(1);
      expect(mockSession.startTransaction).toHaveBeenCalledTimes(1);

      // Verify both writes were performed with the session
      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: mockProduct._id },
        { $inc: { totalPieces: 80 } },
        { new: true, session: mockSession },
      );

      expect(transactionModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            productId: mockProduct._id,
            transactionType: InventoryTransactionType.STOCK_IN,
            physicalPieces: 80,
            salesUnit: SalesUnit.BOX,
          }),
        ],
        { session: mockSession },
      );

      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.abortTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('9. aborts transaction and rolls back if transaction logging fails', async () => {
      const mockProduct = makeMockProduct({ piecesPerBox: 4 });
      const updatedInventory = makeMockInventory(mockProduct._id, 80);

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedInventory),
      });
      transactionModel.create.mockRejectedValue(new Error('Write conflict on audit log'));

      const dto = {
        productId: mockProduct._id.toString(),
        quantity: 10,
        unit: SalesUnit.BOX as const,
      };

      await expect(service.stockIn(dto, mockOwnerUser.id)).rejects.toThrow(
        'Write conflict on audit log',
      );

      // Verify transaction was aborted and ended
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('10. rejects non-positive or fractional box quantity', async () => {
      const mockProduct = makeMockProduct();
      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });

      await expect(
        service.stockIn(
          { productId: mockProduct._id.toString(), quantity: 0, unit: SalesUnit.BOX },
          mockOwnerUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.stockIn(
          { productId: mockProduct._id.toString(), quantity: 2.5, unit: SalesUnit.BOX },
          mockOwnerUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Damage (Boxes or Pieces)
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /inventory/damage', () => {
    it('11. decrements stock by pieces and records DAMAGE transaction in a single session', async () => {
      const mockProduct = makeMockProduct({ piecesPerBox: 4 });
      const updatedInventory = makeMockInventory(mockProduct._id, 35); // 40 - 5 = 35

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedInventory),
      });
      transactionModel.create.mockResolvedValue([{}]);

      const dto = {
        productId: mockProduct._id.toString(),
        quantity: 5,
        unit: SalesUnit.PIECE as const,
        reason: 'Cracked during unloading',
      };

      const result = await service.recordDamage(dto, mockOwnerUser.id);

      expect(result.totalPieces).toBe(35);

      // Verify transaction was started and committed
      expect(mockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);

      // Verify atomic decrement with $gte guard and session
      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: mockProduct._id, totalPieces: { $gte: 5 } },
        { $inc: { totalPieces: -5 } },
        { new: true, session: mockSession },
      );

      // Verify DAMAGE transaction recorded with physicalPieces = -5 within session
      expect(transactionModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            productId: mockProduct._id,
            transactionType: InventoryTransactionType.DAMAGE,
            physicalPieces: -5,
            reason: 'Cracked during unloading',
          }),
        ],
        { session: mockSession },
      );

      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('12. calculates correct piece deduction when damaged unit is BOX', async () => {
      const mockProduct = makeMockProduct({ piecesPerBox: 4 });
      const updatedInventory = makeMockInventory(mockProduct._id, 32); // 40 - (2 * 4) = 32

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedInventory),
      });
      transactionModel.create.mockResolvedValue([{}]);

      const dto = {
        productId: mockProduct._id.toString(),
        quantity: 2,
        unit: SalesUnit.BOX as const,
        reason: 'Water damage to boxes',
      };

      await service.recordDamage(dto, mockOwnerUser.id);

      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: mockProduct._id, totalPieces: { $gte: 8 } },
        { $inc: { totalPieces: -8 } },
        { new: true, session: mockSession },
      );
      expect(transactionModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            physicalPieces: -8,
          }),
        ],
        { session: mockSession },
      );
    });

    it('13. rejects damage request exceeding available stock and aborts transaction', async () => {
      const mockProduct = makeMockProduct({ piecesPerBox: 4 });
      const existingInventory = makeMockInventory(mockProduct._id, 5);

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      // findOneAndUpdate with $gte: 10 returns null because current stock is 5
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const sessionFindOne = {
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingInventory),
      };
      inventoryModel.findOne.mockReturnValue(sessionFindOne);

      const dto = {
        productId: mockProduct._id.toString(),
        quantity: 10,
        unit: SalesUnit.PIECE as const,
        reason: 'Broken',
      };

      await expect(service.recordDamage(dto, mockOwnerUser.id)).rejects.toThrow(
        BadRequestException,
      );

      // Verify transaction aborted
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('14. rejects damage request with missing or empty reason', async () => {
      await expect(
        service.recordDamage(
          {
            productId: makeObjectId().toString(),
            quantity: 1,
            unit: SalesUnit.PIECE,
            reason: '   ',
          },
          mockOwnerUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('15. aborts transaction if transaction write fails during damage recording', async () => {
      const mockProduct = makeMockProduct({ piecesPerBox: 4 });
      const updatedInventory = makeMockInventory(mockProduct._id, 35);

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedInventory),
      });
      transactionModel.create.mockRejectedValue(new Error('Transaction write failed'));

      const dto = {
        productId: mockProduct._id.toString(),
        quantity: 5,
        unit: SalesUnit.PIECE as const,
        reason: 'Shattered',
      };

      await expect(service.recordDamage(dto, mockOwnerUser.id)).rejects.toThrow(
        'Transaction write failed',
      );

      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Manual Adjustment
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /inventory/adjustment', () => {
    it('16. positive adjustment increases stock and logs signed positive transaction in a session', async () => {
      const mockProduct = makeMockProduct();
      const updatedInventory = makeMockInventory(mockProduct._id, 45); // 40 + 5

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedInventory),
      });
      transactionModel.create.mockResolvedValue([{}]);

      const dto = {
        productId: mockProduct._id.toString(),
        physicalPieces: 5,
        reason: 'Physical count surplus',
      };

      const result = await service.adjustStock(dto, mockOwnerUser.id);
      expect(result.totalPieces).toBe(45);

      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: mockProduct._id },
        { $inc: { totalPieces: 5 } },
        { new: true, session: mockSession },
      );

      expect(transactionModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            transactionType: InventoryTransactionType.ADJUSTMENT,
            physicalPieces: 5,
            reason: 'Physical count surplus',
          }),
        ],
        { session: mockSession },
      );

      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('17. negative adjustment decreases stock with $gte guard and logs signed negative transaction in a session', async () => {
      const mockProduct = makeMockProduct();
      const updatedInventory = makeMockInventory(mockProduct._id, 37); // 40 - 3

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedInventory),
      });
      transactionModel.create.mockResolvedValue([{}]);

      const dto = {
        productId: mockProduct._id.toString(),
        physicalPieces: -3,
        reason: 'Stock shrinkage correction',
      };

      const result = await service.adjustStock(dto, mockOwnerUser.id);
      expect(result.totalPieces).toBe(37);

      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: mockProduct._id, totalPieces: { $gte: 3 } },
        { $inc: { totalPieces: -3 } },
        { new: true, session: mockSession },
      );

      expect(transactionModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            transactionType: InventoryTransactionType.ADJUSTMENT,
            physicalPieces: -3,
          }),
        ],
        { session: mockSession },
      );

      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('18. rejects adjustment with 0 physical pieces', async () => {
      await expect(
        service.adjustStock(
          {
            productId: makeObjectId().toString(),
            physicalPieces: 0,
            reason: 'Zero change',
          },
          mockOwnerUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('19. rejects negative adjustment exceeding available stock and aborts transaction', async () => {
      const mockProduct = makeMockProduct();
      const existingInventory = makeMockInventory(mockProduct._id, 5);

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      inventoryModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const sessionFindOne = {
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingInventory),
      };
      inventoryModel.findOne.mockReturnValue(sessionFindOne);

      const dto = {
        productId: mockProduct._id.toString(),
        physicalPieces: -10, // Available is only 5
        reason: 'Shrinkage',
      };

      await expect(service.adjustStock(dto, mockOwnerUser.id)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('20. rejects adjustment with missing or empty reason', async () => {
      await expect(
        service.adjustStock(
          {
            productId: makeObjectId().toString(),
            physicalPieces: 2,
            reason: '',
          },
          mockOwnerUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Audit History
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /inventory/:productId/history', () => {
    it('21. returns paginated transactions sorted by createdAt: -1', async () => {
      const mockProduct = makeMockProduct();
      const mockTransactions = [
        {
          _id: makeObjectId(),
          productId: mockProduct._id,
          transactionType: InventoryTransactionType.STOCK_IN,
          physicalPieces: 80,
          createdAt: new Date(),
        },
      ];

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      transactionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockTransactions),
            }),
          }),
        }),
      });
      transactionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.getHistory(mockProduct._id.toString(), {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('22. filters transaction history by transactionType', async () => {
      const mockProduct = makeMockProduct();

      productModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });
      transactionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      transactionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.getHistory(mockProduct._id.toString(), {
        transactionType: InventoryTransactionType.DAMAGE,
      });

      expect(transactionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: InventoryTransactionType.DAMAGE,
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Authorization & Controller Guarantees
  // ───────────────────────────────────────────────────────────────────────────
  describe('Authorization & Route Protection', () => {
    it('23. JwtAuthGuard and RolesGuard are applied to InventoryController', () => {
      const guards = Reflect.getMetadata('__guards__', InventoryController);
      expect(guards).toBeDefined();

      const hasJwtGuard = guards.some(
        (g: unknown) =>
          g === JwtAuthGuard || (typeof g === 'function' && g.name === 'JwtAuthGuard'),
      );
      const hasRolesGuard = guards.some(
        (g: unknown) =>
          g === RolesGuard || (typeof g === 'function' && g.name === 'RolesGuard'),
      );

      expect(hasJwtGuard).toBe(true);
      expect(hasRolesGuard).toBe(true);
    });

    it('24. @Roles(UserRole.OWNER) is attached to stock-in, damage, and adjustment endpoints', () => {
      const stockInRoles = Reflect.getMetadata(
        ROLES_KEY,
        InventoryController.prototype.stockIn,
      );
      const damageRoles = Reflect.getMetadata(
        ROLES_KEY,
        InventoryController.prototype.recordDamage,
      );
      const adjustmentRoles = Reflect.getMetadata(
        ROLES_KEY,
        InventoryController.prototype.adjustStock,
      );

      expect(stockInRoles).toEqual([UserRole.OWNER]);
      expect(damageRoles).toEqual([UserRole.OWNER]);
      expect(adjustmentRoles).toEqual([UserRole.OWNER]);
    });

    it('25. read endpoints (findAll, findOne, getHistory) have no @Roles restriction', () => {
      const findAllRoles = Reflect.getMetadata(
        ROLES_KEY,
        InventoryController.prototype.findAll,
      );
      const findOneRoles = Reflect.getMetadata(
        ROLES_KEY,
        InventoryController.prototype.findOne,
      );
      const historyRoles = Reflect.getMetadata(
        ROLES_KEY,
        InventoryController.prototype.getHistory,
      );

      expect(findAllRoles).toBeUndefined();
      expect(findOneRoles).toBeUndefined();
      expect(historyRoles).toBeUndefined();
    });

    it('26. RolesGuard blocks non-OWNER role on mutation endpoints with ForbiddenException', () => {
      const reflector = new Reflector();
      const rolesGuard = new RolesGuard(reflector);

      const context = {
        getHandler: () => InventoryController.prototype.stockIn,
        getClass: () => InventoryController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'STAFF' } }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('27. RolesGuard permits OWNER role on mutation endpoints', () => {
      const reflector = new Reflector();
      const rolesGuard = new RolesGuard(reflector);

      const context = {
        getHandler: () => InventoryController.prototype.stockIn,
        getClass: () => InventoryController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: UserRole.OWNER } }),
        }),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Controller Delegation
  // ───────────────────────────────────────────────────────────────────────────
  describe('Controller Delegation', () => {
    it('28. controller.findAll delegates to service.findAll', async () => {
      const mockResponse = { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      jest.spyOn(service, 'findAll').mockResolvedValue(mockResponse);

      const result = await controller.findAll({});
      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith({});
    });

    it('29. controller.findOne delegates to service.findOneByProductId', async () => {
      const mockProduct = makeMockProduct();
      const mockResult: any = { _id: 'inv1', productId: mockProduct, totalPieces: 10 };
      jest.spyOn(service, 'findOneByProductId').mockResolvedValue(mockResult);

      const result = await controller.findOne(mockProduct._id.toString());
      expect(result).toEqual({ inventory: mockResult });
      expect(service.findOneByProductId).toHaveBeenCalledWith(
        mockProduct._id.toString(),
      );
    });

    it('30. controller.getHistory delegates to service.getHistory', async () => {
      const mockResponse = { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      jest.spyOn(service, 'getHistory').mockResolvedValue(mockResponse);

      const result = await controller.getHistory('p1', {});
      expect(result).toEqual(mockResponse);
      expect(service.getHistory).toHaveBeenCalledWith('p1', {});
    });

    it('31. controller.stockIn delegates to service.stockIn with user.id', async () => {
      const mockResult: any = { _id: 'inv1', totalPieces: 80 };
      jest.spyOn(service, 'stockIn').mockResolvedValue(mockResult);

      const dto = { productId: 'p1', quantity: 20, unit: SalesUnit.BOX as const };
      const result = await controller.stockIn(dto, mockOwnerUser);

      expect(result).toEqual({ inventory: mockResult });
      expect(service.stockIn).toHaveBeenCalledWith(dto, mockOwnerUser.id);
    });

    it('32. controller.recordDamage delegates to service.recordDamage with user.id', async () => {
      const mockResult: any = { _id: 'inv1', totalPieces: 35 };
      jest.spyOn(service, 'recordDamage').mockResolvedValue(mockResult);

      const dto = {
        productId: 'p1',
        quantity: 5,
        unit: SalesUnit.PIECE as const,
        reason: 'Broken',
      };
      const result = await controller.recordDamage(dto, mockOwnerUser);

      expect(result).toEqual({ inventory: mockResult });
      expect(service.recordDamage).toHaveBeenCalledWith(dto, mockOwnerUser.id);
    });

    it('33. controller.adjustStock delegates to service.adjustStock with user.id', async () => {
      const mockResult: any = { _id: 'inv1', totalPieces: 45 };
      jest.spyOn(service, 'adjustStock').mockResolvedValue(mockResult);

      const dto = { productId: 'p1', physicalPieces: 5, reason: 'Found stock' };
      const result = await controller.adjustStock(dto, mockOwnerUser);

      expect(result).toEqual({ inventory: mockResult });
      expect(service.adjustStock).toHaveBeenCalledWith(dto, mockOwnerUser.id);
    });
  });
});
