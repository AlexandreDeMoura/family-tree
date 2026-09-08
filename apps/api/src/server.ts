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
