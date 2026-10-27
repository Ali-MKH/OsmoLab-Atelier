import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { isValidResourceId } from '../domain/security-policy.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  workspaceUid?: string;
  workspaceEmail?: string;
}

/**
 * Zero-Trust Authentication Middleware:
 * - Strictly requires a cryptographically verified Firebase ID Token (`Authorization: Bearer <jwt>`).
 * - Rejects unverified emails (`email_verified !== true`) and malformed UIDs.
 * - Rejects any attempt to authenticate via client-spoofable headers (`x-workspace-uid`).
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Explicitly reject legacy/spoofable header attempts if no Bearer token is provided
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error:
        'Unauthorized: A valid Firebase Authentication Bearer token is required to access private user data.',
      code: 'AUTH_BEARER_TOKEN_REQUIRED',
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.length > 4096) {
    return res.status(401).json({
      error: 'Unauthorized: Malformed authentication token.',
      code: 'AUTH_TOKEN_MALFORMED',
    });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken.uid || !isValidResourceId(decodedToken.uid)) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid token subject UID.',
        code: 'AUTH_UID_INVALID',
      });
    }

    if (decodedToken.email_verified !== true) {
      return res.status(403).json({
        error: 'Forbidden: Verified email address is required to access or modify workspace data.',
        code: 'AUTH_EMAIL_NOT_VERIFIED',
      });
    }

    req.user = decodedToken;
    req.workspaceUid = decodedToken.uid;
    req.workspaceEmail = decodedToken.email || 'perfumer@atelier.local';
    return next();
  } catch {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired Firebase ID token.',
      code: 'AUTH_TOKEN_VERIFICATION_FAILED',
    });
  }
};
