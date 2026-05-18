import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { StringValue } from 'ms';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

interface ClientContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, context: ClientContext): Promise<Omit<User, 'password'>> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email is already registered');

    const password = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        password,
        role: dto.role,
        companyId: dto.role === UserRole.BUSINESS ? dto.companyId : undefined,
        supplierId: dto.role === UserRole.SUPPLIER ? dto.supplierId : undefined,
        status: dto.role === UserRole.ADMIN ? UserStatus.ACTIVE : UserStatus.PENDING,
        isVerified: dto.role === UserRole.ADMIN,
      },
    });

    await this.issueEmailVerification(user.id);
    await this.audit.record({
      userId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      actionType: 'AUTH_REGISTER',
      entityAffected: 'User',
      entityId: user.id,
    });

    const safeUser: Omit<User, 'password'> = {
      id: user.id,
      uuid: user.uuid,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      companyId: user.companyId,
      supplierId: user.supplierId,
      status: user.status,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin,
      version: user.version,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
    return safeUser;
  }

  async login(dto: LoginDto, context: ClientContext): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || user.deletedAt) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('User is not active');
    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshHash: 'pending',
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt: this.refreshExpiry(),
      },
    });
    const tokens = await this.signTokens(user, session.id);
    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: session.id },
        data: { refreshHash: await argon2.hash(tokens.refreshToken) },
      }),
      this.prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }),
    ]);

    await this.audit.record({
      userId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      actionType: 'AUTH_LOGIN',
      entityAffected: 'Session',
      entityId: session.id,
    });

    return tokens;
  }

  async refresh(refreshToken: string, context: ClientContext): Promise<TokenPair> {
    const payload = await this.verifyRefresh(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh session');
    }
    const matches = await argon2.verify(session.refreshHash, refreshToken);
    if (!matches) throw new UnauthorizedException('Refresh token has been rotated');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    const tokens = await this.signTokens(user, session.id);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshHash: await argon2.hash(tokens.refreshToken),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    return tokens;
  }

  async logout(sessionId: string): Promise<{ revoked: true }> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  async logoutGlobal(userId: string): Promise<{ revoked: number }> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  async forgotPassword(email: string): Promise<{ accepted: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return { accepted: true };
    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: await argon2.hash(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });
    return { accepted: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ reset: true }> {
    const candidates = await this.prisma.passwordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const tokenRecord = await this.findMatchingToken(candidates, dto.token);
    if (!tokenRecord) throw new BadRequestException('Invalid reset token');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { password: await argon2.hash(dto.password) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { reset: true };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ verified: true }> {
    const candidates = await this.prisma.emailVerificationToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const tokenRecord = await this.findMatchingToken(candidates, dto.token);
    if (!tokenRecord) throw new BadRequestException('Invalid verification token');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { isVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { verified: true };
  }

  async issueEmailVerification(userId: string): Promise<void> {
    const token = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: await argon2.hash(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ changed: true }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await argon2.verify(user.password, dto.currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is invalid');
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await argon2.hash(dto.nextPassword), version: { increment: 1 } },
    });
    return { changed: true };
  }

  validateSession(userId: string, sessionId?: string) {
    return this.prisma.session.findFirst({
      where: { userId, id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, expiresAt: true, createdAt: true },
    });
  }

  private async signTokens(user: User, sessionId: string): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      supplierId: user.supplierId,
      sessionId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<StringValue>('JWT_ACCESS_TTL', '15m' as StringValue),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<StringValue>('JWT_REFRESH_TTL', '30d' as StringValue),
    });
    return { accessToken, refreshToken };
  }

  private async verifyRefresh(refreshToken: string): Promise<{ sub: string; sessionId: string }> {
    try {
      return await this.jwt.verifyAsync<{ sub: string; sessionId: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  }

  private async findMatchingToken<T extends { tokenHash: string }>(
    records: T[],
    token: string,
  ): Promise<T | undefined> {
    for (const record of records) {
      if (await argon2.verify(record.tokenHash, token)) return record;
    }
    return undefined;
  }
}
