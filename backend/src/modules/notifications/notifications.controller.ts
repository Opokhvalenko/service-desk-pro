import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../auth';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List recent notifications for current user' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user, 20);
  }

  @Get('paged')
  @ApiOperation({ summary: 'List notifications with pagination and filters' })
  listPaged(@CurrentUser() user: AuthenticatedUser, @Query() query: ListNotificationsDto) {
    return this.notifications.listPaged(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications' })
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.notifications.unreadCount(user);
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(user, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user);
  }
}
