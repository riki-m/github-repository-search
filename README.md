# Repo Finder

A GitHub repository search application built with Angular 21, Angular Material and ASP.NET Core 10 controllers. Users sign in with a demo account, search via the backend and bookmark complete GitHub repository results in a custom server-side session.

## Run locally

Prerequisites: .NET 10 SDK, Node.js 24 LTS (24.12.0 was used), npm and Internet access to GitHub and package registries.

From the repository root, start the API:

```sh
dotnet restore RepositorySearch.sln
dotnet run --project server/RepositorySearch.Api --launch-profile http
```

In a second terminal:

```sh
cd client
npm ci
npm start
```

Open http://127.0.0.1:4200. The API listens on http://127.0.0.1:5080. Angular proxies /api to the API; no CORS setup or GitHub token is required. These loopback HTTP addresses are for local evaluation only.

| Username | Password |
| --- | --- |
| demo1 | Demo1!Pass |
| demo2 | Demo2!Pass |

These are intentionally public demonstration accounts, not real credentials. Enter a repository keyword and press Enter or Search, then Bookmark a result. Refreshing the browser preserves the active session in the same tab.

## Scope

Implemented: server-side GitHub search; button and Enter submission; repository gallery with name, owner avatar and Bookmark; JWT authentication; custom session storing the entire selected repository JSON object; clean separation of responsibilities and tests.

The optional separate Bookmarks screen is not included in this version. The UI shows the bookmark count and saved state on search results. GET /api/bookmarks returns the full saved objects.

## Session behavior and decisions

- Each successful login creates a new, independent session lasting one hour (absolute expiry).
- JWT contains the user ID and session ID. Signature, algorithm, issuer, audience, lifetime and active-session ownership are validated.
- The JWT is kept in sessionStorage for same-tab refresh continuity, never in a URL. JavaScript access to storage is a demo tradeoff; production authentication needs a separate threat-model review.
- Full repository JSON comes from GitHub and is cloned into server memory. Bookmark requests contain only the ID; the API accepts IDs previously returned to that session, not client-provided repository objects.
- Saving the same repository twice is idempotent, including concurrent requests.
- Logout revokes the session. Server restart clears sessions, bookmarks and the ephemeral JWT signing key.
- Search returns the first 30 results and clearly displays the returned count versus the total. Pagination is outside this implementation.
- To bound demo memory usage: 1,000 active sessions, 100 bookmarks per session and a recent search cache cleared before a new batch once it has at least 300 entries. Older uncached results must be searched again before bookmarking. Expired sessions are cleaned every minute.
- No database, registration, password recovery, distributed storage, deployment or persistence across restarts is included.
- Public demo passwords use in-memory comparison hashes solely for fixtures; this is not a production password storage design.
- GitHub requests are unauthenticated and subject to GitHub's limits. Rate limiting and upstream failures are shown to the user. A network/proxy failure may prevent a live search even when local tests pass.

## Structure

```text
client/src/app/
  auth.service.ts        Login state and scoped JWT interceptor
  repository.service.ts  API calls
  login.ts               Login form
  explorer.ts            Search gallery and bookmark actions
server/
  RepositorySearch.Api/
    Controllers/         HTTP validation and orchestration
    Services/            Demo auth, JWT, GitHub integration, custom sessions
  RepositorySearch.Tests/  API integration and service tests
```

## API

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| POST | /api/auth/login | Public | Accept username/password and return JWT, username, expiresAt |
| POST | /api/auth/logout | JWT | Revoke this session |
| GET | /api/repositories?q=angular | JWT | Search GitHub and remember full results in session |
| POST | /api/bookmarks/{repositoryId} | JWT | Save a previously returned repository; 204 on success |
| GET | /api/bookmarks | JWT | Return full saved repository objects |

Client errors and upstream errors use HTTP status codes and Problem Details where provided by the controllers. Expired/invalid authentication returns 401.

## Verification

```sh
dotnet test RepositorySearch.sln
cd client
npm test -- --watch=false
npm run build
```

See [VERIFICATION.md](VERIFICATION.md) for executed checks and remaining limits.

## Manual review

1. Sign in as demo1. Search using Enter and then the button.
2. Bookmark a repository. Its button changes to Bookmarked.
3. Refresh, repeat the search and confirm the saved state is retained.
4. Sign out and sign in as demo2. Confirm its bookmark count starts at zero.
5. Try a wrong password, an empty search and a query with no matches.
6. Restart the API. The previous token can no longer access the protected API; sign in again.

## References

- [Angular version compatibility](https://angular.dev/reference/versions)
- [ASP.NET Core JWT validation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0)
- [GitHub repository search](https://docs.github.com/en/rest/search/search#search-repositories)
- [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
