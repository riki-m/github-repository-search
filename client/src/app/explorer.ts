import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subscription } from 'rxjs';
import { RepositoryService } from './repository.service';
import { errorMessage } from './auth.service';
import { Repository } from './models';

@Component({
  selector: 'app-explorer',
  imports: [
    FormsModule,
    DecimalPipe,
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
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
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
      <button mat-flat-button type="submit" [disabled]="!query.trim() || loading()">
        Search ↗
      </button>
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
        Showing {{ results().length }} of {{ total() | number }} results for “{{
          submittedQuery()
        }}”.
      </p>
      @if (incomplete()) {
        <p class="muted">GitHub returned partial results. Try a more specific search.</p>
      }
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
        <p>Try another name or a broader keyword.</p>
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
            ><span>☆ {{ repo.stargazers_count | number }}</span>
          </div>
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
  private readonly subscriptions = new Subscription();
  private searchSubscription?: Subscription;
  query = '';
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
  ngOnInit() {
    this.subscriptions.add(
      this.api.bookmarks().subscribe({
        next: (items) => this.bookmarks.set(items),
        error: (error) => this.error.set(errorMessage(error)),
      }),
    );
  }
  search() {
    const query = this.query.trim();
    if (!query || query.length > 200) return;
    // Cancel the prior subscription so a stale response cannot replace newer results.
    this.searchSubscription?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.results.set([]);
    this.searched.set(false);
    this.searchSubscription = this.api.search(query).subscribe({
      next: (response) => {
        this.results.set(response.items);
        this.total.set(response.totalCount);
        this.incomplete.set(response.incompleteResults);
        this.submittedQuery.set(query);
        this.searched.set(true);
        this.loading.set(false);
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
          this.bookmarks.update((items) => [...items, repo]);
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
