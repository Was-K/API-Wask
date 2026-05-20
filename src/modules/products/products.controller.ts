import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import {
  CreateProductDto,
  ProductQueryDto,
  RejectProductDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@Controller({ path: 'products', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'BUSINESS_OWNER crea producto. Queda PENDING hasta aprobación admin.' })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.create(dto, user);
  }

  @Post('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'ADMIN crea producto para un negocio (businessId requerido en body)' })
  createAsAdmin(
    @Body() dto: CreateProductDto,
    @Query('businessId') businessId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.createAsAdmin(dto, businessId, user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER, UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Listar productos. CUSTOMER solo ve APPROVED+ACTIVE. BUSINESS_OWNER solo los suyos.' })
  findMany(@Query() query: ProductQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.findMany(query, user);
  }

  @Get('pending-approval')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Productos pendientes de aprobación (solo ADMIN)' })
  findPendingApproval() {
    return this.productsService.findPendingApproval();
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Editar producto. Si BUSINESS_OWNER edita campos sensibles, vuelve a PENDING.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.update(id, dto, user);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Aprobar producto (solo ADMIN)' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.approve(id, user.sub);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Rechazar producto con motivo (solo ADMIN)' })
  reject(@Param('id') id: string, @Body() dto: RejectProductDto) {
    return this.productsService.reject(id, dto);
  }

  @Post(':id/archive')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Archivar producto. BUSINESS_OWNER solo el suyo.' })
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.archive(id, user);
  }
}
