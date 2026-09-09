import Fastify from 'fastify';
import cors from '@fastify/cors';

// Construct without opening a port or loading credentials so API tests can inject requests.
export function buildApp(options: { webOrigin: string; logger?: boolean }) {
  const app = Fastify({ logger: options.logger ?? false });
  app.register(cors, { origin: options.webOrigin });
  app.get('/health', async () => ({ status: 'ok' }));
  return app;
}
