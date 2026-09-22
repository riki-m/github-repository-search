import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { AuthService, errorMessage } from './auth.service';
@Component({
  selector: 'app-login',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: ` <section class="login-layout">
    <div class="welcome">
      <span class="eyebrow">YOUR NEXT DISCOVERY</span>
      <h1>Great projects.<br /><span>Worth keeping.</span></h1>
      <p>
        Explore GitHub repositories and keep the ones that inspire you, all in one focused
        workspace.
      </p>
      <div class="feature-note">
        <span class="note-icon">↗</span>
        <div>
          <strong>Find it. Save it. Build on it.</strong>
          <p>Search millions of public repositories.</p>
        </div>
      </div>
    </div>
    <form class="login-panel" (ngSubmit)="signIn()">
      <span class="eyebrow">WELCOME TO REPO FINDER</span>
      <h2>Sign in to explore</h2>
      <p class="muted">Use a demo account to start your session.</p>
      <mat-form-field appearance="outline"
        ><mat-label>Username</mat-label>
        <input
          matInput
          name="username"
          [(ngModel)]="username"
          required
          maxlength="64"
          autocomplete="username"
        />
      </mat-form-field>
      <mat-form-field appearance="outline"
        ><mat-label>Password</mat-label>
        <input
          matInput
          type="password"
          name="password"
          [(ngModel)]="password"
          required
          maxlength="128"
          autocomplete="current-password"
        />
      </mat-form-field>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <button mat-flat-button type="submit" [disabled]="busy() || !username.trim() || !password">
        {{ busy() ? 'Signing in…' : 'Sign in →' }}
      </button>
      <div class="demo-accounts">
        <strong>Demo accounts</strong>
        <p><code>demo1</code> / <code>Demo1!Pass</code></p>
        <p><code>demo2</code> / <code>Demo2!Pass</code></p>
      </div>
      <p class="fine-print">
        Bookmarks last for this session. A new sign-in starts a fresh collection.
      </p>
    </form>
  </section>`,
})
export class Login {
  readonly auth = inject(AuthService);
  username = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal('');
  signIn() {
    if (this.busy() || !this.username.trim() || !this.password) return;
    this.busy.set(true);
    this.error.set('');
    this.auth
      .login(this.username.trim(), this.password)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        error: (error) =>
          this.error.set(
            error.status === 401 ? 'Incorrect username or password.' : errorMessage(error),
          ),
      });
  }
}
