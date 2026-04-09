import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import type {
  AppNotification,
  NotificationType,
  PagedNotifications,
} from '../../core/notifications/notification.types';
import { NotificationsApiService } from '../../core/notifications/notifications.service';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { AppToolbarComponent } from '../../shared/app-toolbar/app-toolbar.component';

type ReadFilter = 'all' | 'unread' | 'read';

const TYPE_LABELS: Record<NotificationType, string> = {
  TICKET_ASSIGNED: 'Assigned',
  TICKET_STATUS_CHANGED: 'Status changed',
  TICKET_COMMENT_ADDED: 'New comment',
  TICKET_SLA_BREACHED: 'SLA breached',
};

const TYPE_ICONS: Record<NotificationType, string> = {
  TICKET_ASSIGNED: 'assignment_ind',
  TICKET_STATUS_CHANGED: 'sync_alt',
  TICKET_COMMENT_ADDED: 'forum',
  TICKET_SLA_BREACHED: 'schedule',
};

@Component({
  selector: 'app-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    AppToolbarComponent,
  ],
  template: `
    <app-toolbar active="notifications" />
    <main class="page">
      <header class="page-head">
        <h1>Notifications</h1>
        @if (store.hasUnread()) {
          <button mat-stroked-button type="button" (click)="markAllRead()">
            <mat-icon>done_all</mat-icon>
            Mark all as read
          </button>
        }
      </header>

      <section class="filters">
        <mat-form-field appearance="outline" class="filter-select">
          <mat-label>Type</mat-label>
          <mat-select
            [ngModel]="typeFilter()"
            (ngModelChange)="onTypeChange($event)"
          >
            <mat-option value="">All types</mat-option>
            <mat-option value="TICKET_ASSIGNED">Assigned</mat-option>
            <mat-option value="TICKET_STATUS_CHANGED">Status changed</mat-option>
            <mat-option value="TICKET_COMMENT_ADDED">New comment</mat-option>
            <mat-option value="TICKET_SLA_BREACHED">SLA breached</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-select">
          <mat-label>Status</mat-label>
          <mat-select
            [ngModel]="readFilter()"
            (ngModelChange)="onReadChange($event)"
          >
            <mat-option value="all">All</mat-option>
            <mat-option value="unread">Unread only</mat-option>
            <mat-option value="read">Read only</mat-option>
          </mat-select>
        </mat-form-field>

        <span class="spacer"></span>

        <span class="count">
          {{ total() }} {{ total() === 1 ? 'notification' : 'notifications' }}
        </span>
      </section>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="40" /></div>
      } @else if (error()) {
        <div class="error-banner" role="alert">{{ error() }}</div>
      } @else if (items().length === 0) {
        <div class="empty">
          <mat-icon>notifications_off</mat-icon>
          <p>No notifications to show</p>
        </div>
      } @else {
        <ul class="list">
          @for (n of items(); track n.id) {
            <li class="item" [class.unread]="!n.isRead" (click)="open(n)">
              <mat-icon class="type-icon">{{ typeIcon(n.type) }}</mat-icon>
              <div class="body">
                <div class="row">
                  <span class="chip">{{ typeLabel(n.type) }}</span>
                  @if (!n.isRead) {
                    <span class="dot" aria-label="Unread"></span>
                  }
                  <span class="time">{{ n.createdAt | date: 'medium' }}</span>
                </div>
                <p class="msg">{{ n.message }}</p>
              </div>
              @if (n.ticketId) {
                <mat-icon class="chevron">chevron_right</mat-icon>
              }
            </li>
          }
        </ul>

        <mat-paginator
          [length]="total()"
          [pageSize]="pageSize()"
          [pageIndex]="page() - 1"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPage($event)"
        />
      }
    </main>
  `,
  styles: [
    `
      .page {
        max-width: 60rem;
        margin: 0 auto;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .page-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .page-head h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        color: #0f172a;
      }
      .filters {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .filter-select {
        min-width: 12rem;
      }
      .spacer {
        flex: 1;
      }
      .count {
        color: #64748b;
        font-size: 0.85rem;
      }
      .loading {
        display: flex;
        justify-content: center;
        padding: 3rem 0;
      }
      .error-banner {
        background: #fee2e2;
        color: #991b1b;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 3rem 0;
        color: #64748b;
      }
      .empty mat-icon {
        font-size: 3rem;
        width: 3rem;
        height: 3rem;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .item {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        padding: 0.85rem 1rem;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }
      .item:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      .item.unread {
        background: #eef2ff;
        border-color: #c7d2fe;
      }
      .item.unread .msg {
        font-weight: 600;
      }
      .type-icon {
        color: #4338ca;
        margin-top: 0.15rem;
      }
      .body {
        flex: 1;
        min-width: 0;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
      }
      .chip {
        display: inline-block;
        padding: 0.1rem 0.55rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 700;
        background: #e0e7ff;
        color: #4338ca;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      .dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        background: #4338ca;
      }
      .time {
        font-size: 0.75rem;
        color: #64748b;
        margin-left: auto;
      }
      .msg {
        margin: 0;
        color: #0f172a;
        font-size: 0.92rem;
        line-height: 1.4;
      }
      .chevron {
        color: #94a3b8;
        align-self: center;
      }
    `,
  ],
})
export class NotificationsPage implements OnInit {
  private readonly api = inject(NotificationsApiService);
  protected readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);

  protected readonly items = signal<AppNotification[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly typeFilter = signal<NotificationType | ''>('');
  protected readonly readFilter = signal<ReadFilter>('all');

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res: PagedNotifications = await this.api.listPaged({
        page: this.page(),
        pageSize: this.pageSize(),
        type: this.typeFilter() || undefined,
        isRead:
          this.readFilter() === 'unread' ? false : this.readFilter() === 'read' ? true : undefined,
      });
      this.items.set(res.items);
      this.total.set(res.total);
    } catch {
      this.error.set('Failed to load notifications');
    } finally {
      this.loading.set(false);
    }
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex + 1);
    this.pageSize.set(e.pageSize);
    void this.load();
  }

  protected onTypeChange(value: NotificationType | ''): void {
    this.typeFilter.set(value);
    this.page.set(1);
    void this.load();
  }

  protected onReadChange(value: ReadFilter): void {
    this.readFilter.set(value);
    this.page.set(1);
    void this.load();
  }

  protected async markAllRead(): Promise<void> {
    await this.store.markAllRead();
    this.items.update((list) => list.map((n) => ({ ...n, isRead: true })));
  }

  protected async open(n: AppNotification): Promise<void> {
    if (!n.isRead) {
      await this.store.markRead(n.id);
      this.items.update((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    if (n.ticketId) {
      void this.router.navigate(['/tickets', n.ticketId]);
    }
  }

  protected typeLabel(t: NotificationType): string {
    return TYPE_LABELS[t];
  }

  protected typeIcon(t: NotificationType): string {
    return TYPE_ICONS[t];
  }
}
