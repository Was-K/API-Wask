import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [JwtAuthGuard, RolesGuard, PermissionsGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, PermissionsGuard],
})
export class SecurityModule {}
