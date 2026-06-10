import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(expenseId?: string) {
    const where = expenseId ? { expenseId } : {};
    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        expense: { select: { id: true, month: true, year: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => this.serializePayment(p));
  }

  async findByMember(
    memberId: string,
    requesterId: string,
    roleSlug: string,
    scopes: string[],
  ) {
    const canViewOthers =
      roleSlug === 'admin' ||
      scopes.includes('members.view') ||
      scopes.includes('payments.view');

    if (!canViewOthers && memberId !== requesterId) {
      throw new ForbiddenException('Cannot view other member payments');
    }

    const payments = await this.prisma.payment.findMany({
      where: { userId: memberId },
      include: {
        expense: { select: { id: true, month: true, year: true, amountPerMember: true } },
      },
      orderBy: [{ expense: { year: 'desc' } }, { expense: { month: 'desc' } }],
    });

    return payments.map((p) => this.serializePayment(p));
  }

  async pay(userId: string, dto: PayDto) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        userId_expenseId: { userId, expenseId: dto.expenseId },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (payment.status === 'PAID') {
      throw new BadRequestException('Already paid for this month');
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paymentDate: new Date(),
        remarks: dto.remarks,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        expense: { select: { id: true, month: true, year: true } },
      },
    });

    return this.serializePayment(updated);
  }

  async getDashboardStats() {
    const memberRolePromise = this.prisma.roleDefinition.findUnique({
      where: { slug: 'member' },
      select: { id: true },
    });
    const currentPromise = this.getCurrentMonthPayments();

    const [memberRole, current] = await Promise.all([memberRolePromise, currentPromise]);

    const totalMembers = memberRole
      ? await this.prisma.user.count({
          where: { roleId: memberRole.id, isActive: true },
        })
      : 0;

    if (!current.expense) {
      return {
        totalMembers,
        monthlyExpense: 0,
        perMember: 0,
        paidMembers: 0,
        pendingMembers: 0,
        collectedAmount: 0,
        pendingAmount: 0,
      };
    }

    return {
      totalMembers,
      monthlyExpense: Number(current.expense.totalAmount),
      perMember: Number(current.expense.amountPerMember),
      paidMembers: current.paidCount,
      pendingMembers: current.pendingCount,
      collectedAmount: current.collectedAmount,
      pendingAmount: current.pendingAmount,
    };
  }

  async getMemberDashboard(userId: string, month?: number, year?: number) {
    const now = new Date();
    const viewMonth = month ?? now.getMonth() + 1;
    const viewYear = year ?? now.getFullYear();
    const isCurrentMonth =
      viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear();

    const [user, expense, billShares, paymentHistory] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, mobile: true, email: true },
      }),
      this.prisma.monthlyExpense.findUnique({
        where: { month_year: { month: viewMonth, year: viewYear } },
        include: { payments: { where: { userId } } },
      }),
      this.prisma.billShare.findMany({
        where: {
          userId,
          bill: {
            createdAt: {
              gte: new Date(viewYear, viewMonth - 1, 1),
              lt: new Date(viewYear, viewMonth, 1),
            },
          },
        },
        include: {
          bill: {
            select: {
              id: true,
              title: true,
              category: true,
              totalAmount: true,
              createdAt: true,
              createdById: true,
              createdBy: { select: { id: true, name: true } },
              paidBy: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        where: { userId },
        include: {
          expense: {
            select: { id: true, month: true, year: true, amountPerMember: true },
          },
        },
        orderBy: [{ expense: { year: 'desc' } }, { expense: { month: 'desc' } }],
        take: 24,
      }),
    ]);

    const myPayment = expense?.payments[0];
    const roomRentAmount = myPayment
      ? Number(myPayment.amount)
      : expense
        ? Number(expense.amountPerMember)
        : 0;

    const roomPaid =
      myPayment?.status === 'PAID' ? Number(myPayment.amount) : 0;
    const roomPending =
      myPayment?.status === 'PENDING' ? Number(myPayment.amount) : 0;

    const billPending = billShares
      .filter((s) => s.status === 'PENDING')
      .reduce((sum, share) => sum + Number(share.amount), 0);

    const billPaidInMonth = billShares
      .filter((s) => s.status === 'PAID')
      .reduce((sum, share) => sum + Number(share.amount), 0);

    const pendingBillCount = billShares.filter((s) => s.status === 'PENDING').length;

    const monthBills = billShares.map((s) => ({
      shareId: s.id,
      myAmount: Number(s.amount),
      myStatus: s.status,
      isCreator: s.bill.createdById === userId,
      bill: {
        id: s.bill.id,
        title: s.bill.title,
        category: s.bill.category,
        totalAmount: Number(s.bill.totalAmount),
        createdAt: s.bill.createdAt,
        createdBy: s.bill.createdBy,
        paidBy: s.bill.paidBy,
      },
    }));

    const monthPayment = myPayment
      ? {
          amount: Number(myPayment.amount),
          status: myPayment.status,
          expenseId: expense!.id,
          paymentId: myPayment.id,
        }
      : null;

    return {
      name: user?.name,
      email: user?.email,
      mobile: user?.mobile,
      viewingMonth: { month: viewMonth, year: viewYear },
      isCurrentMonth,
      monthPayment,
      stats: {
        roomRentAmount,
        roomPaid,
        roomPending,
        billPending,
        billPaidInMonth,
        pendingBillCount,
        totalPending: roomPending + billPending,
        totalPaidInMonth: roomPaid + billPaidInMonth,
      },
      monthBills,
      paymentHistory: paymentHistory
        .filter(
          (p) =>
            p.expense.month === viewMonth && p.expense.year === viewYear,
        )
        .map((p) => this.serializePayment(p)),
    };
  }

  private async getCurrentMonthPayments() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const expense = await this.prisma.monthlyExpense.findUnique({
      where: { month_year: { month, year } },
      include: { payments: true },
    });

    if (!expense) {
      return {
        expense: null,
        paidCount: 0,
        pendingCount: 0,
        collectedAmount: 0,
        pendingAmount: 0,
      };
    }

    const paid = expense.payments.filter((p) => p.status === 'PAID');
    const pending = expense.payments.filter((p) => p.status === 'PENDING');

    return {
      expense,
      paidCount: paid.length,
      pendingCount: pending.length,
      collectedAmount: paid.reduce((s, p) => s + Number(p.amount), 0),
      pendingAmount: pending.reduce((s, p) => s + Number(p.amount), 0),
    };
  }

  private serializePayment(payment: {
    id: string;
    amount: { toNumber?: () => number } | number;
    status: string;
    paymentDate: Date | null;
    remarks: string | null;
    createdAt: Date;
    user?: { id: string; name: string; email: string };
    expense?: {
      id: string;
      month: number;
      year: number;
      amountPerMember?: { toNumber?: () => number } | number;
    };
  }) {
    return {
      id: payment.id,
      amount: Number(payment.amount),
      status: payment.status,
      paymentDate: payment.paymentDate,
      remarks: payment.remarks,
      createdAt: payment.createdAt,
      user: payment.user,
      expense: payment.expense
        ? {
            ...payment.expense,
            amountPerMember: payment.expense.amountPerMember
              ? Number(payment.expense.amountPerMember)
              : undefined,
          }
        : undefined,
    };
  }
}
