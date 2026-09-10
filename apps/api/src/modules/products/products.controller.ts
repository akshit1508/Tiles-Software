import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService, PaginatedProducts } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductDocument } from './schemas/product.schema';

/**
 * ProductsController — thin controller that delegates all business logic to ProductsService.
 *
 * All endpoints require JWT authentication (reusing existing infrastructure).
 * No product management operation is publicly accessible.
 *
 * Products are NEVER hard-deleted. Deactivation sets isActive = false.
 */
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * POST /products
   * Creates a new tile product and initializes its inventory with totalPieces = 0.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto): Promise<{ product: ProductDocument }> {
    const product = await this.productsService.create(dto);
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
   */
  @Patch(':id')
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
   */
  @Patch(':id/activate')
  async activate(@Param('id') id: string): Promise<{ product: ProductDocument }> {
    const product = await this.productsService.activate(id);
    return { product };
  }

  /**
   * PATCH /products/:id/deactivate
   * Soft-deactivates the product (isActive = false).
   * Products are NEVER hard-deleted. Returns 409 if already inactive.
   */
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string): Promise<{ product: ProductDocument }> {
    const product = await this.productsService.deactivate(id);
    return { product };
  }
}
