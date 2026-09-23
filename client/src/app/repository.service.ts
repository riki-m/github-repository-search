import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Repository, SearchResponse } from './models';
@Injectable({ providedIn: 'root' })
export class RepositoryService {
  private readonly http = inject(HttpClient);
  search(query: string, page = 1, ranking = 'best-match', nameOnly = false) {
    // Scope is a separate API option; the server composes and encodes GitHub qualifiers.
    const params = { q: query, page, ranking, ...(nameOnly ? { nameOnly: true } : {}) };
    return this.http.get<SearchResponse>('/api/repositories', { params });
  }
  bookmarks() {
    return this.http.get<Repository[]>('/api/bookmarks');
  }
  bookmark(id: number) {
    return this.http.post<void>('/api/bookmarks/' + id, {});
  }
}
