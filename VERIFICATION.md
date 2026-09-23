# Verification

## Current end-to-end QA — 2026-09-23

See [QA_REPORT.md](QA_REPORT.md) for the requirement matrix and release gates. The sections below this current summary are **historical evidence**, not claims about this exact revision.

- Opening state: clean `main`, HEAD `5c10c931aeb295462e930329801d11cea4262b9c`, origin `https://github.com/riki-m/github-repository-search.git`; no pre-existing modified/untracked files.
- Backend: **84 passed**, zero failed/skipped, isolated artifacts, live API left running. This includes 19 added cases for query encoding/boundaries, missing/oversized login fields, signed JWT with mismatched session owner, upstream timeout/network failure, concurrent bookmark capacity and cache eviction.
- Client: **42/42 passed in the final full five-file run**. Explorer 27, App 4, Auth 8, SearchHelp 2, RepositoryCard 1. Initial new-test failures were corrected (Angular test interaction; C# fault-helper syntax); successful reruns are the evidence. No final failing tests remain.
- Production build: passed; 550.16 kB initial raw, 122.01 kB estimated transfer. Existing 500 kB warning budget exceeded by 50.16 kB. Budget unchanged. No load/latency benchmark claim.
- Live comparison: all six paired requests returned HTTP 200, matching totals, false incomplete_results, identical ordered IDs and all displayed card fields. Details in [identity evidence](live-search-identity.json) and [ranking evidence](live-search-ranking.json), UTC timestamps included. No personal GitHub token used.
- Browser (existing local servers, separate test login): Enter search HILAN, popup with broad-scope hint and Escape dismissal, matching ordered gallery names; acknowledged bookmark, full card in Bookmarks, refresh restored it, keyboard Left/Enter changed tab; new same-account login showed zero bookmarks. USER name-only results retained the 1,000 cap after popup dismissal, Last showed range 991–1000 and disabled Next. The preserved hidden Bookmarks panel is not part of the visible Search result count.
- Responsive inspection: 390x844 and 1280x900; document scroll widths 375 and 1265 respectively, no horizontal overflow. Mobile search controls stack and result-cap text wraps. Missing avatar/optional data and escaped markup covered in component tests. This is basic visual/keyboard coverage, not an assistive-technology audit.
- **Clean-copy gate passed:** with explicit approval, copied source files only to `D:\RepoFinder-QA-20260923` (no node_modules/bin/obj). Node 24.12.0, npm 11.6.2, .NET SDK 10.0.204. Fresh D-local npm/NuGet caches; `npm ci` installed 471 packages, `dotnet restore` succeeded. All 84 server and 42 client tests passed again in that copy. Production build passed: 550.16 kB raw / 122.10 kB estimated transfer, same warning budget. This is a clean source/dependency installation on the existing machine, not a fresh OS image. One PowerShell process stack-overflowed before test results; the sequential retry without a shell profile passed.
- Clean-copy browser flow passed on isolated ports 5081/4201: login, Enter search `repo:riki-m/Hilan-Test`, bookmark card, refresh showing 1 saved, new same-account login showing 0 saved. Signed out and stopped only the test processes afterward. The test-only proxy/ports and installed artifacts are outside the real checkout and excluded from publication.
- Scope check: a new, unrelated `client/tsconfig.app.json` edit appeared during final verification. It is preserved locally and excluded from this commit; the clean-copy tests used the HEAD version of that file. All other client/server source files matched the clean copy by SHA-256.
- Release gate: all material checks completed before commit preparation. Existing origin/main verified and fetched with zero divergence from the opening HEAD. The final response records the resulting commit/push verification; no force push or email.

## Historical checks

## Bookmarks bonus — 2026-09-23

Implemented the separate Search/Bookmarks tabs and shared full repository cards. Removed the standalone search counter. No server source, storage contract or dependency manifest changed. These checks cover the bonus implementation; the earlier publication evidence below refers to the previously published baseline.

- All 25 frontend tests passed in sequential file runs: Explorer 18, App 4, Auth 1, SearchHelp 2. New cases cover collection loading/error/retry/empty states, saved-card content and acknowledgement, preserved page/scope/pending input without new requests, failed saves and workspace reload/reset. Existing race, paging, popup and authentication regressions remain passing.
- Initial unconstrained test attempts failed with system memory allocation errors; successful runs used process-local NG_BUILD_MAX_WORKERS=1 and NODE_OPTIONS="--max-semi-space-size=1 --max-old-space-size=256". No system settings or other applications were changed.
- Production build passed: 548.79 kB initial raw / 121.66 kB estimated transfer. Material tabs increased the bundle above the existing 500 kB warning budget by 48.79 kB; the budget was not raised. This is a size measurement, not a latency benchmark.
- Live browser, a separate demo1 login: empty Bookmarks state and Explore repositories focus restoration; real repo:angular/angular search; acknowledged save; full saved card without a save button; keyboard Left + Enter back to Search with the same query/result and Bookmarked state; same-tab refresh restored the saved card from the server.
- A new demo2 login showed zero saved items and the empty state, with none of demo1's saved data. Existing user tabs/sessions and the running API were not reset. Only the newly created test sessions were signed out.
- Desktop and 390-pixel viewport inspected for Search and Bookmarks. Collection width measured 390 pixels at a 390-pixel viewport, with no horizontal overflow. Viewport restored. This is a focused keyboard/responsive check, not a full accessibility audit.
- Error/retry and response-order scenarios were verified through Angular HTTP component tests, not by disrupting the live server. Backend tests were not rerun because the server was unchanged.

Earlier sections below retain evidence from their respective changes; their test counts and bundle sizes predate this bonus.


## Sign-in presentation follow-up — 2026-09-23

Removed the demo account panel and demo wording from the sign-in screen, and removed its unused CSS. Evaluation credentials and the rationale linking JWT identities to custom sessions are now documented in README, explicitly as public fixtures rather than encrypted secrets. Authentication, registration scope and storage behavior did not change.

Production build passed: 487.82 kB initial raw / 110.68 kB estimated transfer. A fresh browser tab at port 4200 showed blank Username/Password fields, the neutral sign-in instruction and no demo account panel or credentials. No new test suite run was needed for this presentation-only change; the repair test results below predate this follow-up.

## Historical repair verification — 2026-09-23

The current source includes bookmark snapshot race protection and deduplication, bounded recovery from shrinking result totals, logout warning cleanup, differentiated upstream failures, and malformed-page validation before session storage. Comments explain these behavioral invariants. The unused Angular router dependency was removed from package.json and package-lock.json.

| Current check | Result |
| --- | --- |
| Full backend suite | 65 passed, 0 failed; fresh build and restore in a separate artifacts directory |
| Full frontend suite | 22 passed, 0 failed in the working project and again in a clean-install copy |
| Production frontend build | Passed in both copies; 488.21 kB initial raw / 110.88 kB estimated transfer |
| Clean client dependency installation | Passed: 471 packages installed from the updated lockfile into an isolated copy |
| Repaired API live smoke test | Temporary port 5081: login 200; real repo:angular/angular search 200 with one result; bookmark 204; bookmark list 200 with one item; logout 204 |
| Whitespace validation | git diff --check passed (line-ending normalization notices only) |
| Git publication | Published to https://github.com/riki-m/github-repository-search on 2026-09-23. Public visibility and default branch main verified through GitHub API; successful push and remote main commit verified with git ls-remote. Local main tracks origin/main. |

The five new frontend cases cover both bookmark response orderings, valid-page recovery preserving scope, bounded repeated-shrink/empty-page behavior, and warning cleanup after login. Nine new backend cases cover malformed envelopes, 403 classification and rejection of a malformed repository page before any entries are remembered.

The clean npm installation initially hit UNABLE_TO_VERIFY_LEAF_SIGNATURE. It succeeded with process-local NODE_OPTIONS=--use-system-ca and bounded network timeouts; TLS verification was not disabled, and no machine or project npm configuration was changed. Existing caches were available, so this proves a fresh node_modules installation, not a cache-free machine setup.

The regular backend output was locked by the existing API process; the complete suite passed with --artifacts-path in an isolated directory. The repaired API was then tested from that build on port 5081 and stopped. No existing sessions were reset. Temporary clean-client installation artifacts were removed after verification.

No new browser visual/accessibility audit, load test or production certification is claimed for this repair. The frontend regressions use Angular component tests; the live smoke test exercises the repaired API over HTTP. The existing API on port 5080 was not restarted: it may still execute the earlier server build. Previous live GitHub/browser checks below are historical evidence, not validation of the newly built server.

## Historical evidence boundary

Everything below this boundary records earlier stages. Counts, bundle sizes, popup behavior and live result rankings describe those stages and must not be treated as the current acceptance result. Current behavior is defined by README and the source.

# Previous verification record

Automated checks and live API checks refreshed on 2026-09-23 after the focused quality changes. This is evidence for the take-home assignment, not production certification.

| Check | Result |
| --- | --- |
| ASP.NET Core build | Passed |
| Backend tests | 56 passed, 0 failed after name-only scope |
| Angular production build | Passed; initial bundle approximately 487 kB raw / 111 kB estimated transfer with the restored Material dialog |
| Angular component tests | 17 passed, 0 failed after contextual popup cleanup |
| Live frontend HTTP | 200 at http://127.0.0.1:4200 |
| Live login and GitHub search via API | Passed; 30 real results for angular |
| Live API bookmark | angular/angular saved; display summary returned; full-object storage separately verified in tests |
| Browser login | Passed |
| Browser search using Enter | Passed |
| Browser search using button | Passed in original 2026-09-22 verification |
| Browser bookmark state | Passed; count increased, button disabled as Bookmarked |
| Browser refresh | Same user and bookmark count retained on 2026-09-23 |
| Browser logout | Returned to login on 2026-09-23; success/failure/timeout also covered by component tests |
| Browser second account | Verified on 2026-09-22; user/session isolation still covered by backend regression tests |
| API privacy headers | Search and bookmarks return no-store; automated tests also check anonymous and rate-limited responses |
| Live logout | 204 followed by 401 for the revoked token |

Backend automated checks cover invalid credentials, missing/invalid/expired tokens, independent users and logins, logout revocation, blank queries, unknown repository rejection, preservation of nested GitHub fields inside the session, concurrent duplicate saves, session expiry/capacity and upstream error translation. New checks cover minimal response contracts, no-store headers, login/search rate limits, per-account and shared budgets, and absence of sensitive markers in normal login/search logs. API tests substitute a fake GitHub service; HTTP-adapter and logging tests use a fake response handler. Real GitHub was tested separately through the running API and browser.

Client automated checks cover blank searches, cancellation of stale searches, save acknowledgement, failed-save recovery and local token cleanup on successful, failed and timed-out logout.

## Historical once-per-login popup — 2026-09-23

Copy clarification: the dialog now explains why it appeared (more than 30 matches) and recommends a more specific query in both scopes, with a concrete example. Conditional checkbox advice remains broad-search-only. All 17 client tests passed again, including both rendered dialog variants; no search or popup-frequency behavior changed.

Live automated browser follow-up: signed in as demo1, searched USER with name-only unchecked and observed the actual dialog including the name-only suggestion. Dismissed, selected name-only and searched again in the same login: 750,040 total matches and no second dialog. Signed out and signed in again in the same tab, selected name-only before the first USER search: the dialog appeared, with page/limit guidance but without the already-applied name-only suggestion (screenshot inspected). After dismissal, the inline limit notice was absent and the result summary remained. Refreshed the page and searched USER again: results appeared without a repeated dialog or inline limit notice. Broad-search totals were approximately 2,791,404–2,791,406 at test time. No defect reproduced and no application code changed. The user's prior tab state was not inspected, so a previously consumed login flag is a possible explanation, not a confirmed diagnosis of that tab.

Latest cleanup: the inline 1,000-match notice is hidden once guidance has been shown, using reactive login-scoped state restored on refresh. The dialog receives the submitted name-only scope and omits redundant name-only advice when that scope is active. Three added rendering/state regression cases passed; 17 client tests total, production build passed (487.52 kB raw / 110.54 kB estimated transfer). This follow-up was verified by automated component rendering; earlier live-browser checks below refer to the original once-per-login version.

- Restored a short guidance dialog on the first successful page-1 search with more than 30 matches. It is not consumed by errors/small searches. A UI-only sessionStorage boolean persists across refreshes in the same tab/login and is reset by successful login and logout cleanup. No query text is stored.
- 14 client tests passed, including first eligible result, no repeated dialog during navigation/search, service recreation from stored login (refresh), and reset on a new successful login. Production build passed at 487.24 kB raw / 110.58 kB estimated transfer. Backend unchanged; prior 56 backend passes remain the latest backend evidence.
- Live browser: after fresh login, USER displayed the dialog with Got it focused; screenshot inspected. After dismissal and full refresh, another USER search returned results without reopening the dialog. New-login reset is covered by the automated test.
- README updated. This supersedes earlier historical statements that the dialog was removed entirely; it remains absent from repeated searches during the same login.

## Name-only scope verification — 2026-09-23

Follow-up investigation: USER returning files-community/Files was not a scope regression. Public repository metadata described it as a file manager helping users organize files/folders. Anonymous GitHub queries restricted to that repository returned HTTP 200 with one match for USER, USER in:description and USER in:name,description, but zero for USER in:name and USER in:topics. This demonstrates a description match for USER against the current description containing users; it does not establish GitHub's general tokenization algorithm. A separate unrestricted USER page-1 comparison returned HTTP 200 from both GitHub and the local API, 2,791,332 total and 30 identical IDs in identical order. Files was not on that particular first page; its eligibility was verified by targeted queries. The local name-only query restricted to Files returned HTTP 200 and zero matches. No code change was needed. Totals/rankings are time-dependent, and switching from the former activity-filtered preset to Default can independently broaden matches.

- Added an unchecked-by-default Repository name only checkbox, separate from ranking. Server adds in:name before GitHub pagination; no client-side result filtering.
- 56 backend and 12 client tests passed, including default/selected scope, page and ranking preservation, manual in: conflicts, invalid boolean input, unchecked advanced queries, and state preservation after request failure.
- Live browser USER search: checked returned 750,041 total matches and displayed Name only; unchecked returned 2,791,341 and removed that applied-scope label. Each returned 30 cards. These counts are time-dependent, not fixed test expectations. Name-scoped cards visibly included names such as user, UserScript and UserLAnd.
- Desktop and 390 × 844 screenshots inspected: labelled checkbox fits below the existing search controls, with no additional dropdown or popup. Default remains selected. Viewport restored after inspection.
- README and inline comments document upstream scope, exact-name limitations and conflicts. The API was rebuilt/restarted for live checks, resetting local in-memory sessions as designed.

## Historical search simplification — 2026-09-23

Latest default adjustment: Best match is now the first option and the initial selection, with no added activity/archive filters. Popular & active and Recently updated remain optional. The 11 client tests passed again after updating expectations; pagination and ranking-change tests exercise the new default. Earlier live observations below used the previously selected Popular & active mode.

- Audited all five mappings: Popular & active and Most starred shared descending star order but differed in activity/archive filters. Most forked was distinct but secondary for the compact inspiration workflow. Retained three choices: Popular & active, Best match, Recently updated. Removed stars/forks standalone ranking modes from the UI and API; tests reject removed values. Fork counts remain useful card data.
- Deleted the explanation dialog component, dialog imports/injection/mocks, description helpers, unused new-search flag and panel CSS. The keyword, labelled Material-styled native selector and Search now share one form. Enter submits both controls. Only the short applied-mode summary and necessary error/partial/cap notices remain.
- Current tests: 50 backend and 11 client tests passed. Counts reflect removal of obsolete mode success cases and added rejection coverage. Production build passed: 391.14 kB raw / 91.33 kB estimated transfer, down from 487.48 / 110.74 kB. This is bundle size evidence, not a latency benchmark.
- Live browser HILAN search: 234 filtered matches; page 1 showed 1–30 and page 2 showed 31–60, with Popular & active preserved and no explanation popup. Counts are time-dependent. Desktop and 390 × 844 visual checks confirmed aligned/stacked controls and readable pagination. Full accessibility certification is not claimed.
- README reflects the current three-option design. The following sections retain historical evidence; the popup was removed at that stage and subsequently restored once per login.

## Historical pagination and popup verification — 2026-09-23

User-approved additions: page navigation and a prominent search explanation popup. These do not change GitHub's relevance ranking or add GitHub authentication.

This paragraph describes the earlier pagination-only change. The subsequent ranking addition below introduces explicit user-selectable sorting/filtering.

- Backend regression coverage: default page 1; forwarding pages 6 and 34; bookmark eligibility on returned pages; rejection of zero, negative, over-limit, fractional and nonnumeric pages before calling GitHub; encoded name qualifiers and page parameters; the 1,000-result boundary (10 results on page 34).
- Client regression coverage: navigation preserves the submitted query despite unsent edits; a new search resets to page 1; help opens for a new multi-page search but not page navigation; no popup for small/empty searches; navigation stops at page 34; loading ignores duplicate page clicks; failed requests retain the previous page and permit retry; a new query cancels a pending page request.
- Live browser: HILAN popup appeared after search; Got it and Escape dismissed it. Escape restored focus to the query field. Next displayed page 2 of 17 and range 31–60, with changed repositories and no repeated popup. A new submission returned to page 1 and displayed help again.
- Visual inspection: desktop popup and navigation, plus a 390 × 844 viewport. Popup content and dismissal button were readable; page buttons wrapped within the viewport. This is focused visual/keyboard verification, not a full accessibility audit.
- Real API via local demo login, without a personal GitHub token: `HILAN&page=6` returned HTTP 200, total 502, 30 items including `riki-m/Hilan-Test`. `angular&page=34` returned HTTP 200, total 1,428,503, 10 items. Counts/rankings change over time; the earlier HILAN investigation recorded 501 matches.
- API restart was needed because the running demo process locked the build output. Its in-memory sessions were reset; tests then passed and the updated server was started successfully.
- No commit, push, deployment, automatic page prefetch or GitHub credential change was performed for this addition.

## Historical five-option ranking verification — 2026-09-23

- Automated server checks cover the 365-day UTC cutoff, archive filter, unchanged advanced queries in other modes, rejected conflicting qualifiers/unsupported sort values, propagation of ranking to the adapter and actual outbound descending sort/page parameters.
- Client checks confirm that pending selector edits cannot change the ranking of displayed results or subsequent pages, successful new ranking submissions restart at page 1, and failures preserve the last successful ranking/results. Existing cancellation, bookmarking and authentication checks remain green.
- Live API: `q=angular&ranking=inspiration`, pages 1 and 2, both HTTP 200, total 134,241, 30 items each. All 60 items were unarchived and had pushed dates within the configured window. Stars decreased across both pages (119,075 at the start of page 1; 14,405 at its end; 13,822 at the start of page 2; 6,288 at its end). Counts and ordering are time-dependent observations.
- Live browser: default Popular & active mode, its explanatory text, result ranking label and stars/forks/last-push fields were verified. Changing to Best match and searching `HILAN-TEST in:name` returned 3 results, including `riki-m/Hilan-Test`, and displayed Best match with no activity filters. The popup remained functional.
- Desktop visual inspection confirmed the ranking selector and explanatory panel fit the existing layout. The new code retains responsive wrapping; no complete accessibility or mobile-device audit is claimed.
- No benchmark claims: ranking still makes one GitHub request per page; no per-result enrichment, crawler or additional persistence. Public counts are not code-quality assessments or recent popularity trends. The earlier payload-size measurements below predate the three added evidence fields and must not be presented as a fresh measurement of this version.

## Earlier response size and timing measurements

A single captured search response for `angular` (30 repositories) was serialized through the original full-result shape and the new production presentation contract. Both sizes are UTF-8 JSON without HTTP compression, using exactly the same repository data:

| Shape | Bytes |
| --- | ---: |
| Original full response | 165,530 |
| New presentation response | 10,626 |
| Reduction | 93.58% |

Separate live requests took 1,611 ms before and 1,875 ms after the change; these are single samples, not a latency improvement claim. The updated request's GitHub adapter (network, response read and parsing) took 1,371 ms. The remaining approximately 504 ms includes client/network/framework/startup overhead as well as application work and must not be described as pure server CPU time. The later targeted browser query completed in 505 ms inside the adapter, but it used a different query and is not a comparison.

The current live 30-item response was 10,562 bytes; this differs from the controlled comparison because GitHub data/results can change. No search cache, latency percentile, load-throughput claim or production certification is implied.

## Limits

The optional Bookmarks screen is not implemented. Full mobile/accessibility audits, load testing, distributed deployment and persistence are outside this version. GitHub publication is a separate step requiring an authenticated GitHub account.

The machine's restricted execution environment initially blocked frontend file resolution and the .NET test host's Windows logging access. The same builds and tests passed when run with the required local execution permissions; application authentication was not disabled.
