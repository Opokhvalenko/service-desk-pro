import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { UpsertSlaPolicyDto } from './dto/upsert-sla-policy.dto';
import { SlaPoliciesService } from './sla-policies.service';

@ApiTags('sla-policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('sla-policies')
export class SlaPoliciesController {
  constructor(private readonly policies: SlaPoliciesService) {}

  @Get()
  @ApiOperation({ summary: 'List all SLA policies (admin)' })
  list() {
    return this.policies.list();
  }

  @Put()
  @ApiOperation({ summary: 'Upsert SLA policy for a priority (admin)' })
  upsert(@Body() dto: UpsertSlaPolicyDto) {
    return this.policies.upsert(dto);
  }
}
