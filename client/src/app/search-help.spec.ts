import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { SearchHelp } from './search-help';

describe('SearchHelp', () => {
  for (const nameOnly of [true, false]) {
    it(`shows name-only advice only when it is not already applied (${nameOnly})`, () => {
      TestBed.configureTestingModule({
        imports: [SearchHelp],
        providers: [{ provide: MAT_DIALOG_DATA, useValue: { nameOnly } }],
      });
      const fixture = TestBed.createComponent(SearchHelp);
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text.includes('Looking for a specific name?')).toBe(!nameOnly);
      expect(text).toContain('Your search matched more than 30 repositories');
      expect(text).toContain('For more precise results, add specific words');
      expect(text).toContain('user authentication');
      expect(text).toContain('1,000');
      expect(text).toContain('Got it');
    });
  }
});
