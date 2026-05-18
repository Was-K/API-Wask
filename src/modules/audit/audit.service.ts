import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';

export interface AuditRecord {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  actionType: string;
  entityAffected: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(data: AuditRecord): Promise<void> {
    await this.prisma.auditLog.create({ data });
  }

  findRecent(take = 100) {
    return this.prisma.auditLog.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
  }
}
