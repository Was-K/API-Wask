import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller({ path: 'analytics', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSIONS.ANALYTICS_READ)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  dashboardSummary() {
    return this.analyticsService.dashboardSummary();
  }

  @Get('orders')
  orderKpis() {
    return this.analyticsService.orderKpis();
  }

  @Get('inventory')
  inventoryKpis() {
    return this.analyticsService.inventoryKpis();
  }
}
