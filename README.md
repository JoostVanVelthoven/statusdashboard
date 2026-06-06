# Status Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Status Dashboard is a client-side Progressive Web App for monitoring multiple
Atlassian Statuspage services in one dashboard. It detects compatible status
pages, tracks incidents and planned maintenance, supports component-level
selection, and can share a dashboard configuration through a compressed URL.

## Transparency and auditability

> **AI-assisted project:** this codebase was substantially generated and
> refined with generative AI under human direction. It is published as open
> source specifically so operators, users, and security researchers can audit
> the implementation instead of having to trust an opaque hosted service.

AI generation is not a security guarantee. Treat the code like any other
third-party software: review it, run the checks, inspect dependency alerts, and
assess it for your own threat model before deployment. See
[AI_PROVENANCE.md](AI_PROVENANCE.md) for the project's disclosure policy.

## Features

- Monitor multiple public Atlassian Statuspage instances.
- Detect overall and component-level degradation.
- Display upcoming and active planned maintenance.
- Store configuration locally in the browser; no application account or
  backend is required.
- Import and export dashboard settings as JSON.
- Share selected public status pages using a compressed URL fragment.
- Install the dashboard as a PWA and retain the application shell offline.

## Supported status pages and limitations

The current provider integration expects the Atlassian Statuspage v2 endpoints
`/api/v2/status.json`, `/api/v2/summary.json`, and, where available,
`/api/v2/scheduled-maintenances.json`.

The browser contacts status-page hosts directly. Those hosts must allow the
request through CORS. A page can therefore work in a normal browser tab while
still being unavailable to this dashboard because of its CORS policy.

Status Dashboard is an informational client. It is not a substitute for an
independent monitoring or alerting system and must not be used as the sole
source for safety-critical or availability-critical decisions.

## Privacy and data flow

- Dashboard settings are stored in the browser's `localStorage` under
  `status-monitor-pages`.
- Status data is fetched directly from URLs selected by the user.
- The project does not include analytics, advertising, user accounts, or an
  application backend.
- JSON exports contain the configured page names, URLs, API endpoints,
  component IDs, and timestamps.
- Shared dashboard links contain compressed configuration in the URL fragment.
  Compression is **not encryption**. Anyone receiving a link can recover its
  contents, so do not include confidential or internal status-page URLs.
- Choosing a platform-specific share action can open that third-party service;
  its own privacy policy then applies.

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- A modern browser with `CompressionStream` and `DecompressionStream` support
  for compressed dashboard sharing

## Development

```bash
git clone <repository-url>
cd statusdashboard
npm ci
npm run dev
```

Vite prints the local development URL. No environment variables or secrets are
required.

## Quality checks

```bash
npm run lint
npm run test:run
npm run build
npm audit
```

Pull requests run linting, tests, a production build, and a production
dependency audit in GitHub Actions.

## Self-hosting

Create the static production output with:

```bash
npm ci
npm run build
```

Deploy the generated `dist/` directory to any static host. Configure the host
to serve `index.html` for unknown application routes because the app uses
client-side routing. Serve it over HTTPS so the service worker and PWA features
work reliably.

Before publishing a fork, review and adjust:

- canonical and social URLs in `index.html`;
- application name, description, colors, and icons in
  `public/manifest.webmanifest`;
- cache naming in `public/sw.js` when changing the service-worker strategy;
- product wording and visual identity.

The name, icons, and hosted domain are descriptive project assets and do not
imply that forks are official deployments.

## Architecture

- React and TypeScript render the browser application.
- Vite builds and serves the static assets.
- `src/services/detectStatusPageProvider.ts` validates HTTPS URLs and detects
  compatible providers.
- `src/services/fetchStatusPageStatus.ts` fetches and normalizes status data.
- `src/services/localStorageStatusPages.ts` handles local JSON persistence.
- `src/services/shareDashboard.ts` creates and resolves share fragments.
- `public/sw.js` provides the small offline application shell.

## Contributing and security

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and follow
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Do not disclose vulnerabilities in a public issue. Follow
[SECURITY.md](SECURITY.md) to report them privately.

## License

Status Dashboard is available under the [MIT License](LICENSE).
