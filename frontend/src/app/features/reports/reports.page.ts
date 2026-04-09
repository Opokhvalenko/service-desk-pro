import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { type ReportSummary, ReportsService } from '../../core/reports/reports.service';
import { AppToolbarComponent } from '../../shared/app-toolbar/app-toolbar.component';
import {
  BAR_OPTIONS,
  DOUGHNUT_OPTIONS,
  LINE_OPTIONS,
  toCategoryChart,
  toPriorityChart,
  toStatusChart,
  toThroughputChart,
} from './report-chart.helpers';
import { WorkloadTableComponent } from './workload-table.component';

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
    BaseChartDirective,
    AppToolbarComponent,
    WorkloadTableComponent,
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
              <canvas baseChart [type]="'line'" [data]="throughputData()" [options]="lineOptions"></canvas>
            </div>
          </mat-card>
          <mat-card appearance="outlined" class="chart-card">
            <h2>By status</h2>
            <div class="chart-wrap">
              <canvas baseChart [type]="'doughnut'" [data]="statusData()" [options]="doughnutOptions"></canvas>
            </div>
          </mat-card>
          <mat-card appearance="outlined" class="chart-card">
            <h2>By priority</h2>
            <div class="chart-wrap">
              <canvas baseChart [type]="'bar'" [data]="priorityData()" [options]="barOptions"></canvas>
            </div>
          </mat-card>
          <mat-card appearance="outlined" class="chart-card">
            <h2>By category</h2>
            <div class="chart-wrap">
              <canvas baseChart [type]="'bar'" [data]="categoryData()" [options]="barOptions"></canvas>
            </div>
          </mat-card>
        </div>

        <app-workload-table [rows]="d.workload" />

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
        color: var(--mat-sys-on-surface);
      }
      .subtitle {
        margin: 0.2rem 0 0;
        color: var(--mat-sys-on-surface-variant);
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
        color: var(--mat-sys-on-surface-variant);
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
        background: var(--mat-sys-surface-container) !important;
        border-radius: 1rem !important;
      }
      .kpi-label {
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--mat-sys-on-surface-variant);
      }
      .kpi-value {
        font-size: 1.85rem;
        font-weight: 800;
        color: var(--mat-sys-on-surface);
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
        background: var(--mat-sys-surface-container) !important;
        border-radius: 1rem !important;
        padding: 1rem 1.25rem;
      }
      .chart-card h2 {
        margin: 0 0 0.5rem;
        font-size: 1rem;
        color: var(--mat-sys-on-surface);
      }
      .chart-wrap {
        position: relative;
        height: 16rem;
      }
      .range-note {
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.78rem;
        margin: 0.5rem 0 0;
      }
    `,
  ],
})
export class ReportsPage implements OnInit {
  private readonly api = inject(ReportsService);

  protected readonly data = signal<ReportSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly downloading = signal(false);

  protected fromDate: Date | null = null;
  protected toDate: Date | null = null;

  // Chart data is derived from `data()` via `computed()` — no manual sync.
  protected readonly statusData = computed(() => {
    const d = this.data();
    return d ? toStatusChart(d) : { labels: [], datasets: [] };
  });
  protected readonly priorityData = computed(() => {
    const d = this.data();
    return d ? toPriorityChart(d) : { labels: [], datasets: [] };
  });
  protected readonly categoryData = computed(() => {
    const d = this.data();
    return d ? toCategoryChart(d) : { labels: [], datasets: [] };
  });
  protected readonly throughputData = computed(() => {
    const d = this.data();
    return d ? toThroughputChart(d) : { labels: [], datasets: [] };
  });

  protected readonly doughnutOptions = DOUGHNUT_OPTIONS;
  protected readonly barOptions = BAR_OPTIONS;
  protected readonly lineOptions = LINE_OPTIONS;

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
