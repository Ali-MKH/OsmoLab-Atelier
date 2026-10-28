import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { isValidResourceId } from '../domain/security-policy.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  workspaceUid?: string;
  workspaceEmail?: string;
}

export type TokenVerifierFn = (
  token: string,
  checkRevoked?: boolean
) => Promise<DecodedIdToken>;

export interface TokenVerificationOutcome {
  ok: boolean;
  statusCode: number;
  error?: string;
  code?: string;
  decodedToken?: DecodedIdToken;
  workspaceUid?: string;
  workspaceEmail?: string;
}

/**
 * Pure verification helper that enforces:
 * 1. `Authorization: Bearer <jwt>` format and length bounds
 * 2. `verifyIdToken(token, true)` with `checkRevoked = true`
 * 3. Safe resource UID validation (`isValidResourceId`)
 * 4. Verified email requirement (`email_verified === true`)
 */
export async function verifyBearerTokenWithPolicy(
  authHeader: string | undefined,
  verifier: TokenVerifierFn = (t, checkRevoked) =>
    adminAuth.verifyIdToken(t, checkRevoked)
): Promise<TokenVerificationOutcome> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      statusCode: 401,
      error:
        'Unauthorized: A valid Firebase Authentication Bearer token is required to access private user data.',
      code: 'AUTH_BEARER_TOKEN_REQUIRED',
    };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.length > 4096) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Unauthorized: Malformed authentication token.',
      code: 'AUTH_TOKEN_MALFORMED',
    };
  }

  try {
    // Enforce revocation checking (checkRevoked = true) as documented in security_spec.md
    const decodedToken = await verifier(token, true);
    if (!decodedToken.uid || !isValidResourceId(decodedToken.uid)) {
      return {
        ok: false,
        statusCode: 401,
        error: 'Unauthorized: Invalid token subject UID.',
        code: 'AUTH_UID_INVALID',
      };
    }

    if (decodedToken.email_verified !== true) {
      return {
        ok: false,
        statusCode: 403,
        error:
          'Forbidden: Verified email address is required to access or modify workspace data.',
        code: 'AUTH_EMAIL_NOT_VERIFIED',
      };
    }

    return {
      ok: true,
      statusCode: 200,
      decodedToken,
      workspaceUid: decodedToken.uid,
      workspaceEmail: decodedToken.email || 'perfumer@atelier.local',
    };
  } catch (err: unknown) {
    const errCode =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (errCode === 'auth/id-token-revoked') {
      return {
        ok: false,
        statusCode: 401,
        error: 'Unauthorized: Firebase ID token has been revoked. Please sign in again.',
        code: 'AUTH_TOKEN_REVOKED',
      };
    }
    return {
      ok: false,
      statusCode: 401,
      error: 'Unauthorized: Invalid or expired Firebase ID token.',
      code: 'AUTH_TOKEN_VERIFICATION_FAILED',
    };
  }
}

/**
 * Zero-Trust Authentication Middleware:
 * - Strictly requires a cryptographically verified Firebase ID Token (`Authorization: Bearer <jwt>`)
 *   checked with `checkRevoked = true`.
 * - Rejects unverified emails (`email_verified !== true`) and malformed UIDs.
 * - Rejects any attempt to authenticate via client-spoofable headers (`x-workspace-uid`).
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const outcome = await verifyBearerTokenWithPolicy(req.headers.authorization);
  if (!outcome.ok) {
    return res.status(outcome.statusCode).json({
      error: outcome.error,
      code: outcome.code,
      details: [],
    });
  }

  req.user = outcome.decodedToken;
  req.workspaceUid = outcome.workspaceUid;
  req.workspaceEmail = outcome.workspaceEmail;
  return next();
};
