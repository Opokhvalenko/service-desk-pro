import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AppNotification } from './notification.types';

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notifications`;

  list(): Promise<AppNotification[]> {
    return firstValueFrom(this.http.get<AppNotification[]>(this.base));
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
