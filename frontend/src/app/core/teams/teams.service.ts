import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { UserRole } from '../auth/auth.types';

export interface TeamLead {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface AdminTeam {
  id: string;
  name: string;
  description: string | null;
  leadId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lead: TeamLead | null;
  _count: { members: number; tickets: number };
}

export interface CreateTeamDto {
  name: string;
  description?: string;
  leadId?: string;
  isActive?: boolean;
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
  leadId?: string | null;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/teams`;

  list(): Promise<AdminTeam[]> {
    return firstValueFrom(this.http.get<AdminTeam[]>(this.base));
  }

  create(dto: CreateTeamDto): Promise<AdminTeam> {
    return firstValueFrom(this.http.post<AdminTeam>(this.base, dto));
  }

  update(id: string, dto: UpdateTeamDto): Promise<AdminTeam> {
    return firstValueFrom(this.http.patch<AdminTeam>(`${this.base}/${id}`, dto));
  }

  deactivate(id: string): Promise<AdminTeam> {
    return firstValueFrom(this.http.delete<AdminTeam>(`${this.base}/${id}`));
  }
}
