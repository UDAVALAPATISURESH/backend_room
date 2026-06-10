import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { LoginDto } from './dto/auth.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dto/profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private rolesService: RolesService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { mobile: dto.mobile },
      include: {
        role: {
          include: {
            scopes: { include: { scope: { select: { key: true } } } },
          },
        },
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid mobile number or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const scopes = user.role.scopes.map((rs) => rs.scope.key);
    return this.buildAuthResponse(user, scopes);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const scopes = await this.rolesService.getUserScopes(user.role.id);

    return {
      ...user,
      role: user.role.slug,
      roleName: user.role.name,
      roleId: user.role.id,
      scopes,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      include: { role: true },
    });
    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return { message: 'Password updated successfully' };
  }

  private buildAuthResponse(
    user: {
      id: string;
      name: string;
      email: string;
      mobile?: string | null;
      role: { id: string; slug: string; name: string };
    },
    scopes?: string[],
  ) {
    const userScopes = scopes ?? [];
    const payload = {
      sub: user.id,
      email: user.email,
      roleSlug: user.role.slug,
      scopes: userScopes,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role.slug,
        roleName: user.role.name,
        roleId: user.role.id,
        scopes: userScopes,
      },
    };
  }
}
