import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

class CreatePaymentHookDto {
  @IsString()
  orderId!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  provider!: string;
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller({ path: 'payments', version: '1' })
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('hooks')
  createHook(@Body() dto: CreatePaymentHookDto) {
    return this.paymentsService.createHook(dto.orderId, dto.amount, dto.provider);
  }
}
