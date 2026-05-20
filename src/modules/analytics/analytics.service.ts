import { Injectable } from '@nestjs/common';
import { ProductApprovalStatus, UserRole, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-request';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminOverview() {
    const [
      totalUsers,
      totalCustomers,
      totalBusinesses,
      pendingBusinesses,
      pendingProducts,
      totalOrders,
      revenueAgg,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, role: UserRole.CUSTOMER } }),
      this.prisma.business.count({ where: { deletedAt: null } }),
      this.prisma.business.count({ where: { deletedAt: null, verificationStatus: VerificationStatus.PENDING } }),
      this.prisma.product.count({ where: { deletedAt: null, approvalStatus: ProductApprovalStatus.PENDING } }),
      this.prisma.order.count({ where: { deletedAt: null } }),
      this.prisma.order.aggregate({ where: { deletedAt: null }, _sum: { grandTotal: true } }),
    ]);

    return {
      totalUsers,
      totalCustomers,
      totalBusinesses,
      pendingBusinesses,
      pendingProducts,
      totalOrders,
      totalRevenue: revenueAgg._sum.grandTotal ?? 0,
    };
  }

  async businessSummary(businessId: string) {
    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      revenueAgg,
      totalProducts,
      pendingProducts,
      lowStockItems,
    ] = await Promise.all([
      this.prisma.order.count({ where: { deletedAt: null, businessId } }),
      this.prisma.order.count({ where: { deletedAt: null, businessId, status: 'PENDING' } }),
      this.prisma.order.count({ where: { deletedAt: null, businessId, status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { deletedAt: null, businessId, status: 'CANCELLED' } }),
      this.prisma.order.aggregate({
        where: { deletedAt: null, businessId },
        _sum: { grandTotal: true },
        _avg: { grandTotal: true },
      }),
      this.prisma.product.count({ where: { deletedAt: null, businessId } }),
      this.prisma.product.count({ where: { deletedAt: null, businessId, approvalStatus: ProductApprovalStatus.PENDING } }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "InventoryItem" ii
        JOIN "Product" p ON p.id = ii."productId"
        WHERE ii."deletedAt" IS NULL
          AND ii."availableStock" <= ii."minimumStock"
          AND p."businessId" = ${businessId}::uuid
      `,
    ]);

    return {
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue: revenueAgg._sum.grandTotal ?? 0,
      averageTicket: revenueAgg._avg.grandTotal ?? 0,
      totalProducts,
      productsPendingApproval: pendingProducts,
      lowStockItems: Number(lowStockItems[0]?.count ?? 0),
    };
  }

  async dashboardSummary(currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.BUSINESS_OWNER && currentUser.businessId) {
      return this.businessSummary(currentUser.businessId);
    }
    return this.adminOverview();
  }

  orderKpis(currentUser: AuthenticatedUser) {
    return this.prisma.order.groupBy({
      by: ['status'],
      where: currentUser.role === UserRole.BUSINESS_OWNER
        ? { businessId: currentUser.businessId ?? undefined }
        : undefined,
      _count: { _all: true },
      _sum: { grandTotal: true },
    });
  }

  inventoryKpis(currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.BUSINESS_OWNER && currentUser.businessId) {
      return this.prisma.inventoryItem.aggregate({
        where: { product: { businessId: currentUser.businessId } },
        _sum: { availableStock: true, reservedStock: true },
        _avg: { availableStock: true },
      });
    }
    return this.prisma.inventoryItem.aggregate({
      _sum: { availableStock: true, reservedStock: true },
      _avg: { availableStock: true },
    });
  }
}
