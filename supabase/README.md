# Family persistence

Commit 03 adds the family schema and server transaction boundary. Apply the
tracked migration to local Supabase without resetting existing data:

```sh
pnpm exec supabase migration up --local
pnpm test:db
```

No additional packages are needed in an initialized checkout. `pg` and its types
are already declared in `apps/api/package.json`.

## Stored data and constraints

| Table | Purpose and boundaries |
| --- | --- |
| `trees` | Name and one required organizer referencing `auth.users(id)`. An organizer may own multiple trees; sole-organizer authorization is implemented in commit 04. |
| `people` | Explicit life status, nullable integer years, adoption, zero to three nonblank text facts, and independent parent/partner/child completeness flags (default unknown). |
| `parent_child` | Unique directed edges; both people must belong to the supplied tree. No self-links. |
| `partnerships` | Unique unordered pairs stored with `person1_id < person2_id`; callers canonicalize UUID pairs. Multiple partners are allowed. |
| `photos` | One required age bucket and a unique `trees/{treeId}/people/{personId}/{photoId}.jpg` path. Composite foreign keys bind photos and main portraits to the same person and tree. |
| `tree_share_links` | One active SHA-256 viewer-token hash per tree. Replacing the row invalidates the prior viewer link; raw bearer tokens are never persisted. |

Person checks reject death before birth and living people with a death year.
A write trigger rejects death years beyond the current UTC year. Unknown years
and equal birth/death years are valid. No age is inferred from years.

No siblings, layout coordinates, placeholder people, or routing nodes are stored.
There are no share secrets on `trees`; viewer access uses the separate hash-only
`tree_share_links` table.
Application reads must project only the fields needed by their response.

## Transactions and validation

`apps/api/src/lib/database.ts` exports `createDatabasePool` and
`withTreeTransaction(pool, treeId, work)`. Future services must use this helper
for **every graph-affecting write**, including person creation, edits, deletion,
parent/partner changes, and tree deletion. New tree creation has no existing row
to lock and must authorize its organizer before inserting.

The helper obtains one pooled connection, begins a READ COMMITTED transaction,
locks the tree with `SELECT ... FOR UPDATE`, then invokes `work(client)`.
The service checks ownership, loads the graph, calls shared domain validation,
and writes through that same client. It must not use a graph loaded before the
lock or call `pool.query` from inside the transaction. Services return only after
commit. Missing trees fail before the callback; errors roll back and release the
connection, discarding a connection if rollback fails. The API process that
creates the pool must call `pool.end()` during shutdown.

Waiting writers read a fresh graph after acquiring the common lock. Different
trees can be updated independently. This follows [node-postgres transaction
guidance](https://node-postgres.com/features/transactions) and PostgreSQL's
[READ COMMITTED behavior](https://www.postgresql.org/docs/current/transaction-iso.html).

The migration enforces row constraints, uniqueness, and ownership foreign keys.
Maximum two parents, ancestry cycles, and connected birth-year ordering remain
the shared domain validators' responsibility inside locked API services in
commits 04–05. The helper supplies transaction ordering; it does not perform
authorization or graph validation itself. There are no family mutation endpoints
yet. Trusted direct SQL can bypass these application-level graph rules.

## Access and deletion

All six tables have RLS enabled with no policies. Existing grants to `PUBLIC`,
`anon`, and `authenticated` are revoked, including for authenticated organizers;
browser clients must use Fastify. Future tables, sequences, and functions created
by the migration owner in `public` also default to no browser grants. A different
migration owner must establish the same defaults and explicitly secure new
objects. The trusted `service_role` has SELECT/INSERT/UPDATE/DELETE privileges;
server credentials remain private. Supabase Auth and signed Storage operations
continue to use the Supabase clients.

Deleting an organizer who still owns a tree is restricted. Deleting a tree
cascades its people, edges, partnerships, share hash, and photo metadata. Deleting a person
cascades their edges, partnerships, and photo metadata. Deleting a main photo
sets only `main_photo_id` to null, preserving the person. Composite foreign keys
use restrictive updates: IDs are stable and moving connected records between
trees is not an edit operation.

Database cascades do **not** delete Storage objects. Photo deletion therefore
removes the private object before deleting its metadata; if the database write
fails, the missing-image record remains visible to the organizer and the same
delete action safely retries cleanup. Failed publication removes its unfinished
object, with an authenticated cleanup endpoint available when a retry is needed.
Migrations do not manipulate Supabase Storage tables or add public Storage
policies. The setup script provisions the single private `family-photos` bucket
through the Storage API with a 5 MiB JPEG limit.

## Database verification

`pnpm test:db` loads `apps/api/.env` and runs the database integration suite.
For an already configured environment (such as CI), use `pnpm test:db:run`.
`DATABASE_URL` must point directly to a local PostgreSQL instance, using a
database administrator permitted to create databases and switch to Supabase's
existing roles. Non-local hosts are rejected.

The suite creates a uniquely named `family_test_*` database from `template0`,
provides the `auth.users(id)` foreign-key fixture, simulates Supabase's permissive
initial grants, and applies all tracked SQL migrations. It uses the local
cluster's real `anon`, `authenticated`, and `service_role` roles. The database
is dropped on completion; existing family data, Auth users, and Storage data
are never copied or reset. Tests cover constraints, ownership, cascades, grants,
default-deny RLS, commits, rollbacks, and actual PostgreSQL lock contention.
This suite does not test the Auth or Storage services.

`pnpm validate` remains the database-independent lint/typecheck/unit-test/build/
manifest check. Run both commands for persistence changes. Do not use
`supabase db reset` on the everyday development database for testing.
