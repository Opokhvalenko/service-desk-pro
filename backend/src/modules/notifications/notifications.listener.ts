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
    try {
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
    } catch (err) {
      this.logFailure('TICKET_ASSIGNED', payload.ticketId, err);
    }
  }

  @OnEvent(TICKET_EVENTS.STATUS_CHANGED)
  async onStatusChanged(payload: TicketStatusChangedPayload): Promise<void> {
    try {
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
    } catch (err) {
      this.logFailure('TICKET_STATUS_CHANGED', payload.ticketId, err);
    }
  }

  @OnEvent(TICKET_EVENTS.COMMENT_ADDED)
  async onCommentAdded(payload: TicketCommentAddedPayload): Promise<void> {
    try {
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
    } catch (err) {
      this.logFailure('TICKET_COMMENT_ADDED', payload.ticketId, err);
    }
  }

  @OnEvent(TICKET_EVENTS.SLA_BREACHED)
  async onSlaBreached(payload: TicketSlaBreachedPayload): Promise<void> {
    try {
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
        // Mail per recipient is best-effort — one bad address shouldn't kill
        // notifications for the rest of the staff list.
        try {
          await this.mail.send({
            to: user.email,
            subject: `[ServiceDesk] SLA breach: ${code}`,
            text: `Hi ${user.fullName},\n\n${message}\n`,
          });
        } catch (mailErr) {
          this.logger.warn(
            `Mail send failed for ${user.email} on SLA breach ${code}: ${(mailErr as Error).message}`,
          );
        }
      }
      this.logger.warn(`SLA breach notifications sent: ${code}`);
    } catch (err) {
      this.logFailure('TICKET_SLA_BREACHED', payload.ticketId, err);
    }
  }

  /**
   * Centralised failure logger for OnEvent handlers. We never rethrow from
   * a listener — the write that fired the event has already committed, and
   * the rest of the listeners should still run. Instead we log full context
   * (event name, ticket id, stack) so the failure is observable in Sentry/pino.
   */
  private logFailure(event: string, ticketId: string, err: unknown): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(
      `Notification listener for ${event} failed on ticket ${ticketId}: ${error.message}`,
      error.stack,
    );
  }
}
