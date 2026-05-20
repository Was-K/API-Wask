import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateBusinessDto {
  @ApiProperty()
  @IsString()
  companyName!: string;

  @ApiProperty()
  @IsString()
  businessIdentifier!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  fiscalData?: Record<string, unknown>;
}

export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {}

export class RejectBusinessDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}
