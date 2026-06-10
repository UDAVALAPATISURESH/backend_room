import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ExportQueryDto, ReportType } from './dto/export-query.dto';
import { ReportPeriod } from './dto/report.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ScopesGuard } from '../guards/scopes.guard';
import { RequireScopes } from '../decorators/scopes.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, ScopesGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('export/excel')
  @RequireScopes('reports.export')
  async exportExcel(
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    return this.reportsService.exportExcel(
      query.period ?? ReportPeriod.MONTHLY,
      query.type ?? ReportType.ALL,
      res,
    );
  }

  @Get('export/my-history')
  async exportMyHistory(
    @CurrentUser('sub') userId: string,
    @Query('period') period: ReportPeriod = ReportPeriod.MONTHLY,
    @Res() res: Response,
  ) {
    return this.reportsService.exportMyHistory(userId, period, res);
  }

  @Get('summary')
  @RequireScopes('reports.export', 'dashboard.admin')
  getSummary(@Query('period') period: ReportPeriod = ReportPeriod.MONTHLY) {
    const range = this.reportsService.getDateRange(period);
    return {
      period,
      label: range.label,
      from: range.from,
      to: range.to,
    };
  }
}
