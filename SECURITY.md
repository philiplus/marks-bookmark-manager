# Security Policy

## Supported versions

Marks is developed on the `main` branch. Security fixes are applied there and, when a
release is affected, shipped in a new patch release.

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |
| < 1.0   | ❌        |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub's
[security advisories](https://github.com/philiplus/marks-bookmark-manager/security/advisories/new)
or by email to <filipemiguelcosta@outlook.com>. Include:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept
- Affected versions and your environment
- Any suggested fix, if you have one

You can expect an acknowledgement within 3 business days and a status update within
10 business days. Please give us a reasonable amount of time to release a fix before
disclosing the issue publicly. Credit will be given in the advisory unless you prefer
to remain anonymous.

## Scope and threat model

Marks is a **single-user, local-first application**. It is designed to run on your own
machine and has no authentication, authorization, or multi-tenancy. By design:

- Anyone who can reach the server can read and modify the entire bookmark database.
- The JSON database and exports contain your full bookmark library in plain text.
- The import endpoint accepts up to 30 MB of HTML per request.

Running Marks on a public network interface without an authenticating reverse proxy is
**not supported** and is considered a misconfiguration rather than a vulnerability.

Reports that are in scope include, for example:

- Cross-site scripting through imported or user-supplied bookmark titles, URLs, or
  descriptions
- Path traversal or arbitrary file read/write through API input
- Request smuggling or denial of service that is not simply "you sent a huge file"
- Dependency vulnerabilities with a demonstrable impact on the app

Out of scope: missing authentication (see above), issues requiring a compromised local
account or physical access, and reports produced solely by automated scanners without a
reproduction.

## Hardening tips

- Keep the server bound to localhost (the default) or put it behind an authenticating
  proxy.
- Back up `data/db.json` regularly and protect it like any other personal data file.
- Do not commit your database or `.env` file; both are ignored by git.
