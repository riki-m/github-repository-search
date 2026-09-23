import { Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { Repository } from './models';

// Both tabs use the same presentation contract; saving remains owned by the session workspace.
@Component({
  selector: 'app-repository-card',
  imports: [DatePipe, DecimalPipe, MatButtonModule],
  template: ` <article class="repository-card">
    <div class="repo-top">
      <img
        [src]="repo().owner.avatar_url"
        [alt]="repo().owner.login + ' avatar'"
        width="42"
        height="42"
        loading="lazy"
        referrerpolicy="no-referrer"
      /><span>{{ repo().owner.login }}</span>
    </div>
    <h3>
      <a [href]="repo().html_url" target="_blank" rel="noopener noreferrer"
        >{{ repo().name }} <span aria-hidden="true">↗</span></a
      >
    </h3>
    <p class="repo-description">{{ repo().description || 'No description provided.' }}</p>
    <div class="repo-meta">
      <span><span class="language-dot"></span>{{ repo().language || 'Repository' }}</span
      ><span>☆ {{ repo().stargazers_count | number }} stars</span>
      <span>{{ repo().forks_count ?? 0 | number }} forks</span>
    </div>
    <p class="muted">
      Last push:
      {{ repo().pushed_at ? (repo().pushed_at | date: 'mediumDate' : 'UTC') : 'Not available' }}
      @if (repo().archived) {
        <strong> · Archived</strong>
      }
    </p>
    @if (showSave()) {
      <button
        mat-stroked-button
        type="button"
        [disabled]="saved() || saving()"
        (click)="save.emit(repo())"
      >
        {{ saved() ? '✓ Bookmarked' : saving() ? 'Saving…' : '+ Bookmark' }}
      </button>
    } @else {
      <span class="saved-marker">✓ Saved to your collection</span>
    }
  </article>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .repository-card {
      height: 100%;
    }
  `,
})
export class RepositoryCard {
  readonly repo = input.required<Repository>();
  readonly saved = input(false);
  readonly saving = input(false);
  readonly showSave = input(true);
  readonly save = output<Repository>();
}
