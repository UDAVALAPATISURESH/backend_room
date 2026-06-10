import { IsEnum, IsOptional } from 'class-validator';
import { ReportPeriod } from './report.dto';

export enum ReportType {
  PAYMENTS = 'payments',
  BILLS = 'bills',
  ALL = 'all',
}

export class ExportQueryDto {
  @IsEnum(ReportPeriod)
  period: ReportPeriod;

  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;
}
