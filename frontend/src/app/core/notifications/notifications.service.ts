import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  AppNotification,
  ListNotificationsQuery,
  PagedNotifications,
} from './notification.types';

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notifications`;

  list(): Promise<AppNotification[]> {
    return firstValueFrom(this.http.get<AppNotification[]>(this.base));
  }

  listPaged(query: ListNotificationsQuery): Promise<PagedNotifications> {
    let params = new HttpParams();
    if (query.page !== undefined) params = params.set('page', String(query.page));
    if (query.pageSize !== undefined) params = params.set('pageSize', String(query.pageSize));
    if (query.type !== undefined) params = params.set('type', query.type);
    if (query.isRead !== undefined) params = params.set('isRead', String(query.isRead));
    return firstValueFrom(this.http.get<PagedNotifications>(`${this.base}/paged`, { params }));
  }

  unreadCount(): Promise<{ count: number }> {
    return firstValueFrom(this.http.get<{ count: number }>(`${this.base}/unread-count`));
  }

  markRead(id: string): Promise<void> {
    return firstValueFrom(this.http.patch<void>(`${this.base}/${id}/read`, {}));
  }

  markAllRead(): Promise<void> {
    return firstValueFrom(this.http.patch<void>(`${this.base}/read-all`, {}));
  }
}
