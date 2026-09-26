import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Repository } from '../models';
import { RepositoryCard } from './repository-card';

@Component({
  selector: 'app-bookmarks',
  imports: [MatButtonModule, MatProgressBarModule, RepositoryCard],
  template: `
    <section class="tab-content" aria-labelledby="bookmarks-heading" [attr.aria-busy]="loading()">
      <div class="collection-heading">
        <span class="eyebrow">YOUR COLLECTION</span>
        <h1 id="bookmarks-heading">Worth <span>coming back to.</span></h1>
        <p class="muted">Your saved repositories, together in one place.</p>
      </div>
      <div class="results-bar">
        <h2>Bookmarks</h2>
        @if (!loading() && !error()) {
          <span class="collection-count" role="status">{{ items().length }} saved</span>
        }
      </div>
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading bookmarks" />
        <p class="muted" role="status">Loading your collection…</p>
      } @else if (error()) {
        <div class="collection-error">
          <p class="error" role="alert">Could not load your collection. {{ error() }}</p>
          <button mat-stroked-button (click)="retry.emit()">Try again</button>
        </div>
      } @else if (items().length === 0) {
        <div class="empty-state collection-empty">
          <span class="empty-icon" aria-hidden="true">☆</span>
          <h2>Your collection starts here</h2>
          <p>Find a repository you like and select Bookmark to keep it here.</p>
          <button mat-flat-button (click)="browse.emit()">Explore repositories</button>
        </div>
      }
      <div class="repository-grid">
        @for (repo of items(); track repo.id) {
          <app-repository-card [repo]="repo" [showSave]="false" />
        }
      </div>
      <p class="fine-print">
        Saved for this session. Signing out starts a fresh collection next time.
      </p>
    </section>
  `,
})
export class Bookmarks {
  readonly items = input.required<Repository[]>();
  readonly loading = input(false);
  readonly error = input('');
  readonly retry = output<void>();
  readonly browse = output<void>();
}
