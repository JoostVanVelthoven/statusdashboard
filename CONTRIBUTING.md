# Contributing

Thank you for helping improve Status Dashboard.

## Before opening an issue

- Search existing issues first.
- Do not post private status-page URLs, JSON exports, credentials, internal
  component identifiers, or vulnerability details in a public issue.
- For security reports, follow [SECURITY.md](SECURITY.md).

A useful bug report includes the browser and version, reproducible steps,
expected and actual behaviour, and whether the status-page host permits CORS.
Only include a status-page URL when it is already public.

## Local setup

```bash
npm ci
npm run dev
```

Node.js 20.19 or newer is required.

## Required checks

Run these commands before submitting a pull request:

```bash
npm run lint
npm run test:run
npm run build
npm audit
```

Add tests for changed behaviour. Keep changes focused and update user-facing
or architectural documentation when behaviour changes.

## Pull requests

Explain:

- the problem and chosen solution;
- security, privacy, accessibility, and compatibility considerations;
- how the change was tested;
- whether generative AI materially assisted the work.

By submitting a contribution, you certify that you have the right to provide
it under the project's MIT License.

## AI-assisted contributions

AI assistance is allowed, but generated output must be reviewed and understood
by the contributor. Follow [AI_PROVENANCE.md](AI_PROVENANCE.md). Never submit
secrets, private data, copied proprietary code, or assets without compatible
licensing.

## Style

- Use TypeScript for application logic.
- Keep browser input and remote data validation explicit.
- Do not weaken HTTPS-only URL handling without a documented reason.
- Prefer small functions and tests for parsing, normalization, and merging.
- Keep the application backend-free unless a proposal has first been discussed.
