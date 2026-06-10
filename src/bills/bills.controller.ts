import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { BillsService } from './bills.service';
import { CreateBillDto, PayBillShareDto, UpdateShareStatusDto } from './dto/bill.dto';
import { BILL_CATEGORIES } from '../common/bill-categories.constants';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';

@Controller('bills')
@UseGuards(JwtAuthGuard)
export class BillsController {
  constructor(private billsService: BillsService) {}

  @Get('members')
  getMembers(@CurrentUser('sub') userId: string) {
    return this.billsService.getMembersForBill(userId);
  }

  @Get('my')
  findMyBills(@CurrentUser('sub') userId: string) {
    return this.billsService.findMyBills(userId);
  }

  @Get('categories')
  getCategories() {
    return BILL_CATEGORIES;
  }

  @Get(':id')
  findOne(
    @Param('id') billId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.billsService.findOne(billId, userId);
  }

  @Post()
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateBillDto,
  ) {
    return this.billsService.create(userId, dto);
  }

  @Post('share/:shareId/pay')
  payShare(
    @Param('shareId') shareId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: PayBillShareDto,
  ) {
    return this.billsService.payShare(shareId, userId, dto);
  }

  @Put('share/:shareId/status')
  updateShareStatus(
    @Param('shareId') shareId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateShareStatusDto,
  ) {
    return this.billsService.updateShareStatus(shareId, userId, dto);
  }
}
