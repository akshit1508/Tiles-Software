import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductsService, PaginatedProducts } from './products.service';
import { CreateProductDto, ImageReferenceDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { UserRole } from '../../common/enums';
import { ProductDocument } from './schemas/product.schema';

/**
 * ProductsController — thin controller that delegates all business logic to ProductsService.
 *
 * All endpoints require JWT authentication (reusing existing infrastructure).
 * Mutation operations require the OWNER role.
 * Query operations (GET) require authentication without role restriction.
 *
 * Products are NEVER hard-deleted. Deactivation sets isActive = false.
 */
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * POST /products/upload-images
   * Uploads up to 5 image files to Cloudinary and returns their ImageReference metadata.
   * Restricted to OWNER role.
   */
  @Post('upload-images')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
        files: 5,
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WebP images are allowed.`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ImageReferenceDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }
    if (files.length > 5) {
      throw new BadRequestException('Maximum 5 images can be uploaded per request');
    }
    return this.productsService.uploadImages(files);
  }

  /**
   * POST /products
   * Creates a new tile product and initializes its inventory with totalPieces = 0.
   * Restricted to OWNER role.
   */
  @Post()
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<{ product: ProductDocument }> {
    const product = await this.productsService.create(dto, user?.id);
    return { product };
  }

  /**
   * GET /products
   * Returns paginated list of products. Defaults to active products only.
   * Supports optional filters: brand, category, isActive, page, limit.
   */
  @Get()
  async findAll(@Query() query: ListProductsDto): Promise<PaginatedProducts> {
    return this.productsService.findAll(query);
  }

  /**
   * GET /products/:id
   * Returns a single product by its MongoDB ObjectId.
   * Returns 400 for invalid IDs, 404 if not found.
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<{ product: ProductDocument }> {
    const product = await this.productsService.findOne(id);
    return { product };
  }

  /**
   * PATCH /products/:id
   * Partially updates a product's mutable fields.
   * isActive cannot be changed via this endpoint — use activate/deactivate.
   * Restricted to OWNER role.
   */
  @Patch(':id')
  @Roles(UserRole.OWNER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<{ product: ProductDocument }> {
    const product = await this.productsService.update(id, dto);
    return { product };
  }

  /**
   * PATCH /products/:id/activate
   * Sets isActive = true. Returns 409 if already active.
   * Restricted to OWNER role.
   */
  @Patch(':id/activate')
  @Roles(UserRole.OWNER)
  async activate(@Param('id') id: string): Promise<{ product: ProductDocument }> {
    const product = await this.productsService.activate(id);
    return { product };
  }

  /**
   * PATCH /products/:id/deactivate
   * Soft-deactivates the product (isActive = false).
   * Products are NEVER hard-deleted. Returns 409 if already inactive.
   * Restricted to OWNER role.
   */
  @Patch(':id/deactivate')
  @Roles(UserRole.OWNER)
  async deactivate(@Param('id') id: string): Promise<{ product: ProductDocument }> {
    const product = await this.productsService.deactivate(id);
    return { product };
  }
}
