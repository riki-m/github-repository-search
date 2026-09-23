# Quality assurance documentation

Start with the [project README](../../README.md) for setup and usage.

| Location | Purpose |
| --- | --- |
| [QA_REPORT.md](QA_REPORT.md) | Requirement coverage, review findings, fixes and submission readiness within the documented scope. |
| [VERIFICATION.md](VERIFICATION.md) | Current verification summary, limitations and clearly labelled historical checks. |
| [evidence/live-search-identity.json](evidence/live-search-identity.json) | Timestamped comparisons of repository identities, order and displayed fields between GitHub and the local API. |
| [evidence/live-search-ranking.json](evidence/live-search-ranking.json) | Timestamped comparisons for the supported ranking modes. |

These reports and evidence files are review material, not application configuration or runtime data. GitHub results change over time; the saved observations are not permanent expected rankings.

The [live comparison script](../../scripts/Verify-LiveSearch.ps1) can reproduce the checks. Follow the commands and prerequisites in the [project README](../../README.md#troubleshooting-and-current-verification). Its default output is `docs/qa/evidence/live-search-evidence.json`; an explicit `-OutputPath` selects another file. Running the documented commands again replaces their evidence files, so review the resulting differences before committing.

Code paths in the reports are relative to the repository root unless stated otherwise.
