import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { DashboardStats } from './stats.types';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/stats`;

  dashboard(): Promise<DashboardStats> {
    return firstValueFrom(this.http.get<DashboardStats>(`${this.base}/dashboard`));
  }
}
