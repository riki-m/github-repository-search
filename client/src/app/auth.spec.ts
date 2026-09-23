import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('Search help login lifetime', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
