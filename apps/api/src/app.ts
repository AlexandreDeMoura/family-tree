import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ApiError } from './lib/api-errors.js';
import { TreeNotFoundError } from './lib/database.js';
import { registerOrganizerRoutes, type OrganizerApiDependencies } from './features/organizer.routes.js';
import { registerSharingRoutes, type SharingApiDependencies } from './features/sharing/sharing.routes.js';

// Construct without opening a port or loading credentials so API tests can inject requests.
export function buildApp(options: {
  webOrigin: string;
  logger?: boolean;
  organizerApi?: OrganizerApiDependencies;
  sharingApi?: SharingApiDependencies;
}) {
  const app = Fastify({
    logger: options.logger ? {
      redact: {
        paths: ['req.headers.authorization'],
        censor: '[REDACTED]',
      },
    } : false,
  });
  app.register(cors, { origin: options.webOrigin });
  app.get('/health', async () => ({ status: 'ok' }));
  if (options.organizerApi) app.register(registerOrganizerRoutes, options.organizerApi);
  if (options.sharingApi) app.register(registerSharingRoutes, options.sharingApi);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: {
        code: error.code,
        message: error.message,
        ...(error.issues ? { issues: error.issues } : {}),
      } });
    }
    if (error instanceof TreeNotFoundError) {
      return reply.code(404).send({ error: { code: error.code, message: error.message } });
    }
    const statusCode = typeof error === 'object' && error !== null
      && 'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : undefined;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ error: {
        code: 'invalid_request',
        message: 'The request is invalid.',
      } });
    }
    app.log.error(error);
    return reply.code(500).send({ error: {
      code: 'internal_error',
      message: 'An unexpected error occurred.',
    } });
  });
  return app;
}
