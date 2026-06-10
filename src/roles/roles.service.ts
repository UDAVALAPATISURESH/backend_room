import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { ALL_SCOPE_KEYS, SCOPE_DEFINITIONS } from '../common/scopes.constants';

@Injectable()
export class RolesService {
  private scopeCache = new Map<string, { scopes: string[]; expires: number }>();

  constructor(private prisma: PrismaService) {}

  clearScopeCache(roleId?: string) {
    if (roleId) this.scopeCache.delete(roleId);
    else this.scopeCache.clear();
  }

  async findAllScopes() {
    return SCOPE_DEFINITIONS;
  }

  async findAllRoles() {
    const roles = await this.prisma.roleDefinition.findMany({
      include: {
        scopes: { include: { scope: true } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return roles.map((r) => this.serializeRole(r));
  }

  async findOne(id: string) {
    const role = await this.prisma.roleDefinition.findUnique({
      where: { id },
      include: {
        scopes: { include: { scope: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    return this.serializeRole(role);
  }

  async create(dto: CreateRoleDto) {
    const slug = dto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const existing = await this.prisma.roleDefinition.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });
    if (existing) throw new ConflictException('Role name already exists');

    const scopeKeys = dto.fullAccess ? [...ALL_SCOPE_KEYS] : dto.scopeKeys ?? [];
    if (!scopeKeys.length) {
      throw new BadRequestException('Select at least one scope or enable full access');
    }

    await this.validateScopeKeys(scopeKeys);

    const scopeRecords = await this.prisma.scope.findMany({
      where: { key: { in: scopeKeys } },
    });

    return this.serializeRole(
      await this.prisma.roleDefinition.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          isSystem: false,
          scopes: {
            create: scopeRecords.map((s) => ({ scopeId: s.id })),
          },
        },
        include: {
          scopes: { include: { scope: true } },
          _count: { select: { users: true } },
        },
      }),
    );
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.roleDefinition.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (dto.scopeKeys) await this.validateScopeKeys(dto.scopeKeys);

    if (dto.scopeKeys) {
      await this.prisma.roleScope.deleteMany({ where: { roleId: id } });
      const scopeRecords = await this.prisma.scope.findMany({
        where: { key: { in: dto.scopeKeys } },
      });
      await this.prisma.roleScope.createMany({
        data: scopeRecords.map((s) => ({ roleId: id, scopeId: s.id })),
      });
      this.clearScopeCache(id);
    }

    const updated = await this.prisma.roleDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        scopes: { include: { scope: true } },
        _count: { select: { users: true } },
      },
    });

    this.clearScopeCache(id);
    return this.serializeRole(updated);
  }

  async remove(id: string) {
    const role = await this.prisma.roleDefinition.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('Cannot delete system role');
    if (role._count.users > 0) {
      throw new BadRequestException('Role is assigned to users. Reassign them first.');
    }

    await this.prisma.roleDefinition.delete({ where: { id } });
    this.clearScopeCache(id);
    return { message: 'Role deleted' };
  }

  async getUserScopes(roleId: string): Promise<string[]> {
    const cached = this.scopeCache.get(roleId);
    if (cached && cached.expires > Date.now()) {
      return cached.scopes;
    }

    const roleScopes = await this.prisma.roleScope.findMany({
      where: { roleId },
      include: { scope: { select: { key: true } } },
    });
    const scopes = roleScopes.map((rs) => rs.scope.key);
    this.scopeCache.set(roleId, {
      scopes,
      expires: Date.now() + 5 * 60 * 1000,
    });
    return scopes;
  }

  private async validateScopeKeys(keys: string[]) {
    const valid = SCOPE_DEFINITIONS.map((s) => s.key);
    const invalid = keys.filter((k) => !valid.includes(k as typeof valid[number]));
    if (invalid.length) {
      throw new BadRequestException(`Invalid scopes: ${invalid.join(', ')}`);
    }
  }

  private serializeRole(role: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isSystem: boolean;
    createdAt: Date;
    scopes: Array<{ scope: { key: string; label: string; module: string } }>;
    _count?: { users: number };
  }) {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      userCount: role._count?.users ?? 0,
      scopes: role.scopes.map((rs) => ({
        key: rs.scope.key,
        label: rs.scope.label,
        module: rs.scope.module,
      })),
      scopeKeys: role.scopes.map((rs) => rs.scope.key),
    };
  }
}
