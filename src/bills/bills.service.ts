import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBillDto, PayBillShareDto, UpdateShareStatusDto } from './dto/bill.dto';
import { getBillCategoryLabel } from '../common/bill-categories.constants';

@Injectable()
export class BillsService {
  constructor(private prisma: PrismaService) {}

  async create(creatorId: string, dto: CreateBillDto) {
    const uniqueIds = [...new Set([creatorId, ...dto.memberIds])];

    const members = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true },
    });

    if (members.length !== uniqueIds.length) {
      throw new BadRequestException('One or more selected members are invalid');
    }

    const shareAmount = Math.round((dto.totalAmount / uniqueIds.length) * 100) / 100;
    const remainder = dto.totalAmount - shareAmount * uniqueIds.length;

    const title = dto.title?.trim() || getBillCategoryLabel(dto.category);

    const bill = await this.prisma.bill.create({
      data: {
        title,
        category: dto.category,
        totalAmount: dto.totalAmount,
        paidById: creatorId,
        createdById: creatorId,
        remarks: dto.remarks,
        shares: {
          create: uniqueIds.map((userId, index) => ({
            userId,
            amount: shareAmount + (index === 0 ? remainder : 0),
            status: userId === creatorId ? 'PAID' : 'PENDING',
            paymentDate: userId === creatorId ? new Date() : null,
            remarks: userId === creatorId ? 'Paid upfront' : null,
          })),
        },
      },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        shares: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return this.serializeBill(bill);
  }

  async findMyBills(userId: string) {
    const shares = await this.prisma.billShare.findMany({
      where: { userId },
      include: {
        bill: {
          include: {
            paidBy: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const creatorBillIds = shares
      .filter((s) => s.bill.createdById === userId)
      .map((s) => s.bill.id);

    const allSharesByBill = new Map<string, Awaited<ReturnType<typeof this.fetchBillShares>>>();
    if (creatorBillIds.length) {
      const billShares = await this.fetchBillShares(creatorBillIds);
      for (const id of creatorBillIds) {
        allSharesByBill.set(
          id,
          billShares.filter((s) => s.billId === id),
        );
      }
    }

    return shares.map((s) => {
      const extraShares =
        s.bill.createdById === userId
          ? allSharesByBill.get(s.bill.id)?.map((share) => ({
              id: share.id,
              userId: share.userId,
              amount: share.amount,
              status: share.status,
              paymentDate: share.paymentDate,
              remarks: share.remarks,
              user: share.user,
            }))
          : undefined;

      const bill = this.serializeBill({ ...s.bill, shares: extraShares });

      return {
        shareId: s.id,
        myAmount: Number(s.amount),
        myStatus: s.status,
        myPaymentDate: s.paymentDate,
        isCreator: s.bill.createdById === userId,
        bill,
      };
    });
  }

  private fetchBillShares(billIds: string[]) {
    return this.prisma.billShare.findMany({
      where: { billId: { in: billIds } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async findOne(billId: string, userId: string) {
    const share = await this.prisma.billShare.findUnique({
      where: { billId_userId: { billId, userId } },
    });

    if (!share) {
      throw new ForbiddenException('You do not have access to this bill');
    }

    const bill = await this.prisma.bill.findUnique({
      where: { id: billId },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        shares: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return this.serializeBill(bill);
  }

  async payShare(shareId: string, userId: string, dto: PayBillShareDto) {
    const share = await this.prisma.billShare.findUnique({
      where: { id: shareId },
      include: { bill: true },
    });

    if (!share) {
      throw new NotFoundException('Bill share not found');
    }

    if (share.userId !== userId) {
      throw new ForbiddenException('You can only pay your own share');
    }

    if (share.bill.paidById === userId) {
      throw new BadRequestException('You already paid this bill upfront');
    }

    if (share.status === 'PAID') {
      throw new BadRequestException('Already paid');
    }

    const updated = await this.prisma.billShare.update({
      where: { id: shareId },
      data: {
        status: 'PAID',
        paymentDate: new Date(),
        remarks: dto.remarks,
      },
      include: {
        bill: {
          include: {
            paidBy: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            shares: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      shareId: updated.id,
      myAmount: Number(updated.amount),
      myStatus: updated.status,
      myPaymentDate: updated.paymentDate,
      bill: this.serializeBill(updated.bill),
    };
  }

  async updateShareStatus(
    shareId: string,
    creatorId: string,
    dto: UpdateShareStatusDto,
  ) {
    const share = await this.prisma.billShare.findUnique({
      where: { id: shareId },
      include: { bill: true, user: { select: { id: true, name: true } } },
    });

    if (!share) {
      throw new NotFoundException('Bill share not found');
    }

    if (share.bill.createdById !== creatorId) {
      throw new ForbiddenException('Only the bill creator can update payment status');
    }

    if (share.userId === creatorId) {
      throw new BadRequestException('Cannot update your own share — you paid upfront');
    }

    const updated = await this.prisma.billShare.update({
      where: { id: shareId },
      data: {
        status: dto.status,
        paymentDate: dto.status === 'PAID' ? new Date() : null,
        remarks: dto.remarks ?? (dto.status === 'PAID' ? 'Confirmed by bill creator' : null),
      },
      include: {
        bill: {
          include: {
            paidBy: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            shares: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      shareId: updated.id,
      memberName: updated.user.name,
      amount: Number(updated.amount),
      status: updated.status,
      paymentDate: updated.paymentDate,
      bill: this.serializeBill(updated.bill),
    };
  }

  async getMembersForBill(userId: string) {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { slug: 'member' },
        NOT: { id: userId },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  private serializeBill(bill: {
    id: string;
    title: string;
    category?: string;
    totalAmount: { toNumber?: () => number } | number;
    remarks: string | null;
    createdAt: Date;
    paidBy?: { id: string; name: string; email: string };
    createdBy?: { id: string; name: string; email: string };
    shares?: Array<{
      id: string;
      userId: string;
      amount: { toNumber?: () => number } | number;
      status: string;
      paymentDate: Date | null;
      remarks: string | null;
      user: { id: string; name: string; email: string };
    }>;
  }) {
    const shares = bill.shares?.map((s) => ({
      id: s.id,
      userId: s.userId,
      amount: Number(s.amount),
      status: s.status,
      paymentDate: s.paymentDate,
      remarks: s.remarks,
      user: s.user,
    }));

    const paidCount = shares?.filter((s) => s.status === 'PAID').length ?? 0;
    const pendingCount = shares?.filter((s) => s.status === 'PENDING').length ?? 0;

    return {
      id: bill.id,
      title: bill.title,
      category: bill.category ?? 'OTHER',
      totalAmount: Number(bill.totalAmount),
      remarks: bill.remarks,
      createdAt: bill.createdAt,
      paidBy: bill.paidBy,
      createdBy: bill.createdBy,
      shares,
      stats: {
        totalShares: shares?.length ?? 0,
        paidCount,
        pendingCount,
      },
    };
  }
}
