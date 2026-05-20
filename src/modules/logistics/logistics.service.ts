import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateShipmentDto, UpdateShipmentStatusDto } from './dto/logistics.dto';

@Injectable()
export class LogisticsService {
  constructor(private readonly prisma: PrismaService) {}

  createShipment(dto: CreateShipmentDto) {
    return this.prisma.shipment.create({ data: dto });
  }

  updateStatus(id: string, dto: UpdateShipmentStatusDto) {
    return this.prisma.shipment.update({
      where: { id },
      data: {
        status: dto.status,
        deliveredAt: dto.status === 'DELIVERED' ? new Date() : undefined,
      },
    });
  }

  findShipments() {
    return this.prisma.shipment.findMany({
      include: {
        order: { select: { id: true, orderNumber: true, status: true } },
        business: { select: { id: true, companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
