import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.$queryRaw`SELECT 1`;
    await this.removeManagerRole();
  }

  private async removeManagerRole() {
    const manager = await this.roleDefinition.findUnique({
      where: { slug: 'manager' },
    });
    if (!manager) return;

    const member = await this.roleDefinition.findUnique({
      where: { slug: 'member' },
    });
    if (member) {
      await this.user.updateMany({
        where: { roleId: manager.id },
        data: { roleId: member.id },
      });
    }

    await this.roleScope.deleteMany({ where: { roleId: manager.id } });
    await this.roleDefinition.delete({ where: { id: manager.id } });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
