import { Injectable } from '@nestjs/common';
import { type Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { ReportQueryDto } from './dto/report-query.dto';

export interface ReportSummary {
  range: { from: string; to: string };
  totals: {
    created: number;
    resolved: number;
    breached: number;
    open: number;
  };
  byStatus: Array<{ status: TicketStatus; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byCategory: Array<{ categoryId: string | null; name: string; count: number }>;
  byTeam: Array<{ teamId: string | null; name: string; count: number }>;
  workload: Array<{ assigneeId: string; fullName: string; open: number; resolved: number }>;
  slaCompliancePct: number | null;
  throughput: Array<{ date: string; created: number; resolved: number }>;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: ReportQueryDto): Promise<ReportSummary> {
    const { from, to } = this.resolveRange(query);
    const teamFilter: Prisma.TicketWhereInput = query.teamId ? { teamId: query.teamId } : {};
    const inRange: Prisma.TicketWhereInput = {
      ...teamFilter,
      createdAt: { gte: from, lte: to },
    };

    const [
      created,
      resolved,
      breached,
      open,
      byStatusRaw,
      byPriorityRaw,
      byCategoryRaw,
      byTeamRaw,
      workloadRaw,
      slaTotal,
      slaBreached,
      throughputRaw,
    ] = await Promise.all([
      this.prisma.ticket.count({ where: inRange }),
      this.prisma.ticket.count({
        where: { ...teamFilter, resolvedAt: { gte: from, lte: to } },
      }),
      this.prisma.ticket.count({
        where: { ...teamFilter, breachedAt: { gte: from, lte: to } },
      }),
      this.prisma.ticket.count({
        where: {
          ...teamFilter,
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        },
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: inRange,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where: inRange,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['categoryId'],
        where: inRange,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['teamId'],
        where: inRange,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['assigneeId'],
        where: { ...teamFilter, assigneeId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.ticket.count({ where: inRange }),
      this.prisma.ticket.count({ where: { ...inRange, breachedAt: { not: null } } }),
      this.prisma.ticket.findMany({
        where: {
          OR: [{ createdAt: { gte: from, lte: to } }, { resolvedAt: { gte: from, lte: to } }],
          ...teamFilter,
        },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    const categories = await this.prisma.category.findMany({ select: { id: true, name: true } });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const byCategory = byCategoryRaw.map((r) => ({
      categoryId: r.categoryId,
      name: r.categoryId ? (catMap.get(r.categoryId) ?? 'Unknown') : 'Uncategorized',
      count: r._count._all,
    }));

    const teams = await this.prisma.team.findMany({ select: { id: true, name: true } });
    const teamMap = new Map(teams.map((t) => [t.id, t.name]));
    const byTeam = byTeamRaw.map((r) => ({
      teamId: r.teamId,
      name: r.teamId ? (teamMap.get(r.teamId) ?? 'Unknown') : 'Unassigned',
      count: r._count._all,
    }));

    const assigneeIds = workloadRaw.map((r) => r.assigneeId).filter((id): id is string => !!id);
    const assignees = await this.prisma.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, fullName: true },
    });
    const assigneeMap = new Map(assignees.map((u) => [u.id, u.fullName]));
    const workloadOpen = await this.prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: {
        ...teamFilter,
        assigneeId: { in: assigneeIds },
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      },
      _count: { _all: true },
    });
    const workloadResolved = await this.prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: {
        ...teamFilter,
        assigneeId: { in: assigneeIds },
        status: TicketStatus.RESOLVED,
      },
      _count: { _all: true },
    });
    const openMap = new Map(workloadOpen.map((r) => [r.assigneeId ?? '', r._count._all]));
    const resolvedMap = new Map(workloadResolved.map((r) => [r.assigneeId ?? '', r._count._all]));
    const workload = assigneeIds
      .map((id) => ({
        assigneeId: id,
        fullName: assigneeMap.get(id) ?? 'Unknown',
        open: openMap.get(id) ?? 0,
        resolved: resolvedMap.get(id) ?? 0,
      }))
      .sort((a, b) => b.open + b.resolved - (a.open + a.resolved));

    const slaCompliancePct =
      slaTotal === 0 ? null : Math.round(((slaTotal - slaBreached) / slaTotal) * 1000) / 10;

    const throughputMap = new Map<string, { created: number; resolved: number }>();
    const cursor = new Date(from);
    while (cursor <= to) {
      throughputMap.set(cursor.toISOString().slice(0, 10), { created: 0, resolved: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const t of throughputRaw) {
      const cKey = t.createdAt.toISOString().slice(0, 10);
      const cBucket = throughputMap.get(cKey);
      if (cBucket) cBucket.created += 1;
      if (t.resolvedAt) {
        const rKey = t.resolvedAt.toISOString().slice(0, 10);
        const rBucket = throughputMap.get(rKey);
        if (rBucket) rBucket.resolved += 1;
      }
    }
    const throughput = Array.from(throughputMap.entries()).map(([date, v]) => ({
      date,
      created: v.created,
      resolved: v.resolved,
    }));

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: { created, resolved, breached, open },
      byStatus: byStatusRaw.map((r) => ({ status: r.status, count: r._count._all })),
      byPriority: byPriorityRaw.map((r) => ({ priority: r.priority, count: r._count._all })),
      byCategory,
      byTeam,
      workload,
      slaCompliancePct,
      throughput,
    };
  }

  async exportTicketsCsv(query: ReportQueryDto): Promise<string> {
    const { from, to } = this.resolveRange(query);
    const teamFilter: Prisma.TicketWhereInput = query.teamId ? { teamId: query.teamId } : {};
    const tickets = await this.prisma.ticket.findMany({
      where: { ...teamFilter, createdAt: { gte: from, lte: to } },
      include: {
        assignee: { select: { fullName: true, email: true } },
        createdBy: { select: { fullName: true, email: true } },
        category: { select: { name: true } },
        team: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = [
      'number',
      'title',
      'status',
      'priority',
      'category',
      'team',
      'createdBy',
      'assignee',
      'createdAt',
      'resolvedAt',
      'breached',
    ];
    const rows = tickets.map((t) => [
      `TKT-${t.number}`,
      t.title,
      t.status,
      t.priority,
      t.category?.name ?? '',
      t.team?.name ?? '',
      t.createdBy?.fullName ?? '',
      t.assignee?.fullName ?? '',
      t.createdAt.toISOString(),
      t.resolvedAt?.toISOString() ?? '',
      t.breachedAt ? 'yes' : 'no',
    ]);
    return toCsv([header, ...rows]);
  }

  private resolveRange(query: ReportQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }
}

function toCsv(rows: Array<Array<string | number>>): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell);
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(','),
    )
    .join('\n');
}
