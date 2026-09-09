# Family Tree

A private, shareable family tree for one organizer and read-only relatives.
This repository currently implements commit 01 of the
[MVP plan](family_tree_constrained_mvp_prd.md#28-implementation-commit-plan):
the development foundation and a starter page with an API health endpoint.
Family schemas, graph rules, authorization, tree rendering, and photo workflows
are subsequent commits.

## Local development

Use Node.js 24, pnpm 10 (the exact version is in `package.json`), and a running
Docker-compatible runtime for local Supabase.

If you already completed [SETUP.md](SETUP.md) steps 1–9, keep your existing local
environment files, organizer, and bucket. Start the existing services from the
repository root:

```sh
pnpm exec supabase start
pnpm dev
```

The web shell runs at `http://localhost:5173`, the API at
`http://localhost:3001`, and local Supabase Studio at `http://127.0.0.1:54323`.
The shared package builds before the app watchers start.

On a new clone, install dependencies yourself with `pnpm install --frozen-lockfile`.
Follow setup steps 6–8 for local Supabase, environment files, an organizer, and
the private bucket; do not rerun the earlier scaffold file-writing blocks.
Hosted Supabase is optional and documented in setup steps 10–11.

## Workspace

| Package | Responsibility |
| --- | --- |
| `apps/web` | React/Vite/Tailwind shell with Router and Query providers; browser Supabase client for future Auth and signed uploads. |
| `apps/api` | Fastify health endpoint, CORS, validated server environment, and server-only Supabase client. |
| `packages/family-core` | Pure shared package scaffold, emitted as ESM and TypeScript declarations; domain rules follow in commit 02. |
| `supabase` | Local CLI configuration and tracked migration directory; application SQL follows in commit 03. |

Both apps declare `@family-tree/family-core` as a workspace dependency. Recursive
production builds build it first. The API keeps application credentials server-side;
the browser receives only the publishable key. Environment examples contain
placeholders and local defaults; real `.env` files are ignored.

## Validation

```sh
pnpm validate
```

Runs web lint, workspace typecheck, API injection tests, ordered production builds,
and the installed Contour manifest check. Tests cover API liveness and configured
CORS without requiring local Supabase. `pnpm test` fails if no tests are discovered.
The manifest check validates repository references and metadata, not product behavior.

With the API running, check the actual HTTP endpoint separately:

```sh
curl --fail http://localhost:3001/health
```

Expected: `{"status":"ok"}`. This is liveness only. To check PostgreSQL and
provision or reconcile the private `family-photos` bucket, use:

```sh
node --env-file=apps/api/.env apps/api/scripts/setup-supabase.mjs
```

That script creates or updates the bucket to private, JPEG-only, and 10 MiB per
file. It does not create family tables or an organizer. UI QA remains manual.

Stop the app with Ctrl-C and stop local Supabase while keeping data with
`pnpm exec supabase stop`. Avoid database reset during routine development;
resetting deletes locally provisioned users and bucket metadata.
