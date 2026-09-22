import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Explorer } from './explorer';

describe('Explorer', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Explorer],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify({ ignoreCancelled: true }));
  function setup() {
    const fixture = TestBed.createComponent(Explorer);
    fixture.detectChanges();
    http.expectOne('/api/bookmarks').flush([]);
    return fixture;
  }
  it('does not send blank searches', () => {
    const fixture = setup();
    fixture.componentInstance.query = '   ';
    fixture.componentInstance.search();
    http.expectNone((request) => request.url === '/api/repositories');
  });
  it('cancels stale searches and keeps the newest response', () => {
    const fixture = setup();
    fixture.componentInstance.query = 'old';
    fixture.componentInstance.search();
    const old = http.expectOne('/api/repositories?q=old');
    fixture.componentInstance.query = 'new';
    fixture.componentInstance.search();
    expect(old.cancelled).toBe(true);
    http
      .expectOne('/api/repositories?q=new')
      .flush({ items: [], totalCount: 0, incompleteResults: false });
    expect(fixture.componentInstance.submittedQuery()).toBe('new');
  });
  it('shows a bookmark as saved only after the server accepts it', () => {
    const fixture = setup();
    const repo = {
      id: 42,
      name: 'example',
      full_name: 'owner/example',
      html_url: 'https://github.com/owner/example',
      description: null,
      language: null,
      stargazers_count: 0,
      owner: { login: 'owner', avatar_url: '' },
    };
    fixture.componentInstance.bookmark(repo);
    expect(fixture.componentInstance.savedIds().has(42)).toBe(false);
    http.expectOne('/api/bookmarks/42').flush(null);
    expect(fixture.componentInstance.savedIds().has(42)).toBe(true);
    fixture.componentInstance.bookmark(repo);
    http.expectNone('/api/bookmarks/42');
  });
  it('restores the save button after a failed bookmark', () => {
    const fixture = setup();
    const repo = {
      id: 42,
      name: 'example',
      full_name: 'owner/example',
      html_url: 'https://github.com/owner/example',
      description: null,
      language: null,
      stargazers_count: 0,
      owner: { login: 'owner', avatar_url: '' },
    };
    fixture.componentInstance.bookmark(repo);
    http
      .expectOne('/api/bookmarks/42')
      .flush({ detail: 'Search again' }, { status: 404, statusText: 'Not Found' });
    expect(fixture.componentInstance.savedIds().has(42)).toBe(false);
    expect(fixture.componentInstance.saving().has(42)).toBe(false);
    expect(fixture.componentInstance.error()).toBe('Search again');
  });
});
