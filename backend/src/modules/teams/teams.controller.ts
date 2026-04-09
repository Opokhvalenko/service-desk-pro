import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CreateTeamDto, UpdateTeamDto } from './dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'List all teams (admin)' })
  list() {
    return this.teams.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create team (admin)' })
  create(@Body() dto: CreateTeamDto) {
    return this.teams.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update team (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teams.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate team (admin)' })
  remove(@Param('id') id: string) {
    return this.teams.remove(id);
  }
}
