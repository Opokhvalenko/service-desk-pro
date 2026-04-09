import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AuditService } from './audit.service';
import { ListAuditDto } from './dto/list-audit.dto';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List audit log entries (admin)' })
  list(@Query() query: ListAuditDto) {
    return this.audit.list(query);
  }

  @Get('ticket/:id')
  @Roles('ADMIN', 'TEAM_LEAD', 'AGENT', 'REQUESTER')
  @ApiOperation({ summary: 'List audit entries for a ticket (scoped by access)' })
  listForTicket(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.audit.listForTicket(id, user);
  }
}
