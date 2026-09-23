export interface Repository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count?: number;
  pushed_at?: string | null;
  archived?: boolean;
  owner: { login: string; avatar_url: string };
}
export interface SearchResponse {
  totalCount: number;
  incompleteResults: boolean;
  items: Repository[];
}
export interface LoginResponse {
  token: string;
  username: string;
  expiresAt: string;
}
