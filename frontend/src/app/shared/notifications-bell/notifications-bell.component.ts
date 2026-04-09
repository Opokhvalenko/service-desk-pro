import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type OnInit } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import type { AppNotification } from '../../core/notifications/notification.types';
import { NotificationsStore } from '../../core/notifications/notifications.store';

@Component({
  selector: 'app-notifications-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
  ],
  template: `
    <button
      mat-icon-button
      type="button"
      [matMenuTriggerFor]="menu"
      (menuOpened)="onOpened()"
      [matBadge]="store.unreadCount()"
      [matBadgeHidden]="!store.hasUnread()"
      matBadgeColor="warn"
      matBadgeSize="small"
      aria-label="Notifications"
    >
      <mat-icon>notifications</mat-icon>
    </button>

    <mat-menu #menu="matMenu" class="notifications-menu" xPosition="before">
      <div class="menu-header" (click)="$event.stopPropagation()">
        <strong>Notifications</strong>
        @if (store.hasUnread()) {
          <button mat-button type="button" (click)="markAll()">Mark all read</button>
        }
      </div>
      <mat-divider />
      @if (store.items().length === 0) {
        <div class="empty">No notifications yet</div>
      }
      @for (n of store.items(); track n.id) {
        <button
          mat-menu-item
          type="button"
          (click)="open(n)"
          [class.unread]="!n.isRead"
        >
          <div class="notif">
            <span class="msg">{{ n.message }}</span>
            <span class="time">{{ n.createdAt | date: 'short' }}</span>
          </div>
        </button>
      }
      <mat-divider />
      <button mat-menu-item type="button" (click)="viewAll()" class="view-all">
        <mat-icon>open_in_new</mat-icon>
        <span>View all notifications</span>
      </button>
    </mat-menu>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 1rem;
    }

    .empty {
      padding: 1rem;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }

    .notif {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      max-width: 22rem;
      overflow: hidden;

      .msg {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.875rem;
      }

      .time {
        font-size: 0.7rem;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .unread {
      background-color: rgb(99 102 241 / 8%);

      .msg {
        font-weight: 600;
      }
    }
  `,
})
export class NotificationsBellComponent implements OnInit {
  protected readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.store.loadAll();
  }

  protected onOpened(): void {
    void this.store.loadAll();
  }

  protected async markAll(): Promise<void> {
    await this.store.markAllRead();
  }

  protected async open(n: AppNotification): Promise<void> {
    await this.store.markRead(n.id);
    if (n.ticketId) {
      void this.router.navigate(['/tickets', n.ticketId]);
    }
  }

  protected viewAll(): void {
    void this.router.navigate(['/notifications']);
  }
}
