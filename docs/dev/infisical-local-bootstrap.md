---
title: "Local Infisical bootstrap"
category: howto
status: current
created: 2026-08-05
updated: 2026-08-05
tags: [local-development, infisical, clerk, runtime]
---

# Local Infisical bootstrap

## The important distinction

Signing in to Infisical in Chrome does not sign in the Infisical CLI. Chrome
uses a browser cookie; `run.sh` uses the local `infisical` CLI session. The CLI
must be authenticated separately, and it must be able to read the Twoweeks
development project in the `dev` environment.

`.infisical.json` identifies the approved Infisical project, environment, and
domain. It is not a credential. `run.sh` retrieves only the development Clerk
publishable key, keeps it in memory for startup, and never prints it.

## First-time setup on a developer machine

From a clean Neyssan checkout:

```bash
./run.sh bootstrap
```

Complete the browser login opened by the CLI if it is not already authenticated.
Then verify the two separate gates:

```bash
infisical login status --domain=https://eu.infisical.com
./run.sh doctor local-fast
```

`bootstrap` can report two different outcomes. `Infisical authentication is
ready` means the credential lookup succeeded. `local-fast is blocked by
readiness checks above` means authentication is fine but a runtime prerequisite
still fails (for example, an untracked listener already owns a parser, Convex,
or Vite port). Fix the listed runtime blocker and rerun `./run.sh local-fast`;
do not repeat the browser login.

## Headless or CI setup

Use a scoped `INFISICAL_TOKEN` supplied by the approved secret manager. Never
paste that token into chat, commit it, or write it into a repository file.

For a local-only fallback, an ignored `my-app/.env.local` may contain the
development `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_CONVEX_URL`. The Clerk key
is publishable, but it must still be development-only and must not be confused
with a Clerk secret key.

## Port blockers

`./run.sh doctor local-fast` fails closed when an untracked process owns a
required port. Inspect the listener with the platform's read-only process
tools, or reuse the tracked stack shown by `./run.sh status`. Do not kill or
replace an unowned process automatically. Once the ports are available, rerun
`./run.sh doctor local-fast` and then `./run.sh local-fast`.

## Safety rules

- Never print or commit Infisical tokens, Clerk secret keys, or Convex private
  credentials.
- Use development Clerk credentials and synthetic local data for smoke tests.
- Keep the CLI authentication boundary separate from browser profile state.
- Treat a successful Infisical lookup and a healthy local runtime as separate
  acceptance checks.
