import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../auth';
import { StatsService } from './stats.service';

@ApiTags('stats')
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Aggregated stats for dashboard (RBAC scoped)' })
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.stats.dashboard(user);
  }
}
