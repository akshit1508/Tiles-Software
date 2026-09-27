import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { GallasService } from './gallas.service';
import { GallasController } from './gallas.controller';
import { Galla } from './schemas/galla.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';

describe('Gallas Module Unit Tests', () => {
  let service: GallasService;
  let controller: GallasController;

  let gallaModel: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findById: jest.Mock;
  };

  let inventoryModel: {
    aggregate: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    gallaModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
    };

    inventoryModel = {
      aggregate: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GallasService,
        GallasController,
        { provide: getModelToken(Galla.name), useValue: gallaModel },
        { provide: getModelToken(Inventory.name), useValue: inventoryModel },
      ],
    }).compile();

    service = module.get<GallasService>(GallasService);
    controller = module.get<GallasController>(GallasController);
  });

  afterEach(() => jest.clearAllMocks());

  it('1. creates a new Galla successfully with uppercase normalized code', async () => {
    gallaModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    const mockCreated = {
      _id: new Types.ObjectId(),
      gallaNumber: 'GALLA 01',
      name: 'North Section',
      description: 'Main aisle',
      isActive: true,
    };
    gallaModel.create.mockResolvedValue(mockCreated);

    const result = await service.create({
      gallaNumber: '  galla 01  ',
      name: 'North Section',
      description: 'Main aisle',
    });

    expect(result.gallaNumber).toBe('GALLA 01');
    expect(gallaModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        gallaNumber: 'GALLA 01',
        name: 'North Section',
        isActive: true,
      }),
    );
  });

  it('2. throws 409 ConflictException when Galla number already exists in master', async () => {
    gallaModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), gallaNumber: 'G-01' }),
    });

    await expect(
      service.create({ gallaNumber: 'G-01' }),
    ).rejects.toThrow(ConflictException);
  });

  it('3. lists Gallas with aggregated product count and total boxes', async () => {
    const gallaId1 = new Types.ObjectId();
    const gallaId2 = new Types.ObjectId();

    const mockGallas = [
      {
        _id: gallaId1,
        gallaNumber: 'GALLA 01',
        name: 'Section 1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: gallaId2,
        gallaNumber: 'GALLA 02',
        name: 'Section 2',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    gallaModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGallas),
      }),
    });

    inventoryModel.aggregate.mockResolvedValue([
      { _id: gallaId1, productCount: 3, totalBoxes: 65 },
      { _id: gallaId2, productCount: 1, totalBoxes: 20 },
    ]);

    const result = await service.findAll({});

    expect(result).toHaveLength(2);
    expect(result[0].gallaNumber).toBe('GALLA 01');
    expect(result[0].productCount).toBe(3);
    expect(result[0].totalBoxes).toBe(65);

    expect(result[1].gallaNumber).toBe('GALLA 02');
    expect(result[1].productCount).toBe(1);
    expect(result[1].totalBoxes).toBe(20);
  });

  it('4. finds a Galla by ID', async () => {
    const gallaId = new Types.ObjectId().toString();
    const mockGalla = { _id: gallaId, gallaNumber: 'G-01', isActive: true };
    gallaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockGalla) });

    const result = await service.findOne(gallaId);
    expect(result.gallaNumber).toBe('G-01');
  });

  it('5. throws 404 if Galla ID does not exist', async () => {
    const gallaId = new Types.ObjectId().toString();
    gallaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    await expect(service.findOne(gallaId)).rejects.toThrow(NotFoundException);
  });

  it('6. updates Galla name and deactivates it', async () => {
    const gallaId = new Types.ObjectId().toString();
    const mockGalla = {
      _id: gallaId,
      gallaNumber: 'G-01',
      name: 'Old Name',
      isActive: true,
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };
    gallaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockGalla) });

    const updated = await service.update(gallaId, {
      name: 'New Name',
      isActive: false,
    });

    expect(updated.name).toBe('New Name');
    expect(updated.isActive).toBe(false);
    expect(mockGalla.save).toHaveBeenCalled();
  });

  it('7. returns Galla inventory detail showing all products stored in that location', async () => {
    const gallaId = new Types.ObjectId();
    const mockGalla = {
      _id: gallaId,
      gallaNumber: 'GALLA 01',
      name: 'North Section',
      isActive: true,
    };
    gallaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockGalla) });

    const product1 = { _id: new Types.ObjectId(), productName: 'Royal Slate', brand: 'Kajaria' };
    const product2 = { _id: new Types.ObjectId(), productName: 'Marble White', brand: 'Somany' };

    const mockLocationItems = [
      { _id: new Types.ObjectId(), productId: product1, boxes: 20, totalPieces: 80 },
      { _id: new Types.ObjectId(), productId: product2, boxes: 15, totalPieces: 60 },
    ];

    inventoryModel.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockLocationItems),
      }),
    });

    const result = await service.getGallaInventory(gallaId.toString());

    expect(result.galla.gallaNumber).toBe('GALLA 01');
    expect(result.totalProducts).toBe(2);
    expect(result.totalBoxes).toBe(35); // 20 + 15
    expect(result.products).toHaveLength(2);
    expect(result.products[0].boxes).toBe(20);
    expect(result.products[1].boxes).toBe(15);
  });
});
