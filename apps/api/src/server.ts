import { buildApp } from './app.js';
import { env } from './lib/env.js';

const app = buildApp({ webOrigin: env.WEB_ORIGIN, logger: true });
await app.listen({ port: env.PORT, host: env.HOST });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().catch((error: unknown) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  });
}
