import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthService, authInterceptor } from './auth/auth.service';

describe('Sign out privacy', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.login('demo1', 'Demo1!Pass').subscribe();
    http.expectOne('/api/auth/login').flush({
      token: 'test-token',
      username: 'demo1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  });

  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('clears the token even if the server is unreachable and reports unconfirmed revocation', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.signOut();
    const request = http.expectOne('/api/auth/logout');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.error(new ProgressEvent('error'));
    expect(auth.session()).toBeNull();
    expect(sessionStorage.getItem('repository-search-session')).toBeNull();
    expect(app.error()).toContain('could not be confirmed');
  });

  it('clears local authentication when sign out succeeds', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.signOut();
    http.expectOne('/api/auth/logout').flush(null);
    expect(auth.session()).toBeNull();
    expect(app.error()).toBe('');
  });

  it('does not keep a token indefinitely if the sign out request hangs', () => {
    vi.useFakeTimers();
    const app = TestBed.createComponent(App).componentInstance;
    app.signOut();
    const request = http.expectOne('/api/auth/logout');
    vi.advanceTimersByTime(5001);
    expect(request.cancelled).toBe(true);
    expect(auth.session()).toBeNull();
    expect(app.signingOut()).toBe(false);
  });
  it('clears the old warning after a new login', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.signOut();
    http.expectOne('/api/auth/logout').error(new ProgressEvent('error'));
    TestBed.tick();
    expect(fixture.componentInstance.error()).toContain('could not be confirmed');
    auth.login('demo2', 'Demo2!Pass').subscribe();
    http
      .expectOne('/api/auth/login')
      .flush({
        token: 'new-token',
        username: 'demo2',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });
    TestBed.tick();
    http.expectOne('/api/bookmarks').flush([]);
    expect(fixture.componentInstance.error()).toBe('');
  });
});
