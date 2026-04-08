import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { AuthService } from './auth.service';
import type { AuthUser, LoginCredentials, UserRole } from './auth.types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  loading: false,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    isAuthenticated: computed(() => state.user() !== null && state.accessToken() !== null),
    role: computed<UserRole | null>(() => state.user()?.role ?? null),
  })),
  withMethods((store, auth = inject(AuthService), router = inject(Router)) => ({
    async login(credentials: LoginCredentials): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const response = await auth.login(credentials);
        patchState(store, {
          user: response.user,
          accessToken: response.accessToken,
          loading: false,
        });
        const role = response.user.role;
        const landing = role === 'ADMIN' || role === 'TEAM_LEAD' ? '/dashboard' : '/tickets';
        await router.navigate([landing]);
      } catch (err) {
        patchState(store, {
          loading: false,
          error: err instanceof Error ? err.message : 'Login failed',
        });
        throw err;
      }
    },

    async refresh(): Promise<boolean> {
      try {
        const response = await auth.refresh();
        patchState(store, { user: response.user, accessToken: response.accessToken });
        return true;
      } catch {
        patchState(store, { user: null, accessToken: null });
        return false;
      }
    },

    async logout(): Promise<void> {
      try {
        await auth.logout();
      } catch {
        // ignore — clear state regardless
      }
      patchState(store, { user: null, accessToken: null, error: null });
      await router.navigate(['/login']);
    },

    setSession(user: AuthUser, accessToken: string): void {
      patchState(store, { user, accessToken, error: null });
    },

    clearError(): void {
      patchState(store, { error: null });
    },
  })),
);
