import { ApiError } from '../../lib/api-errors.js';

export interface VerifiedAuthUser {
  id: string;
}

export interface AuthVerifier {
  verifyAccessToken(accessToken: string): Promise<VerifiedAuthUser | null>;
}

export interface OrganizerPrincipal {
  userId: string;
}

export interface OrganizerAuthenticator {
  authenticate(authorization: string | undefined): Promise<OrganizerPrincipal>;
}

export function createOrganizerAuthenticator(
  verifier: AuthVerifier,
  organizerUserId: string,
): OrganizerAuthenticator {
  return {
    async authenticate(authorization) {
      const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');
      if (!match) {
        throw new ApiError(401, 'authentication_required', 'A Bearer access token is required.');
      }

      let user: VerifiedAuthUser | null;
      try {
        user = await verifier.verifyAccessToken(match[1]);
      } catch {
        user = null;
      }
      if (!user) {
        throw new ApiError(401, 'invalid_access_token', 'The access token is invalid or expired.');
      }
      if (user.id !== organizerUserId) {
        throw new ApiError(403, 'organizer_access_required', 'This account is not the family organizer.');
      }
      return { userId: user.id };
    },
  };
}
