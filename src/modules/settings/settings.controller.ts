import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller({ path: 'settings', version: '1' })
@UseGuards(JwtAuthGuard)
export class SettingsController {
  @Get()
  getSettings() {
    return {
      features: {
        mfa: 'optional',
        refreshRotation: true,
        audit: true,
        realtime: true,
      },
    };
  }
}
