import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { UserRole } from '../auth/auth.types';

export interface AuditEntry {
  id: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
  } | null;
}

export interface AuditListQuery {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditListResult {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/audit`;

  list(query: AuditListQuery): Promise<AuditListResult> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return firstValueFrom(this.http.get<AuditListResult>(this.base, { params }));
  }

  listForTicket(ticketId: string): Promise<AuditEntry[]> {
    return firstValueFrom(this.http.get<AuditEntry[]>(`${this.base}/ticket/${ticketId}`));
  }
}
