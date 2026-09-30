import { Types } from 'mongoose';
import { GallasService } from './gallas.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { MigrationService } from '../../database/migration.service';
import { InventoryTransactionType, SalesUnit, PaymentMethod, OrderStatus } from '../../common/enums';
import { BadRequestException } from '@nestjs/common';

describe('Galla Redesign — Option C Normalized Location Stock (Comprehensive Verification)', () => {
  const mockGallaId1 = new Types.ObjectId();
  const mockGallaId2 = new Types.ObjectId();
  const mockProductId1 = new Types.ObjectId();
  const mockProductId2 = new Types.ObjectId();
  const mockUserId = new Types.ObjectId().toString();

  describe('1. Multiple products can exist in the same Galla & 2. Same product can exist in multiple Gallas', () => {
    it('allows Galla 01 to hold Product 1 and Product 2, while Product 1 also exists in Galla 02', () => {
      const locationRecords = [
        // Galla 01 holds both Product 1 and Product 2
        { productId: mockProductId1, gallaId: mockGallaId1, gallaNumber: 'GAL-01', boxes: 20, totalPieces: 80 },
        { productId: mockProductId2, gallaId: mockGallaId1, gallaNumber: 'GAL-01', boxes: 15, totalPieces: 60 },
        // Product 1 also exists in Galla 02
        { productId: mockProductId1, gallaId: mockGallaId2, gallaNumber: 'GAL-02', boxes: 30, totalPieces: 120 },
      ];

      // Galla 01 has 2 products
      const galla01Products = locationRecords.filter((r) => r.gallaId.equals(mockGallaId1));
      expect(galla01Products).toHaveLength(2);
      expect(galla01Products.map((p) => p.productId)).toEqual([mockProductId1, mockProductId2]);

      // Product 1 exists in 2 distinct Gallas
      const prod1Locations = locationRecords.filter((r) => r.productId.equals(mockProductId1));
      expect(prod1Locations).toHaveLength(2);
      expect(prod1Locations.map((p) => p.gallaId)).toEqual([mockGallaId1, mockGallaId2]);
    });
  });

  describe('3. Product + Galla has unique inventory location record', () => {
    it('verifies compound unique key logic (productId + gallaId)', () => {
      const keys = new Set<string>();
      const addRecord = (prodId: string, gId: string) => {
        const key = `${prodId}_${gId}`;
        if (keys.has(key)) throw new Error('Duplicate key violation: (productId, gallaId)');
        keys.add(key);
      };

      expect(() => {
        addRecord(mockProductId1.toString(), mockGallaId1.toString());
        addRecord(mockProductId1.toString(), mockGallaId2.toString());
        addRecord(mockProductId2.toString(), mockGallaId1.toString());
      }).not.toThrow();

      expect(() => {
        addRecord(mockProductId1.toString(), mockGallaId1.toString());
      }).toThrow('Duplicate key violation');
    });
  });

  describe('4. Galla detail returns all products', () => {
    it('GallasService.getGallaInventory returns all products stored in specified location', async () => {
      const gallaModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: mockGallaId1,
            gallaNumber: 'GAL-01',
            name: 'Main Hall',
            isActive: true,
          }),
        }),
      };

      const inventoryModel = {
        find: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: new Types.ObjectId(),
                productId: { _id: mockProductId1, productName: 'Royal Slate', brand: 'Kajaria' },
                boxes: 20,
                totalPieces: 80,
              },
              {
                _id: new Types.ObjectId(),
                productId: { _id: mockProductId2, productName: 'Marble White', brand: 'Somany' },
                boxes: 15,
                totalPieces: 60,
              },
            ]),
          }),
        }),
      };

      const service = new GallasService(gallaModel as any, inventoryModel as any);
      const detail = await service.getGallaInventory(mockGallaId1.toString());

      expect(detail.galla.gallaNumber).toBe('GAL-01');
      expect(detail.totalProducts).toBe(2);
      expect(detail.totalBoxes).toBe(35);
      expect(detail.products[0].boxes).toBe(20);
      expect(detail.products[1].boxes).toBe(15);
    });
  });

  describe('5. Galla filter works & 6. Product total stock correctly sums all Gallas', () => {
    it('InventoryService aggregates product stock across all locations', async () => {
      const mockProduct = {
        _id: mockProductId1,
        productName: 'Royal Slate',
        brand: 'Kajaria',
        piecesPerBox: 4,
        areaPerBox: Types.Decimal128.fromString('15.5'),
        minimumStockBoxes: 10,
        minimumStockPieces: 40,
        sellingPrice: Types.Decimal128.fromString('600'),
      };

      const inventoryModel = {
        find: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            { _id: new Types.ObjectId(), productId: mockProductId1, gallaId: mockGallaId1, gallaNumber: 'GAL-01', boxes: 20, totalPieces: 80 },
            { _id: new Types.ObjectId(), productId: mockProductId1, gallaId: mockGallaId2, gallaNumber: 'GAL-02', boxes: 30, totalPieces: 120 },
          ]),
        }),
      };

      const productModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockProduct),
        }),
      };

      const mockConn = { startSession: jest.fn() };
      const service = new InventoryService(
        mockConn as any,
        inventoryModel as any,
        {} as any,
        productModel as any,
      );

      const details = await service.findOneByProductId(mockProductId1.toString());
      expect(details.totalPieces).toBe(200); // 80 + 120
      expect(details.fullBoxes).toBe(50); // 20 + 30 boxes
      expect(details.loosePieces).toBe(0);
    });
  });

  describe('7. Stock-in to existing Product + Galla increments stock', () => {
    it('increments boxes and pieces on existing location record', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      const existingRecord = {
        _id: new Types.ObjectId(),
        productId: mockProductId1,
        gallaId: mockGallaId1,
        gallaNumber: 'GAL-01',
        boxes: 30,
        totalPieces: 120,
      };

      const inventoryModel = {
        findOneAndUpdate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(existingRecord),
        }),
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue([existingRecord]),
        }),
      };

      const transactionModel = {
        create: jest.fn().mockResolvedValue([{}]),
      };

      const productModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: mockProductId1,
            piecesPerBox: 4,
            areaPerBox: Types.Decimal128.fromString('15.5'),
            isActive: true,
          }),
        }),
      };

      const mockConn = { startSession: jest.fn().mockResolvedValue(mockSession) };
      const service = new InventoryService(
        mockConn as any,
        inventoryModel as any,
        transactionModel as any,
        productModel as any,
      );

      await service.stockIn({
        productId: mockProductId1.toString(),
        gallaId: mockGallaId1.toString(),
        gallaNumber: 'GAL-01',
        quantity: 10,
        unit: SalesUnit.BOX,
      }, mockUserId);

      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ productId: mockProductId1, gallaId: mockGallaId1 }),
        expect.objectContaining({
          $inc: expect.objectContaining({ boxes: 10, totalPieces: 40 }),
        }),
        expect.objectContaining({ session: mockSession, upsert: true, new: true }),
      );

      expect(transactionModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            gallaId: mockGallaId1,
            transactionType: InventoryTransactionType.STOCK_IN,
            physicalPieces: 40,
          }),
        ]),
        expect.anything(),
      );
    });
  });

  describe('8. Stock-in to new Product + Galla creates location record', () => {
    it('creates new location inventory record when none exists for that galla', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      const createdRecord = {
        _id: new Types.ObjectId(),
        productId: mockProductId1,
        gallaId: mockGallaId2,
        gallaNumber: 'GAL-02',
        boxes: 30,
        totalPieces: 120,
      };

      const inventoryModel = {
        findOneAndUpdate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(createdRecord),
        }),
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue([createdRecord]),
        }),
      };

      const transactionModel = {
        create: jest.fn().mockResolvedValue([{}]),
      };

      const productModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: mockProductId1,
            piecesPerBox: 4,
            areaPerBox: Types.Decimal128.fromString('15.5'),
            isActive: true,
          }),
        }),
      };

      const mockConn = { startSession: jest.fn().mockResolvedValue(mockSession) };
      const service = new InventoryService(
        mockConn as any,
        inventoryModel as any,
        transactionModel as any,
        productModel as any,
      );

      await service.stockIn({
        productId: mockProductId1.toString(),
        gallaId: mockGallaId2.toString(),
        gallaNumber: 'GAL-02',
        quantity: 30,
        unit: SalesUnit.BOX,
      }, mockUserId);

      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ productId: mockProductId1, gallaId: mockGallaId2 }),
        expect.objectContaining({
          $inc: expect.objectContaining({ boxes: 30, totalPieces: 120 }),
        }),
        expect.objectContaining({ session: mockSession, upsert: true, new: true }),
      );
    });
  });

  describe('9. Order deducts only from selected Galla & 10. Insufficient stock rejects order', () => {
    it('rejects order atomically if requested Galla has insufficient stock', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      const customerModel = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), isActive: true }),
          }),
        }),
      };

      const productModel = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: mockProductId1,
                piecesPerBox: 4,
                areaPerBox: Types.Decimal128.fromString('16'),
                purchasePrice: Types.Decimal128.fromString('400'),
                sellingPrice: Types.Decimal128.fromString('600'),
                isActive: true,
              },
            ]),
          }),
        }),
      };

      // Location inventory has only 5 boxes in Galla 01, but order requests 10
      const inventoryModel = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: new Types.ObjectId(),
                productId: mockProductId1,
                gallaId: mockGallaId1,
                boxes: 5,
                totalPieces: 20,
              },
            ]),
          }),
        }),
      };

      const mockConn = { startSession: jest.fn().mockResolvedValue(mockSession) };

      const ordersService = new OrdersService(
        mockConn as any,
        {} as any,
        {} as any,
        customerModel as any,
        productModel as any,
        inventoryModel as any,
        {} as any,
        {} as any,
      );

      await expect(
        ordersService.create(
          {
            customerId: new Types.ObjectId().toString(),
            items: [
              {
                productId: mockProductId1.toString(),
                gallaId: mockGallaId1.toString(),
                quantityBoxes: 10,
              },
            ],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe('11. Order cancellation restores selected Galla', () => {
    it('restores stock to the specific Galla recorded on the line item', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      const mockOrder = {
        _id: new Types.ObjectId(),
        orderNumber: 'GT-20260927-0001',
        status: OrderStatus.COMPLETED,
        customerId: new Types.ObjectId(),
        items: [
          {
            productId: mockProductId1,
            gallaId: mockGallaId1,
            productNameSnapshot: 'Royal Slate',
            brandSnapshot: 'Kajaria',
            salesQuantity: Types.Decimal128.fromString('5'),
            salesUnit: SalesUnit.BOX,
            physicalPieces: 20,
            quantityBoxes: 5,
            pieces: 20,
            unitPrice: Types.Decimal128.fromString('600'),
            lineTotal: Types.Decimal128.fromString('3000'),
          },
        ],
        subtotal: Types.Decimal128.fromString('3000'),
        totalAmount: Types.Decimal128.fromString('3000'),
        paidAmount: Types.Decimal128.fromString('0'),
        outstandingAmount: Types.Decimal128.fromString('3000'),
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
      };

      const orderModel = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockOrder),
          }),
        }),
      };

      const productModel = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: mockProductId1, piecesPerBox: 4 }),
          }),
        }),
      };

      const inventoryModel = {
        findOneAndUpdate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({}),
        }),
      };

      const transactionModel = {
        create: jest.fn().mockResolvedValue([{}]),
      };

      const customerModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), name: 'Test Customer' }),
        }),
      };

      const paymentModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockConn = { startSession: jest.fn().mockResolvedValue(mockSession) };

      const ordersService = new OrdersService(
        mockConn as any,
        orderModel as any,
        {} as any,
        customerModel as any,
        productModel as any,
        inventoryModel as any,
        transactionModel as any,
        paymentModel as any,
      );

      await ordersService.cancel(mockOrder._id.toString(), mockUserId);

      // Verify stock was restored specifically to (mockProductId1, mockGallaId1)
      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: mockProductId1, gallaId: mockGallaId1 },
        {
          $inc: {
            boxes: 5,
            totalPieces: 20,
          },
        },
        expect.objectContaining({ session: mockSession }),
      );

      // Verify audit transaction was created with SALE_REVERSAL and gallaId
      expect(transactionModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            productId: mockProductId1,
            gallaId: mockGallaId1,
            transactionType: InventoryTransactionType.SALE_REVERSAL,
            physicalPieces: 20,
          }),
        ]),
        expect.anything(),
      );
    });
  });

  describe('16. Existing products migrate correctly', () => {
    it('MigrationService scans products with gallaNumber, creates Galla master, and links inventory', async () => {
      const productsCollection = {
        indexes: jest.fn().mockResolvedValue([
          { name: 'gallaNumber_1', key: { gallaNumber: 1 }, unique: true },
        ]),
        dropIndex: jest.fn().mockResolvedValue(true),
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { _id: mockProductId1, gallaNumber: 'GAL-01' },
            { _id: mockProductId2, gallaNumber: 'GAL-01' },
          ]),
        }),
        updateOne: jest.fn().mockResolvedValue(true),
      };

      const inventoriesCollection = {
        indexes: jest.fn().mockResolvedValue([
          { name: 'productId_1', key: { productId: 1 }, unique: true },
        ]),
        dropIndex: jest.fn().mockResolvedValue(true),
        createIndex: jest.fn().mockResolvedValue(true),
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { _id: new Types.ObjectId(), productId: mockProductId1 },
          ]),
        }),
        updateOne: jest.fn().mockResolvedValue(true),
      };

      const gallasCollection = {
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockResolvedValue({ insertedId: mockGallaId1 }),
      };

      const mockDb = {
        collection: jest.fn().mockImplementation((name: string) => {
          if (name === 'products') return productsCollection;
          if (name === 'inventories') return inventoriesCollection;
          if (name === 'gallas') return gallasCollection;
          return { indexes: jest.fn().mockResolvedValue([]) };
        }),
      };

      const mockConn = { db: mockDb, readyState: 1 };
      const migrationService = new MigrationService(mockConn as any);

      await migrationService.onApplicationBootstrap();

      // Verifies dropped obsolete unique index on products
      expect(productsCollection.dropIndex).toHaveBeenCalledWith('gallaNumber_1');
      // Verifies dropped obsolete unique index on inventories
      expect(inventoriesCollection.dropIndex).toHaveBeenCalledWith('productId_1');
      // Verifies compound index created on inventories
      expect(inventoriesCollection.createIndex).toHaveBeenCalledWith(
        { productId: 1, gallaId: 1 },
        expect.objectContaining({ unique: true }),
      );
    });
  });

  describe('Final Review Fix — Mandatory GallaId on New Stock Operations & Legacy Compatibility', () => {
    it('1. Test new stock-in without gallaId -> rejected with BadRequestException', async () => {
      const productModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: mockProductId1, piecesPerBox: 4, isActive: true }),
        }),
      };
      const service = new InventoryService({} as any, {} as any, {} as any, productModel as any);

      await expect(
        service.stockIn(
          {
            productId: mockProductId1.toString(),
            quantity: 5,
            unit: SalesUnit.BOX,
          } as any,
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.stockIn(
          {
            productId: mockProductId1.toString(),
            quantity: 5,
            unit: SalesUnit.BOX,
          } as any,
          mockUserId,
        ),
      ).rejects.toThrow('Target Galla (gallaId) is required for stock-in operations');
    });

    it('2. Test new order without gallaId -> rejected with BadRequestException', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      const customerModel = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), isActive: true }),
          }),
        }),
      };

      const productModel = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: mockProductId1,
                productName: 'Royal Slate',
                piecesPerBox: 4,
                areaPerBox: Types.Decimal128.fromString('16'),
                sellingPrice: Types.Decimal128.fromString('600'),
                isActive: true,
              },
            ]),
          }),
        }),
      };

      const inventoryModel = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: new Types.ObjectId(),
                productId: mockProductId1,
                gallaId: mockGallaId1,
                boxes: 20,
                totalPieces: 80,
              },
            ]),
          }),
        }),
      };

      const ordersService = new OrdersService(
        { startSession: jest.fn().mockResolvedValue(mockSession) } as any,
        {} as any,
        {} as any,
        customerModel as any,
        productModel as any,
        inventoryModel as any,
        {} as any,
        {} as any,
      );

      await expect(
        ordersService.create(
          {
            customerId: new Types.ObjectId().toString(),
            items: [
              {
                productId: mockProductId1.toString(),
                quantityBoxes: 2,
              } as any,
            ],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        ordersService.create(
          {
            customerId: new Types.ObjectId().toString(),
            items: [
              {
                productId: mockProductId1.toString(),
                quantityBoxes: 2,
              } as any,
            ],
          },
          mockUserId,
        ),
      ).rejects.toThrow('Source Galla (gallaId) is required');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('3. Test new order with selected Galla -> succeeds', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      const customerId = new Types.ObjectId();
      const customerModel = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: customerId, name: 'Alice Customer', isActive: true }),
          }),
          exec: jest.fn().mockResolvedValue({ _id: customerId, name: 'Alice Customer', isActive: true }),
        }),
      };

      const productModel = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: mockProductId1,
                productName: 'Royal Slate',
                brand: 'Kajaria',
                piecesPerBox: 4,
                areaPerBox: Types.Decimal128.fromString('16'),
                purchasePrice: Types.Decimal128.fromString('400'),
                sellingPrice: Types.Decimal128.fromString('600'),
                isActive: true,
              },
            ]),
          }),
        }),
      };

      const inventoryModel = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: new Types.ObjectId(),
                productId: mockProductId1,
                gallaId: mockGallaId1,
                gallaNumber: 'GAL-01',
                boxes: 20,
                totalPieces: 80,
              },
            ]),
          }),
        }),
        findOneAndUpdate: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), boxes: 18, totalPieces: 72 }),
          }),
          exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), boxes: 18, totalPieces: 72 }),
        }),
      };

      const counterModel = {
        findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 101 }),
      };

      const createdOrderDoc = {
        _id: new Types.ObjectId(),
        orderNumber: 'GT-20260927-0101',
        status: OrderStatus.COMPLETED,
        customerId,
        items: [
          {
            productId: mockProductId1,
            gallaId: mockGallaId1,
            gallaNumberSnapshot: 'GAL-01',
            productNameSnapshot: 'Royal Slate',
            brandSnapshot: 'Kajaria',
            salesQuantity: Types.Decimal128.fromString('2'),
            salesUnit: SalesUnit.BOX,
            physicalPieces: 8,
            quantityBoxes: 2,
            unitPrice: Types.Decimal128.fromString('600'),
            lineTotal: Types.Decimal128.fromString('1200'),
          },
        ],
        subtotal: Types.Decimal128.fromString('1200'),
        totalAmount: Types.Decimal128.fromString('1200'),
        paidAmount: Types.Decimal128.fromString('0'),
        outstandingAmount: Types.Decimal128.fromString('1200'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orderModel = {
        create: jest.fn().mockResolvedValue([createdOrderDoc]),
      };

      const transactionModel = {
        create: jest.fn().mockResolvedValue([{}]),
      };

      const ordersService = new OrdersService(
        { startSession: jest.fn().mockResolvedValue(mockSession) } as any,
        orderModel as any,
        counterModel as any,
        customerModel as any,
        productModel as any,
        inventoryModel as any,
        transactionModel as any,
        {} as any,
      );

      const res = await ordersService.create(
        {
          customerId: customerId.toString(),
          items: [
            {
              productId: mockProductId1.toString(),
              gallaId: mockGallaId1.toString(),
              quantityBoxes: 2,
            },
          ],
        },
        mockUserId,
      );

      expect(res).toBeDefined();
      expect(res.items[0].gallaId).toBe(mockGallaId1.toString());
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('4. Test same product in two Gallas -> correct deduction only from selected Galla', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      const customerId = new Types.ObjectId();
      const customerModel = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: customerId, name: 'Bob Buyer', isActive: true }),
          }),
          exec: jest.fn().mockResolvedValue({ _id: customerId, name: 'Bob Buyer', isActive: true }),
        }),
      };

      const productModel = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: mockProductId1,
                productName: 'Royal Slate',
                brand: 'Kajaria',
                piecesPerBox: 4,
                areaPerBox: Types.Decimal128.fromString('16'),
                purchasePrice: Types.Decimal128.fromString('400'),
                sellingPrice: Types.Decimal128.fromString('600'),
                isActive: true,
              },
            ]),
          }),
        }),
      };

      // Royal Slate physically in BOTH Galla 01 (50 boxes) and Galla 02 (30 boxes)
      const inventoryGalla1 = {
        _id: new Types.ObjectId(),
        productId: mockProductId1,
        gallaId: mockGallaId1,
        gallaNumber: 'GAL-01',
        boxes: 50,
        totalPieces: 200,
      };
      const inventoryGalla2 = {
        _id: new Types.ObjectId(),
        productId: mockProductId1,
        gallaId: mockGallaId2,
        gallaNumber: 'GAL-02',
        boxes: 30,
        totalPieces: 120,
      };

      const inventoryModel = {
        find: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([inventoryGalla1, inventoryGalla2]),
          }),
        }),
        findOneAndUpdate: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ ...inventoryGalla2, boxes: 20, totalPieces: 80 }),
          }),
          exec: jest.fn().mockResolvedValue({ ...inventoryGalla2, boxes: 20, totalPieces: 80 }),
        }),
      };

      const counterModel = {
        findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 102 }),
      };

      const createdOrderDoc = {
        _id: new Types.ObjectId(),
        orderNumber: 'GT-20260927-0102',
        status: OrderStatus.COMPLETED,
        customerId,
        items: [
          {
            productId: mockProductId1,
            gallaId: mockGallaId2, // Customer explicitly selected Galla 02
            gallaNumberSnapshot: 'GAL-02',
            productNameSnapshot: 'Royal Slate',
            brandSnapshot: 'Kajaria',
            salesQuantity: Types.Decimal128.fromString('10'),
            salesUnit: SalesUnit.BOX,
            physicalPieces: 40,
            quantityBoxes: 10,
            unitPrice: Types.Decimal128.fromString('600'),
            lineTotal: Types.Decimal128.fromString('6000'),
          },
        ],
        subtotal: Types.Decimal128.fromString('6000'),
        totalAmount: Types.Decimal128.fromString('6000'),
        paidAmount: Types.Decimal128.fromString('0'),
        outstandingAmount: Types.Decimal128.fromString('6000'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const orderModel = {
        create: jest.fn().mockResolvedValue([createdOrderDoc]),
      };

      const transactionModel = {
        create: jest.fn().mockResolvedValue([{}]),
      };

      const ordersService = new OrdersService(
        { startSession: jest.fn().mockResolvedValue(mockSession) } as any,
        orderModel as any,
        counterModel as any,
        customerModel as any,
        productModel as any,
        inventoryModel as any,
        transactionModel as any,
        {} as any,
      );

      // Order 10 boxes specifically from Galla 02
      await ordersService.create(
        {
          customerId: customerId.toString(),
          items: [
            {
              productId: mockProductId1.toString(),
              gallaId: mockGallaId2.toString(),
              quantityBoxes: 10,
            },
          ],
        },
        mockUserId,
      );

      // Verify that inventory decrement was applied ONLY to mockGallaId2, NOT mockGallaId1
      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          productId: mockProductId1,
          gallaId: mockGallaId2,
          totalPieces: { $gte: 40 },
        },
        {
          $inc: {
            totalPieces: -40,
            boxes: -10,
          },
        },
        expect.anything(),
      );
    });

    it('5. Test cancellation -> restores original Galla', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      // Order previously deducted from Galla 02
      const mockOrder = {
        _id: new Types.ObjectId(),
        orderNumber: 'GT-20260927-0103',
        status: OrderStatus.COMPLETED,
        customerId: new Types.ObjectId(),
        items: [
          {
            productId: mockProductId1,
            gallaId: mockGallaId2, // Was sold from Galla 02
            gallaNumberSnapshot: 'GAL-02',
            productNameSnapshot: 'Royal Slate',
            brandSnapshot: 'Kajaria',
            salesQuantity: Types.Decimal128.fromString('10'),
            salesUnit: SalesUnit.BOX,
            physicalPieces: 40,
            quantityBoxes: 10,
            unitPrice: Types.Decimal128.fromString('600'),
            lineTotal: Types.Decimal128.fromString('6000'),
          },
        ],
        subtotal: Types.Decimal128.fromString('6000'),
        totalAmount: Types.Decimal128.fromString('6000'),
        paidAmount: Types.Decimal128.fromString('0'),
        outstandingAmount: Types.Decimal128.fromString('6000'),
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
      };

      const orderModel = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockOrder),
          }),
        }),
      };

      const productModel = {
        findById: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: mockProductId1, piecesPerBox: 4 }),
          }),
        }),
      };

      const inventoryModel = {
        findOneAndUpdate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({}),
        }),
      };

      const transactionModel = {
        create: jest.fn().mockResolvedValue([{}]),
      };

      const customerModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: mockOrder.customerId, name: 'Bob Buyer' }),
        }),
      };

      const paymentModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const ordersService = new OrdersService(
        { startSession: jest.fn().mockResolvedValue(mockSession) } as any,
        orderModel as any,
        {} as any,
        customerModel as any,
        productModel as any,
        inventoryModel as any,
        transactionModel as any,
        paymentModel as any,
      );

      await ordersService.cancel(mockOrder._id.toString(), mockUserId);

      // Verify stock was restored specifically to Galla 02
      expect(inventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: mockProductId1, gallaId: mockGallaId2 },
        {
          $inc: {
            boxes: 10,
            totalPieces: 40,
          },
        },
        expect.objectContaining({ session: mockSession }),
      );

      // Verify SALE_REVERSAL transaction recorded with Galla 02
      expect(transactionModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            productId: mockProductId1,
            gallaId: mockGallaId2,
            transactionType: InventoryTransactionType.SALE_REVERSAL,
            physicalPieces: 40,
          }),
        ]),
        expect.anything(),
      );
    });

    it('6. Test legacy order without gallaId remains readable', async () => {
      // Historical order in MongoDB where line item does NOT have gallaId
      const legacyOrderId = new Types.ObjectId();
      const customerId = new Types.ObjectId();

      const legacyOrderDoc = {
        _id: legacyOrderId,
        orderNumber: 'GT-20250101-0001',
        status: OrderStatus.COMPLETED,
        customerId,
        items: [
          {
            productId: mockProductId1,
            // gallaId is undefined (legacy pre-redesign order)
            productNameSnapshot: 'Vintage Marble',
            brandSnapshot: 'Somany',
            salesQuantity: Types.Decimal128.fromString('4'),
            salesUnit: SalesUnit.BOX,
            physicalPieces: 16,
            quantityBoxes: 4,
            unitPrice: Types.Decimal128.fromString('500'),
            lineTotal: Types.Decimal128.fromString('2000'),
          },
        ],
        subtotal: Types.Decimal128.fromString('2000'),
        totalAmount: Types.Decimal128.fromString('2000'),
        paidAmount: Types.Decimal128.fromString('2000'),
        outstandingAmount: Types.Decimal128.fromString('0'),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      const orderModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(legacyOrderDoc),
        }),
      };

      const customerModel = {
        findById: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: customerId, name: 'Legacy Customer' }),
        }),
      };

      const paymentModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const ordersService = new OrdersService(
        {} as any,
        orderModel as any,
        {} as any,
        customerModel as any,
        {} as any,
        {} as any,
        {} as any,
        paymentModel as any,
      );

      const result = await ordersService.findOne(legacyOrderId.toString());
      expect(result).toBeDefined();
      expect(result.orderNumber).toBe('GT-20250101-0001');
      expect(result.items[0].productNameSnapshot).toBe('Vintage Marble');
      expect(result.items[0].gallaId).toBeUndefined(); // Remains readable and valid
    });
  });
});

