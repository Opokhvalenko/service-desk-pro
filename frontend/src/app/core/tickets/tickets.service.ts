import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  CreateTicketDto,
  ListTicketsQuery,
  Ticket,
  TicketComment,
  TicketListResponse,
  TicketStatus,
  UpdateTicketDto,
} from './ticket.types';

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tickets`;

  list(query: ListTicketsQuery = {}): Promise<TicketListResponse> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return firstValueFrom(this.http.get<TicketListResponse>(this.base, { params }));
  }

  get(id: string): Promise<Ticket> {
    return firstValueFrom(this.http.get<Ticket>(`${this.base}/${id}`));
  }

  create(dto: CreateTicketDto): Promise<Ticket> {
    return firstValueFrom(this.http.post<Ticket>(this.base, dto));
  }

  update(id: string, dto: UpdateTicketDto): Promise<Ticket> {
    return firstValueFrom(this.http.patch<Ticket>(`${this.base}/${id}`, dto));
  }

  changeStatus(id: string, status: TicketStatus): Promise<Ticket> {
    return firstValueFrom(this.http.patch<Ticket>(`${this.base}/${id}/status`, { status }));
  }

  assign(id: string, assigneeId: string | null): Promise<Ticket> {
    return firstValueFrom(this.http.patch<Ticket>(`${this.base}/${id}/assign`, { assigneeId }));
  }

  addComment(id: string, body: string, isInternal = false): Promise<TicketComment> {
    return firstValueFrom(
      this.http.post<TicketComment>(`${this.base}/${id}/comments`, { body, isInternal }),
    );
  }
}
