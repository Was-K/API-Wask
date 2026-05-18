import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [AnalyticsModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
