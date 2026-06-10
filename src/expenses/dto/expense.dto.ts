import { IsInt, IsNumber, Min, Max } from 'class-validator';

export class CreateExpenseDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2020)
  year: number;

  @IsNumber()
  @Min(0)
  totalAmount: number;
}
