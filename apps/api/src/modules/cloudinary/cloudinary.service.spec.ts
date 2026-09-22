import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service';
import { v2 as cloudinary } from 'cloudinary';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
  },
}));

describe('CloudinaryService', () => {
  let service: CloudinaryService;
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'CLOUDINARY_CLOUD_NAME') return 'test-cloud';
        if (key === 'CLOUDINARY_API_KEY') return 'test-key';
        if (key === 'CLOUDINARY_API_SECRET') return 'test-secret';
        return undefined;
      }),
    };
    service = new CloudinaryService(configService as ConfigService);
  });

  it('1. configures cloudinary when all credentials are provided', () => {
    expect(service.getIsConfigured()).toBe(true);
    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'test-cloud',
      api_key: 'test-key',
      api_secret: 'test-secret',
      secure: true,
    });
  });

  it('2. sets isConfigured to false when credentials are missing', () => {
    const emptyConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    const unconfiguredService = new CloudinaryService(emptyConfigService as any);
    expect(unconfiguredService.getIsConfigured()).toBe(false);
  });

  it('3. uploadImage throws BadRequestException when Cloudinary is not configured', async () => {
    const emptyConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    const unconfiguredService = new CloudinaryService(emptyConfigService as any);
    const mockFile = {
      originalname: 'tile.jpg',
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    await expect(unconfiguredService.uploadImage(mockFile)).rejects.toThrow(BadRequestException);
  });

  it('4. uploadMultipleImages throws BadRequestException on empty files', async () => {
    await expect(service.uploadMultipleImages([])).rejects.toThrow(BadRequestException);
  });

  it('5. uploadMultipleImages throws BadRequestException when more than 5 files provided', async () => {
    const files = Array(6).fill({
      originalname: 'tile.jpg',
      buffer: Buffer.from('test'),
    }) as Express.Multer.File[];

    await expect(service.uploadMultipleImages(files)).rejects.toThrow(BadRequestException);
  });

  it('6. uploadImage streams buffer to Cloudinary and resolves metadata', async () => {
    const mockFile = {
      originalname: 'granite-tile.jpg',
      buffer: Buffer.from('fake-image-data'),
    } as Express.Multer.File;

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((options, callback) => {
      // Return a writable stream
      const { Writable } = require('stream');
      const writable = new Writable({
        write(_chunk: unknown, _encoding: unknown, next: () => void) {
          next();
        },
      });
      // Trigger callback asynchronously
      setImmediate(() => {
        callback(null, {
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/goverdhan-traders/products/granite-tile.jpg',
          public_id: 'goverdhan-traders/products/granite-tile',
        });
      });
      return writable;
    });

    const result = await service.uploadImage(mockFile);
    expect(result).toEqual({
      url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/goverdhan-traders/products/granite-tile.jpg',
      publicId: 'goverdhan-traders/products/granite-tile',
      alt: 'granite-tile',
    });
  });

  it('7. uploadImage throws InternalServerErrorException on Cloudinary stream error', async () => {
    const mockFile = {
      originalname: 'corrupt.jpg',
      buffer: Buffer.from('corrupt'),
    } as Express.Multer.File;

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((options, callback) => {
      const { Writable } = require('stream');
      const writable = new Writable({
        write(_chunk: unknown, _encoding: unknown, next: () => void) {
          next();
        },
      });
      setImmediate(() => {
        callback(new Error('Cloudinary stream failed'), null);
      });
      return writable;
    });

    await expect(service.uploadImage(mockFile)).rejects.toThrow(InternalServerErrorException);
  });
});
