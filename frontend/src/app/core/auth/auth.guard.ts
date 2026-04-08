import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';
import type { UserRole } from './auth.types';

export const authGuard: CanActivateFn = async () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (store.isAuthenticated()) return true;

  // Try silent refresh via httpOnly cookie
  const refreshed = await store.refresh();
  if (refreshed) return true;

  return router.createUrlTree(['/login']);
};

export const roleGuard = (allowed: UserRole[]): CanActivateFn => {
  return () => {
    const store = inject(AuthStore);
    const router = inject(Router);
    const role = store.role();
    if (role && allowed.includes(role)) return true;
    return router.createUrlTree(['/tickets']);
  };
};

export const guestGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (store.isAuthenticated()) return router.createUrlTree(['/tickets']);
  return true;
};
