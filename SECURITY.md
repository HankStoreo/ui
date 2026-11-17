# Security

## Supported versions

Only the latest release gets fixes. This library is pre-1.0, so update to the newest tag.

## Reporting a vulnerability

Report it privately through this repository's **Security** tab ("Report a vulnerability"). Please don't open a public issue. You should get a reply within a week.

The components run in the browser with no network calls or dependencies of their own, so the likely issues are script injection through attributes the components read (for example `data-tip`) or markup they build.
