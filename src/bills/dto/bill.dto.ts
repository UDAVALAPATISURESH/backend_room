import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { BillCategory, PaymentStatus } from '@prisma/client';

export class CreateBillDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsEnum(BillCategory)
  category: BillCategory;

  @IsNumber()
  @Min(1)
  totalAmount: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  memberIds: string[];

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class PayBillShareDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateShareStatusDto {
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}
