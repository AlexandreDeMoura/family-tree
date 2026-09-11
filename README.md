# Family Tree

A private, shareable family tree for one organizer and read-only relatives.
This repository currently implements commits 01–11 of the
[MVP plan](family_tree_constrained_mvp_prd.md#28-implementation-commit-plan):
the development foundation, shared person schemas and graph rules, private SQL
persistence, organizer editing, automatic tree layout, person cards, verified
private photos, account-free read-only viewer links, automated MVP integrity
coverage, and synthetic manual-acceptance fixtures. UI acceptance remains manual
as required by the project workflow.

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

The shared package builds before the app watchers start.

On a new clone, install dependencies yourself with `pnpm install --frozen-lockfile`.
Follow setup steps 6–8 for local Supabase, environment files, an organizer, and
the private bucket; do not rerun the earlier scaffold file-writing blocks.
Hosted Supabase is optional and documented in setup steps 10–11.

### Local URLs

| Service | URL |
| --- | --- |
| Web app (Vite) | `http://localhost:5173` |
| API (Fastify) | `http://localhost:3001` (liveness at `/health`) |
| Supabase Studio (database dashboard) | `http://127.0.0.1:54323` |
| Supabase API (Auth, Storage, REST) | `http://127.0.0.1:54321` |
| PostgreSQL (direct connection) | `127.0.0.1:54322` |
| Local email inbox (Mailpit) | `http://127.0.0.1:54324` |
| Contour repository viewer | First free port in `4310`–`4319`; open the URL `pnpm view:repo` prints |

`pnpm exec supabase status` prints the Supabase URLs together with the local keys
and database URL used in `apps/api/.env` and `apps/web/.env.local`.

### Essential commands

Run these from the repository root. The Supabase CLI is a project dependency, so
always call it through `pnpm exec supabase`, not a global install.

| # | Command | Purpose |
| --- | --- | --- |
| 1 | `pnpm install --frozen-lockfile` | Install locked dependencies on a new clone or after pulling. |
| 2 | `pnpm exec supabase start` | Start local Supabase (PostgreSQL, Auth, Storage, Studio). Docker must be running. |
| 3 | `pnpm dev` | Build `family-core`, then run the web, API, and core watchers in parallel. |
| 4 | `pnpm exec supabase status` | Show local Supabase URLs, keys, and the database connection string. |
| 5 | `pnpm exec supabase stop` | Stop local Supabase and keep its data. |
| 6 | `pnpm exec supabase migration new <name>` | Create a new SQL migration in `supabase/migrations/`. |
| 7 | `pnpm exec supabase migration up --local` | Apply pending migrations to your everyday local database. |
| 8 | `pnpm test` | Run domain, API, and layout tests (no Supabase needed). |
| 9 | `pnpm test:db` | Run database tests against local Supabase in a disposable database. |
| 10 | `pnpm validate` | Full gate: lint, typecheck, tests, builds, and the Contour manifest check. |

### Contour manifest tooling

[Contour](https://www.npmjs.com/package/@trompetteman/contour) validates and
browses the project manifest in `.contour/manifest/`. It is a root dev
dependency; use the installed binary through pnpm and never let validation
download it.

| Command | Purpose |
| --- | --- |
| `pnpm check:manifest` | Run `contour check`: read-only validation of manifests, references, and contracts. Exit code `1` means blocking findings. |
| `pnpm view:repo` | Run `contour serve`: open the local repository companion (manifests, contracts, source, Git). |
| `pnpm exec contour serve --port 4311` | Serve on a specific port when the default range is busy (`--port 0` picks any free port). |
| `pnpm exec contour check --json` | Print findings as versioned JSON. |
| `pnpm exec contour check --write` | Persist current findings into the generated section of `attention.yaml` only. Keep CI read-only. |
| `pnpm exec contour init` | Create missing manifest slices and refresh Contour-owned agent instruction blocks. |
| `pnpm exec contour prompt bootstrap` | Print the bootstrap prompt for describing an existing repository. |
| `pnpm exec contour --version` | Show the installed version. |

To update Contour, review its release changes, then:

```sh
pnpm outdated @trompetteman/contour               # compare installed and latest versions
pnpm add -Dw @trompetteman/contour@<version>      # install the new version at the workspace root
pnpm exec contour init                            # refresh Contour-owned instruction blocks
pnpm validate                                     # rerun the full gate, including the manifest check
```

Pre-1.0 caret ranges do not cross minor versions, so `pnpm update` will not move
`^0.4.0` to `0.5.x`; name the version explicitly. `init` only refreshes Contour's
owned blocks, so review existing manifest entries against any new guidance.
Commit the updated `package.json` and `pnpm-lock.yaml` together.

## Workspace

| Package | Responsibility |
| --- | --- |
| `apps/web` | React/Vite organizer and read-only viewer surfaces; browser Supabase is limited to Auth and signed uploads. |
| `apps/api` | Fastify organizer/viewer APIs, authorization, PostgreSQL graph mutations, hash-only share links, and signed photo access. |
| `packages/family-core` | Pure Zod schemas, person/graph validation, and immediate-family derivation, emitted as ESM and TypeScript declarations. See its [usage guide](packages/family-core/README.md). |
| `supabase` | Local CLI configuration, family schema migrations, row constraints, and private access boundaries. See the [persistence guide](supabase/README.md). |

Both apps declare `@family-tree/family-core` as a workspace dependency. Recursive
production builds build it first. The API keeps application credentials server-side;
the browser receives only the publishable key. Environment examples contain
placeholders and local defaults; real `.env` files are ignored.

## Validation

```sh
pnpm validate
```

Runs web lint, workspace typecheck, domain/API/layout tests, ordered production
builds, and the installed Contour manifest check. Tests cover every MVP invariant,
graph mutations, ancestry DFS, sibling derivation, private access and photos, API
liveness, and configured CORS without requiring local Supabase. `pnpm test` fails
if no tests are discovered.
The manifest check validates repository references and metadata, not product behavior.

Production uses a separately hosted HTTPS SPA, persistent Fastify API, and hosted
Supabase project. Follow the [deployment and MVP operations runbook](docs/deployment-and-operations.md)
for environment boundaries, migrations, private bucket provisioning, SPA fallback,
CORS, release checks, link revocation, photo recovery, and rollback procedures.

For database changes, also run `pnpm test:db` against local Supabase. It applies
the migrations and tests constraints, browser-role denial, and transaction locks
in a disposable database without resetting your existing data. Apply the schema
to your everyday local instance with `pnpm exec supabase migration up --local`.
CI runs these non-UI checks from a frozen lockfile and starts local Supabase for
the disposable database suite.

With the API running, check the actual HTTP endpoint separately:

```sh
curl --fail http://localhost:3001/health
```

Expected: `{"status":"ok"}`. This is liveness only. To check PostgreSQL and
provision or reconcile the private `family-photos` bucket, use:

```sh
node --env-file=apps/api/.env apps/api/scripts/setup-supabase.mjs
```

That script creates or updates the bucket to private, JPEG-only, and 5 MiB per
file. It does not create family tables or an organizer. UI QA remains manual.

## Manual acceptance fixture

After local Supabase, migrations, the organizer, and the private photo bucket are
ready, create a new synthetic acceptance tree with:

```sh
pnpm seed:acceptance
```

The seed is local-only and additive. It covers the large and incomplete family
structures that need human layout and interaction review, while leaving photos
empty so the signed upload path is tested for real. Follow the complete
[MVP manual acceptance checklist](docs/manual-acceptance.md) and record results
before changing any product capability from in-progress to shipped.

