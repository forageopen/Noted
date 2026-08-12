# Security Policy

Noted is a browser-native, local-first app with no backend of its own (see `docs/product/PRODUCT-SPEC.md`) - a loaded file never leaves your machine, and there's no account or server-side data to compromise. The realistic risk surface is the app itself: the code that ships to `https://forageopen.github.io/Noted/`, and the small number of third-party services it talks to (GoatCounter for visitor counting, GitHub Pages for hosting).

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security report.

Use GitHub's private vulnerability reporting instead: go to the [Security tab](https://github.com/forageopen/Noted/security) of this repository and select **"Report a vulnerability"**. This opens a private advisory visible only to the maintainer, so the issue isn't disclosed before a fix ships.

Include, if you can:

- What you found and why it's a security issue (not just a bug).
- Steps to reproduce, or a proof-of-concept `.md`/`.docx` file if relevant.
- The impact you'd expect (e.g. what an attacker could actually do with it).

## Scope

In scope:

- The application code in `src/`, `index.html`, `styles.css`.
- The build/deploy pipeline (`.github/workflows/`).
- Anything that could execute unintended script in a visitor's browser (XSS), leak data that should stay local, or compromise the deployed site's integrity.

Out of scope:

- Third-party services this app links to or embeds a tracking script for (GoatCounter, GitHub Pages itself) - report those to their own maintainers.
- Findings that require an already-compromised browser, OS, or extension.

## Supported versions

Only the latest release (see `CHANGELOG.md` and the [Releases page](https://github.com/forageopen/Noted/releases)) is supported. There is no LTS branch.
