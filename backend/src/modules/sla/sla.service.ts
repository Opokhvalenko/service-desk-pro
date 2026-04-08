import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type Prisma, type Ticket, TicketStatus } from '@prisma/client';
import { TICKET_EVENTS, type TicketSlaBreachedPayload } from '../../common/events/ticket.events';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { addHours, isOverdue, shiftDeadline } from './sla.calculator';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Initialize SLA deadlines for a freshly created ticket. */
  async initializeForTicket(ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const policy = await this.prisma.slaPolicy.findUnique({ where: { priority: ticket.priority } });
    if (!policy) {
      this.logger.warn(`No SLA policy for priority ${ticket.priority} — skipping`);
      return;
    }

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        firstResponseDueAt: addHours(ticket.createdAt, policy.firstResponseHours),
        resolveDueAt: addHours(ticket.createdAt, policy.resolveHours),
      },
    });
  }

  /**
   * Handle status change side-effects:
   * - WAITING_FOR_CUSTOMER → start pause
   * - any other → resume (shift deadlines by paused ms)
   * - first agent comment / IN_PROGRESS → mark firstResponseAt
   */
  async onStatusChange(ticketId: string, from: TicketStatus, to: TicketStatus): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return;

    const data: Prisma.TicketUpdateInput = {};
    const now = new Date();

    // Mark first response when moving NEW/OPEN → IN_PROGRESS
    if (
      !ticket.firstResponseAt &&
      to === TicketStatus.IN_PROGRESS &&
      (from === TicketStatus.NEW || from === TicketStatus.OPEN)
    ) {
      data.firstResponseAt = now;
    }

    // Pause
    if (to === TicketStatus.WAITING_FOR_CUSTOMER && !ticket.pausedAt) {
      data.pausedAt = now;
    }

    // Resume
    if (from === TicketStatus.WAITING_FOR_CUSTOMER && ticket.pausedAt) {
      const pausedMs = now.getTime() - ticket.pausedAt.getTime();
      const total = ticket.pausedTotalMs + pausedMs;
      data.pausedAt = null;
      data.pausedTotalMs = total;
      if (ticket.firstResponseDueAt) {
        data.firstResponseDueAt = shiftDeadline(ticket.firstResponseDueAt, pausedMs);
      }
      if (ticket.resolveDueAt) {
        data.resolveDueAt = shiftDeadline(ticket.resolveDueAt, pausedMs);
      }
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.ticket.update({ where: { id: ticketId }, data });
    }
  }

  /**
   * Scheduled SLA check — emits sla_breached event for newly breached tickets.
   * Called by BullMQ job.
   */
  async checkBreaches(): Promise<number> {
    const now = new Date();

    const candidates = await this.prisma.ticket.findMany({
      where: {
        breachedAt: null,
        pausedAt: null,
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        OR: [
          { firstResponseDueAt: { lt: now }, firstResponseAt: null },
          { resolveDueAt: { lt: now } },
        ],
      },
      select: {
        id: true,
        number: true,
        firstResponseDueAt: true,
        firstResponseAt: true,
        resolveDueAt: true,
      },
    });

    let breachedCount = 0;
    for (const t of candidates) {
      const breachType: 'response' | 'resolve' =
        !t.firstResponseAt && isOverdue(t.firstResponseDueAt, now) ? 'response' : 'resolve';
      const dueAt = breachType === 'response' ? t.firstResponseDueAt : t.resolveDueAt;
      if (!dueAt) continue;

      await this.prisma.ticket.update({ where: { id: t.id }, data: { breachedAt: now } });
      const payload: TicketSlaBreachedPayload = {
        ticketId: t.id,
        number: t.number,
        breachType,
        dueAt,
      };
      this.events.emit(TICKET_EVENTS.SLA_BREACHED, payload);
      breachedCount++;
    }

    if (breachedCount > 0) {
      this.logger.warn(`SLA check: ${breachedCount} breaches detected`);
    }
    return breachedCount;
  }

  /** Public helper used by serializer to compute live SLA state. */
  computeSlaState(
    ticket: Pick<
      Ticket,
      'firstResponseDueAt' | 'resolveDueAt' | 'firstResponseAt' | 'breachedAt' | 'status'
    >,
  ) {
    const now = new Date();
    const responseBreached = !ticket.firstResponseAt && isOverdue(ticket.firstResponseDueAt, now);
    const resolveBreached = isOverdue(ticket.resolveDueAt, now);
    return {
      breached: !!ticket.breachedAt || responseBreached || resolveBreached,
      responseBreached,
      resolveBreached,
    };
  }
}
