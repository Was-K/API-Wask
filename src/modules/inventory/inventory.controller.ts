import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  @Roles(UserRole.ADMIN, UserRole.BUSINESS, UserRole.SUPPLIER)
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(dto);
  }

  @Post('items')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS, UserRole.SUPPLIER)
  upsertItem(@Body() dto: UpsertInventoryDto) {
    return this.inventoryService.upsertItem(dto);
  }

  @Post('movements')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS, UserRole.SUPPLIER)
  moveStock(@Body() dto: StockMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.moveStock(dto, user.sub);
  }

  @Get('low-stock')
  findLowStock() {
    return this.inventoryService.findLowStock();
  }
}
