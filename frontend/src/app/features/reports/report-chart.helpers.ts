import type { ChartConfiguration, ChartData } from 'chart.js';
import type { ReportSummary } from '../../core/reports/reports.service';

/**
 * Chart configuration + data-mapping helpers for the Reports page.
 *
 * Extracted from the page component so the page itself stays focused on
 * orchestration (load → set signals) while these helpers own the
 * presentation-layer translations from API shape to chart.js shape.
 */

export const STATUS_COLORS: Record<string, string> = {
  NEW: '#6366f1',
  OPEN: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  WAITING_FOR_CUSTOMER: '#a855f7',
  ESCALATED: '#dc2626',
  RESOLVED: '#10b981',
  CLOSED: '#6b7280',
  REOPENED: '#f97316',
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  CRITICAL: '#dc2626',
};

export const DOUGHNUT_OPTIONS: ChartConfiguration<'doughnut'>['options'] = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
};

export const BAR_OPTIONS: ChartConfiguration<'bar'>['options'] = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { ticks: { precision: 0 } } },
};

export const LINE_OPTIONS: ChartConfiguration<'line'>['options'] = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
  scales: { y: { ticks: { precision: 0 } } },
};

export function toStatusChart(data: ReportSummary): ChartData<'doughnut'> {
  return {
    labels: data.byStatus.map((r) => r.status),
    datasets: [
      {
        data: data.byStatus.map((r) => r.count),
        backgroundColor: data.byStatus.map((r) => STATUS_COLORS[r.status] ?? '#94a3b8'),
      },
    ],
  };
}

export function toPriorityChart(data: ReportSummary): ChartData<'bar'> {
  return {
    labels: data.byPriority.map((r) => r.priority),
    datasets: [
      {
        label: 'Tickets',
        data: data.byPriority.map((r) => r.count),
        backgroundColor: data.byPriority.map((r) => PRIORITY_COLORS[r.priority] ?? '#94a3b8'),
      },
    ],
  };
}

export function toCategoryChart(data: ReportSummary): ChartData<'bar'> {
  return {
    labels: data.byCategory.map((r) => r.name),
    datasets: [
      {
        label: 'Tickets',
        data: data.byCategory.map((r) => r.count),
        backgroundColor: '#6366f1',
      },
    ],
  };
}

export function toThroughputChart(data: ReportSummary): ChartData<'line'> {
  return {
    labels: data.throughput.map((r) => r.date),
    datasets: [
      {
        label: 'Created',
        data: data.throughput.map((r) => r.created),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Resolved',
        data: data.throughput.map((r) => r.resolved),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        tension: 0.3,
        fill: true,
      },
    ],
  };
}
