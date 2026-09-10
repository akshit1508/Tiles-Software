/**
 * Products Module Unit Tests
 *
 * Tests ProductsService and ProductsController in isolation using Jest mocks.
 * No MongoDB connection required.
 *
 * Coverage:
 *  1.  Create product successfully
 *  2.  Create product — required-field validation (gallaNumber missing)
 *  3.  Create product — duplicate gallaNumber → 409 Conflict
 *  4.  Create product — inventory initialization happens
 *  5.  List products — defaults to isActive=true
 *  6.  List products — pagination metadata correct
 *  7.  List products — isActive=false filter returns inactive
 *  8.  Get product by id — success
 *  9.  Get product by id — not found → 404
 *  10. Get product by id — invalid ObjectId → 400
 *  11. Update product — success
 *  12. Update product — gallaNumber update + duplicate protection → 409
 *  13. Update product — not found → 404
 *  14. Deactivate product — success
 *  15. Deactivate product — already inactive → 409
 *  16. Activate product — success
 *  17. Activate product — already active → 409
 *  18. Authentication — JwtAuthGuard is applied to the controller
 */

import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './schemas/product.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeProductId(): Types.ObjectId {
  return new Types.ObjectId();
}

function makeProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = makeProductId();
  return {
    _id: id,
    brand: 'TestBrand',
    productName: 'Floor Tile 60x60',
    gallaNumber: 'GT-001',
    category: 'Floor',
    size: '60x60',
    finish: 'Polished',
    color: 'White',
    piecesPerBox: 4,
    areaPerBox: Types.Decimal128.fromString('14.4'),
    purchasePrice: Types.Decimal128.fromString('500'),
    sellingPrice: Types.Decimal128.fromString('700'),
    minimumStockPieces: 10,
    images: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockImplementation(function (this: Record<string, unknown>) { return Promise.resolve(this); }),
    ...overrides,
  };
}

const MONGO_DUPLICATE_ERROR = Object.assign(new Error('Duplicate key'), { code: 11000 });

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Products Module Unit Tests', () => {
  let service: ProductsService;
  let controller: ProductsController;
  let productModel: {
    create: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndDelete: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    countDocuments: jest.Mock;
  };
  let inventoryModel: {
    create: jest.Mock;
  };

  beforeEach(async () => {
    productModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
    };

    inventoryModel = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        { provide: getModelToken(Product.name), useValue: productModel },
        { provide: getModelToken(Inventory.name), useValue: inventoryModel },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<ProductsService>(ProductsService);
    controller = module.get<ProductsController>(ProductsController);
  });

  afterEach(() => jest.clearAllMocks());

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Create product successfully
  // ───────────────────────────────────────────────────────────────────────────
  it('1. creates a product successfully and returns it', async () => {
    const mockProduct = makeProduct();
    productModel.create.mockResolvedValue(mockProduct);
    inventoryModel.create.mockResolvedValue({ productId: mockProduct._id, totalPieces: 0 });

    const dto = {
      brand: 'TestBrand',
      productName: 'Floor Tile 60x60',
      gallaNumber: 'gt-001',
      category: 'Floor',
      size: '60x60',
      finish: 'Polished',
      color: 'White',
      piecesPerBox: 4,
      areaPerBox: 14.4,
      purchasePrice: 500,
      sellingPrice: 700,
      minimumStockPieces: 10,
    };

    const result = await service.create(dto as any);
    expect(result).toBeDefined();
    expect(result._id).toBeDefined();
    expect(productModel.create).toHaveBeenCalledTimes(1);
    expect(inventoryModel.create).toHaveBeenCalledTimes(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. gallaNumber normalization
  // ───────────────────────────────────────────────────────────────────────────
  it('2. normalizes gallaNumber to UPPERCASE + trim before saving', async () => {
    const mockProduct = makeProduct({ gallaNumber: 'GT-001' });
    productModel.create.mockResolvedValue(mockProduct);
    inventoryModel.create.mockResolvedValue({});

    await service.create({
      brand: 'B',
      productName: 'P',
      gallaNumber: '  gt-001  ',
      category: 'C',
      size: 'S',
      finish: 'F',
      color: 'W',
      piecesPerBox: 1,
      areaPerBox: 1,
      purchasePrice: 0,
      sellingPrice: 0,
    } as any);

    const createCall = productModel.create.mock.calls[0][0];
    expect(createCall.gallaNumber).toBe('GT-001');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Duplicate gallaNumber → 409
  // ───────────────────────────────────────────────────────────────────────────
  it('3. duplicate gallaNumber returns 409 ConflictException', async () => {
    productModel.create.mockRejectedValue(MONGO_DUPLICATE_ERROR);

    await expect(
      service.create({
        brand: 'B',
        productName: 'P',
        gallaNumber: 'GT-001',
        category: 'C',
        size: 'S',
        finish: 'F',
        color: 'W',
        piecesPerBox: 1,
        areaPerBox: 1,
        purchasePrice: 0,
        sellingPrice: 0,
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Inventory initialized on product creation
  // ───────────────────────────────────────────────────────────────────────────
  it('4. inventory document is created with totalPieces=0 when product is created', async () => {
    const mockProduct = makeProduct();
    productModel.create.mockResolvedValue(mockProduct);
    inventoryModel.create.mockResolvedValue({ productId: mockProduct._id, totalPieces: 0 });

    await service.create({
      brand: 'B', productName: 'P', gallaNumber: 'GT-NEW',
      category: 'C', size: 'S', finish: 'F', color: 'W',
      piecesPerBox: 1, areaPerBox: 1, purchasePrice: 0, sellingPrice: 0,
    } as any);

    expect(inventoryModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: mockProduct._id,
        totalPieces: 0,
      }),
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. List products — defaults to isActive=true
  // ───────────────────────────────────────────────────────────────────────────
  it('5. findAll defaults to isActive=true filter', async () => {
    const mockProducts = [makeProduct(), makeProduct({ gallaNumber: 'GT-002' })];
    productModel.find.mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockProducts) }) }) });
    productModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(2) });

    const result = await service.findAll({});
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);

    const findCallArg = productModel.find.mock.calls[0][0];
    expect(findCallArg.isActive).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. List products — pagination metadata
  // ───────────────────────────────────────────────────────────────────────────
  it('6. pagination metadata is correct', async () => {
    productModel.find.mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }) });
    productModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(45) });

    const result = await service.findAll({ page: 2, limit: 10 });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(5);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. List inactive products
  // ───────────────────────────────────────────────────────────────────────────
  it('7. passing isActive=false returns inactive products filter', async () => {
    productModel.find.mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }) });
    productModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

    await service.findAll({ isActive: false });
    const findCallArg = productModel.find.mock.calls[0][0];
    expect(findCallArg.isActive).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Get product by id — success
  // ───────────────────────────────────────────────────────────────────────────
  it('8. findOne returns product for valid id', async () => {
    const id = makeProductId().toString();
    const mockProduct = makeProduct({ _id: new Types.ObjectId(id) });
    productModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockProduct) });

    const result = await service.findOne(id);
    expect(result).toBeDefined();
    expect(productModel.findById).toHaveBeenCalledWith(id);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Get product — not found
  // ───────────────────────────────────────────────────────────────────────────
  it('9. findOne throws NotFoundException for unknown id', async () => {
    const id = makeProductId().toString();
    productModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Invalid ObjectId → 400
  // ───────────────────────────────────────────────────────────────────────────
  it('10. findOne throws BadRequestException for invalid ObjectId', async () => {
    await expect(service.findOne('not-a-valid-id')).rejects.toThrow(BadRequestException);
    expect(productModel.findById).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Update product — success
  // ───────────────────────────────────────────────────────────────────────────
  it('11. update returns updated product', async () => {
    const id = makeProductId().toString();
    const updated = makeProduct({ _id: new Types.ObjectId(id), brand: 'NewBrand' });
    productModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

    const result = await service.update(id, { brand: 'NewBrand' });
    expect(result.brand).toBe('NewBrand');
    expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ $set: expect.objectContaining({ brand: 'NewBrand' }) }),
      expect.objectContaining({ new: true }),
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Update gallaNumber — duplicate protection
  // ───────────────────────────────────────────────────────────────────────────
  it('12. updating gallaNumber to an existing one throws ConflictException', async () => {
    const id = makeProductId().toString();
    productModel.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockRejectedValue(MONGO_DUPLICATE_ERROR),
    });

    await expect(service.update(id, { gallaNumber: 'GT-EXISTING' })).rejects.toThrow(
      ConflictException,
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 13. Update — not found
  // ───────────────────────────────────────────────────────────────────────────
  it('13. update throws NotFoundException when product does not exist', async () => {
    const id = makeProductId().toString();
    productModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    await expect(service.update(id, { brand: 'X' })).rejects.toThrow(NotFoundException);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 14. Deactivate — success
  // ───────────────────────────────────────────────────────────────────────────
  it('14. deactivate sets isActive=false', async () => {
    const id = makeProductId().toString();
    const activeProduct = makeProduct({ _id: new Types.ObjectId(id), isActive: true });
    productModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(activeProduct) });

    await service.deactivate(id);
    expect(activeProduct.isActive).toBe(false);
    expect(activeProduct.save).toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 15. Deactivate already inactive → 409
  // ───────────────────────────────────────────────────────────────────────────
  it('15. deactivating already-inactive product throws ConflictException', async () => {
    const id = makeProductId().toString();
    const inactiveProduct = makeProduct({ _id: new Types.ObjectId(id), isActive: false });
    productModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(inactiveProduct) });

    await expect(service.deactivate(id)).rejects.toThrow(ConflictException);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 16. Activate — success
  // ───────────────────────────────────────────────────────────────────────────
  it('16. activate sets isActive=true', async () => {
    const id = makeProductId().toString();
    const inactiveProduct = makeProduct({ _id: new Types.ObjectId(id), isActive: false });
    productModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(inactiveProduct) });

    await service.activate(id);
    expect(inactiveProduct.isActive).toBe(true);
    expect(inactiveProduct.save).toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 17. Activate already active → 409
  // ───────────────────────────────────────────────────────────────────────────
  it('17. activating already-active product throws ConflictException', async () => {
    const id = makeProductId().toString();
    const activeProduct = makeProduct({ _id: new Types.ObjectId(id), isActive: true });
    productModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(activeProduct) });

    await expect(service.activate(id)).rejects.toThrow(ConflictException);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 18. Authentication — JwtAuthGuard is applied
  // ───────────────────────────────────────────────────────────────────────────
  it('18. JwtAuthGuard is applied to ProductsController', () => {
    const guards = Reflect.getMetadata('__guards__', ProductsController);
    const hasJwtGuard =
      guards &&
      guards.some(
        (g: unknown) => g === JwtAuthGuard || (typeof g === 'function' && g.name === 'JwtAuthGuard'),
      );
    expect(hasJwtGuard).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Controller delegation tests
  // ───────────────────────────────────────────────────────────────────────────
  it('19. controller.create delegates to service.create', async () => {
    const mockProduct = makeProduct();
    jest.spyOn(service, 'create').mockResolvedValue(mockProduct as any);

    const result = await controller.create({
      brand: 'B', productName: 'P', gallaNumber: 'GT-X',
      category: 'C', size: 'S', finish: 'F', color: 'W',
      piecesPerBox: 1, areaPerBox: 1, purchasePrice: 0, sellingPrice: 0,
    } as any);

    expect(result).toEqual({ product: mockProduct });
    expect(service.create).toHaveBeenCalledTimes(1);
  });

  it('20. controller.findOne delegates to service.findOne', async () => {
    const id = makeProductId().toString();
    const mockProduct = makeProduct({ _id: new Types.ObjectId(id) });
    jest.spyOn(service, 'findOne').mockResolvedValue(mockProduct as any);

    const result = await controller.findOne(id);
    expect(result).toEqual({ product: mockProduct });
    expect(service.findOne).toHaveBeenCalledWith(id);
  });

  it('21. controller.findAll delegates to service.findAll', async () => {
    const paginatedResult = { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    jest.spyOn(service, 'findAll').mockResolvedValue(paginatedResult);

    const result = await controller.findAll({});
    expect(result).toEqual(paginatedResult);
  });

  it('22. controller.deactivate delegates to service.deactivate', async () => {
    const id = makeProductId().toString();
    const mockProduct = makeProduct({ _id: new Types.ObjectId(id), isActive: false });
    jest.spyOn(service, 'deactivate').mockResolvedValue(mockProduct as any);

    const result = await controller.deactivate(id);
    expect(result).toEqual({ product: mockProduct });
    expect(service.deactivate).toHaveBeenCalledWith(id);
  });

  it('23. controller.activate delegates to service.activate', async () => {
    const id = makeProductId().toString();
    const mockProduct = makeProduct({ _id: new Types.ObjectId(id), isActive: true });
    jest.spyOn(service, 'activate').mockResolvedValue(mockProduct as any);

    const result = await controller.activate(id);
    expect(result).toEqual({ product: mockProduct });
    expect(service.activate).toHaveBeenCalledWith(id);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Role-based Authorization Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('Role-based Authorization', () => {
    let reflector: Reflector;
    let rolesGuard: RolesGuard;

    beforeEach(() => {
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    it('24. RolesGuard is applied to ProductsController alongside JwtAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', ProductsController);
      expect(guards).toBeDefined();
      const hasRolesGuard = guards.some(
        (g: unknown) => g === RolesGuard || (typeof g === 'function' && g.name === 'RolesGuard'),
      );
      const hasJwtGuard = guards.some(
        (g: unknown) => g === JwtAuthGuard || (typeof g === 'function' && g.name === 'JwtAuthGuard'),
      );
      expect(hasRolesGuard).toBe(true);
      expect(hasJwtGuard).toBe(true);
    });

    it('25. @Roles(UserRole.OWNER) is attached to all mutation endpoints', () => {
      const createRoles = Reflect.getMetadata(ROLES_KEY, ProductsController.prototype.create);
      const updateRoles = Reflect.getMetadata(ROLES_KEY, ProductsController.prototype.update);
      const activateRoles = Reflect.getMetadata(ROLES_KEY, ProductsController.prototype.activate);
      const deactivateRoles = Reflect.getMetadata(ROLES_KEY, ProductsController.prototype.deactivate);

      expect(createRoles).toEqual([UserRole.OWNER]);
      expect(updateRoles).toEqual([UserRole.OWNER]);
      expect(activateRoles).toEqual([UserRole.OWNER]);
      expect(deactivateRoles).toEqual([UserRole.OWNER]);
    });

    it('26. GET endpoints do NOT have @Roles decorator (allowing any authenticated user)', () => {
      const findAllRoles = Reflect.getMetadata(ROLES_KEY, ProductsController.prototype.findAll);
      const findOneRoles = Reflect.getMetadata(ROLES_KEY, ProductsController.prototype.findOne);

      expect(findAllRoles).toBeUndefined();
      expect(findOneRoles).toBeUndefined();
    });

    it('27. RolesGuard permits access when no roles are required on route', () => {
      const context = {
        getHandler: () => ProductsController.prototype.findAll,
        getClass: () => ProductsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'ANY_ROLE' } }),
        }),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('28. RolesGuard permits access when user has the authorized OWNER role', () => {
      const context = {
        getHandler: () => ProductsController.prototype.create,
        getClass: () => ProductsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: UserRole.OWNER } }),
        }),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('29. RolesGuard blocks request with ForbiddenException when user has unauthorized role', () => {
      const context = {
        getHandler: () => ProductsController.prototype.create,
        getClass: () => ProductsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'STAFF' } }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('30. RolesGuard blocks request with ForbiddenException when user has no role', () => {
      const context = {
        getHandler: () => ProductsController.prototype.create,
        getClass: () => ProductsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: {} }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('31. RolesGuard blocks request with ForbiddenException when user is undefined', () => {
      const context = {
        getHandler: () => ProductsController.prototype.create,
        getClass: () => ProductsController,
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('32. JwtAuthGuard blocks unauthenticated requests', () => {
      const jwtGuard = new JwtAuthGuard();
      expect(() => jwtGuard.handleRequest(null, null)).toThrow();
      expect(() => jwtGuard.handleRequest(new Error('Invalid token'), null)).toThrow();
    });

    it('33. JwtAuthGuard permits authenticated user', () => {
      const jwtGuard = new JwtAuthGuard();
      const mockUser = { id: '123', role: UserRole.OWNER };
      expect(jwtGuard.handleRequest(null, mockUser)).toEqual(mockUser);
    });
  });
});
