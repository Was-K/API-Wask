import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboardSummary() {
    const [users, businesses, suppliers, orders, products, shipments] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.business.count({ where: { deletedAt: null } }),
      this.prisma.supplier.count({ where: { deletedAt: null } }),
      this.prisma.order.count({ where: { deletedAt: null } }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.shipment.count(),
    ]);
    return { users, businesses, suppliers, orders, products, shipments };
  }

  orderKpis() {
    return this.prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { grandTotal: true },
    });
  }

  inventoryKpis() {
    return this.prisma.inventoryItem.aggregate({
      _sum: { availableStock: true, reservedStock: true },
      _avg: { availableStock: true },
    });
  }
}
