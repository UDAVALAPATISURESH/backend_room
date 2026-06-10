import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PayDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ScopesGuard } from '../guards/scopes.guard';
import { RequireScopes } from '../decorators/scopes.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard, ScopesGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  @RequireScopes('payments.view', 'payments.manage', 'dashboard.admin')
  findAll(@Query('expenseId') expenseId?: string) {
    return this.paymentsService.findAll(expenseId);
  }

  @Get('dashboard/admin')
  @RequireScopes('dashboard.admin')
  getAdminDashboard() {
    return this.paymentsService.getDashboardStats();
  }

  @Get('dashboard/member')
  @RequireScopes('dashboard.member')
  getMemberDashboard(
    @CurrentUser('sub') userId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const m = month ? parseInt(month, 10) : undefined;
    const y = year ? parseInt(year, 10) : undefined;
    return this.paymentsService.getMemberDashboard(userId, m, y);
  }

  @Get('member/:id')
  findByMember(
    @Param('id') memberId: string,
    @CurrentUser('sub') requesterId: string,
    @CurrentUser('roleSlug') roleSlug: string,
    @CurrentUser('scopes') scopes: string[],
  ) {
    return this.paymentsService.findByMember(
      memberId,
      requesterId,
      roleSlug,
      scopes,
    );
  }

  @Post('pay')
  @RequireScopes('dashboard.member', 'payments.manage')
  pay(@CurrentUser('sub') userId: string, @Body() dto: PayDto) {
    return this.paymentsService.pay(userId, dto);
  }
}
