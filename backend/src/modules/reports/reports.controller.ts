import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @Roles('ADMIN', 'TEAM_LEAD')
  @ApiOperation({ summary: 'Aggregated reports summary' })
  summary(@Query() query: ReportQueryDto) {
    return this.reports.summary(query);
  }

  @Get('export.csv')
  @Roles('ADMIN', 'TEAM_LEAD')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export tickets as CSV' })
  async exportCsv(@Query() query: ReportQueryDto, @Res() res: Response): Promise<void> {
    const csv = await this.reports.exportTicketsCsv(query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="tickets-${stamp}.csv"`);
    res.send(csv);
  }
}
