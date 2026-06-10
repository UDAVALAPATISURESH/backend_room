import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPES_KEY } from '../decorators/scopes.decorator';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    const userScopes: string[] = user?.scopes ?? [];

    if (user?.roleSlug === 'admin') return true;

    const hasScope = required.some((s) => userScopes.includes(s));
    if (!hasScope) {
      throw new ForbiddenException('Missing required permission');
    }
    return true;
  }
}
