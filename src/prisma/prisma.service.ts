import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
    });
  }

  async onModuleInit() {
    const maxAttempts = 5;
    const delayMs = 3000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        if (attempt > 1) {
          this.logger.log('Database connected');
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === maxAttempts) {
          this.logger.error(
            `Database unreachable after ${maxAttempts} attempts. ` +
              'If using Neon free tier, open the Neon dashboard to wake the database, then restart.',
          );
          throw error;
        }
        this.logger.warn(
          `Database not ready (attempt ${attempt}/${maxAttempts}): ${message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
