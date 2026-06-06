# AI provenance and audit policy

## Disclosure

Status Dashboard was substantially generated, reviewed, and iterated with
help from generative AI under human direction. AI assistance may have been used
for source code, tests, documentation, design, and maintenance changes.
Individual lines are not labelled because later human and AI edits make that
attribution unreliable.

## Why the source is public

The project is open source in order to make its behaviour auditable. Users and
operators should be able to inspect:

- which remote endpoints the browser contacts;
- what configuration is retained locally;
- what information is included in exports and shared links;
- how untrusted status-page responses and imported JSON are processed;
- which third-party dependencies and build tools are used.

Publication supports review; it does not prove correctness or safety. AI output
can contain subtle security, privacy, accessibility, licensing, and logic
errors. Every release remains subject to human responsibility and should be
independently assessed for its deployment context.

## Contribution expectations

AI-assisted contributions are allowed, provided that contributors:

1. understand and take responsibility for the submitted change;
2. verify that they have the right to submit all code and assets;
3. do not include confidential prompts, credentials, personal data, or
   unlicensed material;
4. add or update appropriate tests and documentation;
5. accurately disclose material AI assistance in the pull request;
6. respond to review feedback rather than treating generated output as
   authoritative.

Maintainers may reject generated changes that are overly broad, unverifiable,
poorly tested, or difficult to audit.
