import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateExpenseDto } from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async create(dto: CreateExpenseDto, adminId: string) {
    const existing = await this.prisma.monthlyExpense.findUnique({
      where: { month_year: { month: dto.month, year: dto.year } },
    });

    if (existing) {
      throw new ConflictException(
        `Expense for ${dto.month}/${dto.year} already exists`,
      );
    }

    const memberCount = await this.usersService.countActiveMembers();
    if (memberCount === 0) {
      throw new BadRequestException('No active members to split expense');
    }

    const amountPerMember = dto.totalAmount / memberCount;

    const expense = await this.prisma.monthlyExpense.create({
      data: {
        month: dto.month,
        year: dto.year,
        totalAmount: dto.totalAmount,
        amountPerMember,
        createdById: adminId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    const members = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { slug: 'member' },
      },
      select: { id: true },
    });

    await this.prisma.payment.createMany({
      data: members.map((m) => ({
        userId: m.id,
        expenseId: expense.id,
        amount: amountPerMember,
        status: 'PENDING' as const,
      })),
    });

    return this.serializeExpense(expense);
  }

  async findAll() {
    const expenses = await this.prisma.monthlyExpense.findMany({
      include: {
        createdBy: { select: { id: true, name: true } },
        payments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return expenses.map((e) => this.serializeExpenseWithStats(e));
  }

  async findCurrent() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const expense = await this.prisma.monthlyExpense.findUnique({
      where: { month_year: { month, year } },
      include: {
        createdBy: { select: { id: true, name: true } },
        payments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!expense) {
      return null;
    }

    return this.serializeExpenseWithStats(expense);
  }

  async findOne(id: string) {
    const expense = await this.prisma.monthlyExpense.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        payments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return this.serializeExpenseWithStats(expense);
  }

  private serializeExpense(expense: {
    id: string;
    month: number;
    year: number;
    totalAmount: { toNumber?: () => number } | number;
    amountPerMember: { toNumber?: () => number } | number;
    createdAt: Date;
    createdBy?: { id: string; name: string };
  }) {
    return {
      id: expense.id,
      month: expense.month,
      year: expense.year,
      totalAmount: Number(expense.totalAmount),
      amountPerMember: Number(expense.amountPerMember),
      createdAt: expense.createdAt,
      createdBy: expense.createdBy,
    };
  }

  private serializeExpenseWithStats(expense: {
    id: string;
    month: number;
    year: number;
    totalAmount: { toNumber?: () => number } | number;
    amountPerMember: { toNumber?: () => number } | number;
    createdAt: Date;
    createdBy?: { id: string; name: string };
    payments: Array<{
      id: string;
      amount: { toNumber?: () => number } | number;
      status: string;
      paymentDate: Date | null;
      remarks: string | null;
      user: { id: string; name: string; email: string };
    }>;
  }) {
    const payments = expense.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      paymentDate: p.paymentDate,
      remarks: p.remarks,
      user: p.user,
    }));

    const paidCount = payments.filter((p) => p.status === 'PAID').length;
    const pendingCount = payments.filter((p) => p.status === 'PENDING').length;
    const collectedAmount = payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = payments
      .filter((p) => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      ...this.serializeExpense(expense),
      stats: {
        totalMembers: payments.length,
        paidMembers: paidCount,
        pendingMembers: pendingCount,
        collectedAmount,
        pendingAmount,
      },
      payments,
    };
  }
}
