# Project initialization and Supabase setup

Run the steps below yourself, in order, from macOS Terminal (zsh). The starting folder contains only the PRD and `AGENTS.md`, with no Git repository or application packages. These commands create a runnable development foundation for commit 01 of the [PRD plan](family_tree_constrained_mvp_prd.md#28-implementation-commit-plan). Family tables, authorization endpoints, graph rules, and product screens are implemented in the subsequent commits.

Run each block separately and stop if it fails. File-writing blocks are intended for this initial setup and overwrite the named files; do not rerun them over later implementation work.

**Existing checkout:** Steps 1–9 have been completed for this repository. Use the
[root README](README.md) for daily commands and validation. Keep your populated
local environment files and provisioned organizer/bucket; do not repeat the
scaffolding blocks. Steps 10–11 are optional hosted setup, outside commit 01.

## 1. Install prerequisites

Use Node.js 24 and pnpm 10 for this project. Node 24 meets Vite's documented Node requirements; this guide deliberately selects pnpm 10 so its workspace/build-script configuration is consistent. [Vite prerequisites](https://vite.dev/guide/), [pnpm installation and compatibility](https://pnpm.io/installation).

Check what you already have:

```sh
node --version
pnpm --version
git --version
docker --version
```

If you already have Node 24, pnpm 10, and a running Docker-compatible runtime, skip the installation block. Otherwise, with [Homebrew](https://brew.sh/) installed, install only the missing tools:

```sh
brew install node@24
export PATH="$(brew --prefix node@24)/bin:$PATH"
npm install --global pnpm@10
brew install --cask docker
open -a Docker
```

Complete Docker Desktop's first-launch setup. If Node was installed with Homebrew, also add the `export PATH=...` line above to `~/.zshrc` for future terminals. If `git --version` prompts for Apple's command-line tools, complete that installation.

```sh
node --version
pnpm --version
docker info
cd /Users/alexandredemoura/Desktop/dev/family-tree
```

Local Supabase needs a running Docker-compatible runtime. [Supabase local development](https://supabase.com/docs/guides/local-development).

## 2. Initialize Git and the workspace

```sh
git init -b main

cat > .gitignore <<'EOF'
node_modules/
dist/
coverage/
*.tsbuildinfo
*.log
.DS_Store
.env
.env.*
!.env.example
supabase/.temp/
supabase/.branches/
EOF

printf '24\n' > .nvmrc

cat > package.json <<'EOF'
{
  "name": "family-tree",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24 <25", "pnpm": ">=10 <11" },
  "scripts": {
    "dev": "pnpm --filter @family-tree/family-core build && pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm --filter @family-tree/family-core build && pnpm -r typecheck",
    "lint": "pnpm --filter @family-tree/web lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
EOF

cat > pnpm-workspace.yaml <<'EOF'
packages:
  - apps/*
  - packages/*
onlyBuiltDependencies:
  - esbuild
  - supabase
  - '@tailwindcss/oxide'
EOF

node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.packageManager = `pnpm@${execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim()}`;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
EOF

mkdir -p apps packages/family-core/src apps/api/src/lib
pnpm create vite apps/web --template react-ts --no-interactive
```

If the scaffold asks whether to install dependencies and start immediately, choose No; the workspace installation follows below. Scaffolding into `apps/web` preserves the existing documentation. [Vite scaffolding](https://vite.dev/guide/).

## 3. Declare the API and shared package

The shared package compiles to JavaScript and declarations so both Vite and the compiled API can resolve it. Workspace dependencies make recursive builds run it first.

```sh
cat > packages/family-core/package.json <<'EOF'
{
  "name": "@family-tree/family-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  }
}
EOF

cat > apps/api/package.json <<'EOF'
{
  "name": "@family-tree/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=.env src/server.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "start": "node --env-file=.env dist/server.js"
  }
}
EOF

node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'apps/web/package.json';
const pkg = JSON.parse(readFileSync(file, 'utf8'));
pkg.name = '@family-tree/web';
pkg.scripts.typecheck = 'tsc -b --pretty false';
writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
EOF

pnpm add -DwE typescript@5.9 vitest supabase
pnpm --filter @family-tree/family-core add zod
pnpm --filter @family-tree/family-core add -D typescript@5.9
pnpm --filter @family-tree/api add fastify @fastify/cors zod @supabase/supabase-js pg '@family-tree/family-core@workspace:*'
pnpm --filter @family-tree/api add -D typescript@5.9 tsx @types/node@24 @types/pg
pnpm --filter @family-tree/web add react-router @tanstack/react-query @xyflow/react elkjs @supabase/supabase-js '@family-tree/family-core@workspace:*'
pnpm --filter @family-tree/web add -D typescript@5.9 tailwindcss @tailwindcss/vite
pnpm install
pnpm exec supabase --version
```

Keep `pnpm-lock.yaml` and the exact root `packageManager` value in Git when you commit. The Supabase CLI is a project dependency, so commands use `pnpm exec supabase`, not a global install. [Supabase CLI installation](https://supabase.com/docs/guides/local-development/cli/getting-started).

The plain `pg` client is for server-side SQL transactions that keep graph validation and writes atomic. Supabase JS handles Auth and Storage; this adds no ORM or repository layer.

## 4. Configure TypeScript and the API starter

```sh
cat > tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
EOF

cat > packages/family-core/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
EOF

cat > packages/family-core/src/index.ts <<'EOF'
// Export the pure schemas and graph rules added in implementation commit 02.
export {};
EOF

cat > apps/api/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
EOF

cat > apps/api/src/lib/env.ts <<'EOF'
import { z } from 'zod';

export const env = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('127.0.0.1'),
  WEB_ORIGIN: z.url(),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ORGANIZER_USER_ID: z.uuid(),
}).parse(process.env);
EOF

cat > apps/api/src/lib/supabase.ts <<'EOF'
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
EOF

cat > apps/api/src/server.ts <<'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './lib/env.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: env.WEB_ORIGIN });
app.get('/health', async () => ({ status: 'ok' }));
await app.listen({ port: env.PORT, host: env.HOST });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().catch((error: unknown) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  });
}
EOF

mkdir -p apps/web/src/app apps/web/src/components apps/web/src/lib
mkdir -p apps/web/src/features/{tree,people,photos,organizer}
mkdir -p apps/api/src/features/{trees,people,relationships,photos,sharing}
```

Keep the Vite template's browser TypeScript configuration. The shared/API packages use Node ESM; use `.js` extensions in their relative TypeScript imports. Empty feature folders become tracked when implementation files are added.

## 5. Wire Tailwind, routing, and Query

Tailwind uses its Vite plugin and a CSS import; no `tailwindcss init -p` command is needed. [Tailwind's Vite setup](https://tailwindcss.com/docs/installation/using-vite).

```sh
cat > apps/web/vite.config.ts <<'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
});
EOF

cat > apps/web/src/index.css <<'EOF'
@import "tailwindcss";

body { margin: 0; }
EOF

cat > apps/web/src/App.tsx <<'EOF'
export default function App() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-semibold">Family Tree</h1>
      <p className="mt-3 text-slate-600">Your family story starts here.</p>
    </main>
  );
}
EOF

cat > apps/web/src/main.tsx <<'EOF'
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><App /></BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
EOF

cat > apps/web/src/lib/supabase.ts <<'EOF'
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Missing browser Supabase configuration');

// Browser usage is limited to Auth and authorized signed uploads.
export const supabase = createClient(url, key);
EOF
```

The starter has no sign-in UI or family endpoints yet. `VITE_API_URL` below is reserved for the API client in commit 06. Add React Flow's stylesheet when its renderer is implemented.

## 6. Initialize and start local Supabase

```sh
pnpm exec supabase init
mkdir -p supabase/migrations
```

Edit the existing `[auth]` section of `supabase/config.toml` to these values; do not add a second `[auth]` section:

```toml
[auth]
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173/auth/callback"]
enable_signup = false
```

Leave the other generated settings in place. Keep email/password login enabled. Provision the organizer administratively in the next step; public signup is unnecessary for this MVP. Redirect URLs must match the frontend. [Local configuration](https://supabase.com/docs/guides/local-development/managing-config), [Auth redirects](https://supabase.com/docs/guides/auth/redirect-urls).

```sh
pnpm exec supabase start
pnpm exec supabase status
```

The first start downloads container images. Save the displayed API URL, database URL, publishable key, and secret key for the environment files. Local Studio is normally `http://127.0.0.1:54323`; the status output is authoritative. [Supabase CLI startup](https://supabase.com/docs/guides/local-development/cli/getting-started).

If your installed CLI displays legacy keys, use `anon` in place of the publishable key and `service_role` in place of the secret key. Browser code receives only the publishable/anon key; secret/service-role keys bypass RLS and belong exclusively on the API. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## 7. Provision the organizer and environment files

Open local Studio yourself. Under Authentication → Users, add a user with your chosen email/password and mark the email confirmed. Copy that user's UUID. Use a development password for this local account. This account is separate from the hosted organizer created later.

```sh
cat > apps/web/.env.example <<'EOF'
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=replace-with-local-publishable-key
EOF

cat > apps/api/.env.example <<'EOF'
PORT=3001
HOST=127.0.0.1
WEB_ORIGIN=http://localhost:5173
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=replace-with-local-secret-key
DATABASE_URL=replace-with-local-database-url
ORGANIZER_USER_ID=replace-with-local-organizer-uuid
EOF

cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

Edit `apps/web/.env.local` and `apps/api/.env`, replacing all placeholders with values from this same local instance. Keep real credentials out of the `.env.example` files. `ORGANIZER_USER_ID` is validated at startup; the authorization checks using it arrive in commit 04.

```sh
git check-ignore apps/web/.env.local apps/api/.env
```

Expected: both paths are printed. API keys, the CLI login token, and the database password are different credentials. Do not put the database URL, secret key, or organizer password in any `VITE_*` variable.

## 8. Create the private photo bucket and check connectivity

Create buckets through the Storage API. SQL migration files remain the source of truth for the application's own tables; Storage object operations go through its API. [Creating buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets), [Storage schema guidance](https://supabase.com/docs/guides/storage/schema/design).

This repeatable script checks PostgreSQL and creates or configures the one private bucket. It chooses a 10 MiB JPEG limit for initialization; photo implementation can revise that limit deliberately.

```sh
mkdir -p apps/api/scripts

cat > apps/api/scripts/setup-supabase.mjs <<'EOF'
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

for (const name of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'DATABASE_URL']) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query('select 1');
  console.log('PostgreSQL connection OK');
} finally {
  await pool.end();
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: buckets, error: listError } = await admin.storage.listBuckets();
if (listError) throw listError;

const options = {
  public: false,
  allowedMimeTypes: ['image/jpeg'],
  fileSizeLimit: 10 * 1024 * 1024,
};
const exists = buckets.some((bucket) => bucket.id === 'family-photos');
const { error } = exists
  ? await admin.storage.updateBucket('family-photos', options)
  : await admin.storage.createBucket('family-photos', options);
if (error) throw error;
console.log('Private family-photos bucket ready');
EOF

node --env-file=apps/api/.env apps/api/scripts/setup-supabase.mjs
```

Run this command from the repository root. The explicit paths avoid `.env` lookup issues when invoking Node through `pnpm exec`.

Do not add public `storage.objects` policies. Later, Fastify authorizes a tree/person before issuing signed uploads or short-lived viewing URLs. Stored paths follow `trees/{treeId}/people/{personId}/{photoId}.jpg`.

## 9. Build and start the foundation

```sh
pnpm typecheck
pnpm lint
pnpm build
pnpm dev
```

In another terminal:

```sh
curl --fail http://localhost:3001/health
```

Expected response: `{"status":"ok"}`. This endpoint proves API liveness; the script in step 8 checks database and Storage connectivity. Manually open `http://localhost:5173` to QA the starter page.

The raw scaffold above has no tests. The completed commit 01 foundation adds
Fastify injection tests for health and CORS, and `pnpm test` fails if no tests are
discovered. Run `pnpm validate` on the completed checkout for lint, typecheck,
tests, production builds, and the installed Contour manifest check. Domain and
product behavior remain unimplemented at this stage.

After this setup you have the workspace, dependencies, development servers, local PostgreSQL/Auth/Storage, one organizer account, and a private bucket. The family data schema and application features remain the work in commits 02 onward.

## 10. Create and link a hosted Supabase project

You can do this now or once the local foundation is working.

1. Open the [Supabase dashboard](https://supabase.com/dashboard), create a project in your organization, choose its region, and save its database password in your password manager.
2. Wait for provisioning and copy the project reference from its settings or dashboard URL.
3. Under Authentication, disable new user signups and keep email/password enabled. Add the one hosted organizer under Users, confirm the email, and copy its UUID.
4. Set Auth Site URL to `http://localhost:5173` while developing against this project and allow `http://localhost:5173/auth/callback`. At deployment, set the Site URL to the real HTTPS frontend URL and allow its `/auth/callback` URL. Local `config.toml` changes do not automatically configure hosted Auth. [Redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

From the repository root:

```sh
pnpm exec supabase login
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF`. Complete the login flow and enter the database password when prompted. Linking chooses the target of remote CLI commands; it does not switch application environment variables or copy local users/files. [Supabase environment workflow](https://supabase.com/docs/guides/deployment/managing-environments).

## 11. Apply application migrations and provision hosted Storage

The application schema is introduced in commit 03. During that commit, create a migration and implement its SQL before applying it:

```sh
pnpm exec supabase migration new create_family_schema
```

Edit the generated `supabase/migrations/<timestamp>_create_family_schema.sql` according to the commit plan, including constraints, grants, and RLS. Do not apply an empty file as if the schema were complete. Then apply and generate types locally:

```sh
pnpm exec supabase migration up --local
pnpm exec supabase gen types typescript --local > apps/api/src/lib/database.types.ts
```

After reviewing and testing the migration locally, preview and apply it to the linked hosted project:

```sh
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

`db push` applies pending migrations; it does not deploy the web/API apps or transfer Auth users and uploaded photos. With no application migrations yet, there is no family schema to push. [Supabase CLI migration commands](https://supabase.com/docs/reference/cli/supabase-migration-up).

To provision the hosted bucket without changing your local app configuration, create `apps/api/.env.hosted` in your editor with these hosted values:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=replace-with-hosted-secret-key
DATABASE_URL=replace-with-hosted-postgres-connection-string
```

Get the URL and keys from the project's API settings. Get the database connection string from **Connect**; use the session pooler for a persistent Fastify server on an IPv4-only connection, or the direct connection where IPv6 is available. Replace the password placeholder with the URL-encoded database password and configure TLS using the dashboard's connection guidance/certificate. [PostgreSQL connection options](https://supabase.com/docs/guides/database/connecting-to-postgres).

```sh
git check-ignore apps/api/.env.hosted
node --env-file=apps/api/.env.hosted apps/api/scripts/setup-supabase.mjs
```

The same script provisions `family-photos` as private in the hosted project.

To run your local apps against hosted Supabase, update all Supabase values in both `apps/web/.env.local` and `apps/api/.env` together, including the hosted database URL and hosted organizer UUID. Keep frontend/API origins localhost while the apps run locally, then restart `pnpm dev`. For deployment, configure those variables in the hosting platforms and rebuild the frontend because Vite embeds its environment values at build time.

## 12. Daily commands and commit names

Start local services and applications:

```sh
pnpm exec supabase start
pnpm dev
```

After stopping the app with Ctrl-C, stop Supabase while preserving its local data:

```sh
pnpm exec supabase stop
```

After cloning the initialized repository elsewhere, install the locked dependencies with `pnpm install --frozen-lockfile`, copy/fill environment examples, start local Supabase, provision a local organizer, and run the bucket setup script.

For a disposable local database only, `pnpm exec supabase db reset --local` rebuilds it from migrations and seed data. It deletes local data, including manually provisioned Auth users and bucket metadata; repeat organizer/bucket provisioning afterward. Do not use it as the routine migration command.

Suggested commit for this documentation change:

`docs: add MVP commit plan and project setup guide`

Suggested commit after you execute and review initialization:

`chore: initialize pnpm workspace and local Supabase`

Stage and commit these yourself. UI QA also remains manual.
