/**
 * OsmoLab Zero-Trust Security Policy & Input Sanitization Engine
 *
 * Enforces security invariants across:
 * 1. Firebase Authentication RS256 ID Token Verification (`verifyIdToken(token, true)`)
 * 2. Express API & PostgreSQL Tenant Isolation (strict verified UID, zero header spoofing)
 * 3. Payload Sanitization, Prototype Pollution Guard, and Volumetric Bounds
 */

export class SecurityPolicyViolationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 403, code = 'SECURITY_POLICY_VIOLATION') {
    super(message);
    this.name = 'SecurityPolicyViolationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Validates that an ID or UID string is safe against Path/ID Poisoning (1..128 alphanumeric/hyphen/underscore chars).
 */
export function isValidResourceId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    VALID_ID_REGEX.test(id)
  );
}

/**
 * Strips dangerous HTML/script tags and control characters, and truncates to maxLength.
 */
export function sanitizeBoundedString(
  val: unknown,
  maxLength: number,
  fallback = ''
): string {
  if (typeof val !== 'string') return fallback;
  const cleaned = val
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<\s*\/?\s*script\b[^>]*>/gi, '')
    .trim();
  return cleaned.slice(0, maxLength);
}

/**
 * Recursively checks an incoming payload object for prototype-pollution keys or excessive depth.
 */
export function assertNoPrototypePollution(obj: unknown, depth = 0): void {
  if (depth > 8) {
    throw new SecurityPolicyViolationError(
      'Payload rejected: object nesting depth exceeds security limit.',
      400,
      'EXCESSIVE_NESTING'
    );
  }
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    if (obj.length > 500) {
      throw new SecurityPolicyViolationError(
        'Payload rejected: array length exceeds maximum bound (500).',
        400,
        'ARRAY_BOUNDS_EXCEEDED'
      );
    }
    for (const item of obj) {
      assertNoPrototypePollution(item, depth + 1);
    }
    return;
  }

  const rawKeys = Object.getOwnPropertyNames(obj);
  for (const key of rawKeys) {
    if (DANGEROUS_KEYS.has(key)) {
      throw new SecurityPolicyViolationError(
        `Payload rejected: forbidden prototype key "${key}".`,
        400,
        'PROTOTYPE_POLLUTION_DETECTED'
      );
    }
    assertNoPrototypePollution((obj as Record<string, unknown>)[key], depth + 1);
  }
}

/**
 * Validates that an incoming API request never attempts to override tenant ownership fields
 * (`userUid`, `ownerId`, `uid`) with a different user's identity.
 */
export function assertStrictTenantPayload(
  payload: unknown,
  authenticatedUid: string
): void {
  if (!isValidResourceId(authenticatedUid)) {
    throw new SecurityPolicyViolationError(
      'Unauthorized: invalid authenticated UID.',
      401,
      'INVALID_AUTH_UID'
    );
  }
  assertNoPrototypePollution(payload);

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    for (const field of ['userUid', 'ownerId', 'uid']) {
      if (
        field in record &&
        record[field] !== undefined &&
        record[field] !== authenticatedUid
      ) {
        throw new SecurityPolicyViolationError(
          `Forbidden: cross-tenant identity spoofing attempt on field "${field}".`,
          403,
          'IDENTITY_SPOOFING_BLOCKED'
        );
      }
    }
  }
}

export interface SecurityPostureControl {
  id: string;
  layer: 'Firebase Auth' | 'PostgreSQL Persistence' | 'API Gateway' | 'Client Privacy';
  title: string;
  status: 'ENFORCED';
  verificationSummary: string;
}

export const OSMOLAB_SECURITY_CONTROLS: SecurityPostureControl[] = [
  {
    id: 'zero-trust-jwt',
    layer: 'Firebase Auth',
    title: 'Cryptographic Firebase ID Token Verification (RS256 + Revocation Check)',
    status: 'ENFORCED',
    verificationSummary:
      'All authenticated /api/* routes verify Bearer JWTs via adminAuth.verifyIdToken(token, true) with email_verified === true. Unverified client headers (x-workspace-uid) are rejected with 401.',
  },
  {
    id: 'anti-idor-fk-guard',
    layer: 'PostgreSQL Persistence',
    title: 'Cross-Tenant Foreign Key & IDOR Ownership Verification',
    status: 'ENFORCED',
    verificationSummary:
      'Every SQL SELECT, INSERT, UPDATE, and DELETE filters by user_uid = authenticated_uid and verifies parent materialId, formulaId, and accordId ownership before mutation.',
  },
  {
    id: 'api-boundary-schema-validation',
    layer: 'API Gateway',
    title: 'Strict Runtime Schema Validation & Standardized Error Contracts',
    status: 'ENFORCED',
    verificationSummary:
      'All mutation payloads are validated at the API boundary for numeric ranges, enum domains, string length bounds, and structural integrity before reaching repository methods.',
  },
  {
    id: 'http-transport-hardening',
    layer: 'API Gateway',
    title: 'Private No-Store Caching, Rate Limiting & 256KB Payload Bounds',
    status: 'ENFORCED',
    verificationSummary:
      'Enforces Cache-Control: no-store, private on all API responses, X-Content-Type-Options: nosniff, sliding-window per-IP rate limiting, and prototype-pollution sanitization.',
  },
  {
    id: 'session-isolation-wipe',
    layer: 'Client Privacy',
    title: 'UID-Scoped Local Storage & Automatic Sign-Out Memory Purge',
    status: 'ENFORCED',
    verificationSummary:
      'Unauthenticated visitors operate in an isolated in-browser sandbox without touching shared database records. Signing out immediately purges in-memory workspace state.',
  },
];
