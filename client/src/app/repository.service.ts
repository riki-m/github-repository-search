import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Repository, SearchResponse } from './models';
@Injectable({ providedIn: 'root' })
export class RepositoryService {
  private readonly http = inject(HttpClient);
  search(query: string) {
    return this.http.get<SearchResponse>('/api/repositories', { params: { q: query } });
  }
  bookmarks() {
    return this.http.get<Repository[]>('/api/bookmarks');
  }
  bookmark(id: number) {
    return this.http.post<void>('/api/bookmarks/' + id, {});
  }
}
