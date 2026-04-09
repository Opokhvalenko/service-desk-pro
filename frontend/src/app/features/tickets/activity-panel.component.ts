import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  type OnChanges,
  type SimpleChanges,
  signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { type AuditEntry, AuditService } from '../../core/audit/audit.service';

interface ActivityRow {
  id: string;
  icon: string;
  text: string;
  actor: string;
  createdAt: string;
}

const ACTION_ICONS: Record<string, string> = {
  created: 'add_circle',
  updated: 'edit',
  status_changed: 'sync',
  assigned: 'person_add',
};

function describe(entry: AuditEntry): { icon: string; text: string } {
  const meta = entry.metadata ?? {};
  if (entry.entityType === 'TicketComment' && entry.action === 'created') {
    return { icon: 'comment', text: 'added a comment' };
  }
  if (entry.entityType === 'Ticket') {
    switch (entry.action) {
      case 'created':
        return { icon: 'add_circle', text: 'created the ticket' };
      case 'status_changed': {
        const from = (meta['from'] as string | undefined) ?? '?';
        const to = (meta['to'] as string | undefined) ?? '?';
        return { icon: 'sync', text: `changed status ${from} → ${to}` };
      }
      case 'assigned': {
        const to = (meta['assigneeId'] as string | null) ?? null;
        return { icon: 'person_add', text: to ? 'assigned the ticket' : 'unassigned the ticket' };
      }
      case 'updated':
        return { icon: 'edit', text: 'updated ticket fields' };
    }
  }
  return { icon: ACTION_ICONS[entry.action] ?? 'history', text: entry.action.replace(/_/g, ' ') };
}

@Component({
  selector: 'app-activity-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <mat-card appearance="outlined" class="activity-card">
      <header class="head">
        <h2 class="label">
          <mat-icon>history</mat-icon>
          Activity
          <span class="count">{{ rows().length }}</span>
        </h2>
      </header>
      @if (loading()) {
        <div class="loading"><mat-spinner diameter="28" /></div>
      } @else if (error()) {
        <p class="error">Failed to load activity.</p>
      } @else if (rows().length === 0) {
        <p class="empty">No activity yet.</p>
      } @else {
        <ol class="timeline">
          @for (r of rows(); track r.id) {
            <li class="row">
              <span class="dot"><mat-icon>{{ r.icon }}</mat-icon></span>
              <div class="body">
                <p class="text">
                  <strong>{{ r.actor }}</strong> {{ r.text }}
                </p>
                <span class="date">{{ r.createdAt | date: 'MMM d, y, h:mm a' }}</span>
              </div>
            </li>
          }
        </ol>
      }
    </mat-card>
  `,
  styles: [
    `
      .activity-card {
        padding: 1rem 1.25rem;
      }
      .head {
        display: flex;
        align-items: center;
        margin-bottom: 0.75rem;
      }
      .label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
        color: #0f172a;
      }
      .count {
        background: #eef2ff;
        color: #4338ca;
        padding: 0.1rem 0.55rem;
        border-radius: 999px;
        font-size: 0.78rem;
      }
      .loading,
      .empty,
      .error {
        padding: 1rem;
        text-align: center;
        color: #64748b;
        font-size: 0.88rem;
      }
      .error {
        color: #dc2626;
      }
      .timeline {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .row {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
      }
      .dot {
        flex-shrink: 0;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        background: #eef2ff;
        color: #4338ca;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .dot mat-icon {
        font-size: 1.05rem;
        width: 1.05rem;
        height: 1.05rem;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
      .text {
        margin: 0;
        font-size: 0.9rem;
        color: #0f172a;
      }
      .date {
        font-size: 0.75rem;
        color: #64748b;
      }
    `,
  ],
})
export class ActivityPanelComponent implements OnChanges {
  readonly ticketId = input.required<string>();

  private readonly api = inject(AuditService);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly rows = signal<ActivityRow[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticketId']) {
      void this.load();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const entries = await this.api.listForTicket(this.ticketId());
      this.rows.set(
        entries.map((e) => {
          const d = describe(e);
          return {
            id: e.id,
            icon: d.icon,
            text: d.text,
            actor: e.actor?.fullName ?? 'System',
            createdAt: e.createdAt,
          };
        }),
      );
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
