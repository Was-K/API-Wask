import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateShipmentDto, UpdateShipmentStatusDto } from './dto/logistics.dto';
import { LogisticsService } from './logistics.service';

@ApiTags('Logistics')
@ApiBearerAuth()
@Controller({ path: 'logistics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('shipments')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  createShipment(@Body() dto: CreateShipmentDto) {
    return this.logisticsService.createShipment(dto);
  }

  @Patch('shipments/:id/status')
  @Roles(UserRole.ADMIN, UserRole.DELIVERY, UserRole.BUSINESS_OWNER)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateShipmentStatusDto) {
    return this.logisticsService.updateStatus(id, dto);
  }

  @Get('shipments')
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  findShipments() {
    return this.logisticsService.findShipments();
  }
}
