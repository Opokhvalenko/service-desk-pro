import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type { AppNotification } from './notification.types';
import { NotificationsApiService } from './notifications.service';

interface State {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
}

const initialState: State = { items: [], unreadCount: 0, loading: false };

export const NotificationsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((s) => ({
    hasUnread: computed(() => s.unreadCount() > 0),
  })),
  withMethods((store, api = inject(NotificationsApiService)) => ({
    async loadAll(): Promise<void> {
      patchState(store, { loading: true });
      try {
        const [items, count] = await Promise.all([api.list(), api.unreadCount()]);
        patchState(store, { items, unreadCount: count.count, loading: false });
      } catch {
        patchState(store, { loading: false });
      }
    },

    async refreshCount(): Promise<void> {
      try {
        const { count } = await api.unreadCount();
        patchState(store, { unreadCount: count });
      } catch {
        // ignore
      }
    },

    addRealtime(notif: AppNotification): void {
      patchState(store, {
        items: [notif, ...store.items()].slice(0, 20),
        unreadCount: store.unreadCount() + 1,
      });
    },

    async markRead(id: string): Promise<void> {
      const target = store.items().find((n) => n.id === id);
      if (!target || target.isRead) return;
      try {
        await api.markRead(id);
        patchState(store, {
          items: store.items().map((n) => (n.id === id ? { ...n, isRead: true } : n)),
          unreadCount: Math.max(0, store.unreadCount() - 1),
        });
      } catch {
        // ignore
      }
    },

    async markAllRead(): Promise<void> {
      try {
        await api.markAllRead();
        patchState(store, {
          items: store.items().map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        });
      } catch {
        // ignore
      }
    },

    reset(): void {
      patchState(store, initialState);
    },
  })),
);
