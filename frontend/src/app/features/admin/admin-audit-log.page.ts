import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { type AuditEntry, AuditService } from '../../core/audit/audit.service';

const ENTITY_TYPES = ['', 'Ticket', 'TicketComment'] as const;
const ACTIONS = ['', 'created', 'updated', 'status_changed', 'assigned'] as const;

@Component({
  selector: 'app-admin-audit-log-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <mat-card appearance="outlined" class="page-card">
      <header class="page-head">
        <div>
          <h1>Audit log</h1>
          <p class="subtitle">All administrative and ticket activity</p>
        </div>
        <button mat-stroked-button type="button" (click)="reset()">
          <mat-icon>refresh</mat-icon>
          Reset filters
        </button>
      </header>

      <div class="filters">
        <mat-form-field appearance="outline">
          <mat-label>Entity</mat-label>
          <mat-select [value]="entityType()" (selectionChange)="entityType.set($event.value); reload()">
            @for (t of entityTypes; track t) {
              <mat-option [value]="t">{{ t || 'All' }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Action</mat-label>
          <mat-select [value]="action()" (selectionChange)="action.set($event.value); reload()">
            @for (a of actions; track a) {
              <mat-option [value]="a">{{ a || 'All' }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Entity ID</mat-label>
          <input
            matInput
            [ngModel]="entityId()"
            (ngModelChange)="entityId.set($event)"
            (keyup.enter)="reload()"
          />
        </mat-form-field>
      </div>

      @if (loading()) {
        <div class="state"><mat-spinner diameter="36" /></div>
      } @else if (error()) {
        <div class="state error">{{ error() }}</div>
      } @else if (rows().length === 0) {
        <div class="state">No entries.</div>
      } @else {
        <table mat-table [dataSource]="rows()" class="data-table">
          <ng-container matColumnDef="when">
            <th mat-header-cell *matHeaderCellDef>When</th>
            <td mat-cell *matCellDef="let r">{{ r.createdAt | date: 'MMM d, y, h:mm:ss a' }}</td>
          </ng-container>

          <ng-container matColumnDef="actor">
            <th mat-header-cell *matHeaderCellDef>Actor</th>
            <td mat-cell *matCellDef="let r">
              @if (r.actor) {
                <div class="actor">
                  <strong>{{ r.actor.fullName }}</strong>
                  <span class="role-chip" [attr.data-role]="r.actor.role">{{ r.actor.role }}</span>
                </div>
              } @else {
                <span class="muted">System</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="entity">
            <th mat-header-cell *matHeaderCellDef>Entity</th>
            <td mat-cell *matCellDef="let r">
              <div class="entity">
                <span class="type">{{ r.entityType }}</span>
                <code class="id">{{ r.entityId }}</code>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef>Action</th>
            <td mat-cell *matCellDef="let r">
              <span class="action-chip">{{ r.action }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="metadata">
            <th mat-header-cell *matHeaderCellDef>Metadata</th>
            <td mat-cell *matCellDef="let r">
              @if (r.metadata) {
                <code class="meta">{{ format(r.metadata) }}</code>
              } @else {
                <span class="muted">—</span>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        <mat-paginator
          [length]="total()"
          [pageSize]="pageSize()"
          [pageIndex]="page() - 1"
          [pageSizeOptions]="[25, 50, 100]"
          (page)="onPage($event)"
        />
      }
    </mat-card>
  `,
  styles: [
    `
      .page-card {
        border-radius: 1rem !important;
        background: var(--mat-sys-surface-container) !important;
        padding: 1.5rem;
      }
      .page-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      h1 {
        margin: 0;
        font-size: 1.4rem;
        font-weight: 800;
        color: var(--mat-sys-on-surface);
      }
      .subtitle {
        margin: 0.2rem 0 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.85rem;
      }
      .filters {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 0.5rem;
      }
      .filters mat-form-field {
        min-width: 12rem;
      }
      .state {
        padding: 2rem;
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
      }
      .state.error {
        color: #b91c1c;
      }
      .data-table {
        width: 100%;
        background: transparent;
      }
      .data-table .mat-column-when {
        min-width: 12rem;
      }
      .data-table .mat-column-entity {
        min-width: 14rem;
      }
      .actor {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .role-chip {
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 700;
        background: #eef2ff;
        color: #4338ca;
      }
      .role-chip[data-role='ADMIN'] {
        background: #fee2e2;
        color: #991b1b;
      }
      .entity {
        display: flex;
        flex-direction: column;
      }
      .type {
        font-weight: 600;
        color: var(--mat-sys-on-surface);
        font-size: 0.85rem;
      }
      .id {
        font-size: 0.7rem;
        color: var(--mat-sys-on-surface-variant);
      }
      .action-chip {
        padding: 0.2rem 0.55rem;
        border-radius: 0.4rem;
        background: var(--mat-sys-surface-container);
        color: var(--mat-sys-on-surface);
        font-size: 0.78rem;
        font-weight: 600;
      }
      .meta {
        font-size: 0.72rem;
        color: var(--mat-sys-on-surface-variant);
        word-break: break-all;
      }
      .muted {
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
})
export class AdminAuditLogPage implements OnInit {
  private readonly api = inject(AuditService);

  protected readonly entityTypes = ENTITY_TYPES;
  protected readonly actions = ACTIONS;
  protected readonly columns = ['when', 'actor', 'entity', 'action', 'metadata'];

  protected readonly rows = signal<AuditEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(50);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly entityType = signal<string>('');
  protected readonly entityId = signal<string>('');
  protected readonly action = signal<string>('');

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.api.list({
        entityType: this.entityType() || undefined,
        entityId: this.entityId().trim() || undefined,
        action: this.action() || undefined,
        page: this.page(),
        pageSize: this.pageSize(),
      });
      this.rows.set(result.items);
      this.total.set(result.total);
    } catch {
      this.error.set('Failed to load audit log');
    } finally {
      this.loading.set(false);
    }
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    void this.reload();
  }

  protected reset(): void {
    this.entityType.set('');
    this.entityId.set('');
    this.action.set('');
    this.page.set(1);
    void this.reload();
  }

  protected format(meta: Record<string, unknown>): string {
    return JSON.stringify(meta);
  }
}
