import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationalStatus, Prisma, UserStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateBusinessDto, RejectBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateBusinessDto) {
    return this.prisma.business.create({
      data: {
        ...dto,
        fiscalData: dto.fiscalData as Prisma.InputJsonValue | undefined,
      },
    });
  }

  findMany(verificationStatus?: VerificationStatus, q?: string, deleted?: boolean) {
    return this.prisma.business.findMany({
      where: {
        deletedAt: deleted ? { not: null } : null,
        verificationStatus: deleted ? undefined : verificationStatus,
        companyName: q ? { contains: q, mode: 'insensitive' } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        users: { select: { id: true, email: true, role: true, status: true } },
      },
    });
  }

  /** Campos públicos de una tienda (sin datos fiscales ni usuarios). */
  private static readonly SHOP_PUBLIC_SELECT = {
    id: true,
    companyName: true,
    industry: true,
    logo: true,
    address: true,
    phone: true,
    latitude: true,
    longitude: true,
    operationalStatus: true,
  } as const;

  /** Listado público de tiendas para el CUSTOMER: solo VERIFIED + operativas. */
  findShops(q?: string) {
    return this.prisma.business.findMany({
      where: {
        deletedAt: null,
        verificationStatus: VerificationStatus.VERIFIED,
        operationalStatus: OperationalStatus.ACTIVE,
        companyName: q ? { contains: q, mode: 'insensitive' } : undefined,
      },
      select: BusinessService.SHOP_PUBLIC_SELECT,
      orderBy: { companyName: 'asc' },
    });
  }

  /** Detalle público de una tienda para el CUSTOMER. */
  async findShopById(id: string) {
    const shop = await this.prisma.business.findFirst({
      where: {
        id,
        deletedAt: null,
        verificationStatus: VerificationStatus.VERIFIED,
        operationalStatus: OperationalStatus.ACTIVE,
      },
      select: BusinessService.SHOP_PUBLIC_SELECT,
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  /** Detalle completo de un negocio (solo ADMIN). */
  async findOne(id: string) {
    const business = await this.prisma.business.findFirst({
      where: { id, deletedAt: null },
      include: {
        users: { select: { id: true, email: true, role: true, status: true } },
      },
    });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async findMyBusiness(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new NotFoundException('No business associated with this account');
    const business = await this.prisma.business.findFirst({
      where: { id: user.businessId, deletedAt: null },
    });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async updateMyBusiness(userId: string, dto: UpdateBusinessDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new ForbiddenException('No business associated with this account');
    return this.prisma.business.update({
      where: { id: user.businessId },
      data: { ...dto, fiscalData: dto.fiscalData as Prisma.InputJsonValue | undefined, version: { increment: 1 } },
    });
  }

  update(id: string, dto: UpdateBusinessDto) {
    return this.prisma.business.update({
      where: { id },
      data: { ...dto, fiscalData: dto.fiscalData as Prisma.InputJsonValue | undefined, version: { increment: 1 } },
    });
  }

  async approve(id: string) {
    const business = await this.prisma.business.findFirst({ where: { id, deletedAt: null } });
    if (!business) throw new NotFoundException('Business not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.business.update({
        where: { id },
        data: {
          verificationStatus: VerificationStatus.VERIFIED,
          rejectionReason: null,
          version: { increment: 1 },
        },
      });
      await tx.user.updateMany({
        where: { businessId: id, status: UserStatus.PENDING },
        data: { status: UserStatus.ACTIVE, isVerified: true },
      });
      return updated;
    });
  }

  async reject(id: string, dto: RejectBusinessDto) {
    const business = await this.prisma.business.findFirst({ where: { id, deletedAt: null } });
    if (!business) throw new NotFoundException('Business not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.business.update({
        where: { id },
        data: {
          verificationStatus: VerificationStatus.REJECTED,
          rejectionReason: dto.reason,
          version: { increment: 1 },
        },
      });
      await tx.user.updateMany({
        where: { businessId: id, status: UserStatus.PENDING },
        data: { status: UserStatus.DISABLED },
      });
      return updated;
    });
  }

  async deleteMyBusiness(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new ForbiddenException('No business associated with this account');

    const business = await this.prisma.business.findFirst({
      where: { id: user.businessId, deletedAt: null },
    });
    if (!business) throw new NotFoundException('Business not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: user.businessId! },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      await tx.user.updateMany({
        where: { businessId: user.businessId! },
        data: { status: UserStatus.DISABLED, deletedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { deleted: true };
  }

  async deleteByAdmin(id: string) {
    const business = await this.prisma.business.findFirst({ where: { id, deletedAt: null } });
    if (!business) throw new NotFoundException('Business not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      await tx.user.updateMany({
        where: { businessId: id },
        data: { status: UserStatus.DISABLED, deletedAt: new Date() },
      });
      await tx.product.updateMany({
        where: { businessId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      const users = await tx.user.findMany({ where: { businessId: id }, select: { id: true } });
      if (users.length > 0) {
        await tx.session.updateMany({
          where: { userId: { in: users.map((u) => u.id) }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });

    return { deleted: true };
  }

  async restore(id: string) {
    const business = await this.prisma.business.findFirst({
      where: { id, deletedAt: { not: null } },
      include: { users: { select: { id: true } } },
    });
    if (!business) throw new NotFoundException('Business not found or is not deleted');

    await this.prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id },
        data: {
          deletedAt: null,
          verificationStatus: VerificationStatus.PENDING,
          rejectionReason: null,
          version: { increment: 1 },
        },
      });
      await tx.user.updateMany({
        where: { businessId: id },
        data: { deletedAt: null, status: UserStatus.PENDING },
      });
      await tx.product.updateMany({
        where: { businessId: id },
        data: { deletedAt: null },
      });
    });

    return { restored: true, businessId: id };
  }
}
