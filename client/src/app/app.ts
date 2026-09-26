import { Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from './auth/auth.service';
import { finalize } from 'rxjs';
import { Login } from './auth/login';
import { Explorer } from './explorer/explorer';
@Component({
  selector: 'app-root',
  imports: [MatButtonModule, Login, Explorer],
  templateUrl: './app.html',
})
export class App {
  readonly auth = inject(AuthService);
  readonly error = signal('');
  readonly signingOut = signal(false);
  constructor() {
    // A successful new login ends the lifetime of the previous logout warning.
    effect(() => {
      if (this.auth.session()) this.error.set('');
    });
  }
  signOut() {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.error.set('');
    this.auth
      .logout()
      .pipe(
        finalize(() => {
          this.auth.clear();
          this.signingOut.set(false);
        }),
      )
      .subscribe({
        error: () =>
          this.error.set(
            'Signed out on this device. Server sign-out could not be confirmed; the session may remain active until it expires.',
          ),
      });
  }
}
