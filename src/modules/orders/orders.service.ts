import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { OrderStatus, Prisma, ProductApprovalStatus, ProductStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateOrderDto, currentUser: AuthenticatedUser) {
    if (!dto.items.length) throw new BadRequestException('Order requires at least one item');

    const business = await this.prisma.business.findFirst({
      where: { id: dto.businessId, deletedAt: null },
    });
    if (!business) throw new NotFoundException('Business not found');

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: dto.items.map((i) => i.productId) },
        businessId: dto.businessId,
        status: ProductStatus.ACTIVE,
        approvalStatus: ProductApprovalStatus.APPROVED,
        deletedAt: null,
      },
    });

    if (products.length !== dto.items.length) {
      throw new BadRequestException(
        'One or more products are unavailable, not approved, or do not belong to this business',
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const items = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const total = product.price.mul(item.quantity);
      return { productId: item.productId, quantity: item.quantity, unitPrice: product.price, total };
    });

    const subtotal = items.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: `WK-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`,
          customerId: currentUser.sub,
          businessId: dto.businessId,
          notes: dto.notes,
          deliveryAddress: dto.deliveryAddress,
          subtotal,
          grandTotal: subtotal,
          items: { create: items },
          events: {
            create: { status: OrderStatus.PENDING, actorUserId: currentUser.sub, message: 'Order created' },
          },
        },
        include: { items: true, events: true },
      });
      return created;
    });

    await this.audit.record({
      userId: currentUser.sub,
      actionType: 'ORDER_CREATED',
      entityAffected: 'Order',
      entityId: order.id,
      metadata: { orderNumber: order.orderNumber },
    });
    return order;
  }

  findMany(currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.ADMIN) {
      return this.prisma.order.findMany({
        where: { deletedAt: null },
        include: this.orderIncludes(),
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }

    if (currentUser.role === UserRole.CUSTOMER) {
      return this.prisma.order.findMany({
        where: { deletedAt: null, customerId: currentUser.sub },
        include: this.orderIncludes(),
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }

    if (currentUser.role === UserRole.BUSINESS_OWNER) {
      return this.prisma.order.findMany({
        where: { deletedAt: null, businessId: currentUser.businessId ?? undefined },
        include: this.orderIncludes(),
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }

    if (currentUser.role === UserRole.DELIVERY) {
      return this.prisma.order.findMany({
        where: { deletedAt: null, deliveryUserId: currentUser.sub },
        include: this.orderIncludes(),
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }

    return [];
  }

  findBusinessOrders(currentUser: AuthenticatedUser) {
    if (!currentUser.businessId) throw new ForbiddenException('No business associated');
    return this.prisma.order.findMany({
      where: { deletedAt: null, businessId: currentUser.businessId },
      include: this.orderIncludes(),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, currentUser: AuthenticatedUser) {
    const order = await this.prisma.order.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw new NotFoundException('Order not found');

    if (currentUser.role === UserRole.BUSINESS_OWNER) {
      if (order.businessId !== currentUser.businessId) {
        throw new ForbiddenException('You can only update orders of your own business');
      }
    }

    if (currentUser.role === UserRole.DELIVERY) {
      if (order.deliveryUserId !== currentUser.sub) {
        throw new ForbiddenException('You can only update orders assigned to you');
      }
      const allowed: OrderStatus[] = [OrderStatus.SHIPPED, OrderStatus.DELIVERED];
      if (!allowed.includes(dto.status)) {
        throw new ForbiddenException('Delivery can only set SHIPPED or DELIVERED status');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id },
        data: { status: dto.status, version: { increment: 1 } },
      });
      await tx.orderEvent.create({
        data: { orderId: id, status: dto.status, message: dto.message, actorUserId: currentUser.sub },
      });
      return result;
    });

    await this.audit.record({
      userId: currentUser.sub,
      actionType: 'ORDER_STATUS_CHANGED',
      entityAffected: 'Order',
      entityId: id,
      metadata: { status: dto.status },
    });
    return updated;
  }

  private orderIncludes() {
    return {
      business: { select: { id: true, companyName: true } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, price: true } } } },
    };
  }
}
