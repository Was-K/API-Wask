import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller({ path: 'analytics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Resumen. ADMIN=global, BUSINESS_OWNER=su negocio.' })
  dashboardSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.dashboardSummary(user);
  }

  @Get('orders')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'KPIs de órdenes por estado' })
  orderKpis(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.orderKpis(user);
  }

  @Get('inventory')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'KPIs de inventario' })
  inventoryKpis(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.inventoryKpis(user);
  }
}
