import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../decorators/current-user.decorator';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private rolesService: RolesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'fallback-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
        name: true,
        roleId: true,
        role: { select: { slug: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account inactive or not found');
    }

    const scopes = await this.rolesService.getUserScopes(user.roleId);

    return {
      sub: user.id,
      email: user.email,
      roleSlug: user.role.slug,
      scopes,
      name: user.name,
    };
  }
}
