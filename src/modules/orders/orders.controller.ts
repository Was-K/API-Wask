import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller({ path: 'orders', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'CUSTOMER crea pedido a un negocio' })
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.create(dto, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER, UserRole.BUSINESS_OWNER, UserRole.DELIVERY)
  @ApiOperation({ summary: 'Listar pedidos según rol: ADMIN=todos, CUSTOMER=suyos, BUSINESS_OWNER=su negocio, DELIVERY=asignados' })
  findMany(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findMany(user);
  }

  @Get('business')
  @Roles(UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Pedidos del negocio del BUSINESS_OWNER autenticado' })
  findBusinessOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findBusinessOrders(user);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER, UserRole.DELIVERY)
  @ApiOperation({ summary: 'Cambiar estado de pedido. DELIVERY solo puede poner SHIPPED/DELIVERED.' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.updateStatus(id, dto, user);
  }
}
