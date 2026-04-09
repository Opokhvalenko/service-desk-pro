import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type Prisma, TicketStatus, UserRole } from '@prisma/client';
import {
  TICKET_EVENTS,
  type TicketAssignedPayload,
  type TicketCommentAddedPayload,
  type TicketCreatedPayload,
  type TicketStatusChangedPayload,
} from '../../common/events/ticket.events';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth';
import { SlaService } from '../sla/sla.service';
import type {
  AssignTicketDto,
  ChangeStatusDto,
  CreateCommentDto,
  CreateTicketDto,
  ListTicketsQueryDto,
  UpdateTicketDto,
} from './dto';
import { canTransition, formatTicketNumber } from './state-machine';

const TICKET_INCLUDE = {
  createdBy: { select: { id: true, fullName: true, email: true, role: true } },
  assignee: { select: { id: true, fullName: true, email: true, role: true } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly sla: SlaService,
  ) {}

  /**
   * Wraps `EventEmitter2.emit` so a crashing listener never breaks the
   * write-path that fired the event. The ticket has already been persisted at
   * this point — we just want to broadcast best-effort and log if the
   * downstream notification/audit/realtime listener throws.
   */
  private safeEmit(event: string, payload: unknown): void {
    try {
      this.events.emit(event, payload);
    } catch (err) {
      this.logger.error(
        `Listener for ${event} threw: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  async create(dto: CreateTicketDto, user: AuthenticatedUser) {
    const ticket = await this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
        createdById: user.id,
      },
      include: TICKET_INCLUDE,
    });

    await this.sla.initializeForTicket(ticket.id);
    await this.audit(user.id, 'Ticket', ticket.id, 'created', { title: ticket.title });
    const created: TicketCreatedPayload = {
      ticketId: ticket.id,
      number: ticket.number,
      createdById: user.id,
    };
    this.safeEmit(TICKET_EVENTS.CREATED, created);

    const fresh = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: TICKET_INCLUDE,
    });
    return this.serialize(fresh);
  }

  async list(query: ListTicketsQueryDto, user: AuthenticatedUser) {
    const where: Prisma.TicketWhereInput = this.scopeForUser(user);

    if (query.status) {
      where.status = query.status;
    } else if (query.statusIn) {
      const values = query.statusIn
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is TicketStatus => (Object.values(TicketStatus) as string[]).includes(s));
      if (values.length > 0) where.status = { in: values };
    }
    if (query.breached) where.breachedAt = { not: null };
    if (query.priority) where.priority = query.priority;
    if (query.unassigned) where.assigneeId = null;
    else if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      items: items.map((t) => this.maskRequesterPii(this.serialize(t), user)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...TICKET_INCLUDE,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, fullName: true, role: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertCanView(ticket, user);

    // Hide internal comments from requesters
    const comments =
      user.role === UserRole.REQUESTER
        ? ticket.comments.filter((c) => !c.isInternal)
        : ticket.comments;

    return { ...this.serialize(ticket), comments };
  }

  async update(id: string, dto: UpdateTicketDto, user: AuthenticatedUser) {
    const existing = await this.getOrThrow(id);
    this.assertCanModify(existing, user);

    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
      },
      include: TICKET_INCLUDE,
    });

    await this.audit(user.id, 'Ticket', id, 'updated', { ...dto });
    return this.serialize(ticket);
  }

  async changeStatus(id: string, dto: ChangeStatusDto, user: AuthenticatedUser) {
    const existing = await this.getOrThrow(id);
    this.assertCanWorkOn(existing, user);

    if (existing.status === dto.status) return this.serialize(existing);
    if (!canTransition(existing.status, dto.status)) {
      throw new BadRequestException(`Cannot transition from ${existing.status} to ${dto.status}`);
    }

    const data: Prisma.TicketUpdateInput = { status: dto.status };
    if (dto.status === TicketStatus.RESOLVED) data.resolvedAt = new Date();
    if (dto.status === TicketStatus.CLOSED) data.closedAt = new Date();
    if (dto.status === TicketStatus.REOPENED) {
      data.resolvedAt = null;
      data.closedAt = null;
    }

    // Optimistic concurrency: only succeed if the ticket is STILL in the
    // status we read a moment ago. If a concurrent request already moved it
    // (e.g. two agents both clicking "Resolve"), `updateMany` returns count=0
    // and we surface a 409 instead of silently overwriting the other write.
    const result = await this.prisma.ticket.updateMany({
      where: { id, status: existing.status },
      data,
    });
    if (result.count === 0) {
      throw new ConflictException('Ticket was modified by another request. Reload and try again.');
    }
    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id },
      include: TICKET_INCLUDE,
    });

    await this.sla.onStatusChange(id, existing.status, dto.status);
    await this.audit(user.id, 'Ticket', id, 'status_changed', {
      from: existing.status,
      to: dto.status,
    });
    const payload: TicketStatusChangedPayload = {
      ticketId: id,
      from: existing.status,
      to: dto.status,
      actorId: user.id,
    };
    this.safeEmit(TICKET_EVENTS.STATUS_CHANGED, payload);
    return this.serialize(ticket);
  }

  async assignableUsers() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [UserRole.AGENT, UserRole.TEAM_LEAD, UserRole.ADMIN] },
      },
      select: { id: true, fullName: true, email: true, role: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async assign(id: string, dto: AssignTicketDto, user: AuthenticatedUser) {
    if (user.role === UserRole.REQUESTER) {
      throw new ForbiddenException('Requesters cannot assign tickets');
    }
    const existing = await this.getOrThrow(id);

    if (dto.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
        select: { id: true, role: true, isActive: true },
      });
      if (!assignee || !assignee.isActive) {
        throw new BadRequestException('Assignee not found or inactive');
      }
      if (assignee.role === UserRole.REQUESTER) {
        throw new BadRequestException('Cannot assign to a requester');
      }
    }

    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { assigneeId: dto.assigneeId ?? null },
      include: TICKET_INCLUDE,
    });

    await this.audit(user.id, 'Ticket', id, 'assigned', {
      from: existing.assigneeId,
      to: dto.assigneeId ?? null,
    });
    const payload: TicketAssignedPayload = {
      ticketId: id,
      assigneeId: dto.assigneeId ?? null,
      actorId: user.id,
    };
    this.safeEmit(TICKET_EVENTS.ASSIGNED, payload);
    return this.serialize(ticket);
  }

  async addComment(id: string, dto: CreateCommentDto, user: AuthenticatedUser) {
    const ticket = await this.getOrThrow(id);
    this.assertCanView(ticket, user);

    const isInternal = dto.isInternal ?? false;
    if (isInternal && user.role === UserRole.REQUESTER) {
      throw new ForbiddenException('Requesters cannot post internal notes');
    }

    const comment = await this.prisma.ticketComment.create({
      data: {
        ticketId: id,
        authorId: user.id,
        body: dto.body,
        isInternal,
      },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });

    await this.audit(user.id, 'TicketComment', comment.id, 'created', { ticketId: id });
    const payload: TicketCommentAddedPayload = {
      ticketId: id,
      commentId: comment.id,
      authorId: user.id,
      isInternal,
    };
    this.safeEmit(TICKET_EVENTS.COMMENT_ADDED, payload);
    return comment;
  }

  // ── Helpers ──

  private async getOrThrow(id: string) {
    const t = await this.prisma.ticket.findUnique({ where: { id }, include: TICKET_INCLUDE });
    if (!t) throw new NotFoundException('Ticket not found');
    return t;
  }

  private scopeForUser(user: AuthenticatedUser): Prisma.TicketWhereInput {
    switch (user.role) {
      case UserRole.REQUESTER:
        return { createdById: user.id };
      case UserRole.AGENT:
        return { OR: [{ assigneeId: user.id }, { assigneeId: null }] };
      case UserRole.TEAM_LEAD:
      case UserRole.ADMIN:
        return {};
      default:
        return { id: '__never__' };
    }
  }

  private assertCanView(
    ticket: { createdById: string; assigneeId: string | null },
    user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.TEAM_LEAD) return;
    if (user.role === UserRole.REQUESTER && ticket.createdById === user.id) return;
    if (
      user.role === UserRole.AGENT &&
      (ticket.assigneeId === user.id || ticket.assigneeId === null)
    )
      return;
    throw new ForbiddenException('Not allowed to access this ticket');
  }

  private assertCanModify(
    ticket: { createdById: string; status: TicketStatus },
    user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.TEAM_LEAD) return;
    if (
      user.role === UserRole.REQUESTER &&
      ticket.createdById === user.id &&
      ticket.status === TicketStatus.NEW
    ) {
      return;
    }
    if (user.role === UserRole.AGENT) return;
    throw new ForbiddenException('Not allowed to modify this ticket');
  }

  private assertCanWorkOn(
    ticket: { assigneeId: string | null; createdById: string },
    user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.TEAM_LEAD) return;
    if (user.role === UserRole.AGENT) return;
    // Requester може REOPEN власний CLOSED/RESOLVED
    if (user.role === UserRole.REQUESTER && ticket.createdById === user.id) return;
    throw new ForbiddenException('Not allowed to change status');
  }

  private async audit(
    actorId: string | null,
    entityType: string,
    entityId: string,
    action: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    await this.prisma.auditLog.create({
      data: { actorId, entityType, entityId, action, metadata },
    });
  }

  private serialize<T extends { number: number }>(ticket: T) {
    return { ...ticket, code: formatTicketNumber(ticket.number) };
  }

  /**
   * Strip the requester's email from list responses for agents who are not
   * (yet) the assignee — limits PII exposure on the queue / browse views.
   * Once the agent claims the ticket, the detail endpoint returns the full
   * email so they can correspond with the requester.
   *
   * Admin / team-lead always see full info; requester only ever sees their
   * own tickets so masking is a no-op for them.
   */
  private maskRequesterPii<
    T extends {
      assigneeId: string | null;
      createdBy: { id: string; fullName: string; email: string; role: string } | null;
    },
  >(ticket: T, user: AuthenticatedUser): T {
    if (user.role !== UserRole.AGENT) return ticket;
    if (ticket.assigneeId === user.id) return ticket;
    if (!ticket.createdBy) return ticket;
    return {
      ...ticket,
      createdBy: { ...ticket.createdBy, email: '' },
    };
  }
}
