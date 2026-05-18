import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
  companyId?: string | null;
  supplierId?: string | null;
  sessionId?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
