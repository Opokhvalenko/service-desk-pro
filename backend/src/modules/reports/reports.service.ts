import { Injectable } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { ReportQueryDto } from './dto/report-query.dto';

interface WorkloadRow {
  assigneeId: string;
  fullName: string;
  open: bigint;
  resolved: bigint;
}

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
      // Hard cap: throughput is computed in JS so an unbounded findMany on a
      // big production DB would OOM the API. 50k tickets covers ~3 years of
      // a busy team's traffic; for larger ranges this should move to a SQL
      // aggregation in a follow-up. For the portfolio scale (<100 tickets)
      // the cap never triggers.
      this.prisma.ticket.findMany({
        where: {
          OR: [{ createdAt: { gte: from, lte: to } }, { resolvedAt: { gte: from, lte: to } }],
          ...teamFilter,
        },
        select: { createdAt: true, resolvedAt: true },
        take: 50_000,
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
    // One raw SQL query with PostgreSQL FILTER clauses replaces the previous
    // 3 separate queries (assignees lookup + 2 workload groupBys). FILTER is
    // ANSI-SQL-2003 and Postgres has had it since 9.4. The Prisma.sql tag
    // safely interpolates the assigneeIds + optional teamId filter without
    // SQL injection risk.
    const teamCond = query.teamId ? Prisma.sql`AND t."teamId" = ${query.teamId}` : Prisma.empty;
    const workloadRows: WorkloadRow[] =
      assigneeIds.length === 0
        ? []
        : await this.prisma.$queryRaw<WorkloadRow[]>`
            SELECT
              t."assigneeId" AS "assigneeId",
              u."fullName"   AS "fullName",
              COUNT(*) FILTER (WHERE t.status::text NOT IN ('RESOLVED', 'CLOSED')) AS open,
              COUNT(*) FILTER (WHERE t.status::text = 'RESOLVED') AS resolved
            FROM tickets t
            JOIN users u ON u.id = t."assigneeId"
            WHERE t."assigneeId" IN (${Prisma.join(assigneeIds)})
            ${teamCond}
            GROUP BY t."assigneeId", u."fullName"
          `;
    const workload = workloadRows
      .map((r) => ({
        assigneeId: r.assigneeId,
        fullName: r.fullName,
        // pg returns COUNT() as bigint — coerce to number for JSON.
        open: Number(r.open),
        resolved: Number(r.resolved),
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
