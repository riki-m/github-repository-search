import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AuthService, errorMessage } from './auth.service';
import { Login } from './login';
import { Explorer } from './explorer';
@Component({
  selector: 'app-root',
  imports: [MatButtonModule, Login, Explorer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly auth = inject(AuthService);
  readonly error = signal('');
  signOut() {
    this.auth.logout().subscribe({
      next: () => {
        this.auth.clear();
        this.error.set('');
      },
      error: (error) => this.error.set(errorMessage(error)),
    });
  }
}
