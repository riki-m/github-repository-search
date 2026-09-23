# Repo Finder

Repository: [riki-m/github-repository-search](https://github.com/riki-m/github-repository-search)

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

## Evaluation accounts and their purpose

| Username | Password |
| --- | --- |
| demo1 | Demo1!Pass |
| demo2 | Demo2!Pass |

These are intentionally public evaluation fixtures, not real credentials. They are documented here for the evaluator and are not displayed on the sign-in screen. Moving them into README is **not encryption** and does not make them secret; the same fixture values also exist in server code and tests. Do not reuse a real password for these accounts.

**Requirement from the assignment:** use JWT between client and server and store bookmarked repository objects in a custom session associated with the user.

**Implementation decision:** provide two predefined local accounts to let the evaluator obtain a JWT, exercise authenticated search/bookmark requests, and verify that one user's saved objects are not visible in another user's session. The assignment does not require these particular usernames, a registration flow or a database. This small fixture-based login demonstrates the required identity/session relationship without adding an account-management subsystem.

**What a new user can do:** a username not defined by the server is rejected with HTTP 401, even if it is typed into README. README is documentation, not the user store. There is no registration endpoint and no GitHub-account login. A successful login creates a new independent one-hour session; a JWT identifies the user and that session.

**Where data is stored:** there is no database. The two allowed identities are defined in `server/RepositorySearch.Api/Services/Authentication.cs`; its SHA-256 comparison hashes are demo fixtures, not encryption or a production password-storage design. Sessions and full bookmarked GitHub objects live in server process memory. The browser keeps its JWT in sessionStorage to preserve the active login on same-tab refresh. Logout, expiry or server restart ends access to that session; a new login starts a fresh collection. Real registration and durable user storage would be a separately approved scope extension.

## First search

Enter a repository keyword and press Enter or Search, then Bookmark a result.

**Bookmarks are saved only for your current session.** Refreshing the same browser tab keeps them while that session is still valid. After signing out and signing in again, your bookmarks list starts empty, even with the same account. Bookmarks are not stored permanently; session expiry or a server restart also ends access to them.

## Scope

Implemented: server-side GitHub search; button and Enter submission; repository gallery with name, owner avatar and Bookmark; JWT authentication; custom session storing the entire selected repository JSON object; clean separation of responsibilities and tests.

The assignment bonus is implemented as a separate Bookmarks tab with full repository cards. Search results retain their Bookmarked state; the standalone bookmark counter has been removed from Search. Search and bookmark responses contain only gallery fields; the complete original objects remain in the server session.

## Bookmarks tab (assignment bonus)

Use **Search** to discover repositories and select **Bookmark**. Once the server accepts the save, the card is marked Bookmarked and appears in **Bookmarks** immediately. That tab shows the same owner/avatar, name/link, description, language, stars, forks and last-push information as the search card, with a saved marker instead of another save button. Its count belongs to the collection, not the search page.

- Switching tabs preserves the search text (including unsent edits), submitted filters, results and page. Tab navigation does not request another GitHub search.
- The collection distinguishes loading, a failed load with **Try again**, and an empty collection with **Explore repositories**. An error is never labelled as an empty collection.
- Material tabs provide keyboard navigation: focus a tab, use Left/Right to move and Enter/Space to select. Returning from the empty state focuses Search.
- Bookmarks use the existing authenticated `GET /api/bookmarks` and ID-only save endpoint. The workspace owns one bookmark collection, merges delayed snapshots with acknowledged saves and deduplicates by ID. It is destroyed on logout.
- Refreshing the same browser tab during a valid session reloads saved repositories from the server. A new login starts a fresh collection, including a new login by the same username. Expiry or server restart also ends access. This bonus does not add permanent storage, registration, removal or additional sorting/filtering.
- `repository-card.ts` supplies the shared presentation; `bookmarks.ts` renders collection states; `explorer.ts` owns navigation and session-local state, with its template in `explorer.html`. The server and full-JSON session storage are unchanged.

## Session behavior and decisions

- Each successful login creates a new, independent session lasting one hour (absolute expiry).
- JWT contains the user ID and session ID. Signature, algorithm, issuer, audience, lifetime and active-session ownership are validated.
- The JWT is kept in sessionStorage for same-tab refresh continuity, never in a URL. JavaScript access to storage is a demo tradeoff; production authentication needs a separate threat-model review.
- Full repository JSON comes from GitHub and is cloned into server memory. Bookmark requests contain only the ID; the API accepts IDs previously returned to that session, not client-provided repository objects.
- Saving the same repository twice is idempotent, including concurrent requests.
- Successful logout revokes the session. The browser also clears its token on failure or after a five-second timeout and reports that server revocation was not confirmed. Server restart clears sessions, bookmarks and the ephemeral JWT signing key.
- Search returns up to 30 results per requested page. First/Previous/Next/Last controls preserve the submitted query and display the current page and result range. See the search instructions below for GitHub's 1,000-result limit.
- To bound demo memory usage: 1,000 active sessions, 100 bookmarks per session and a recent search cache cleared before a new batch once it has at least 300 entries. Older uncached results must be searched again before bookmarking. Expired sessions are cleaned every minute.
- No database, registration, password recovery, distributed storage, deployment or persistence across restarts is included.
- Public demo passwords use in-memory comparison hashes solely for fixtures; this is not a production password storage design.
- GitHub requests are unauthenticated and subject to GitHub's limits. Rate limiting and upstream failures are shown to the user. A network/proxy failure may prevent a live search even when local tests pass.

## Focused quality improvements

- A typed presentation contract separates gallery fields from the full stored GitHub JSON. No search-result cache or extra persistence was introduced.
- Every API response uses `Cache-Control: no-store`, including authentication failures and rate-limit responses.
- Outbound HTTP request loggers are disabled to avoid recording GitHub query URLs. The application records only elapsed milliseconds for GitHub searches; regression tests check normal login/search logs for passwords, tokens, query text and response markers. This does not audit external reverse-proxy or infrastructure logs.
- Configurable fixed-window limits in `appsettings.json`: 10 login attempts per minute per observed client IP; 8 searches per minute per authenticated account; 10 search requests per minute across the server. Rejections return 429 and Retry-After, without queuing. Search limits do not block bookmark reads or logout. Rejected searches can consume the shared request budget; it is a protective ceiling, not a guarantee of GitHub quota availability.
- These are single-process limits for the local demo, not distributed DDoS protection. The Angular development proxy shares its source IP between local users; forwarded headers are not trusted automatically.
- Existing demo-only authentication, sessionStorage, one-hour sessions and local HTTP remain unchanged. HTTPS and a separate authentication/privacy review are required before external deployment.

## Structure

```text
client/src/app/
  auth.service.ts        Login state and scoped JWT interceptor
  repository.service.ts  API calls
  login.ts               Login form
  explorer.ts/html       Search state, tabs and bookmark synchronization
  bookmarks.ts           Collection loading/error/empty states
  repository-card.ts     Shared repository card
server/
  RepositorySearch.Api/
    Contracts/           Minimal gallery response models
    Controllers/         HTTP validation and orchestration
    Services/            Demo auth, JWT, GitHub integration, custom sessions
  RepositorySearch.Tests/  API integration and service tests
```

## API

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| POST | /api/auth/login | Public | Accept username/password and return JWT, username, expiresAt |
| POST | /api/auth/logout | JWT | Revoke this session |
| GET | /api/repositories?q=angular&page=1&ranking=inspiration | JWT | Search a ranked GitHub page; page defaults to 1 (valid 1–34), ranking defaults to best-match for API compatibility; the UI also defaults to best-match |
| POST | /api/bookmarks/{repositoryId} | JWT | Save a previously returned repository; 204 on success |
| GET | /api/bookmarks | JWT | Return presentation summaries of the saved objects |

Client errors and upstream errors use HTTP status codes and Problem Details where provided by the controllers. Expired/invalid authentication returns 401.

## Reliability behavior

- Initial bookmark loading merges with acknowledged saves by repository ID, in either response order. A delayed snapshot cannot erase a new save or duplicate it.
- If GitHub reports that a requested page no longer exists because its total has decreased, the UI requests the new last page once, using the submitted query, ranking and scope. It commits only the valid response. If totals shrink again or recovery fails, the previous results remain and an error asks the user to retry; there is no automatic retry loop. Zero matches reset the page to 1.
- A successful new login clears any warning from an earlier unconfirmed logout.
- HTTP 429 and recognized GitHub rate-limit signals produce throttling guidance. An unrelated 403 is a controlled upstream refusal, not labelled as throttling. Malformed search envelopes or repository fields produce 502; a malformed page is rejected before its objects are remembered in the session.
- These are reliability fixes to the approved scope, not new search modes or persistent storage.

## Verification

```sh
dotnet test RepositorySearch.sln
cd client
npm test -- --watch=false
npm run build
```

See [VERIFICATION.md](VERIFICATION.md) for executed checks and remaining limits.

On Windows, a running API can lock its build output. To test without stopping it or resetting sessions, use a separate output directory:

```sh
dotnet test RepositorySearch.sln --artifacts-path ../repository-search-test-artifacts
```

Building tests does not update an already running API process. Restart it when ready to load server changes; this intentionally clears its in-memory sessions and bookmarks.

## Manual review

1. Sign in as demo1. Search using Enter and then the button.
2. Bookmark a repository. Its button changes to Bookmarked.
3. Refresh, repeat the search and confirm the saved state is retained.
4. Open Bookmarks and verify the full saved card. Switch back to Search and verify its state is preserved. Sign out and sign in as demo2; Bookmarks must show an empty collection.
5. Try a wrong password, an empty search and a query with no matches.
6. Restart the API. The previous token can no longer access the protected API; sign in again.
7. Search for HILAN using the single search row: keyword, Sort results, Search. On the first search with more than 30 matches, dismiss the one-time guidance popup. Confirm it does not repeat on further searches or refresh in the same login. Move to Next and Previous: the page number, result range and repositories change together.
8. Edit the search text without submitting, then click Next. Results must still belong to the previously submitted query. Submit the edited text: successful results start at page 1.
9. Search for a broad term with more than 1,000 matches. Last opens page 34 (up to 10 results); Next is disabled. The 1,000-match limit is explained in the one-time popup; its repeated inline notice stays hidden after that popup has been shown. A failed request must preserve the previous page and allow retry after the displayed rate-limit guidance.
10. Bookmark an item on a later page, return to it and verify the saved state. Repeat navigation at narrow/mobile width and using the keyboard.

## One-time search guidance

The first successful page-1 search with more than 30 matches opens a short Material popup headed Make your search more specific. It explains that more than 30 matches span multiple pages and recommends adding specific words or more of the repository name (user authentication instead of user). This refinement advice appears in both broad and name-only modes; it does not promise an exact match. Paging and the 1,000-result limit remain secondary guidance. The suggestion to select Repository name only appears only when that submitted search did not already use name-only scope. Once the popup has been shown, the repeated inline First 1,000 matches available notice is hidden for that login, including after refresh; the result range/count and applied search settings remain visible. Close it with Got it, Escape or the backdrop. It does not auto-dismiss; Material manages focus containment and restoration.

The UI stores only a boolean flag in sessionStorage for the current tab/login, never query text. Subsequent searches, page navigation and refreshes in that login do not reopen the popup. A successful new login resets the flag; logout/session cleanup removes it. Failed requests and searches with 30 or fewer matches do not consume the opportunity. This restores guidance without interrupting every search; it supersedes the earlier decision to remove the dialog entirely.

Manual verification: sign in, run a broad search, dismiss the popup, search again, change page and refresh/search again. The popup should appear only on the first broad search. Sign out and sign in again: the next broad search should show it again.

## Search instructions and pagination decision

### Repository name only

The optional **Repository name only** checkbox sits directly below the search controls and is unchecked initially. Enter a term, optionally check the box, choose a ranking, and press Search or Enter. No extra search button is added. The once-per-login guidance popup below also mentions this checkbox.

- Unchecked: preserve the normal GitHub search scope (name, description and topics), or any advanced qualifiers the user entered.
- Checked: the API appends `in:name` before calling GitHub. For example, `USER` becomes `USER in:name`; description-only matches are excluded by GitHub. This is name matching, not exact equality: names such as `user-management` may match.
- Scope and ranking are independent. Name-only can be combined with Default, Popular & active or Recently updated. Filtering happens upstream before pagination, so the total and pages reflect the scoped search; cards are not discarded locally after downloading a page.
- The checkbox is a pending setting until submission. Page navigation retains the scope of the displayed results, even if the checkbox has been edited. A successful new search resets to page 1; a failed request retains the previous results and scope. The result summary includes **Name only** when applied.
- Advanced query handling: when checked, an existing `in:` qualifier is conservatively rejected with HTTP 400 and guidance to remove it or uncheck the box. This also covers an explicit `in:name`, avoiding ambiguous duplicate qualifiers. When unchecked, manual qualifiers are preserved.
- API: `GET /api/repositories?q=USER&page=1&ranking=best-match&nameOnly=true`. `nameOnly` is an optional boolean defaulting to false; invalid boolean values are rejected. Existing authentication, request limits and the 1,000-result limit still apply.

Manual check: search USER unchecked, then checked; verify Name only appears in the summary and results follow the chosen scope. Navigate to page 2, change the checkbox without submitting, and confirm paging still uses the applied scope. Submit again to apply the changed scope and restart at page 1. Try `USER in:description` with the checkbox selected to verify useful conflict guidance.

This is an approved usability addition for users who know part of a repository name. The default remains broad to support discovery by topic or description. Implementation comments explain the scope boundary and state handling in `SearchScope.cs`, `RepositoriesController.cs`, `repository.service.ts` and `explorer.ts`.

**Purpose:** Help a user find public GitHub repositories matching a topic or a known name, compare candidates for learning or inspiration, and bookmark useful results within the current session. Search is a discovery tool, not a code-quality audit or a guarantee that a repository is suitable for reuse.

**Default versus optional choices:** Default starts broadly: it adds no activity or archive restrictions to the user's query. It does not mean every repository on GitHub or all matches loaded at once. GitHub determines matches and relevance, and the app displays 30 per requested page within the accessible result limit. Popular & active both filters and sorts; Recently updated only changes sorting. Calling both alternatives “filters” is convenient in conversation but technically imprecise.

**End-to-end flow:** The user enters a query and optionally selects a ranking, then submits once with Search or Enter. Angular sends the query, page 1 and selected ranking to the authenticated .NET endpoint. The server validates the request and active session, builds the permitted GitHub query/sort and requests one page. GitHub performs matching and ordering. The server retains full returned objects in the session for valid bookmark operations and returns only gallery fields and result counts to the browser. The browser commits the successful results, page and applied ranking together. Paging repeats this flow with the same submitted query/ranking and the requested page; it does not download all pages or sort only the current 30 cards.

**UX rationale and evidence:**

| Earlier experience | Current behavior | Expected benefit |
| --- | --- | --- |
| Activity filters applied by default | Default is first and selected initially | Older or low-star matches are not excluded by our default preset |
| Five partially overlapping ranking choices | Three distinct choices | Less decision effort |
| Separate ranking panel with repeated prose | One query/sort/Search form; short result summary and once-per-login guidance | A clearer action sequence with fewer interruptions |
| Only the first page was accessible in the original version | First/Previous/Next/Last and visible ranges | Users can explore without knowing the exact repository name |
| Risk of confusing pending edits with displayed results | Applied query/ranking remain attached to results until a successful new submission | Predictable navigation and honest labels |

Desktop and narrow-viewport visual checks, browser search/paging checks and automated state tests support these specific improvements. No usability study, task-completion timing or satisfaction survey was performed, so improved user satisfaction is an informed design assessment rather than a measured claim. Selecting a new ranking still requires Search/Enter, preserving a deliberate single request. GitHub ranking changes, network delays, rate limits and the 1,000-result cap remain constraints. Detailed guidance stays in this README instead of returning to the uncluttered search screen.

**Scope:** Pagination and selectable ranking are user-approved usability additions, not newly discovered mandatory requirements or a fix to GitHub matching.

**Why:** During the 2026-09-23 HILAN investigation, the public repository `riki-m/Hilan-Test` appeared at rank 165 (page 6, item 15 with 30 results per page). The broad query returned 501 matches. Direct GitHub, our API and the gallery agreed on the first page. A repository absent from that page was therefore not proof of broken search. Rankings and totals can change; these observations are historical, not fixed acceptance values.

**How to search:** Enter a keyword, choose a ranking (see below), and submit using Search or Enter. For a broad search, browse with First, Previous, Next or Last. To narrow the search, use `HILAN-TEST in:name` (name field), `HILAN user:riki-m` (owner), or `repo:riki-m/Hilan-Test` (specific repository). Name matching is not guaranteed to be exact. Our demo login does not sign you into GitHub; requests remain anonymous and return public repositories.

**Request and state behavior:** The client sends `q`, `page` and `ranking`; the API trims outer query whitespace, applies the chosen preset, and URL-encodes the effective query. Every click fetches only the selected page using `per_page=30`; no automatic prefetch, new cache or personal token was added. Navigation uses the last submitted query and ranking, even if the controls have unsent edits. A new search starts at page 1. Pending searches are cancelled when replaced; page/results/ranking update together only after success. On failure, the previous successful results/page remain visible with an error so navigation can be retried. Controls are disabled while loading. Bookmark state remains shared across pages within the existing session.

**Limits:** GitHub exposes at most 1,000 results per search: up to 34 pages at this page size, with at most 10 items on the final page. The API rejects invalid page values with HTTP 400; it does not turn upstream failures into empty successful results. The UI caps navigation and explains the limit when total_count exceeds 1,000. Refine the query to reach more specific matches. `incomplete_results` still produces a separate partial-results notice. Live rankings are not a frozen snapshot, so duplicates or omissions can occur between calls as GitHub data changes. Every page request consumes the existing local and GitHub rate limits; wait and retry after a rate-limit error. Existing session expiry and bounded recent-result storage are unchanged.

Reference: [GitHub search limits, ranking and pagination](https://docs.github.com/en/rest/search/search#search-repositories).

## Finding inspiration: three distinct ranking choices

The original five options were reduced to three after a UX review: Most starred used the same star ordering as Popular & active without its activity filters; Most forked was a separate but secondary community-interest measure. Neither was an identical algorithm, but both added overlapping choices. Their standalone API modes have been removed and are rejected with HTTP 400. Fork counts remain useful visible repository data. The explanation dialog component, imports, mocks, description helpers and panel styles were deleted.

This is a user-requested enhancement beyond the original assignment's basic search requirement. The goal is to surface popular, recently active matching repositories while keeping the ranking understandable and reversible.

| UI option | API ranking | GitHub behavior |
| --- | --- | --- |
| Default (default, first option) | best-match | Original query and GitHub relevance order; no extra activity/archive filters |
| Popular & active | inspiration | Append `archived:false pushed:>=YYYY-MM-DD` (UTC date minus 365 days); sort by stars descending |
| Recently updated | updated | Original query; GitHub updated order descending, not a quality or trending score |

The 365-day activity window is an application choice, not a GitHub endorsement or proof of maintenance quality. This cutoff is calculated per request; it can roll forward across UTC midnight. An older but valuable repository may be excluded by this preset; choose Default to include it. Existing explicit `pushed:` or `archived:` qualifiers are rejected in Popular & active with a useful 400 response asking for another ranking, rather than silently overriding user intent. Other advanced filters remain available in the query, for example `language:typescript`, `stars:>=100`, `topic:algorithms` and `license:mit`.

The server uses a fixed allowlist of rankings. Sorting/filtering happens in GitHub **before pagination**, across the matching search set, not just within 30 already-downloaded items. This preserves meaningful page ordering without downloading hundreds of repositories, making per-repository enrichment calls or adding a crawler/database. Each page still costs one search request and remains subject to the existing request limits and 1,000-result cap.

The keyword, Material-styled native sort selector and Search button share one form and align on desktop; on narrow screens they stack in that same order. No explanatory panels are shown; a short guidance dialog appears once per login as described below. The selector describes pending settings; the result summary describes the settings that actually produced the visible results. Press Search to apply a selection and restart at page 1. Cards display lifetime stars, forks, last push date (UTC) and archive status so the evidence is visible.

**What this does not claim:** Stars measure community interest; forks count copies, not positive reviews. Recent pushes do not prove good code, security or suitability. GitHub's public repository search does not expose search-frequency statistics, review ratings, traffic rankings or a code-quality score. Repository traffic endpoints require elevated repository permissions and cannot provide an anonymous global popularity ranking. We do not relabel watchers/stars as views, infer recent star growth from lifetime totals, invent an AI quality score, or call any repository the best on GitHub. Inspect its README, tests, maintenance and licensing before adopting it.

Sources: [Search API ranking](https://docs.github.com/en/rest/search/search#search-repositories), [supported repository filters](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories), [traffic API permissions](https://docs.github.com/en/rest/metrics/traffic).

## References

- [Angular version compatibility](https://angular.dev/reference/versions)
- [ASP.NET Core JWT validation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0)
- [GitHub repository search](https://docs.github.com/en/rest/search/search#search-repositories)
- [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
