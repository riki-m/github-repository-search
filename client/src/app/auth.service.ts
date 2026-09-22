import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, tap, throwError } from 'rxjs';
import { LoginResponse } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly stored = this.restore();
  readonly session = signal<LoginResponse | null>(this.stored);
  login(username: string, password: string) {
    return this.http.post<LoginResponse>('/api/auth/login', { username, password }).pipe(
      tap((session) => {
        sessionStorage.setItem('repository-search-session', JSON.stringify(session));
        this.session.set(session);
      }),
    );
  }
  logout() {
    return this.http.post<void>('/api/auth/logout', {});
  }
  clear() {
    sessionStorage.removeItem('repository-search-session');
    this.session.set(null);
  }
  private restore(): LoginResponse | null {
    try {
      const value = JSON.parse(
        sessionStorage.getItem('repository-search-session') ?? 'null',
      ) as LoginResponse | null;
      if (
        value &&
        typeof value.token === 'string' &&
        typeof value.username === 'string' &&
        Date.parse(value.expiresAt) > Date.now()
      )
        return value;
    } catch {
      /* A damaged browser entry must not prevent signing in again. */
    }
    sessionStorage.removeItem('repository-search-session');
    return null;
  }
}
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.session()?.token;
  const isProtectedApi = request.url.startsWith('/api/') && request.url !== '/api/auth/login';
  const outgoing =
    token && isProtectedApi
      ? request.clone({ setHeaders: { Authorization: 'Bearer ' + token } })
      : request;
  return next(outgoing).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isProtectedApi) auth.clear();
      return throwError(() => error);
    }),
  );
};
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return 'Your session ended. Please sign in again.';
    if (error.status === 0) return 'Cannot reach the server. Check that it is running.';
    return error.error?.detail ?? 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
