# Deployment and MVP operations

This runbook covers the constrained MVP described in the PRD: one organizer,
an unlisted account-free viewer link, a static browser application, a persistent
Fastify API, and one hosted Supabase project. It is provider-neutral. Record the
chosen frontend and API hosts, their owners, and their rollback controls in the
release record before the first production release.

Use three separate HTTPS origins in production:

| Runtime | Example | Responsibility |
| --- | --- | --- |
| Web SPA | `https://family.example.com` | Static `apps/web/dist` files and client-side routes. |
| Fastify API | `https://api.family.example.com` | Authentication, authorization, family reads/writes, and signed photo operations. |
| Supabase | `https://PROJECT_REF.supabase.co` | PostgreSQL, the sole organizer's Auth account, and private Storage. |

Use a separate Supabase project and separate API/web deployments for staging.
Never connect a preview deployment, synthetic seed, or disposable database test
to production.

## Production configuration

### API

Configure these as server-side environment variables in the API host. Do not put
them in the web build, commit them, or print them in release logs.

| Variable | Production value |
| --- | --- |
| `PORT` | The port assigned by the host. Defaults to `3001` only when omitted. |
| `HOST` | `0.0.0.0` for a container or host that requires binding on all interfaces. |
| `WEB_ORIGIN` | The exact public frontend origin, such as `https://family.example.com`, with no path or trailing slash. |
| `SUPABASE_URL` | The hosted project URL. |
| `SUPABASE_SECRET_KEY` | The hosted server secret key. |
| `DATABASE_URL` | The hosted PostgreSQL connection string, with the required TLS settings. |
| `ORGANIZER_USER_ID` | The UUID of the one hosted Supabase Auth user allowed to organize trees. |

`WEB_ORIGIN` configures one exact CORS origin. Do not use `*`, a comma-separated
list, or the API origin. A staging or preview frontend therefore needs its own API
configuration. CORS is only a browser boundary; the API still authorizes every
organizer request and every private viewer read.

The API logger redacts the `Authorization` header. Keep platform request logging
from recording headers, database URLs, Supabase secrets, or full private viewer
links. The viewer token is stored in the URL fragment and must remain there.

### Web SPA

Set these when building the web application. Vite embeds every `VITE_*` value in
the public JavaScript bundle, so only public browser configuration belongs here.

| Variable | Production value |
| --- | --- |
| `VITE_API_URL` | The public HTTPS API origin, such as `https://api.family.example.com`, with no trailing slash. |
| `VITE_SUPABASE_URL` | The same hosted project URL used by the API. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The project's browser-safe publishable key. |

Never expose `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `ORGANIZER_USER_ID`, the
organizer password, or a private viewer token through a `VITE_*` variable.
Rebuild the SPA after any web environment change.

Serve only over HTTPS. The public web and API URLs, Supabase Auth Site URL, Auth
redirect allow-list, and CORS origin must all use the final HTTPS frontend/API
origins; otherwise browsers may block requests as mixed content or reject CORS.

### SPA route fallback

Configure the static host to serve a real asset when it exists and internally
rewrite every other path to `/index.html` with HTTP 200. Do not issue a redirect
to `/`, because that loses the React Router path. At minimum, direct loads and
refreshes of these routes must reach the SPA:

- `/sign-in`
- `/organizer`
- `/organizer/trees/:treeId`
- `/view/:treeId`

The secret portion of a viewer link follows `#` and is never sent to the static
host. Preserve the browser URL during fallback so the application can read it.

### Hosted Supabase

1. Create the project and store its database password in the team password
   manager.
2. Disable public sign-up, keep email/password sign-in enabled, and create exactly
   one confirmed organizer account administratively. Copy its UUID into the API's
   `ORGANIZER_USER_ID`.
3. Set Auth **Site URL** to the production frontend origin and allow the exact
   `https://family.example.com/auth/callback` URL. Add only intentional staging
   or local callback URLs; do not use an unrestricted production wildcard.
4. Link the CLI to the intended project, review the target, preview migrations,
   and apply the tracked files:

   ```sh
   pnpm exec supabase login
   pnpm exec supabase link --project-ref YOUR_PROJECT_REF
   pnpm exec supabase db push --dry-run
   pnpm exec supabase db push
   ```

5. Create `apps/api/.env.hosted` locally with only `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, and `DATABASE_URL`. Confirm it is ignored, then run the
   idempotent connectivity and bucket reconciliation script:

   ```sh
   git check-ignore apps/api/.env.hosted
   node --env-file=apps/api/.env.hosted apps/api/scripts/setup-supabase.mjs
   ```

   It checks PostgreSQL and creates or updates one `family-photos` bucket as
   private, JPEG-only, and limited to 5 MiB. Do not add public Storage policies.

Changing only `ORGANIZER_USER_ID` does not transfer existing tree ownership. If
the sole organizer account must change, plan and verify a database ownership
migration as a separate release before retiring the old Auth user.

## Build and deploy

The supported runtime is Node.js 24 with pnpm 10. On a clean release checkout,
the operator installs the locked dependencies and runs the checks:

```sh
pnpm install --frozen-lockfile
pnpm validate
pnpm test:db
pnpm build
```

`pnpm validate` runs lint, typecheck, non-UI tests, production builds, and the
Contour manifest check. `pnpm test:db` uses local Supabase and a disposable test
database; it deliberately refuses a non-local database URL. It does not validate
the hosted project.

Deploy in this order:

1. Confirm a recoverable production database backup exists and separately confirm
   how private Storage objects are backed up. A database backup alone must not be
   assumed to include photo objects.
2. Apply reviewed forward migrations to the linked hosted Supabase project.
3. Run `setup-supabase.mjs` against the hosted project to verify connectivity and
   reconcile the private bucket.
4. Deploy the API build with its server-only environment. Its runtime needs the
   production workspace dependencies plus both `apps/api/dist` and
   `packages/family-core/dist`; `apps/api/dist` is not a standalone bundle. From
   the repository root, start it with `node apps/api/dist/server.js`; from an
   `apps/api` working directory with the workspace dependency resolvable, use
   `node dist/server.js`.
5. Check `curl --fail https://api.family.example.com/health`. The expected body
   is `{"status":"ok"}`. This proves only that the API process is live; it does
   not query PostgreSQL, Auth, or Storage.
6. Build the SPA with the final public variables and publish `apps/web/dist` with
   the route fallback above.
7. Confirm the hosted Auth Site URL, redirect allow-list, and API `WEB_ORIGIN`
   are based on the deployed frontend origin exactly as described above.
8. Complete the staging/release-candidate checklist in
   [manual-acceptance.md](manual-acceptance.md). UI acceptance belongs to the
   organizer and is required before production release.

The package script `pnpm --filter @family-tree/api start` loads
`apps/api/.env`. It is suitable only when that ignored file is intentionally
mounted; most production hosts should inject environment variables and use the
direct `node` command above.

## Release checklist

Record each item and the deployed commit SHA in the release record.

- [ ] The release SHA passed `pnpm validate` in CI or a clean checkout.
- [ ] `pnpm test:db` passed against disposable local Supabase.
- [ ] The migration dry run targeted the correct hosted project and was reviewed.
- [ ] Database and private-photo recovery arrangements were confirmed before migration.
- [ ] The sole hosted organizer UUID matches `ORGANIZER_USER_ID`; public sign-up is disabled.
- [ ] The private bucket reconciliation script passed with hosted credentials.
- [ ] API secrets exist only in server-side configuration; the web bundle contains only the three documented app-defined `VITE_*` values.
- [ ] Web, API, Supabase, Auth redirects, SPA fallback, and CORS use the intended HTTPS origins.
- [ ] API liveness passed, followed by an authenticated tree read and a private signed-photo read to establish dependency readiness.
- [ ] The organizer completed and recorded all manual MVP acceptance checks.
- [ ] A newly issued private viewer link works signed out, is read-only, and communicates that anyone with the link can view it.
- [ ] The previous API and web artifacts remain available for code rollback.

## Routine development and schema changes

Start and stop local services without deleting local data:

```sh
pnpm exec supabase start
pnpm exec supabase migration up --local
node --env-file=apps/api/.env apps/api/scripts/setup-supabase.mjs
pnpm dev
pnpm exec supabase stop
```

Create one new migration for each schema change, test it locally, then preview it
against hosted Supabase before applying it:

```sh
pnpm exec supabase migration new describe_your_schema_change
pnpm exec supabase migration up --local
pnpm test:db
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

SQL migrations are the schema source of truth. The current API uses explicit
typed PostgreSQL query mappings and does not consume generated Supabase types.
If generated types are introduced, regenerate them from the migrated local schema
and review the resulting diff before typecheck/build:

```sh
pnpm exec supabase gen types typescript --local > apps/api/src/lib/database.types.ts
pnpm typecheck
```

Do not use `supabase db reset` for routine work or against production. A local
reset deletes local data, Auth users, and bucket metadata and requires organizer
and bucket provisioning again.

The synthetic acceptance seed is additive and local-only:

```sh
pnpm seed:acceptance
```

It creates a new synthetic tree on every run and prints its organizer URL. The
script rejects non-local PostgreSQL hosts. Never copy this fixture or a real
family's data between environments.

## Operating procedures

### Replace a private viewer link

Use **Replace private link** in the organizer sharing panel when a link is lost,
forwarded unexpectedly, or should be revoked. Copy the replacement immediately:
only its SHA-256 hash is stored, so the raw link cannot be recovered later. The
old token stops authorizing tree and gallery reads as soon as replacement
completes. Signed photo URLs already issued may remain usable for at most five
minutes. Do not put private links in tickets, analytics, monitoring, or logs.

### Recover photo operations

- If upload or publication fails and the UI shows **Retry unfinished-upload
  cleanup**, leave the page open and use that action until it succeeds. No photo
  metadata is visible before publication.
- If cleanup reports that the photo was already published, refresh the tree; the
  completed record is authoritative.
- If a published photo is shown as unavailable, use the normal gallery delete
  action and retry it if necessary. Storage deletion happens before metadata
  deletion, making the same action safe after a partial database failure.
- If all uploads fail after a deployment, verify API/PostgreSQL/Supabase
  connectivity and rerun `setup-supabase.mjs` with hosted credentials to restore
  the required private, JPEG-only, 5 MiB bucket configuration.
- Do not delete photo rows directly or make the bucket public. Database cascades
  do not remove Storage objects, so manual SQL deletion can create private
  orphans and lose the path needed for cleanup.

### Triage service incidents

1. Check `/health` and API process logs. A healthy response means liveness only.
2. Check an authenticated organizer tree read to cover Auth and PostgreSQL, then
   a gallery read to cover signed Storage access. Use synthetic staging data, not
   a production private link, in shared diagnostics.
3. Confirm the deployed environment belongs to one Supabase project and that
   frontend/API origins match. Mixed projects commonly appear as failed sign-in,
   forbidden organizer access, or missing photos.
4. For a leaked viewer link, replace it immediately. For a leaked server secret
   or database credential, rotate it at the provider, update only the API host,
   redeploy, and verify old credentials no longer work.
5. Preserve failing request IDs, timestamps, status/error codes, and sanitized
   logs. Never retain authorization headers, raw viewer tokens, photo signed URLs,
   organizer passwords, or family content in an incident ticket.

### Roll back or recover

Roll back web and API artifacts independently when the database remains compatible.
After any API rollback, repeat liveness plus authenticated tree and photo checks.
Do not reverse an applied production migration with `db reset`, delete a migration
file, or edit hosted tables ad hoc. Create and review a new forward corrective
migration. If data restoration is required, stop writes, preserve the incident
state, and follow the hosting provider's tested database and Storage recovery
procedures; restore both metadata and private objects to a separate environment
first and verify their tree/person paths before production cutover.

The MVP has no background worker, automatic orphan sweeper, public data export,
or in-app disaster-recovery workflow. These limits must be part of the operating
expectation rather than silently delegated to the application.
