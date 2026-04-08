import { Injectable } from '@nestjs/common';
import { type Prisma, TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth';

export interface DashboardStats {
  totals: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    breached: number;
    unassigned: number;
  };
  byStatus: Array<{ status: TicketStatus; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  myAssigned: number | null;
  avgResolutionHours: number | null;
}

const ACTIVE_STATUSES: TicketStatus[] = [
  TicketStatus.NEW,
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_FOR_CUSTOMER,
  TicketStatus.ESCALATED,
  TicketStatus.REOPENED,
];

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: AuthenticatedUser): Promise<DashboardStats> {
    const scope = this.scopeForUser(user);

    const [total, open, inProgress, resolved, breached, unassigned, byStatusRaw, byPriorityRaw] =
      await Promise.all([
        this.prisma.ticket.count({ where: scope }),
        this.prisma.ticket.count({ where: { ...scope, status: { in: ACTIVE_STATUSES } } }),
        this.prisma.ticket.count({ where: { ...scope, status: TicketStatus.IN_PROGRESS } }),
        this.prisma.ticket.count({ where: { ...scope, status: TicketStatus.RESOLVED } }),
        this.prisma.ticket.count({ where: { ...scope, breachedAt: { not: null } } }),
        this.prisma.ticket.count({ where: { ...scope, assigneeId: null } }),
        this.prisma.ticket.groupBy({
          by: ['status'],
          where: scope,
          _count: { _all: true },
        }),
        this.prisma.ticket.groupBy({
          by: ['priority'],
          where: scope,
          _count: { _all: true },
        }),
      ]);

    const myAssigned =
      user.role === UserRole.AGENT
        ? await this.prisma.ticket.count({
            where: { assigneeId: user.id, status: { in: ACTIVE_STATUSES } },
          })
        : null;

    const avgResolutionHours = await this.computeAvgResolutionHours(scope);

    return {
      totals: { total, open, inProgress, resolved, breached, unassigned },
      byStatus: byStatusRaw.map((r) => ({ status: r.status, count: r._count._all })),
      byPriority: byPriorityRaw.map((r) => ({ priority: r.priority, count: r._count._all })),
      myAssigned,
      avgResolutionHours,
    };
  }

  private async computeAvgResolutionHours(where: Prisma.TicketWhereInput): Promise<number | null> {
    const resolved = await this.prisma.ticket.findMany({
      where: { ...where, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 200,
      orderBy: { resolvedAt: 'desc' },
    });
    if (resolved.length === 0) return null;
    const totalMs = resolved.reduce((sum, t) => {
      if (!t.resolvedAt) return sum;
      return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
    }, 0);
    return Math.round((totalMs / resolved.length / (60 * 60 * 1000)) * 10) / 10;
  }

  private scopeForUser(user: AuthenticatedUser): Prisma.TicketWhereInput {
    switch (user.role) {
      case UserRole.REQUESTER:
        return { createdById: user.id };
      case UserRole.AGENT:
        return { OR: [{ assigneeId: user.id }, { assigneeId: null }] };
      default:
        return {};
    }
  }
}
