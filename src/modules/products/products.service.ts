import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductApprovalStatus, ProductStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import {
  CreateProductDto,
  ProductQueryDto,
  RejectProductDto,
  UpdateProductDto,
} from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto, currentUser: AuthenticatedUser) {
    let businessId: string;

    if (currentUser.role === UserRole.BUSINESS_OWNER) {
      if (!currentUser.businessId) {
        throw new ForbiddenException('No business associated with your account');
      }
      const business = await this.prisma.business.findFirst({
        where: { id: currentUser.businessId, deletedAt: null },
      });
      if (!business) throw new NotFoundException('Business not found');
      if (business.verificationStatus !== 'VERIFIED') {
        throw new ForbiddenException('Your business must be approved before adding products');
      }
      businessId = currentUser.businessId;
    } else {
      throw new ForbiddenException('Only BUSINESS_OWNER or ADMIN can create products');
    }

    return this.prisma.product.create({
      data: {
        ...dto,
        price: new Prisma.Decimal(dto.price),
        alcoholPercentage: dto.alcoholPercentage !== undefined ? new Prisma.Decimal(dto.alcoholPercentage) : undefined,
        businessId,
        status: ProductStatus.DRAFT,
        approvalStatus: ProductApprovalStatus.PENDING,
        searchVector: [dto.sku, dto.name, dto.category, dto.subcategory, dto.brand]
          .filter(Boolean)
          .join(' '),
      },
    });
  }

  async createAsAdmin(dto: CreateProductDto, businessId: string, adminUserId: string) {
    const business = await this.prisma.business.findFirst({ where: { id: businessId, deletedAt: null } });
    if (!business) throw new NotFoundException('Business not found');

    return this.prisma.product.create({
      data: {
        ...dto,
        price: new Prisma.Decimal(dto.price),
        alcoholPercentage: dto.alcoholPercentage !== undefined ? new Prisma.Decimal(dto.alcoholPercentage) : undefined,
        businessId,
        status: ProductStatus.ACTIVE,
        approvalStatus: ProductApprovalStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: adminUserId,
        searchVector: [dto.sku, dto.name, dto.category, dto.subcategory, dto.brand]
          .filter(Boolean)
          .join(' '),
      },
    });
  }

  findMany(query: ProductQueryDto, currentUser: AuthenticatedUser) {
    let businessIdFilter: string | undefined;

    if (currentUser.role === UserRole.CUSTOMER) {
      return this.prisma.product.findMany({
        where: {
          deletedAt: null,
          status: ProductStatus.ACTIVE,
          approvalStatus: ProductApprovalStatus.APPROVED,
          category: query.category,
          OR: query.q
            ? [
                { name: { contains: query.q, mode: 'insensitive' } },
                { sku: { contains: query.q, mode: 'insensitive' } },
                { barcode: { contains: query.q, mode: 'insensitive' } },
              ]
            : undefined,
        },
        include: { business: { select: { id: true, companyName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }

    if (currentUser.role === UserRole.BUSINESS_OWNER) {
      businessIdFilter = currentUser.businessId ?? undefined;
    } else if (currentUser.role === UserRole.ADMIN) {
      businessIdFilter = query.businessId;
    }

    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        businessId: businessIdFilter,
        category: query.category,
        status: query.status,
        approvalStatus: query.approvalStatus,
        OR: query.q
          ? [
              { name: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
              { barcode: { contains: query.q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { business: { select: { id: true, companyName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  findPendingApproval() {
    return this.prisma.product.findMany({
      where: { deletedAt: null, approvalStatus: ProductApprovalStatus.PENDING },
      include: { business: { select: { id: true, companyName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, dto: UpdateProductDto, currentUser: AuthenticatedUser) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');

    if (currentUser.role === UserRole.BUSINESS_OWNER) {
      if (product.businessId !== currentUser.businessId) {
        throw new ForbiddenException('You can only edit your own products');
      }
      const sensitiveFields: (keyof UpdateProductDto)[] = [
        'name', 'description', 'category', 'price', 'images', 'barcode', 'brand',
        'volumeMl', 'alcoholPercentage', 'subcategory',
      ];
      const touchesSensitive = sensitiveFields.some((f) => dto[f] !== undefined);
      if (touchesSensitive) {
        return this.prisma.product.update({
          where: { id },
          data: {
            ...dto,
            price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
            alcoholPercentage: dto.alcoholPercentage !== undefined ? new Prisma.Decimal(dto.alcoholPercentage) : undefined,
            approvalStatus: ProductApprovalStatus.PENDING,
            status: ProductStatus.DRAFT,
            rejectionReason: null,
            version: { increment: 1 },
          },
        });
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        alcoholPercentage: dto.alcoholPercentage !== undefined ? new Prisma.Decimal(dto.alcoholPercentage) : undefined,
        version: { increment: 1 },
      },
    });
  }

  async approve(id: string, adminUserId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.product.update({
      where: { id },
      data: {
        approvalStatus: ProductApprovalStatus.APPROVED,
        status: ProductStatus.ACTIVE,
        approvedAt: new Date(),
        approvedById: adminUserId,
        rejectionReason: null,
        version: { increment: 1 },
      },
    });
  }

  async reject(id: string, dto: RejectProductDto) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.product.update({
      where: { id },
      data: {
        approvalStatus: ProductApprovalStatus.REJECTED,
        status: ProductStatus.DRAFT,
        rejectionReason: dto.reason,
        version: { increment: 1 },
      },
    });
  }

  async archive(id: string, currentUser: AuthenticatedUser) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    if (currentUser.role === UserRole.BUSINESS_OWNER && product.businessId !== currentUser.businessId) {
      throw new ForbiddenException('You can only archive your own products');
    }
    return this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED, version: { increment: 1 } },
    });
  }
}
