import { Component, OnInit, OnDestroy, inject, signal, computed, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
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
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs';
import { RepositoryCard } from './repository-card';
import { Bookmarks } from './bookmarks';

@Component({
  selector: 'app-explorer',
  imports: [
    MatTabsModule,
    RepositoryCard,
    Bookmarks,
    FormsModule,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './explorer.html',
})
export class Explorer implements OnInit, OnDestroy {
  private readonly api = inject(RepositoryService);
  protected readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly subscriptions = new Subscription();
  private searchSubscription?: Subscription;
  readonly activeTab = signal(0);
  private readonly tabs = viewChild(MatTabGroup);
  readonly bookmarksLoading = signal(false);
  readonly bookmarksError = signal('');
  showSearch() {
    this.activeTab.set(0);
    // Restore keyboard focus to the tab, rather than a button in the panel being hidden.
    this.tabs()?.focusTab(0);
  }
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
  // Owned by this authenticated workspace; destroying it on logout drops all client bookmark state.
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
    this.loadBookmarks();
  }
  loadBookmarks() {
    if (this.bookmarksLoading()) return;
    this.bookmarksLoading.set(true);
    this.bookmarksError.set('');
    this.subscriptions.add(
      this.api.bookmarks().subscribe({
        // Preserve saves acknowledged while the initial snapshot was still loading.
        next: (items) => {
          this.bookmarks.update((saved) => [
            ...new Map([...items, ...saved].map((repo) => [repo.id, repo])).values(),
          ]);
          this.bookmarksLoading.set(false);
        },
        error: (error) => {
          this.bookmarksError.set(errorMessage(error));
          this.bookmarksLoading.set(false);
        },
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
