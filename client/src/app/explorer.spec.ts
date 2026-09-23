import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Explorer } from './explorer';
import { AuthService } from './auth.service';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';

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
  it('uses submitted scope in help and removes the repeated limit notice after showing it', () => {
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
    expect(fixture.nativeElement.textContent).not.toContain('First 1,000 matches available');
    expect(fixture.nativeElement.textContent).toContain('Showing');
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
});
