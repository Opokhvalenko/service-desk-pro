import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  SlaPoliciesService,
  type SlaPolicy,
  type TicketPriority,
} from '../../core/sla/sla-policies.service';

interface PolicyRow {
  priority: TicketPriority;
  firstResponseHours: number;
  resolveHours: number;
  saving: boolean;
}

const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DEFAULTS: Record<TicketPriority, { fr: number; r: number }> = {
  LOW: { fr: 24, r: 72 },
  MEDIUM: { fr: 8, r: 48 },
  HIGH: { fr: 4, r: 24 },
  CRITICAL: { fr: 1, r: 8 },
};

@Component({
  selector: 'app-admin-sla-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card appearance="outlined" class="page-card">
      <header class="page-head">
        <div>
          <h1>SLA policies</h1>
          <p class="subtitle">Set first-response and resolution targets per priority</p>
        </div>
      </header>

      @if (loading()) {
        <div class="state"><mat-spinner diameter="36" /></div>
      } @else if (error()) {
        <div class="state error">{{ error() }}</div>
      } @else {
        <div class="rows">
          @for (row of rows(); track row.priority) {
            <div class="row" [attr.data-priority]="row.priority">
              <span class="priority-chip" [attr.data-priority]="row.priority">{{ row.priority }}</span>
              <mat-form-field appearance="outline" class="num">
                <mat-label>First response (h)</mat-label>
                <input
                  matInput
                  type="number"
                  min="1"
                  max="8760"
                  [ngModel]="row.firstResponseHours"
                  (ngModelChange)="updateField(row.priority, 'firstResponseHours', $event)"
                />
              </mat-form-field>
              <mat-form-field appearance="outline" class="num">
                <mat-label>Resolve (h)</mat-label>
                <input
                  matInput
                  type="number"
                  min="1"
                  max="8760"
                  [ngModel]="row.resolveHours"
                  (ngModelChange)="updateField(row.priority, 'resolveHours', $event)"
                />
              </mat-form-field>
              <button
                mat-flat-button
                color="primary"
                type="button"
                [disabled]="row.saving"
                (click)="save(row)"
              >
                <mat-icon>save</mat-icon>
                Save
              </button>
            </div>
          }
        </div>
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
        margin-bottom: 1.25rem;
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
      .state {
        padding: 2rem;
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
      }
      .state.error {
        color: #b91c1c;
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .row {
        display: grid;
        grid-template-columns: 7rem 1fr 1fr auto;
        align-items: center;
        gap: 1rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--mat-sys-surface-container);
      }
      .priority-chip {
        padding: 0.25rem 0.7rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        text-align: center;
        background: var(--mat-sys-outline-variant);
        color: var(--mat-sys-on-surface);
      }
      .priority-chip[data-priority='LOW'] {
        background: #dcfce7;
        color: #166534;
      }
      .priority-chip[data-priority='MEDIUM'] {
        background: #fef3c7;
        color: #92400e;
      }
      .priority-chip[data-priority='HIGH'] {
        background: #ffedd5;
        color: #9a3412;
      }
      .priority-chip[data-priority='CRITICAL'] {
        background: #fee2e2;
        color: #991b1b;
      }
      .num {
        width: 100%;
      }
      @media (max-width: 768px) {
        .row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AdminSlaPage implements OnInit {
  private readonly api = inject(SlaPoliciesService);
  private readonly snack = inject(MatSnackBar);

  protected readonly rows = signal<PolicyRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const existing = await this.api.list();
      const byPriority = new Map<TicketPriority, SlaPolicy>(existing.map((p) => [p.priority, p]));
      this.rows.set(
        PRIORITIES.map((priority) => {
          const found = byPriority.get(priority);
          return {
            priority,
            firstResponseHours: found?.firstResponseHours ?? DEFAULTS[priority].fr,
            resolveHours: found?.resolveHours ?? DEFAULTS[priority].r,
            saving: false,
          };
        }),
      );
    } catch {
      this.error.set('Failed to load SLA policies');
    } finally {
      this.loading.set(false);
    }
  }

  protected updateField(
    priority: TicketPriority,
    field: 'firstResponseHours' | 'resolveHours',
    value: number,
  ): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.priority === priority ? { ...r, [field]: Number(value) } : r)),
    );
  }

  protected async save(row: PolicyRow): Promise<void> {
    if (row.firstResponseHours < 1 || row.resolveHours < 1) {
      this.snack.open('Hours must be at least 1', 'Close', { duration: 2500 });
      return;
    }
    this.rows.update((rows) =>
      rows.map((r) => (r.priority === row.priority ? { ...r, saving: true } : r)),
    );
    try {
      await this.api.upsert({
        priority: row.priority,
        firstResponseHours: row.firstResponseHours,
        resolveHours: row.resolveHours,
      });
      this.snack.open(`${row.priority} policy saved`, 'Close', { duration: 2500 });
    } catch {
      this.snack.open('Failed to save policy', 'Close', { duration: 3000 });
    } finally {
      this.rows.update((rows) =>
        rows.map((r) => (r.priority === row.priority ? { ...r, saving: false } : r)),
      );
    }
  }
}
