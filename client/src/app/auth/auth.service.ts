import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, tap, throwError, timeout } from 'rxjs';
import { LoginResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly stored = this.restore();
  readonly session = signal<LoginResponse | null>(this.stored);
  private readonly helpSeen = signal(
    !!this.stored && sessionStorage.getItem('repository-search-help-seen') === 'true',
  );
  readonly searchHelpSeen = this.helpSeen.asReadonly();
  // A UI-only flag follows this tab's login lifetime, including refreshes. No query is stored.
  claimSearchHelp(): boolean {
    if (!this.session() || this.helpSeen()) return false;
    sessionStorage.setItem('repository-search-help-seen', 'true');
    this.helpSeen.set(true);
    return true;
  }
  login(username: string, password: string) {
    return this.http.post<LoginResponse>('/api/auth/login', { username, password }).pipe(
      tap((session) => {
        sessionStorage.removeItem('repository-search-help-seen');
        this.helpSeen.set(false);
        sessionStorage.setItem('repository-search-session', JSON.stringify(session));
        this.session.set(session);
      }),
    );
  }
  logout() {
    return this.http.post<void>('/api/auth/logout', {}).pipe(timeout(5000));
  }
  clear() {
    this.helpSeen.set(false);
    sessionStorage.removeItem('repository-search-help-seen');
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
        value.token.trim().length > 0 &&
        typeof value.username === 'string' &&
        value.username.trim().length > 0 &&
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
