import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AuthResponse, LoginCredentials } from './auth.types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auth`;

  login(credentials: LoginCredentials): Promise<AuthResponse> {
    return firstValueFrom(
      this.http.post<AuthResponse>(`${this.base}/login`, credentials, { withCredentials: true }),
    );
  }

  refresh(): Promise<AuthResponse> {
    return firstValueFrom(
      this.http.post<AuthResponse>(`${this.base}/refresh`, {}, { withCredentials: true }),
    );
  }

  logout(): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.base}/logout`, {}, { withCredentials: true }),
    );
  }

  me(): Promise<{ user: AuthResponse['user'] }> {
    return firstValueFrom(this.http.post<{ user: AuthResponse['user'] }>(`${this.base}/me`, {}));
  }
}
