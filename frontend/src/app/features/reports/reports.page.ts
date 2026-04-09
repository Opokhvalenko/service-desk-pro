import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import type { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { type ReportSummary, ReportsService } from '../../core/reports/reports.service';
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
  selector: 'app-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatTableModule,
    BaseChartDirective,
    AppToolbarComponent,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'en-US' }],
  template: `
    <app-toolbar active="reports" />
    <section class="page">
      <header class="page-head">
        <div>
          <h1>Reports</h1>
          <p class="subtitle">Aggregated metrics and CSV export</p>
        </div>
        <div class="filters">
          <mat-form-field appearance="outline">
            <mat-label>From</mat-label>
            <input matInput [matDatepicker]="fromPicker" [(ngModel)]="fromDate" />
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
            <mat-datepicker #fromPicker />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>To</mat-label>
            <input matInput [matDatepicker]="toPicker" [(ngModel)]="toDate" />
            <mat-datepicker-toggle matIconSuffix [for]="toPicker" />
            <mat-datepicker #toPicker />
          </mat-form-field>
          <button mat-flat-button color="primary" type="button" (click)="reload()">
            <mat-icon>refresh</mat-icon>
            Apply
          </button>
          <button mat-stroked-button type="button" (click)="downloadCsv()" [disabled]="downloading()">
            <mat-icon>download</mat-icon>
            Export CSV
          </button>
        </div>
      </header>

      @if (loading()) {
        <div class="state"><mat-spinner diameter="42" /></div>
      } @else if (error()) {
        <div class="state error">{{ error() }}</div>
      } @else if (data(); as d) {
        <div class="kpi-grid">
          <mat-card appearance="outlined" class="kpi">
            <span class="kpi-label">Created</span>
            <span class="kpi-value">{{ d.totals.created }}</span>
          </mat-card>
          <mat-card appearance="outlined" class="kpi">
            <span class="kpi-label">Resolved</span>
            <span class="kpi-value resolved">{{ d.totals.resolved }}</span>
          </mat-card>
          <mat-card appearance="outlined" class="kpi">
            <span class="kpi-label">Open</span>
            <span class="kpi-value">{{ d.totals.open }}</span>
          </mat-card>
          <mat-card appearance="outlined" class="kpi">
            <span class="kpi-label">Breached</span>
            <span class="kpi-value breached">{{ d.totals.breached }}</span>
          </mat-card>
          <mat-card appearance="outlined" class="kpi">
            <span class="kpi-label">SLA compliance</span>
            <span class="kpi-value">
              @if (d.slaCompliancePct !== null) {
                {{ d.slaCompliancePct | number: '1.0-1' }}%
              } @else {
                —
              }
            </span>
          </mat-card>
        </div>

        <div class="charts-grid">
          <mat-card appearance="outlined" class="chart-card">
            <h2>Throughput</h2>
            <div class="chart-wrap">
              <canvas
                baseChart
                [type]="'line'"
                [data]="throughputData()"
                [options]="lineOptions"
              ></canvas>
            </div>
          </mat-card>
          <mat-card appearance="outlined" class="chart-card">
            <h2>By status</h2>
            <div class="chart-wrap">
              <canvas
                baseChart
                [type]="'doughnut'"
                [data]="statusData()"
                [options]="doughnutOptions"
              ></canvas>
            </div>
          </mat-card>
          <mat-card appearance="outlined" class="chart-card">
            <h2>By priority</h2>
            <div class="chart-wrap">
              <canvas
                baseChart
                [type]="'bar'"
                [data]="priorityData()"
                [options]="barOptions"
              ></canvas>
            </div>
          </mat-card>
          <mat-card appearance="outlined" class="chart-card">
            <h2>By category</h2>
            <div class="chart-wrap">
              <canvas
                baseChart
                [type]="'bar'"
                [data]="categoryData()"
                [options]="barOptions"
              ></canvas>
            </div>
          </mat-card>
        </div>

        <mat-card appearance="outlined" class="table-card">
          <h2>Agent workload</h2>
          @if (d.workload.length === 0) {
            <p class="muted">No assigned tickets in range.</p>
          } @else {
            <table mat-table [dataSource]="d.workload" class="data-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Agent</th>
                <td mat-cell *matCellDef="let r">{{ r.fullName }}</td>
              </ng-container>
              <ng-container matColumnDef="open">
                <th mat-header-cell *matHeaderCellDef>Open</th>
                <td mat-cell *matCellDef="let r">{{ r.open }}</td>
              </ng-container>
              <ng-container matColumnDef="resolved">
                <th mat-header-cell *matHeaderCellDef>Resolved</th>
                <td mat-cell *matCellDef="let r">{{ r.resolved }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="workloadColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: workloadColumns"></tr>
            </table>
          }
        </mat-card>

        <p class="range-note">
          Range: {{ d.range.from | date: 'mediumDate' }} — {{ d.range.to | date: 'mediumDate' }}
        </p>
      }
    </section>
  `,
  styles: [
    `
      .page {
        max-width: 90rem;
        margin: 0 auto;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .page-head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1rem;
      }
      h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        color: #0f172a;
      }
      .subtitle {
        margin: 0.2rem 0 0;
        color: #64748b;
        font-size: 0.9rem;
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
      }
      .filters mat-form-field {
        width: 13.5rem;
      }
      .state {
        padding: 3rem;
        text-align: center;
        color: #64748b;
      }
      .state.error {
        color: #b91c1c;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
        gap: 1rem;
      }
      .kpi {
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        background: #fff !important;
        border-radius: 1rem !important;
      }
      .kpi-label {
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
      }
      .kpi-value {
        font-size: 1.85rem;
        font-weight: 800;
        color: #0f172a;
      }
      .kpi-value.resolved {
        color: #047857;
      }
      .kpi-value.breached {
        color: #b91c1c;
      }
      .charts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
        gap: 1rem;
      }
      .chart-card {
        background: #fff !important;
        border-radius: 1rem !important;
        padding: 1rem 1.25rem;
      }
      .chart-card h2 {
        margin: 0 0 0.5rem;
        font-size: 1rem;
        color: #0f172a;
      }
      .chart-wrap {
        position: relative;
        height: 16rem;
      }
      .table-card {
        background: #fff !important;
        border-radius: 1rem !important;
        padding: 1rem 1.25rem;
      }
      .table-card h2 {
        margin: 0 0 0.75rem;
        font-size: 1rem;
        color: #0f172a;
      }
      .data-table {
        width: 100%;
        background: transparent;
      }
      .muted {
        color: #94a3b8;
      }
      .range-note {
        text-align: center;
        color: #94a3b8;
        font-size: 0.78rem;
        margin: 0.5rem 0 0;
      }
    `,
  ],
})
export class ReportsPage implements OnInit {
  private readonly api = inject(ReportsService);

  protected readonly workloadColumns = ['name', 'open', 'resolved'];

  protected readonly data = signal<ReportSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly downloading = signal(false);

  protected fromDate: Date | null = null;
  protected toDate: Date | null = null;

  protected readonly statusData = signal<ChartData<'doughnut'>>({ labels: [], datasets: [] });
  protected readonly priorityData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  protected readonly categoryData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  protected readonly throughputData = signal<ChartData<'line'>>({ labels: [], datasets: [] });

  protected readonly doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };
  protected readonly barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { ticks: { precision: 0 } } },
  };
  protected readonly lineOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { ticks: { precision: 0 } } },
  };

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.api.summary({
        from: this.fromDate?.toISOString(),
        to: this.toDate?.toISOString(),
      });
      this.data.set(data);
      this.statusData.set({
        labels: data.byStatus.map((r) => r.status),
        datasets: [
          {
            data: data.byStatus.map((r) => r.count),
            backgroundColor: data.byStatus.map((r) => STATUS_COLORS[r.status] ?? '#94a3b8'),
          },
        ],
      });
      this.priorityData.set({
        labels: data.byPriority.map((r) => r.priority),
        datasets: [
          {
            label: 'Tickets',
            data: data.byPriority.map((r) => r.count),
            backgroundColor: data.byPriority.map((r) => PRIORITY_COLORS[r.priority] ?? '#94a3b8'),
          },
        ],
      });
      this.categoryData.set({
        labels: data.byCategory.map((r) => r.name),
        datasets: [
          {
            label: 'Tickets',
            data: data.byCategory.map((r) => r.count),
            backgroundColor: '#6366f1',
          },
        ],
      });
      this.throughputData.set({
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
      });
    } catch {
      this.error.set('Failed to load reports');
    } finally {
      this.loading.set(false);
    }
  }

  protected async downloadCsv(): Promise<void> {
    this.downloading.set(true);
    try {
      await this.api.downloadCsv({
        from: this.fromDate?.toISOString(),
        to: this.toDate?.toISOString(),
      });
    } catch {
      this.error.set('Failed to download CSV');
    } finally {
      this.downloading.set(false);
    }
  }
}
