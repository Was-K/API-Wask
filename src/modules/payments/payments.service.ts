import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  createHook(orderId: string, amount: number, provider = 'manual') {
    return this.prisma.payment.create({
      data: {
        orderId,
        amount: new Prisma.Decimal(amount),
        provider,
        status: PaymentStatus.PENDING,
      },
    });
  }
}
