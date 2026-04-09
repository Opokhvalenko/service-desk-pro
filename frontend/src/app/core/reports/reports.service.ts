import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReportSummary {
  range: { from: string; to: string };
  totals: { created: number; resolved: number; breached: number; open: number };
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byCategory: Array<{ categoryId: string | null; name: string; count: number }>;
  byTeam: Array<{ teamId: string | null; name: string; count: number }>;
  workload: Array<{ assigneeId: string; fullName: string; open: number; resolved: number }>;
  slaCompliancePct: number | null;
  throughput: Array<{ date: string; created: number; resolved: number }>;
}

export interface ReportQuery {
  from?: string;
  to?: string;
  teamId?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reports`;

  summary(query: ReportQuery): Promise<ReportSummary> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return firstValueFrom(this.http.get<ReportSummary>(`${this.base}/summary`, { params }));
  }

  exportCsvUrl(query: ReportQuery): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    return `${this.base}/export.csv${qs ? `?${qs}` : ''}`;
  }

  async downloadCsv(query: ReportQuery): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(this.exportCsvUrl(query), { responseType: 'blob' }),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
