import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SlaPolicy {
  id: string;
  priority: TicketPriority;
  firstResponseHours: number;
  resolveHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSlaPolicyDto {
  priority: TicketPriority;
  firstResponseHours: number;
  resolveHours: number;
}

@Injectable({ providedIn: 'root' })
export class SlaPoliciesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sla-policies`;

  list(): Promise<SlaPolicy[]> {
    return firstValueFrom(this.http.get<SlaPolicy[]>(this.base));
  }

  upsert(dto: UpsertSlaPolicyDto): Promise<SlaPolicy> {
    return firstValueFrom(this.http.put<SlaPolicy>(this.base, dto));
  }
}
