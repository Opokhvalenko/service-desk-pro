import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import type { ReportSummary } from '../../core/reports/reports.service';

/**
 * Presentational table for the per-agent open/resolved workload section of
 * the Reports page. Extracted so the parent page stays focused on
 * orchestration and chart-data prep.
 */
@Component({
  selector: 'app-workload-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatTableModule],
  template: `
    <mat-card appearance="outlined" class="table-card">
      <h2>Agent workload</h2>
      @if (rows().length === 0) {
        <p class="muted">No assigned tickets in range.</p>
      } @else {
        <table mat-table [dataSource]="rows()" class="data-table">
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
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      }
    </mat-card>
  `,
  styles: `
    .table-card {
      background: var(--mat-sys-surface-container) !important;
      border-radius: 1rem !important;
      padding: 1rem 1.25rem;
    }
    .table-card h2 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
      color: var(--mat-sys-on-surface);
    }
    .data-table {
      width: 100%;
      background: transparent;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class WorkloadTableComponent {
  readonly rows = input.required<ReportSummary['workload']>();
  protected readonly columns = ['name', 'open', 'resolved'];
}
