import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty()
  @IsString()
  supplierName!: string;

  @ApiProperty()
  @IsString()
  businessIdentifier!: string;

  @ApiPropertyOptional()
  @IsOptional()
  companyData?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  certifications?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  operationalRegions?: Record<string, unknown>;
}

export class UpdateSupplierDto extends CreateSupplierDto {}
