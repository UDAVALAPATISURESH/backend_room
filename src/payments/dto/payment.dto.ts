import { IsOptional, IsString, IsUUID } from 'class-validator';

export class PayDto {
  @IsUUID()
  expenseId: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdatePaymentDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
