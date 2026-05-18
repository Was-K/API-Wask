import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        ...dto,
        price: new Prisma.Decimal(dto.price),
        searchVector: [dto.sku, dto.name, dto.category, dto.subcategory].filter(Boolean).join(' '),
      },
    });
  }

  findMany(query: ProductQueryDto) {
    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        supplierId: query.supplierId,
        category: query.category,
        OR: query.q
          ? [
              { name: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
              { barcode: { contains: query.q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { supplier: { select: { id: true, supplierName: true, rating: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  update(id: string, dto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        price: dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
        version: { increment: 1 },
      },
    });
  }
}
