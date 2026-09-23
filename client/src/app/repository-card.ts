import { Component, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { Repository } from './models';

// Both tabs use the same presentation contract; saving remains owned by the session workspace.
@Component({
  selector: 'app-repository-card',
  imports: [DatePipe, DecimalPipe, MatButtonModule],
  templateUrl: './repository-card.html',
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .avatar-fallback {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      flex-shrink: 0;
      border-radius: 50%;
      background: #e8eef5;
      color: #17334d;
    }
    .repository-card {
      height: 100%;
    }
  `,
})
export class RepositoryCard {
  // Retain the owner label when a remote avatar is missing or fails to load.
  readonly failedAvatar = signal<string | null>(null);
  readonly repo = input.required<Repository>();
  readonly saved = input(false);
  readonly saving = input(false);
  readonly showSave = input(true);
  readonly save = output<Repository>();
}
