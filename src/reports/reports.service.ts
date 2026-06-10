import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ReportPeriod } from './dto/report.dto';
import { getBillCategoryLabel } from '../common/bill-categories.constants';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  getDateRange(period: ReportPeriod) {
    const now = new Date();
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);

    switch (period) {
      case ReportPeriod.DAILY: {
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        return { from, to, label: 'Daily Report' };
      }
      case ReportPeriod.WEEKLY: {
        const from = new Date(now);
        from.setDate(now.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        return { from, to, label: 'Weekly Report (Last 7 Days)' };
      }
      case ReportPeriod.MONTHLY: {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from, to, label: 'Monthly Report' };
      }
      case ReportPeriod.YEARLY: {
        const from = new Date(now.getFullYear(), 0, 1);
        return { from, to, label: 'Yearly Report' };
      }
    }
  }

  async exportExcel(
    period: ReportPeriod,
    type: 'payments' | 'bills' | 'all',
    res: Response,
  ) {
    const { from, to, label } = this.getDateRange(period);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Room Expense Tracker';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Summary');
    summary.addRow(['Room Expense Tracker - ' + label]);
    summary.addRow(['Period', `${from.toLocaleDateString('en-IN')} - ${to.toLocaleDateString('en-IN')}`]);
    summary.addRow(['Generated', new Date().toLocaleString('en-IN')]);
    summary.addRow([]);

    let totalCollected = 0;
    let totalPending = 0;

    if (type === 'payments' || type === 'all') {
      const payments = await this.prisma.payment.findMany({
        where: {
          OR: [
            { paymentDate: { gte: from, lte: to } },
            { createdAt: { gte: from, lte: to } },
          ],
        },
        include: {
          user: { select: { name: true, mobile: true, email: true } },
          expense: { select: { month: true, year: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const sheet = workbook.addWorksheet('Room Payments');
      sheet.columns = [
        { header: 'Member', key: 'member', width: 20 },
        { header: 'Mobile', key: 'mobile', width: 14 },
        { header: 'Period', key: 'period', width: 16 },
        { header: 'Amount', key: 'amount', width: 12 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Payment Date', key: 'date', width: 16 },
        { header: 'Remarks', key: 'remarks', width: 24 },
      ];
      sheet.getRow(1).font = { bold: true };

      for (const p of payments) {
        const amt = Number(p.amount);
        if (p.status === 'PAID') totalCollected += amt;
        else totalPending += amt;

        sheet.addRow({
          member: p.user.name,
          mobile: p.user.mobile ?? '-',
          period: `${p.expense.month}/${p.expense.year}`,
          amount: amt,
          status: p.status === 'PAID' ? 'Cleared' : 'Pending',
          date: p.paymentDate
            ? p.paymentDate.toLocaleDateString('en-IN')
            : '-',
          remarks: p.remarks ?? '',
        });
      }
    }

    if (type === 'bills' || type === 'all') {
      const shares = await this.prisma.billShare.findMany({
        where: {
          OR: [
            { paymentDate: { gte: from, lte: to } },
            { createdAt: { gte: from, lte: to } },
          ],
        },
        include: {
          user: { select: { name: true, mobile: true } },
          bill: { select: { title: true, category: true, totalAmount: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const sheet = workbook.addWorksheet('Shared Bills');
      sheet.columns = [
        { header: 'Category', key: 'category', width: 14 },
        { header: 'Bill', key: 'bill', width: 20 },
        { header: 'Member', key: 'member', width: 18 },
        { header: 'Mobile', key: 'mobile', width: 14 },
        { header: 'Share Amount', key: 'amount', width: 14 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Payment Date', key: 'date', width: 16 },
        { header: 'Remarks', key: 'remarks', width: 24 },
      ];
      sheet.getRow(1).font = { bold: true };

      for (const s of shares) {
        const amt = Number(s.amount);
        if (s.status === 'PAID') totalCollected += amt;
        else totalPending += amt;

        sheet.addRow({
          category: getBillCategoryLabel(s.bill.category),
          bill: s.bill.title,
          member: s.user.name,
          mobile: s.user.mobile ?? '-',
          amount: amt,
          status: s.status === 'PAID' ? 'Cleared' : 'Pending',
          date: s.paymentDate
            ? s.paymentDate.toLocaleDateString('en-IN')
            : '-',
          remarks: s.remarks ?? '',
        });
      }
    }

    summary.addRow(['Total Cleared (in period)', totalCollected]);
    summary.addRow(['Total Pending (in period)', totalPending]);
    summary.addRow(['Grand Total', totalCollected + totalPending]);

    const filename = `room-expense-${period}-${Date.now()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  async exportMyHistory(userId: string, period: ReportPeriod, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, mobile: true, email: true },
    });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { from, to, label } = this.getDateRange(period);
    const dateFilter = {
      OR: [
        { paymentDate: { gte: from, lte: to } },
        { createdAt: { gte: from, lte: to } },
      ],
    };

    const payments = await this.prisma.payment.findMany({
      where: { userId, ...dateFilter },
      include: { expense: { select: { month: true, year: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const billShares = await this.prisma.billShare.findMany({
      where: { userId, ...dateFilter },
      include: {
        bill: {
          select: {
            title: true,
            category: true,
            totalAmount: true,
            createdAt: true,
            paidBy: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let roomPaid = 0;
    let roomPending = 0;
    let billPaid = 0;
    let billPending = 0;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Room Expense Tracker';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Summary');
    summary.addRow(['My Expense History - ' + label]);
    summary.addRow(['Name', user.name]);
    summary.addRow(['Mobile', user.mobile ?? '-']);
    summary.addRow(['Period', `${from.toLocaleDateString('en-IN')} - ${to.toLocaleDateString('en-IN')}`]);
    summary.addRow(['Generated', new Date().toLocaleString('en-IN')]);
    summary.addRow([]);

    const roomSheet = workbook.addWorksheet('Room Rent');
    roomSheet.columns = [
      { header: 'Month/Year', key: 'period', width: 16 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Payment Date', key: 'date', width: 16 },
      { header: 'Remarks', key: 'remarks', width: 24 },
    ];
    roomSheet.getRow(1).font = { bold: true };

    for (const p of payments) {
      const amt = Number(p.amount);
      const cleared = p.status === 'PAID';
      if (cleared) roomPaid += amt;
      else roomPending += amt;
      roomSheet.addRow({
        period: `${p.expense.month}/${p.expense.year}`,
        amount: amt,
        status: cleared ? 'Cleared' : 'Pending',
        date: p.paymentDate ? p.paymentDate.toLocaleDateString('en-IN') : '-',
        remarks: p.remarks ?? '',
      });
    }

    const billSheet = workbook.addWorksheet('Shared Bills');
    billSheet.columns = [
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Bill', key: 'bill', width: 20 },
      { header: 'Total Bill', key: 'total', width: 12 },
      { header: 'My Share', key: 'amount', width: 12 },
      { header: 'Paid By', key: 'payer', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Payment Date', key: 'date', width: 16 },
      { header: 'Remarks', key: 'remarks', width: 24 },
    ];
    billSheet.getRow(1).font = { bold: true };

    for (const s of billShares) {
      const amt = Number(s.amount);
      const cleared = s.status === 'PAID';
      if (cleared) billPaid += amt;
      else billPending += amt;
      billSheet.addRow({
        category: getBillCategoryLabel(s.bill.category),
        bill: s.bill.title,
        total: Number(s.bill.totalAmount),
        amount: amt,
        payer: s.bill.paidBy.name,
        status: cleared ? 'Cleared' : 'Pending',
        date: s.paymentDate ? s.paymentDate.toLocaleDateString('en-IN') : '-',
        remarks: s.remarks ?? '',
      });
    }

    summary.addRow(['Room Rent - Cleared', roomPaid]);
    summary.addRow(['Room Rent - Pending', roomPending]);
    summary.addRow(['Shared Bills - Cleared', billPaid]);
    summary.addRow(['Shared Bills - Pending', billPending]);
    summary.addRow([]);
    summary.addRow(['Total Cleared', roomPaid + billPaid]);
    summary.addRow(['Total Pending', roomPending + billPending]);
    summary.addRow(['Grand Total', roomPaid + roomPending + billPaid + billPending]);

    const filename = `my-history-${period}-${Date.now()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
