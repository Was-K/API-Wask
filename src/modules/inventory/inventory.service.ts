import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InventoryMovementType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateWarehouseDto, StockMovementDto, UpsertInventoryDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createWarehouse(dto: CreateWarehouseDto, currentUser: AuthenticatedUser) {
    if (!currentUser.businessId) throw new ForbiddenException('No business associated');
    return this.prisma.warehouse.create({ data: { ...dto, businessId: currentUser.businessId } });
  }

  async createWarehouseAdmin(dto: CreateWarehouseDto, businessId: string) {
    return this.prisma.warehouse.create({ data: { ...dto, businessId } });
  }

  async upsertItem(dto: UpsertInventoryDto, currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.BUSINESS_OWNER) {
      if (!currentUser.businessId) throw new ForbiddenException('No business associated');
      const [warehouse, product] = await Promise.all([
        this.prisma.warehouse.findFirst({
          where: { id: dto.warehouseId, businessId: currentUser.businessId, deletedAt: null },
        }),
        this.prisma.product.findFirst({
          where: { id: dto.productId, businessId: currentUser.businessId, deletedAt: null },
        }),
      ]);
      if (!warehouse) throw new ForbiddenException('Warehouse does not belong to your business');
      if (!product) throw new ForbiddenException('Product does not belong to your business');
    }

    return this.prisma.inventoryItem.upsert({
      where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId } },
      update: {
        availableStock: dto.availableStock,
        minimumStock: dto.minimumStock,
        version: { increment: 1 },
      },
      create: dto,
    });
  }

  async findMyInventory(currentUser: AuthenticatedUser) {
    if (!currentUser.businessId) throw new ForbiddenException('No business associated');
    return this.prisma.inventoryItem.findMany({
      where: {
        deletedAt: null,
        product: { businessId: currentUser.businessId, deletedAt: null },
      },
      include: {
        product: { select: { id: true, name: true, sku: true, category: true, price: true, status: true } },
        warehouse: { select: { id: true, name: true, code: true, region: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findLowStock(currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.BUSINESS_OWNER) {
      if (!currentUser.businessId) throw new ForbiddenException('No business associated');
      return this.prisma.inventoryItem.findMany({
        where: {
          deletedAt: null,
          product: { businessId: currentUser.businessId, deletedAt: null },
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
    }

    // ADMIN: all businesses
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "InventoryItem"
      WHERE "deletedAt" IS NULL AND "availableStock" <= "minimumStock"
      ORDER BY "updatedAt" DESC LIMIT 100
    `;
    if (!rows.length) return [];
    return this.prisma.inventoryItem.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async moveStock(dto: StockMovementDto, currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.BUSINESS_OWNER) {
      if (!currentUser.businessId) throw new ForbiddenException('No business associated');
      const item = await this.prisma.inventoryItem.findFirst({
        where: { id: dto.inventoryItemId },
        include: { warehouse: { select: { businessId: true } } },
      });
      if (!item || item.warehouse.businessId !== currentUser.businessId) {
        throw new ForbiddenException('Inventory item does not belong to your business');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: dto.inventoryItemId } });
      const delta = this.stockDelta(dto.type, dto.quantity);
      if (item.availableStock + delta < 0) throw new BadRequestException('Insufficient stock');
      const updated = await tx.inventoryItem.update({
        where: { id: dto.inventoryItemId },
        data: { availableStock: { increment: delta }, version: { increment: 1 } },
      });
      await tx.inventoryMovement.create({
        data: { ...dto, actorUserId: currentUser.sub },
      });
      return updated;
    });

    await this.audit.record({
      userId: currentUser.sub,
      actionType: 'INVENTORY_MOVEMENT',
      entityAffected: 'InventoryItem',
      entityId: dto.inventoryItemId,
      metadata: { type: dto.type, quantity: dto.quantity },
    });
    return result;
  }

  private stockDelta(type: InventoryMovementType, quantity: number): number {
    if (type === InventoryMovementType.INBOUND || type === InventoryMovementType.RELEASE) return quantity;
    return -Math.abs(quantity);
  }
}
