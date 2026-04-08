import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TICKET_EVENTS,
  type TicketAssignedPayload,
  type TicketCommentAddedPayload,
  type TicketSlaBreachedPayload,
  type TicketStatusChangedPayload,
} from '../../common/events/ticket.events';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { formatTicketNumber } from '../tickets/state-machine';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  @OnEvent(TICKET_EVENTS.ASSIGNED)
  async onAssigned(payload: TicketAssignedPayload): Promise<void> {
    if (!payload.assigneeId) return;
    const [ticket, assignee] = await Promise.all([
      this.prisma.ticket.findUnique({
        where: { id: payload.ticketId },
        select: { number: true, title: true },
      }),
      this.prisma.user.findUnique({
        where: { id: payload.assigneeId },
        select: { email: true, fullName: true },
      }),
    ]);
    if (!ticket || !assignee) return;

    const code = formatTicketNumber(ticket.number);
    const message = `You were assigned ${code}: ${ticket.title}`;

    await this.notifications.create({
      userId: payload.assigneeId,
      type: 'TICKET_ASSIGNED',
      ticketId: payload.ticketId,
      message,
    });
    await this.mail.send({
      to: assignee.email,
      subject: `[ServiceDesk] Assigned: ${code}`,
      text: `Hi ${assignee.fullName},\n\n${message}\n`,
    });
  }

  @OnEvent(TICKET_EVENTS.STATUS_CHANGED)
  async onStatusChanged(payload: TicketStatusChangedPayload): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: payload.ticketId },
      select: { number: true, title: true, createdById: true, assigneeId: true },
    });
    if (!ticket) return;

    const code = formatTicketNumber(ticket.number);
    const message = `${code} status: ${payload.from} → ${payload.to}`;

    const recipients = new Set<string>();
    if (ticket.createdById && ticket.createdById !== payload.actorId) {
      recipients.add(ticket.createdById);
    }
    if (ticket.assigneeId && ticket.assigneeId !== payload.actorId) {
      recipients.add(ticket.assigneeId);
    }

    for (const userId of recipients) {
      await this.notifications.create({
        userId,
        type: 'TICKET_STATUS_CHANGED',
        ticketId: payload.ticketId,
        message,
      });
    }
  }

  @OnEvent(TICKET_EVENTS.COMMENT_ADDED)
  async onCommentAdded(payload: TicketCommentAddedPayload): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: payload.ticketId },
      select: { number: true, title: true, createdById: true, assigneeId: true },
    });
    if (!ticket) return;

    const code = formatTicketNumber(ticket.number);
    const message = `New comment on ${code}: ${ticket.title}`;

    const recipients = new Set<string>();
    if (ticket.createdById && ticket.createdById !== payload.authorId) {
      recipients.add(ticket.createdById);
    }
    if (ticket.assigneeId && ticket.assigneeId !== payload.authorId) {
      recipients.add(ticket.assigneeId);
    }
    // Internal notes — never notify the requester
    if (payload.isInternal) {
      recipients.delete(ticket.createdById);
    }

    for (const userId of recipients) {
      await this.notifications.create({
        userId,
        type: 'TICKET_COMMENT_ADDED',
        ticketId: payload.ticketId,
        message,
      });
    }
  }

  @OnEvent(TICKET_EVENTS.SLA_BREACHED)
  async onSlaBreached(payload: TicketSlaBreachedPayload): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: payload.ticketId },
      select: { title: true, assigneeId: true },
    });
    if (!ticket) return;

    const code = formatTicketNumber(payload.number);
    const message = `SLA breached on ${code} (${payload.breachType}): ${ticket.title}`;

    // Notify assignee + all leads/admins
    const recipients = await this.prisma.user.findMany({
      where: {
        OR: [{ id: ticket.assigneeId ?? undefined }, { role: { in: ['TEAM_LEAD', 'ADMIN'] } }],
        isActive: true,
      },
      select: { id: true, email: true, fullName: true },
    });

    for (const user of recipients) {
      await this.notifications.create({
        userId: user.id,
        type: 'TICKET_SLA_BREACHED',
        ticketId: payload.ticketId,
        message,
      });
      await this.mail.send({
        to: user.email,
        subject: `[ServiceDesk] SLA breach: ${code}`,
        text: `Hi ${user.fullName},\n\n${message}\n`,
      });
    }
    this.logger.warn(`SLA breach notifications sent: ${code}`);
  }
}
