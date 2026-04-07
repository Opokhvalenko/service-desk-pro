import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../auth';
import {
  AssignTicketDto,
  ChangeStatusDto,
  CreateCommentDto,
  CreateTicketDto,
  ListTicketsQueryDto,
  UpdateTicketDto,
} from './dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Create new ticket' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets (RBAC scoped)' })
  list(@Query() query: ListTicketsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket details with comments' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ticket fields' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.update(id, dto, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change ticket status (state machine)' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.changeStatus(id, dto, user);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign or unassign ticket' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.assign(id, dto, user);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add comment (or internal note)' })
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.addComment(id, dto, user);
  }
}
