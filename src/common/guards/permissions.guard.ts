import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_PERMISSIONS } from '../constants/permissions';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions?.length) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    const granted = user ? ROLE_PERMISSIONS[user.role] : [];
    if (requiredPermissions.every((permission) => granted.includes(permission))) return true;
    throw new ForbiddenException('Insufficient permission');
  }
}
