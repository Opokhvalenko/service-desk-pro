import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { NotificationType, Prisma } from '@prisma/client';
import {
  type NewNotificationPayload,
  NOTIFICATION_EVENTS,
} from '../../common/events/notification.events';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth';
import type { ListNotificationsDto } from './dto/list-notifications.dto';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  ticketId?: string | null;
  message: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(input: CreateNotificationInput): Promise<void> {
    const created = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        ticketId: input.ticketId ?? null,
        message: input.message,
      },
    });
    const payload: NewNotificationPayload = {
      id: created.id,
      userId: created.userId,
      type: created.type,
      ticketId: created.ticketId,
      message: created.message,
      createdAt: created.createdAt,
    };
    this.events.emit(NOTIFICATION_EVENTS.NEW, payload);
  }

  async list(user: AuthenticatedUser, limit = 20) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listPaged(user: AuthenticatedUser, query: ListNotificationsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.NotificationWhereInput = { userId: user.id };
    if (query.type) where.type = query.type as NotificationType;
    if (query.isRead !== undefined) where.isRead = query.isRead;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  unreadCount(user: AuthenticatedUser): Promise<number> {
    return this.prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });
  }

  async markRead(user: AuthenticatedUser, id: string): Promise<void> {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== user.id) throw new NotFoundException('Notification not found');
    await this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(user: AuthenticatedUser): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
  }
}
