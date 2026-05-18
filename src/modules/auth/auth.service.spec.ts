import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('AuthService', () => {
  it('is defined with enterprise dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_ACCESS_SECRET: 'access-secret-for-tests',
              JWT_REFRESH_SECRET: 'refresh-secret-for-tests',
              JWT_ACCESS_TTL: '15m',
              JWT_REFRESH_TTL: '30d',
            }),
          ],
        }),
        JwtModule.register({}),
      ],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: {} },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    expect(moduleRef.get(AuthService)).toBeDefined();
  });
});
