import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  GallasService,
  PaginatedGallasResponse,
  GallaInventoryDetailResponse,
} from './gallas.service';
import { CreateGallaDto, UpdateGallaDto, ListGallasDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('gallas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GallasController {
  constructor(private readonly gallasService: GallasService) {}

  @Post()
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateGallaDto) {
    return this.gallasService.create(dto);
  }

  @Get()
  @Roles(UserRole.OWNER)
  findAll(@Query() query: ListGallasDto): Promise<PaginatedGallasResponse> {
    return this.gallasService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.OWNER)
  findOne(@Param('id') id: string) {
    return this.gallasService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  update(@Param('id') id: string, @Body() dto: UpdateGallaDto) {
    return this.gallasService.update(id, dto);
  }

  @Get(':id/inventory')
  @Roles(UserRole.OWNER)
  getGallaInventory(@Param('id') id: string): Promise<GallaInventoryDetailResponse> {
    return this.gallasService.getGallaInventory(id);
  }
}
