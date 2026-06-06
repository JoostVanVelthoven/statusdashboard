# Security policy

## Supported versions

Security fixes are provided for the latest release on the default branch. Old
releases and third-party forks are not supported unless their maintainers state
otherwise.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's **Report a vulnerability** / private vulnerability reporting
feature for this repository. If that feature is unavailable, contact the
repository owner privately through the contact method shown on their GitHub
profile and include `Status Dashboard security report` in the subject.

Include, where possible:

- affected commit or release;
- impact and realistic attack scenario;
- reproduction steps or a minimal proof of concept;
- suggested remediation;
- whether the report contains information that must remain confidential.

Please allow a reasonable period for triage and remediation before public
disclosure. Receipt should normally be acknowledged within seven days, but
this community project provides no response-time guarantee or bug bounty.

## Security model

Status Dashboard is a static browser application without its own backend. It
processes untrusted URLs, remote JSON, imported settings, local storage, and
share fragments. Shared links and JSON exports are not encrypted. Deployers
must use HTTPS, maintain dependencies, review host security headers, and assess
the application against their own threat model.
