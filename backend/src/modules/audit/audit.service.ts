import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ListAuditDto } from './dto/list-audit.dto';

const ACTOR_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
} as const;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.AuditLogWhereInput = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = query.action;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: ACTOR_SELECT } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async listForTicket(ticketId: string, user: AuthenticatedUser) {
    // Enforce ticket-level access: requesters can only see audit history of
    // tickets they created; agents only see assigned-to-them or unassigned;
    // leads + admins see everything. Without this guard any authenticated user
    // could enumerate audit history of arbitrary tickets.
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { createdById: true, assigneeId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const role = user.role;
    const allowed =
      role === 'ADMIN' ||
      role === 'TEAM_LEAD' ||
      (role === 'REQUESTER' && ticket.createdById === user.id) ||
      (role === 'AGENT' && (ticket.assigneeId === user.id || ticket.assigneeId === null));
    if (!allowed) {
      throw new ForbiddenException('Not allowed to view audit history for this ticket');
    }

    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'Ticket', entityId: ticketId },
          { entityType: 'TicketComment', metadata: { path: ['ticketId'], equals: ticketId } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: ACTOR_SELECT } },
    });
  }
}
