import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus, VerificationStatus } from '@prisma/client';
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

  findMany(verificationStatus?: VerificationStatus, q?: string) {
    return this.prisma.business.findMany({
      where: {
        deletedAt: null,
        verificationStatus,
        companyName: q ? { contains: q, mode: 'insensitive' } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        users: { select: { id: true, email: true, role: true, status: true } },
      },
    });
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
}
