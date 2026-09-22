import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Readable } from 'stream';

export interface UploadedImageResult {
  url: string;
  publicId: string;
  alt?: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
      this.logger.log('Cloudinary successfully configured');
    } else {
      this.logger.warn(
        'Cloudinary credentials not fully configured. Image uploads will require valid credentials.',
      );
    }
  }

  /**
   * Returns whether Cloudinary is configured with credentials.
   */
  getIsConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Uploads a single image buffer to Cloudinary using stream upload.
   */
  async uploadImage(
    file: Express.Multer.File,
    folder = 'goverdhan-traders/products',
  ): Promise<UploadedImageResult> {
    if (!this.isConfigured) {
      throw new BadRequestException(
        'Cloudinary service is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the server environment.',
      );
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload error:', error?.message || 'Unknown error');
            return reject(
              new InternalServerErrorException(
                'Failed to upload image to cloud storage. Please try again.',
              ),
            );
          }

          const alt = file.originalname
            ? file.originalname.replace(/\.[^/.]+$/, '').trim()
            : undefined;

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            alt: alt || undefined,
          });
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Uploads multiple images concurrently.
   */
  async uploadMultipleImages(
    files: Express.Multer.File[],
    folder = 'goverdhan-traders/products',
  ): Promise<UploadedImageResult[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }

    if (files.length > 5) {
      throw new BadRequestException('Maximum 5 images can be uploaded per request');
    }

    return Promise.all(files.map((file) => this.uploadImage(file, folder)));
  }
}
