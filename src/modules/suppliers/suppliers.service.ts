import { Injectable } from '@nestjs/common';
import { Prisma, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        supplierName: dto.supplierName,
        businessIdentifier: dto.businessIdentifier,
        companyData: dto.companyData as Prisma.InputJsonValue | undefined,
        certifications: dto.certifications as Prisma.InputJsonValue | undefined,
        operationalRegions: dto.operationalRegions as Prisma.InputJsonValue | undefined,
      },
    });
  }

  findMany() {
    return this.prisma.supplier.findMany({
      where: { deletedAt: null },
      include: { products: { take: 5, orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, dto: UpdateSupplierDto) {
    return this.prisma.supplier.update({
      where: { id },
      data: {
        supplierName: dto.supplierName,
        businessIdentifier: dto.businessIdentifier,
        companyData: dto.companyData as Prisma.InputJsonValue | undefined,
        certifications: dto.certifications as Prisma.InputJsonValue | undefined,
        operationalRegions: dto.operationalRegions as Prisma.InputJsonValue | undefined,
        version: { increment: 1 },
      },
    });
  }

  verify(id: string) {
    return this.prisma.supplier.update({
      where: { id },
      data: { verificationLevel: VerificationStatus.VERIFIED },
    });
  }
}
