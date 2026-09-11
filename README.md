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

That script creates or updates the bucket to private, JPEG-only, and 10 MiB per
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

## Private viewer links

The organizer sharing panel creates or replaces the tree's active private link.
Links use `/view/:treeId#token`, keeping the bearer secret out of HTTP paths and
referrers. The API stores only the SHA-256 token hash. Replacing a link immediately
invalidates the previous tree and gallery reads; photo URLs already issued remain
valid only until their five-minute expiry.

Viewer reads use `Authorization: Share token` on dedicated GET-only endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/viewer/trees/:treeId` | Load the shared tree and authoritative graph. |
| `GET` | `/viewer/trees/:treeId/photos` | Issue short-lived URLs for the shared private gallery. |

Anyone holding the link can view and forward it. Viewer tokens are never accepted
by organizer mutation routes, and viewer responses disable storage and indexing.

## Organizer relationship endpoints

All organizer endpoints require a verified Bearer access token. Relationship
creates return HTTP 201, removals return HTTP 200, and both return
`{ "graph": ... }` with the updated authoritative family graph.

| Method | Path | Input |
| --- | --- | --- |
| `POST` | `/trees/:treeId/relationships/parents` | `{ parentId, childId }` |
| `DELETE` | `/trees/:treeId/relationships/parents/:parentId/:childId` | Path IDs |
| `POST` | `/trees/:treeId/relationships/partners` | `{ person1Id, person2Id }` |
| `DELETE` | `/trees/:treeId/relationships/partners/:person1Id/:person2Id` | Path IDs in either order |

Every mutation acquires the tree lock before authorization, fresh graph loading,
domain validation, persistence, and the response reload. Parent and partner edges
remain independent; neither kind is inferred from the other.

Stop the app with Ctrl-C and stop local Supabase while keeping data with
`pnpm exec supabase stop`. Avoid database reset during routine development;
resetting deletes locally provisioned users and bucket metadata.
