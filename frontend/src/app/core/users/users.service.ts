import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { UserRole } from '../auth/auth.types';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserDto {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  isActive?: boolean;
}

export interface UpdateUserDto {
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  list(): Promise<AdminUser[]> {
    return firstValueFrom(this.http.get<AdminUser[]>(this.base));
  }

  create(dto: CreateUserDto): Promise<AdminUser> {
    return firstValueFrom(this.http.post<AdminUser>(this.base, dto));
  }

  update(id: string, dto: UpdateUserDto): Promise<AdminUser> {
    return firstValueFrom(this.http.patch<AdminUser>(`${this.base}/${id}`, dto));
  }

  deactivate(id: string): Promise<AdminUser> {
    return firstValueFrom(this.http.delete<AdminUser>(`${this.base}/${id}`));
  }
}
