import { Injectable } from '@nestjs/common';
import { VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateBusinessDto) {
    return this.prisma.business.create({ data: dto });
  }

  findMany() {
    return this.prisma.business.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { users: { select: { id: true, email: true, role: true } } },
    });
  }

  update(id: string, dto: UpdateBusinessDto) {
    return this.prisma.business.update({ where: { id }, data: { ...dto, version: { increment: 1 } } });
  }

  approve(id: string) {
    return this.prisma.business.update({
      where: { id },
      data: { verificationStatus: VerificationStatus.VERIFIED },
    });
  }
}
