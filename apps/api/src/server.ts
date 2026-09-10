import { buildApp } from './app.js';
import { createOrganizerAuthenticator } from './features/auth/auth.service.js';
import { createPeopleService } from './features/people/people.service.js';
import { createRelationshipsService } from './features/relationships/relationships.service.js';
import { createTreesService } from './features/trees/trees.service.js';
import { createDatabasePool } from './lib/database.js';
import { env } from './lib/env.js';
import { createSupabaseAuthVerifier, supabaseAdmin } from './lib/supabase.js';

const database = createDatabasePool(env.DATABASE_URL);
const app = buildApp({
  webOrigin: env.WEB_ORIGIN,
  logger: true,
  organizerApi: {
    authenticator: createOrganizerAuthenticator(
      createSupabaseAuthVerifier(supabaseAdmin.auth),
      env.ORGANIZER_USER_ID,
    ),
    trees: createTreesService(database),
    people: createPeopleService(database),
    relationships: createRelationshipsService(database),
  },
});
app.addHook('onClose', async () => database.end());
await app.listen({ port: env.PORT, host: env.HOST });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().catch((error: unknown) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  });
}
