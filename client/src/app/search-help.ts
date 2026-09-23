import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-search-help',
  imports: [MatDialogModule, MatButtonModule],
  // Material supplies keyboard focus containment, Escape dismissal and focus restoration.
  template: `
    <h2 mat-dialog-title>Make your search more specific</h2>
    <mat-dialog-content>
      <p>Your search matched more than 30 repositories, so the results span multiple pages.</p>
      <!-- Refining the query helps in both broad and name-only search modes. -->
      <p>
        <strong>For more precise results, add specific words or more of the repository name.</strong>
        For example, try <strong>user authentication</strong> instead of <strong>user</strong>.
      </p>
      @if (!data.nameOnly) {
        <p>
          Looking for a specific name? Select <strong>Repository name only</strong> and search
          again.
        </p>
      }
      <p>You can also keep exploring with Next and Previous: 30 results per page, up to 1,000 matches.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button mat-dialog-close>Got it</button>
    </mat-dialog-actions>
  `,
})
export class SearchHelp {
  // Hide advice the user has already followed for this submitted search.
  readonly data = inject<{ nameOnly: boolean }>(MAT_DIALOG_DATA);
}
