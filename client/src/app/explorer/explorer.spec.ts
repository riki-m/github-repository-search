import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Explorer } from './explorer';
import { AuthService } from '../auth/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { Bookmarks } from './bookmarks';
import { Repository } from '../models';

describe('Explorer', () => {
  let http: HttpTestingController;
  const openDialog = vi.fn();
  beforeEach(() => {
    sessionStorage.clear();
    openDialog.mockClear();
    TestBed.configureTestingModule({
      imports: [Explorer],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: openDialog } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    sessionStorage.clear();
  });
  function setup() {
    const fixture = TestBed.createComponent(Explorer);
    fixture.detectChanges();
    http.expectOne('/api/bookmarks').flush([]);
    return fixture;
  }
  it('uses submitted scope in help and keeps the navigation limit discoverable after showing it', () => {
    const fixture = setup();
    const c = fixture.componentInstance;
    TestBed.inject(AuthService).session.set({
      token: 'test',
      username: 'demo1',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    c.query = 'USER';
    c.nameOnly = true;
    c.search();
    c.nameOnly = false; // A pending edit must not change the advice for the in-flight search.
    http
      .expectOne('/api/repositories?q=USER&page=1&ranking=best-match&nameOnly=true')
      .flush({ items: [], totalCount: 2000, incompleteResults: false });
    expect(openDialog.mock.calls[0][1].data).toEqual({ nameOnly: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Only the first 1,000 matches are accessible',
    );
    expect(fixture.nativeElement.textContent).toContain('Showing');
  });
  it.each([0, 1, 30, 31, 999, 1000, 1001])(
    'keeps range, pages and cards aligned for %i matches',
    (total) => {
      const fixture = setup();
      const c = fixture.componentInstance;
      c.query = 'boundary';
      c.search();
      const items = (count: number) =>
        Array.from({ length: count }, (_, i) => ({ ...example, id: i + 1 }));
      http
        .expectOne('/api/repositories?q=boundary&page=1&ranking=best-match')
        .flush({ items: items(Math.min(total, 30)), totalCount: total, incompleteResults: total === 31 });
      expect(c.pageCount()).toBe(Math.ceil(Math.min(total, 1000) / 30));
      if (c.pageCount() > 1) {
        c.goToPage(c.pageCount());
        const count = Math.min(total, 1000) - (c.pageCount() - 1) * 30;
        http
          .expectOne(`/api/repositories?q=boundary&page=${c.pageCount()}&ranking=best-match`)
          .flush({ items: items(count), totalCount: total, incompleteResults: total === 31 });
        expect(c.results().length).toBe(count);
      }
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.repository-card').length).toBe(
        c.results().length,
      );
      expect(fixture.nativeElement.textContent.includes('Partial results returned.')).toBe(total === 31);
    const end = Math.min(total, 1000);
      const start = total ? (c.page() - 1) * 30 + 1 : 0;
      expect(fixture.nativeElement.querySelector('.result-summary').textContent).toContain(
        `Showing ${start}–${end}`,
      );
    },
  );
  it('labels retained results during a request and after failure', () => {
    const fixture = setup();
    const c = fixture.componentInstance;
    c.query = 'old';
    c.search();
    http
      .expectOne('/api/repositories?q=old&page=1&ranking=best-match')
      .flush({ items: [example], totalCount: 1, incompleteResults: false });
    c.query = 'new';
    c.search();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Previous successful results');
    http
      .expectOne('/api/repositories?q=new&page=1&ranking=best-match')
      .flush({}, { status: 502, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Previous successful results');
    expect(c.submittedQuery()).toBe('old');
    expect(c.results()).toEqual([example]);
  });
  it('explains the additional activity filters only when selected', async () => {
    const fixture = setup();
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector('select');
    select.value = 'inspiration';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('excluding archived repositories');
    select.value = 'best-match';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('excluding archived repositories');
  });
  it('opens help once after a broad successful search, not on errors, small results or later requests', () => {
    const c = setup().componentInstance;
    TestBed.inject(AuthService).session.set({
      token: 'test',
      username: 'demo1',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    c.query = 'USER';
    c.search();
    http
      .expectOne('/api/repositories?q=USER&page=1&ranking=best-match')
      .flush({}, { status: 502, statusText: 'Bad Gateway' });
    c.search();
    http
      .expectOne('/api/repositories?q=USER&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 30, incompleteResults: false });
    expect(openDialog).not.toHaveBeenCalled();
    c.search();
    http
      .expectOne('/api/repositories?q=USER&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 60, incompleteResults: false });
    expect(openDialog).toHaveBeenCalledTimes(1);
    c.goToPage(2);
    http
      .expectOne('/api/repositories?q=USER&page=2&ranking=best-match')
      .flush({ items: [], totalCount: 60, incompleteResults: false });
    c.search();
    http
      .expectOne('/api/repositories?q=USER&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 60, incompleteResults: false });
    expect(openDialog).toHaveBeenCalledTimes(1);
  });
  it('submits name-only scope, preserves it across pages and commits changes only on success', () => {
    const c = setup().componentInstance;
    expect(c.nameOnly).toBe(false);
    c.query = 'USER';
    c.nameOnly = true;
    c.search();
    http
      .expectOne('/api/repositories?q=USER&page=1&ranking=best-match&nameOnly=true')
      .flush({ items: [], totalCount: 100, incompleteResults: false });
    expect(c.submittedNameOnly()).toBe(true);
    c.nameOnly = false;
    c.goToPage(2);
    http
      .expectOne('/api/repositories?q=USER&page=2&ranking=best-match&nameOnly=true')
      .flush({ items: [], totalCount: 100, incompleteResults: false });
    c.search();
    http
      .expectOne('/api/repositories?q=USER&page=1&ranking=best-match')
      .flush({ detail: 'Try again' }, { status: 502, statusText: 'Bad Gateway' });
    expect(c.submittedNameOnly()).toBe(true);
    expect(c.page()).toBe(2);
    c.search();
    http
      .expectOne('/api/repositories?q=USER&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 100, incompleteResults: false });
    expect(c.submittedNameOnly()).toBe(false);
    expect(c.page()).toBe(1);
  });
  it('keeps ranking with its results and applies changed ranking only on a new search', () => {
    const c = setup().componentInstance;
    c.query = 'angular';
    c.search();
    http
      .expectOne('/api/repositories?q=angular&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 100, incompleteResults: false });
    c.ranking = 'inspiration';
    c.goToPage(2);
    http
      .expectOne('/api/repositories?q=angular&page=2&ranking=best-match')
      .flush({ items: [], totalCount: 100, incompleteResults: false });
    expect(c.submittedRanking()).toBe('best-match');
    c.search();
    http
      .expectOne('/api/repositories?q=angular&page=1&ranking=inspiration')
      .flush({ items: [], totalCount: 100, incompleteResults: false });
    expect(c.page()).toBe(1);
    expect(c.submittedRanking()).toBe('inspiration');
    c.ranking = 'updated';
    c.search();
    http
      .expectOne('/api/repositories?q=angular&page=1&ranking=updated')
      .flush({ detail: 'Try again' }, { status: 502, statusText: 'Bad Gateway' });
    expect(c.submittedRanking()).toBe('inspiration');
  });
  it('pages the submitted query and resets for a new query', () => {
    const c = setup().componentInstance;
    c.query = 'HILAN';
    c.search();
    http
      .expectOne('/api/repositories?q=HILAN&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 501, incompleteResults: false });
    c.query = 'unsent edit';
    c.goToPage(6);
    http
      .expectOne('/api/repositories?q=HILAN&page=6&ranking=best-match')
      .flush({ items: [], totalCount: 501, incompleteResults: false });
    expect(c.page()).toBe(6);
    c.search();
    http
      .expectOne('/api/repositories?q=unsent%20edit&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 0, incompleteResults: false });
    expect(c.page()).toBe(1);
    expect(c.pageCount()).toBe(0);
  });
  it('caps navigation and preserves the prior page on failure so it can be retried', () => {
    const c = setup().componentInstance;
    c.query = 'angular';
    c.search();
    http
      .expectOne('/api/repositories?q=angular&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 5000, incompleteResults: false });
    expect(c.pageCount()).toBe(34);
    c.goToPage(0);
    c.goToPage(35);
    http.expectNone((r) => r.url === '/api/repositories');
    c.goToPage(2);
    c.goToPage(3); // Ignore further page clicks while a request is in flight.
    http
      .expectOne('/api/repositories?q=angular&page=2&ranking=best-match')
      .flush({ detail: 'Wait before retrying' }, { status: 429, statusText: 'Too Many Requests' });
    expect(c.page()).toBe(1);
    expect(c.loading()).toBe(false);
    expect(c.error()).toBe('Wait before retrying');
    c.goToPage(2);
    http
      .expectOne('/api/repositories?q=angular&page=2&ranking=best-match')
      .flush({ items: [], totalCount: 5000, incompleteResults: false });
    expect(c.page()).toBe(2);
  });
  it('cancels a pending page when a new search starts', () => {
    const c = setup().componentInstance;
    c.query = 'HILAN';
    c.search();
    http
      .expectOne('/api/repositories?q=HILAN&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 501, incompleteResults: false });
    c.goToPage(2);
    const old = http.expectOne('/api/repositories?q=HILAN&page=2&ranking=best-match');
    c.query = 'HILAN-TEST';
    c.search();
    expect(old.cancelled).toBe(true);
    http
      .expectOne('/api/repositories?q=HILAN-TEST&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 3, incompleteResults: false });
    expect(c.submittedQuery()).toBe('HILAN-TEST');
    expect(c.page()).toBe(1);
  });
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
    const old = http.expectOne('/api/repositories?q=old&page=1&ranking=best-match');
    fixture.componentInstance.query = 'new';
    fixture.componentInstance.search();
    expect(old.cancelled).toBe(true);
    http
      .expectOne('/api/repositories?q=new&page=1&ranking=best-match')
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
  it('preserves new saves when the initial snapshot arrives late, without duplicates', () => {
    const fixture = TestBed.createComponent(Explorer);
    fixture.detectChanges();
    const initial = http.expectOne('/api/bookmarks');
    const repo = { id: 42 } as Parameters<Explorer['bookmark']>[0];
    fixture.componentInstance.bookmark(repo);
    http.expectOne('/api/bookmarks/42').flush(null);
    initial.flush([{ id: 7 }, repo]);
    expect(fixture.componentInstance.bookmarks().map((r) => r.id)).toEqual([7, 42]);
  });
  it('fetches the last valid page after totals shrink, preserving submitted scope', () => {
    const c = setup().componentInstance;
    c.query = 'HILAN';
    c.nameOnly = true;
    c.search();
    http
      .expectOne('/api/repositories?q=HILAN&page=1&ranking=best-match&nameOnly=true')
      .flush({ items: [], totalCount: 100, incompleteResults: false });
    c.query = 'unsent';
    c.nameOnly = false;
    c.goToPage(4);
    http
      .expectOne('/api/repositories?q=HILAN&page=4&ranking=best-match&nameOnly=true')
      .flush({ items: [], totalCount: 31, incompleteResults: false });
    expect(c.page()).toBe(1);
    http
      .expectOne('/api/repositories?q=HILAN&page=2&ranking=best-match&nameOnly=true')
      .flush({ items: [], totalCount: 31, incompleteResults: false });
    expect(c.page()).toBe(2);
    expect(c.pageCount()).toBe(2);
    expect(c.submittedNameOnly()).toBe(true);
  });
  it('bounds repeated shrink recovery and resets an empty later page', () => {
    const c = setup().componentInstance;
    c.query = 'test';
    c.search();
    http
      .expectOne('/api/repositories?q=test&page=1&ranking=best-match')
      .flush({ items: [], totalCount: 100, incompleteResults: false });
    c.goToPage(4);
    http
      .expectOne('/api/repositories?q=test&page=4&ranking=best-match')
      .flush({ items: [], totalCount: 61, incompleteResults: false });
    http
      .expectOne('/api/repositories?q=test&page=3&ranking=best-match')
      .flush({ items: [], totalCount: 31, incompleteResults: false });
    expect(c.error()).toContain('changed again');
    expect(c.loading()).toBe(false);
    expect(c.page()).toBe(1);
    expect(c.total()).toBe(100);
    c.goToPage(2);
    http
      .expectOne('/api/repositories?q=test&page=2&ranking=best-match')
      .flush({ items: [], totalCount: 0, incompleteResults: false });
    expect(c.page()).toBe(1);
    expect(c.pageCount()).toBe(0);
  });

  it('does not duplicate a bookmark when the snapshot arrives before its save acknowledgement', () => {
    const fixture = TestBed.createComponent(Explorer);
    fixture.detectChanges();
    const initial = http.expectOne('/api/bookmarks');
    const repo = { id: 42 } as Parameters<Explorer['bookmark']>[0];
    fixture.componentInstance.bookmark(repo);
    const save = http.expectOne('/api/bookmarks/42');
    initial.flush([repo]);
    save.flush(null);
    expect(fixture.componentInstance.bookmarks().length).toBe(1);
  });
  const example: Repository = {
    id: 42,
    name: 'example',
    full_name: 'owner/example',
    html_url: 'https://github.com/owner/example',
    description: 'Useful repository',
    language: 'TypeScript',
    stargazers_count: 12,
    forks_count: 3,
    owner: { login: 'owner', avatar_url: 'https://example.com/avatar.png' },
  };
  async function openBookmarks(fixture: ReturnType<typeof setup>) {
    fixture.componentInstance.activeTab.set(1);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(Bookmarks));
  }
  it('distinguishes bookmark loading, error and empty states and supports retry', async () => {
    const fixture = TestBed.createComponent(Explorer);
    fixture.detectChanges();
    const request = http.expectOne('/api/bookmarks');
    let panel = await openBookmarks(fixture);
    expect(panel.nativeElement.textContent).toContain('Loading your collection');
    expect(panel.nativeElement.textContent).not.toContain('Your collection starts here');
    request.flush({ detail: 'Unavailable' }, { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();
    expect(panel.nativeElement.textContent).toContain('Could not load your collection');
    expect(panel.nativeElement.textContent).not.toContain('Your collection starts here');
    panel.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    http.expectOne('/api/bookmarks').flush([]);
    fixture.detectChanges();
    expect(panel.nativeElement.textContent).toContain('Your collection starts here');
    panel.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeTab()).toBe(0);
  });
  it('shows complete saved cards only after acknowledgement and preserves search across tabs', async () => {
    const fixture = setup();
    const c = fixture.componentInstance;
    c.query = 'example';
    c.nameOnly = true;
    c.search();
    http
      .expectOne('/api/repositories?q=example&page=1&ranking=best-match&nameOnly=true')
      .flush({ items: [example], totalCount: 60, incompleteResults: false });
    c.goToPage(2);
    http
      .expectOne('/api/repositories?q=example&page=2&ranking=best-match&nameOnly=true')
      .flush({ items: [example], totalCount: 60, incompleteResults: false });
    c.query = 'pending edit';
    c.bookmark(example);
    const save = http.expectOne('/api/bookmarks/42');
    const panel = await openBookmarks(fixture);
    expect(panel.nativeElement.querySelectorAll('.repository-card').length).toBe(0);
    save.flush(null);
    fixture.detectChanges();
    expect(panel.nativeElement.querySelectorAll('.repository-card').length).toBe(1);
    expect(panel.nativeElement.textContent).toContain('Useful repository');
    expect(panel.nativeElement.textContent).toContain('12 stars');
    expect(panel.nativeElement.querySelector('a').href).toBe(example.html_url);
    expect(panel.nativeElement.querySelector('img').alt).toBe('owner avatar');
    expect(panel.nativeElement.querySelectorAll('.repository-card button').length).toBe(0);
    c.showSearch();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(c.query).toBe('pending edit');
    expect(c.page()).toBe(2);
    expect(c.submittedQuery()).toBe('example');
    expect(c.submittedNameOnly()).toBe(true);
    expect(c.results()).toEqual([example]);
    http.expectNone((r) => r.url === '/api/repositories' || r.url === '/api/bookmarks');
  });
  it('keeps failed saves out of the collection and restores saved cards on a new workspace load', async () => {
    let fixture = setup();
    fixture.componentInstance.bookmark(example);
    http.expectOne('/api/bookmarks/42').flush({}, { status: 500, statusText: 'Error' });
    let panel = await openBookmarks(fixture);
    expect(panel.nativeElement.querySelectorAll('.repository-card').length).toBe(0);
    fixture.destroy();
    fixture = TestBed.createComponent(Explorer);
    fixture.detectChanges();
    http.expectOne('/api/bookmarks').flush([example]);
    panel = await openBookmarks(fixture);
    expect(panel.nativeElement.querySelectorAll('.repository-card').length).toBe(1);
    fixture.destroy();
    fixture = setup();
    panel = await openBookmarks(fixture);
    expect(panel.nativeElement.querySelectorAll('.repository-card').length).toBe(0);
  });
});
