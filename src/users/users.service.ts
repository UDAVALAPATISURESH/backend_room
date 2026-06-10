import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const userSelect = {
  id: true,
  name: true,
  email: true,
  mobile: true,
  isActive: true,
  createdAt: true,
  role: { select: { id: true, name: true, slug: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.serializeUser(u));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.serializeUser(user);
  }

  async create(dto: CreateUserDto) {
    const existingMobile = await this.prisma.user.findUnique({
      where: { mobile: dto.mobile },
    });
    if (existingMobile) throw new ConflictException('Mobile number already exists');

    const email = dto.email ?? `${dto.mobile}@room.local`;
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) throw new ConflictException('User already exists for this mobile');

    let roleId = dto.roleId;
    if (!roleId) {
      const memberRole = await this.prisma.roleDefinition.findUnique({
        where: { slug: 'member' },
      });
      if (!memberRole) throw new BadRequestException('Default member role not found');
      roleId = memberRole.id;
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        mobile: dto.mobile,
        password: hashed,
        roleId,
      },
      select: userSelect,
    });
    return this.serializeUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.mobile) {
      const existing = await this.prisma.user.findFirst({
        where: { mobile: dto.mobile, NOT: { id } },
      });
      if (existing) throw new ConflictException('Mobile number already exists');
    }

    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (existing) throw new ConflictException('Email already exists');
    }

    const data: Record<string, unknown> = { ...dto };
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
    return this.serializeUser(user);
  }

  async remove(id: string) {
    const user = await this.findOne(id);

    if (user.role === 'admin') {
      const adminRole = await this.prisma.roleDefinition.findUnique({
        where: { slug: 'admin' },
      });
      const adminCount = await this.prisma.user.count({
        where: { roleId: adminRole!.id, isActive: true },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the only active admin');
      }
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async countActiveMembers() {
    const memberRole = await this.prisma.roleDefinition.findUnique({
      where: { slug: 'member' },
    });
    if (!memberRole) return 0;
    return this.prisma.user.count({
      where: { roleId: memberRole.id, isActive: true },
    });
  }

  private serializeUser(user: {
    id: string;
    name: string;
    email: string;
    mobile?: string | null;
    isActive: boolean;
    createdAt: Date;
    role: { id: string; name: string; slug: string };
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      isActive: user.isActive,
      createdAt: user.createdAt,
      role: user.role.slug,
      roleId: user.role.id,
      roleName: user.role.name,
    };
  }
}
