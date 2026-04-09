import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
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
  @ApiOperation({ summary: 'List audit entries for a ticket' })
  listForTicket(@Param('id') id: string) {
    return this.audit.listForTicket(id);
  }
}
