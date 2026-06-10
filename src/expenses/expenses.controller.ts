import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/expense.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ScopesGuard } from '../guards/scopes.guard';
import { RequireScopes } from '../decorators/scopes.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';

@Controller('expenses')
@UseGuards(JwtAuthGuard, ScopesGuard)
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @Post()
  @RequireScopes('expenses.manage')
  create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.expensesService.create(dto, adminId);
  }

  @Get()
  @RequireScopes('expenses.view', 'expenses.manage', 'dashboard.admin')
  findAll() {
    return this.expensesService.findAll();
  }

  @Get('current')
  @UseGuards(ScopesGuard)
  @RequireScopes('dashboard.member', 'expenses.view', 'dashboard.admin')
  findCurrent() {
    return this.expensesService.findCurrent();
  }
}
