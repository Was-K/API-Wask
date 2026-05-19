import { BadRequestException, Injectable } from '@nestjs/common';
import { InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWarehouseDto, StockMovementDto, UpsertInventoryDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  createWarehouse(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  upsertItem(dto: UpsertInventoryDto) {
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

  async findLowStock() {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "InventoryItem"
      WHERE "deletedAt" IS NULL AND "availableStock" <= "minimumStock"
      ORDER BY "updatedAt" DESC LIMIT 100
    `;
    if (!rows.length) return [];
    return this.prisma.inventoryItem.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: { product: true, warehouse: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async moveStock(dto: StockMovementDto, actorUserId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: dto.inventoryItemId } });
      const delta = this.stockDelta(dto.type, dto.quantity);
      if (item.availableStock + delta < 0) throw new BadRequestException('Insufficient stock');

      const updated = await tx.inventoryItem.update({
        where: { id: dto.inventoryItemId },
        data: { availableStock: { increment: delta }, version: { increment: 1 } },
      });
      await tx.inventoryMovement.create({
        data: { ...dto, actorUserId },
      });
      return updated;
    });

    await this.audit.record({
      userId: actorUserId,
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
