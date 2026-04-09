import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
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

  listForTicket(ticketId: string) {
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
