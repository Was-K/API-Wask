import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole, VerificationStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { BusinessService } from './business.service';
import { CreateBusinessDto, RejectBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@ApiTags('Business')
@ApiBearerAuth()
@Controller({ path: 'business', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear negocio manualmente (solo ADMIN)' })
  create(@Body() dto: CreateBusinessDto) {
    return this.businessService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar negocios (solo ADMIN). Filtrar por verificationStatus, búsqueda o deleted=true' })
  @ApiQuery({ name: 'verificationStatus', enum: VerificationStatus, required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'deleted', required: false, type: Boolean })
  findMany(
    @Query('verificationStatus') verificationStatus?: VerificationStatus,
    @Query('q') q?: string,
    @Query('deleted') deleted?: string,
  ) {
    return this.businessService.findMany(verificationStatus, q, deleted === 'true');
  }

  @Get('shops')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Listado público de tiendas (VERIFIED + ACTIVE) para la app del cliente' })
  @ApiQuery({ name: 'q', required: false })
  findShops(@Query('q') q?: string) {
    return this.businessService.findShops(q);
  }

  @Get('shops/:id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Detalle público de una tienda para la app del cliente' })
  findShopById(@Param('id') id: string) {
    return this.businessService.findShopById(id);
  }

  @Get('my-business')
  @Roles(UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Ver el negocio del BUSINESS_OWNER autenticado' })
  findMyBusiness(@CurrentUser() user: AuthenticatedUser) {
    return this.businessService.findMyBusiness(user.sub);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Detalle completo de un negocio (solo ADMIN)' })
  findOne(@Param('id') id: string) {
    return this.businessService.findOne(id);
  }

  @Patch('my-business')
  @Roles(UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Editar el negocio del BUSINESS_OWNER autenticado' })
  updateMyBusiness(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateBusinessDto) {
    return this.businessService.updateMyBusiness(user.sub, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Editar cualquier negocio (solo ADMIN)' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businessService.update(id, dto);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Aprobar negocio y activar sus usuarios BUSINESS_OWNER' })
  approve(@Param('id') id: string) {
    return this.businessService.approve(id);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Rechazar negocio con motivo' })
  reject(@Param('id') id: string, @Body() dto: RejectBusinessDto) {
    return this.businessService.reject(id, dto);
  }

  @Delete('my-business')
  @Roles(UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'El BUSINESS_OWNER elimina su propio negocio (soft delete)' })
  deleteMyBusiness(@CurrentUser() user: AuthenticatedUser) {
    return this.businessService.deleteMyBusiness(user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'ADMIN elimina cualquier negocio (soft delete)' })
  deleteByAdmin(@Param('id') id: string) {
    return this.businessService.deleteByAdmin(id);
  }

  @Post(':id/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'ADMIN restaura un negocio eliminado (vuelve a PENDING para re-aprobación)' })
  restore(@Param('id') id: string) {
    return this.businessService.restore(id);
  }
}
