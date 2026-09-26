import { TestBed } from '@angular/core/testing';
import { RepositoryCard } from './repository-card';

describe('Repository card fallbacks', () => {
  it('keeps a readable owner when the remote avatar fails and handles absent optional data', () => {
    const fixture = TestBed.createComponent(RepositoryCard);
    fixture.componentRef.setInput('repo', {
      id: 1,
      name: '<script>long name</script>',
      owner: { login: 'owner', avatar_url: 'https://example.com/broken.png' },
      html_url: 'https://github.com/owner/repo',
      stargazers_count: 0,
    });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.avatar-fallback').textContent).toBe('O');
    expect(fixture.nativeElement.textContent).toContain('No description provided.');
    expect(fixture.nativeElement.textContent).toContain('Not available');
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.querySelector('a').rel).toContain('noopener');
  });
});
