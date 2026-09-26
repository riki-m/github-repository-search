import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService, authInterceptor } from './auth.service';

describe('Search help login lifetime', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    sessionStorage.clear();
  });
  function login(auth: AuthService) {
    auth.login('demo1', 'password').subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/login')
      .flush({
        token: 'test-token',
        username: 'demo1',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
  }
  it.each([
    '{broken',
    'null',
    '{}',
    '{"token":42}',
    JSON.stringify({ token: '', username: 'demo1', expiresAt: '2099-01-01' }),
    JSON.stringify({ token: 'x', username: 'demo1', expiresAt: '2000-01-01' }),
  ])('discards damaged or expired storage: %s', (stored) => {
    sessionStorage.setItem('repository-search-session', stored);
    expect(TestBed.inject(AuthService).session()).toBeNull();
    expect(sessionStorage.getItem('repository-search-session')).toBeNull();
  });
  it('attaches the JWT only to protected local API calls and clears rejected sessions', () => {
    const auth = TestBed.inject(AuthService);
    login(auth);
    const client = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    client.get('https://example.com/public').subscribe();
    const external = http.expectOne('https://example.com/public');
    expect(external.request.headers.has('Authorization')).toBe(false);
    external.flush({});
    client.get('/api/bookmarks').subscribe({ error: () => {} });
    const protectedRequest = http.expectOne('/api/bookmarks');
    expect(protectedRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    protectedRequest.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.session()).toBeNull();
    expect(sessionStorage.getItem('repository-search-session')).toBeNull();
  });
  it('remembers the popup across service recreation and resets after a new login', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.claimSearchHelp()).toBe(false);
    login(auth);
    expect(auth.claimSearchHelp()).toBe(true);
    expect(auth.claimSearchHelp()).toBe(false);
    // Recreating the service models a refresh restoring the same stored login.
    const restored = TestBed.runInInjectionContext(() => new AuthService());
    expect(restored.claimSearchHelp()).toBe(false);
    restored.clear();
    expect(restored.claimSearchHelp()).toBe(false);
    login(restored);
    expect(restored.claimSearchHelp()).toBe(true);
  });
});
