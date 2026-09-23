import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subscription } from 'rxjs';
import { RepositoryService } from './repository.service';
import { AuthService, errorMessage } from './auth.service';
import { MatDialog } from '@angular/material/dialog';
import { SearchHelp } from './search-help';
import { Repository } from './models';

@Component({
  selector: 'app-explorer',
  imports: [
    FormsModule,
    DecimalPipe,
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  template: ` <section class="explore-heading">
      <span class="eyebrow">DISCOVER OPEN SOURCE</span>
      <h1>Find your next<br /><span>great repository.</span></h1>
      <p class="muted">Search GitHub. Save what matters. Keep exploring.</p>
    </section>
    <form class="search-form" (ngSubmit)="search()">
      <mat-form-field class="query-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Search repositories</mat-label>
        <input
          matInput
          name="query"
          [(ngModel)]="query"
          maxlength="200"
          placeholder="e.g. angular, dotnet, machine learning"
          autocomplete="off"
        />
      </mat-form-field>
      <mat-form-field class="ranking-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Sort results</mat-label>
        <select matNativeControl name="ranking" [(ngModel)]="ranking">
          @for (mode of rankingModes; track mode.value) {
            <option [value]="mode.value">{{ mode.label }}</option>
          }
        </select>
      </mat-form-field>
      <button mat-flat-button type="submit" [disabled]="!query.trim() || loading()">
        Search ↗
      </button>
      <label class="name-only-option">
        <input type="checkbox" name="nameOnly" [(ngModel)]="nameOnly" />
        Repository name only
      </label>
    </form>
    <div class="results-bar">
      <h2>Search results</h2>
      <span class="muted" aria-live="polite">{{ bookmarks().length }} bookmarked</span>
    </div>
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" aria-label="Searching GitHub" />
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (searched() && !loading()) {
      <p class="result-summary" role="status">
        Showing {{ results().length ? (page() - 1) * 30 + 1 : 0 }}–{{
          results().length ? (page() - 1) * 30 + results().length : 0
        }}
        of {{ total() | number }} results for “{{ submittedQuery() }}” ·
        {{ rankingLabel(submittedRanking()) }}
        @if (submittedNameOnly()) {
          · Name only
        }
      </p>
      @if (total() > 1000 && !auth.searchHelpSeen()) {
        <p class="muted">First 1,000 matches available.</p>
      }
      @if (incomplete()) {
        <p class="muted">Partial results returned.</p>
      }
    }
    @if (searched() && pageCount() > 1) {
      <nav class="pagination" aria-label="Search result pages">
        <button mat-stroked-button [disabled]="loading() || page() === 1" (click)="goToPage(1)">
          First
        </button>
        <button
          mat-stroked-button
          [disabled]="loading() || page() === 1"
          (click)="goToPage(page() - 1)"
        >
          Previous
        </button>
        <span aria-live="polite">Page {{ page() }} of {{ pageCount() }}</span>
        <button
          mat-stroked-button
          [disabled]="loading() || page() >= pageCount()"
          (click)="goToPage(page() + 1)"
        >
          Next
        </button>
        <button
          mat-stroked-button
          [disabled]="loading() || page() >= pageCount()"
          (click)="goToPage(pageCount())"
        >
          Last
        </button>
      </nav>
    }
    @if (!searched() && !loading()) {
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">⌕</span>
        <h2>A world of code awaits</h2>
        <p>Enter a keyword above to discover your next project.</p>
      </div>
    } @else if (searched() && results().length === 0 && !loading() && !error()) {
      <div class="empty-state">
        <h2>No repositories found</h2>
        <p>Try another keyword or Default.</p>
      </div>
    }
    <div class="repository-grid">
      @for (repo of results(); track repo.id) {
        <article class="repository-card">
          <div class="repo-top">
            <img
              [src]="repo.owner.avatar_url"
              [alt]="repo.owner.login + ' avatar'"
              width="42"
              height="42"
              loading="lazy"
              referrerpolicy="no-referrer"
            /><span>{{ repo.owner.login }}</span>
          </div>
          <h3>
            <a [href]="repo.html_url" target="_blank" rel="noopener noreferrer"
              >{{ repo.name }} <span aria-hidden="true">↗</span></a
            >
          </h3>
          <p class="repo-description">{{ repo.description || 'No description provided.' }}</p>
          <div class="repo-meta">
            <span><span class="language-dot"></span>{{ repo.language || 'Repository' }}</span
            ><span>☆ {{ repo.stargazers_count | number }} stars</span>
            <span>{{ repo.forks_count ?? 0 | number }} forks</span>
          </div>
          <p class="muted">
            Last push:
            {{ repo.pushed_at ? (repo.pushed_at | date: 'mediumDate' : 'UTC') : 'Not available' }}
            @if (repo.archived) {
              <strong> · Archived</strong>
            }
          </p>
          <button
            mat-stroked-button
            type="button"
            [disabled]="savedIds().has(repo.id) || saving().has(repo.id)"
            (click)="bookmark(repo)"
          >
            {{
              savedIds().has(repo.id)
                ? '✓ Bookmarked'
                : saving().has(repo.id)
                  ? 'Saving…'
                  : '+ Bookmark'
            }}
          </button>
        </article>
      }
    </div>`,
})
export class Explorer implements OnInit, OnDestroy {
  private readonly api = inject(RepositoryService);
  protected readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly subscriptions = new Subscription();
  private searchSubscription?: Subscription;
  query = '';
  nameOnly = false;
  // Separate pending input from the scope that produced the displayed results.
  readonly submittedNameOnly = signal(false);
  // Start without extra activity/archive restrictions so discovery includes older matches.
  // Ranking and query are submitted together; changing the selector alone sends no request.
  ranking = 'best-match';
  readonly submittedRanking = signal('best-match');
  // Three distinct choices: relevance, popularity with activity filters, and recency.
  readonly rankingModes = [
    { value: 'best-match', label: 'Default' },
    { value: 'inspiration', label: 'Popular & active' },
    { value: 'updated', label: 'Recently updated' },
  ];
  rankingLabel(mode: string) {
    return this.rankingModes.find((m) => m.value === mode)?.label ?? mode;
  }
  readonly results = signal<Repository[]>([]);
  readonly bookmarks = signal<Repository[]>([]);
  readonly savedIds = computed(() => new Set(this.bookmarks().map((r) => r.id)));
  readonly saving = signal(new Set<number>());
  readonly loading = signal(false);
  readonly error = signal('');
  readonly searched = signal(false);
  readonly total = signal(0);
  readonly incomplete = signal(false);
  readonly submittedQuery = signal('');
  readonly page = signal(1);
  // GitHub search exposes at most 1,000 results, even when total_count is larger.
  readonly pageCount = computed(() => Math.ceil(Math.min(this.total(), 1000) / 30));
  ngOnInit() {
    this.subscriptions.add(
      this.api.bookmarks().subscribe({
        // Preserve saves acknowledged while the initial snapshot was still loading.
        next: (items) =>
          this.bookmarks.update((saved) => [
            ...new Map([...items, ...saved].map((repo) => [repo.id, repo])).values(),
          ]),
        error: (error) => this.error.set(errorMessage(error)),
      }),
    );
  }
  search() {
    const query = this.query.trim();
    if (!query || query.length > 200) return;
    this.loadPage(query, 1, this.ranking, this.nameOnly);
  }
  goToPage(page: number) {
    if (this.loading() || page < 1 || page > this.pageCount() || page === this.page()) return;
    // Use the submitted query, not edits still in the input. New searches always start at page 1.
    this.loadPage(this.submittedQuery(), page, this.submittedRanking(), this.submittedNameOnly());
  }
  private loadPage(
    query: string,
    page: number,
    ranking: string,
    nameOnly: boolean,
    recovering = false,
  ) {
    // Cancel the prior subscription so a stale response cannot replace newer results.
    this.searchSubscription?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    // Commit page and results together only on success; failures leave the previous page usable.
    this.searchSubscription = this.api.search(query, page, ranking, nameOnly).subscribe({
      next: (response) => {
        const lastPage = Math.max(1, Math.ceil(Math.min(response.totalCount, 1000) / 30));
        if (response.totalCount > 0 && page > lastPage) {
          // Fetch a valid page once when totals shrink; never just relabel old cards.
          if (recovering) {
            this.error.set('Search results changed again. Please search again.');
            this.loading.set(false);
          } else {
            this.loadPage(query, lastPage, ranking, nameOnly, true);
          }
          return;
        }
        this.results.set(response.items);
        this.total.set(response.totalCount);
        this.incomplete.set(response.incompleteResults);
        this.submittedQuery.set(query);
        // Commit the ranking with its results; unsent selector edits cannot relabel an old page.
        this.submittedRanking.set(ranking);
        this.submittedNameOnly.set(nameOnly);
        this.page.set(response.totalCount === 0 ? 1 : page);
        this.searched.set(true);
        this.loading.set(false);
        // Only the first successful multi-page search per login interrupts with guidance.
        // Do not consume the flag on failures, small searches or page navigation.
        if (page === 1 && response.totalCount > 30 && this.auth.claimSearchHelp()) {
          // Use the scope that produced these results, not any pending checkbox edits.
          this.dialog.open(SearchHelp, {
            width: '440px',
            maxWidth: 'calc(100vw - 32px)',
            data: { nameOnly },
          });
        }
      },
      error: (error) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }
  bookmark(repo: Repository) {
    if (this.savedIds().has(repo.id) || this.saving().has(repo.id)) return;
    this.saving.update((ids) => new Set([...ids, repo.id]));
    this.error.set('');
    this.subscriptions.add(
      this.api.bookmark(repo.id).subscribe({
        next: () => {
          this.bookmarks.update((items) => [...items.filter((item) => item.id !== repo.id), repo]);
          this.finishSaving(repo.id);
        },
        error: (error) => {
          this.error.set(errorMessage(error));
          this.finishSaving(repo.id);
        },
      }),
    );
  }
  private finishSaving(id: number) {
    this.saving.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }
  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
    this.subscriptions.unsubscribe();
  }
}
