import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from './auth.store';

const REFRESH_PATH = `${environment.apiUrl}/auth/refresh`;
const LOGIN_PATH = `${environment.apiUrl}/auth/login`;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const token = store.accessToken();

  // Skip auth header for login/refresh
  const isAuthEndpoint = req.url === REFRESH_PATH || req.url === LOGIN_PATH;
  const authReq =
    token && !isAuthEndpoint
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !isAuthEndpoint && token) {
        return from(store.refresh()).pipe(
          switchMap((ok) => {
            if (!ok) return throwError(() => err);
            const newToken = store.accessToken();
            const retried = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next(retried);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
