import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateOrderDto, actorUserId: string) {
    if (!dto.items.length) throw new BadRequestException('Order requires at least one item');
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((item) => item.productId) } },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const items = dto.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new BadRequestException(`Product ${item.productId} not found`);
      const total = product.price.mul(item.quantity);
      return { productId: item.productId, quantity: item.quantity, unitPrice: product.price, total };
    });
    const subtotal = items.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: `WK-${Date.now()}`,
          businessId: dto.businessId,
          supplierId: dto.supplierId,
          notes: dto.notes,
          subtotal,
          grandTotal: subtotal,
          items: { create: items },
          events: { create: { status: OrderStatus.PENDING, actorUserId, message: 'Order created' } },
        },
        include: { items: true, events: true },
      });
      return created;
    });
    await this.audit.record({
      userId: actorUserId,
      actionType: 'ORDER_CREATED',
      entityAffected: 'Order',
      entityId: order.id,
      metadata: { orderNumber: order.orderNumber },
    });
    return order;
  }

  findMany() {
    return this.prisma.order.findMany({
      where: { deletedAt: null },
      include: {
        business: { select: { id: true, companyName: true } },
        supplier: { select: { id: true, supplierName: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, actorUserId: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status: dto.status, version: { increment: 1 } },
      });
      await tx.orderEvent.create({
        data: { orderId: id, status: dto.status, message: dto.message, actorUserId },
      });
      return updated;
    });
    await this.audit.record({
      userId: actorUserId,
      actionType: 'ORDER_STATUS_CHANGED',
      entityAffected: 'Order',
      entityId: id,
      metadata: { status: dto.status },
    });
    return order;
  }
}
