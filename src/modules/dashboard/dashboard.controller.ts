import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AnalyticsService } from '../analytics/analytics.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.dashboardSummary(user);
  }
}
