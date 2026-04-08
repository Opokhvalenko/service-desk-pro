import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import type { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { AuthStore } from '../../core/auth/auth.store';
import { StatsService } from '../../core/stats/stats.service';
import type { DashboardStats } from '../../core/stats/stats.types';
import { AppToolbarComponent } from '../../shared/app-toolbar/app-toolbar.component';

const STATUS_COLORS: Record<string, string> = {
  NEW: '#6366f1',
  OPEN: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  WAITING_FOR_CUSTOMER: '#a855f7',
  ESCALATED: '#dc2626',
  RESOLVED: '#10b981',
  CLOSED: '#6b7280',
  REOPENED: '#f97316',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  CRITICAL: '#dc2626',
};

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatProgressSpinnerModule, BaseChartDirective, AppToolbarComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  private readonly api = inject(StatsService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthStore);

  protected goToTickets(filter?: { status?: string; statusIn?: string; breached?: boolean }): void {
    void this.router.navigate(['/tickets'], { queryParams: filter });
  }

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly statusChartType: ChartConfiguration<'doughnut'>['type'] = 'doughnut';
  protected readonly priorityChartType: ChartConfiguration<'bar'>['type'] = 'bar';

  protected readonly statusChartData = signal<ChartData<'doughnut'>>({ labels: [], datasets: [] });
  protected readonly priorityChartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });

  protected readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    locale: 'en-US',
    plugins: { legend: { position: 'bottom' } },
    scales: {
      y: {
        ticks: {
          precision: 0,
          callback: (value) => Number(value).toLocaleString('en-US'),
        },
      },
    },
  };

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.api.dashboard();
      this.stats.set(data);
      this.statusChartData.set({
        labels: data.byStatus.map((r) => r.status),
        datasets: [
          {
            data: data.byStatus.map((r) => r.count),
            backgroundColor: data.byStatus.map((r) => STATUS_COLORS[r.status] ?? '#94a3b8'),
          },
        ],
      });
      this.priorityChartData.set({
        labels: data.byPriority.map((r) => r.priority),
        datasets: [
          {
            label: 'Tickets',
            data: data.byPriority.map((r) => r.count),
            backgroundColor: data.byPriority.map((r) => PRIORITY_COLORS[r.priority] ?? '#94a3b8'),
          },
        ],
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      this.loading.set(false);
    }
  }
}
