# Verification

Verified locally on 2026-09-22. This is evidence for the take-home assignment, not production certification.

| Check | Result |
| --- | --- |
| ASP.NET Core build | Passed |
| Backend tests | 20 passed, 0 failed |
| Angular production build | Passed; initial bundle approximately 370 kB raw / 86 kB estimated transfer |
| Angular component tests | 4 passed, 0 failed |
| Live frontend HTTP | 200 at http://127.0.0.1:4200 |
| Live login and GitHub search via API | Passed; 30 real results for angular |
| Live API bookmark | angular/angular stored and returned |
| Browser login | Passed |
| Browser search using Enter | Passed |
| Browser search using button | Passed |
| Browser bookmark state | Passed; count increased, button disabled as Bookmarked |
| Browser refresh | Same user and bookmark count retained; saved state confirmed on repeat search |
| Browser logout | Returned to login |
| Browser second account | demo2 starts with 0 bookmarks after demo1 saved a repository |

Backend automated checks cover invalid credentials, missing/invalid/expired tokens, independent users and logins, logout revocation, blank queries, unknown repository rejection, preservation of nested GitHub fields, concurrent duplicate saves, session expiry/capacity and upstream error translation. API tests substitute a fake GitHub service; HTTP-adapter tests use a fake response handler. Real GitHub was tested separately through the running API and browser.

Client automated checks cover blank searches, cancellation of stale searches, save acknowledgement and failed-save recovery.

## Limits

The optional Bookmarks screen is not implemented. Full mobile/accessibility audits, load testing, distributed deployment and persistence are outside this version. GitHub publication is a separate step requiring an authenticated GitHub account.

The machine's restricted execution environment initially blocked frontend file resolution and the .NET test host's Windows logging access. The same builds and tests passed when run with the required local execution permissions; application authentication was not disabled.
