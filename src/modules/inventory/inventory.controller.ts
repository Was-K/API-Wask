import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateWarehouseDto, StockMovementDto, UpsertInventoryDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller({ path: 'inventory', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('warehouses')
  @Roles(UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Crear almacén para el negocio del BUSINESS_OWNER autenticado' })
  createWarehouse(@Body() dto: CreateWarehouseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.createWarehouse(dto, user);
  }

  @Post('warehouses/admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'ADMIN crea almacén para un negocio específico' })
  createWarehouseAdmin(
    @Body() dto: CreateWarehouseDto,
    @Query('businessId') businessId: string,
  ) {
    return this.inventoryService.createWarehouseAdmin(dto, businessId);
  }

  @Post('items')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Crear o actualizar stock de un producto en un almacén' })
  upsertItem(@Body() dto: UpsertInventoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.upsertItem(dto, user);
  }

  @Post('movements')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Registrar movimiento de inventario' })
  moveStock(@Body() dto: StockMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.moveStock(dto, user);
  }

  @Get('my-inventory')
  @Roles(UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Ver inventario completo del negocio autenticado' })
  findMyInventory(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.findMyInventory(user);
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Ver productos con stock bajo. BUSINESS_OWNER solo su negocio.' })
  findLowStock(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.findLowStock(user);
  }
}
