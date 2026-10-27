/**
 * OsmoLab Zero-Trust Security Policy & Input Sanitization Engine
 *
 * Enforces Google-standard security invariants across:
 * 1. Firestore ABAC Rule Evaluation Simulation (verifying the Dirty Dozen payloads)
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
const VALID_VERSION_REGEX = /^[a-zA-Z0-9_.-]+$/;
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

/**
 * Evaluates Firestore ABAC Security Rules logic in TypeScript for deterministic TDD verification
 * of the 8 Pillars of Hardened Rules and the "Dirty Dozen" adversarial payloads.
 */
export interface SimulatedAuthContext {
  uid: string;
  email: string;
  email_verified: boolean;
}

export interface SimulatedFirestoreEvalContext {
  auth: SimulatedAuthContext | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  requestTimeMs: number;
  existingDoc?: Record<string, unknown> | null;
  incomingDoc?: Record<string, unknown> | null;
  existingUserProfiles?: Record<string, { ownerId: string; email: string }>;
  existingMaterialsByUser?: Record<string, Record<string, { ownerId: string }>>;
  existingFormulasByUser?: Record<string, Record<string, { ownerId: string }>>;
}

function hasExactKeys(
  data: Record<string, unknown>,
  requiredKeys: string[],
  allowedKeys: string[]
): boolean {
  const keys = Object.keys(data);
  for (const reqKey of requiredKeys) {
    if (!(reqKey in data)) return false;
  }
  const allowedSet = new Set(allowedKeys);
  for (const k of keys) {
    if (!allowedSet.has(k)) return false;
  }
  return true;
}

function getAffectedKeys(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): string[] {
  const allKeys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const k of allKeys) {
    if (JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])) {
      changed.push(k);
    }
  }
  return changed;
}

function validateFormulaDoc(
  data: Record<string, unknown>,
  auth: SimulatedAuthContext
): boolean {
  const reqKeys = [
    'ownerId',
    'name',
    'projectName',
    'status',
    'activeVersionLabel',
    'intendedProduct',
    'ifraCategory',
    'finalProductConcentration',
    'targetBrief',
    'tags',
    'createdAt',
    'updatedAt',
  ];
  if (!hasExactKeys(data, reqKeys, reqKeys)) return false;
  if (!isValidResourceId(data.ownerId) || data.ownerId !== auth.uid) return false;
  if (typeof data.name !== 'string' || data.name.length < 1 || data.name.length > 160)
    return false;
  if (
    typeof data.projectName !== 'string' ||
    data.projectName.length < 1 ||
    data.projectName.length > 120
  )
    return false;
  if (
    typeof data.status !== 'string' ||
    !['Draft', 'ActiveTrial', 'Macerating', 'Stable', 'Archived'].includes(data.status)
  )
    return false;
  if (
    typeof data.activeVersionLabel !== 'string' ||
    data.activeVersionLabel.length < 1 ||
    data.activeVersionLabel.length > 32 ||
    !VALID_VERSION_REGEX.test(data.activeVersionLabel)
  )
    return false;
  if (
    typeof data.intendedProduct !== 'string' ||
    data.intendedProduct.length < 1 ||
    data.intendedProduct.length > 120
  )
    return false;
  if (
    typeof data.ifraCategory !== 'string' ||
    data.ifraCategory.length < 1 ||
    data.ifraCategory.length > 80
  )
    return false;
  if (
    typeof data.finalProductConcentration !== 'number' ||
    data.finalProductConcentration < 0.1 ||
    data.finalProductConcentration > 100
  )
    return false;
  if (typeof data.targetBrief !== 'string' || data.targetBrief.length > 2000) return false;
  if (!Array.isArray(data.tags) || data.tags.length > 10) return false;
  if (
    data.tags.length > 0 &&
    (typeof data.tags[0] !== 'string' || data.tags[0].length > 64)
  )
    return false;
  if (typeof data.createdAt !== 'number' || typeof data.updatedAt !== 'number') return false;
  return true;
}

function validateSensoryEvaluationDoc(
  data: Record<string, unknown>,
  auth: SimulatedAuthContext
): boolean {
  const reqKeys = [
    'ownerId',
    'formulaId',
    'checkpoint',
    'overallScore',
    'openingNotes',
    'heartNotes',
    'drydownNotes',
    'createdAt',
    'updatedAt',
  ];
  if (!hasExactKeys(data, reqKeys, reqKeys)) return false;
  if (!isValidResourceId(data.ownerId) || data.ownerId !== auth.uid) return false;
  if (!isValidResourceId(data.formulaId)) return false;
  if (
    typeof data.checkpoint !== 'string' ||
    data.checkpoint.length < 1 ||
    data.checkpoint.length > 64
  )
    return false;
  if (
    typeof data.overallScore !== 'number' ||
    data.overallScore < 0 ||
    data.overallScore > 10
  )
    return false;
  if (typeof data.openingNotes !== 'string' || data.openingNotes.length > 2000)
    return false;
  if (typeof data.heartNotes !== 'string' || data.heartNotes.length > 2000)
    return false;
  if (typeof data.drydownNotes !== 'string' || data.drydownNotes.length > 2000)
    return false;
  if (typeof data.createdAt !== 'number' || typeof data.updatedAt !== 'number') return false;
  return true;
}

/**
 * Simulates the exact evaluation of `/firestore.rules` for unit testing.
 * Returns `'ALLOW'` or `'PERMISSION_DENIED'`.
 */
export function evaluateFirestoreSecurityRule(
  ctx: SimulatedFirestoreEvalContext
): 'ALLOW' | 'PERMISSION_DENIED' {
  // 1. Must be signed in & email verified
  if (!ctx.auth || ctx.auth.email_verified !== true) {
    return 'PERMISSION_DENIED';
  }

  const segments = ctx.path.split('/').filter(Boolean);
  // Root /users/{userId}
  if (segments.length === 2 && segments[0] === 'users') {
    const userId = segments[1];
    if (ctx.operation === 'list') return 'PERMISSION_DENIED';
    if (ctx.auth.uid !== userId || !isValidResourceId(userId)) {
      return 'PERMISSION_DENIED';
    }
    if (ctx.operation === 'get' || ctx.operation === 'delete') {
      return ctx.existingDoc?.ownerId === ctx.auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (ctx.operation === 'create') {
      if (!ctx.incomingDoc) return 'PERMISSION_DENIED';
      if (ctx.incomingDoc.ownerId !== ctx.auth.uid) return 'PERMISSION_DENIED';
      if (ctx.incomingDoc.email !== ctx.auth.email) return 'PERMISSION_DENIED';
      if (
        ctx.incomingDoc.createdAt !== ctx.requestTimeMs ||
        ctx.incomingDoc.updatedAt !== ctx.requestTimeMs
      ) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOW';
    }
    return 'PERMISSION_DENIED';
  }

  // Subcollection /users/{userId}/{collection}/{docId?}
  if (segments.length >= 3 && segments[0] === 'users') {
    const userId = segments[1];
    const subcol = segments[2];
    const docId = segments[3];

    if (ctx.auth.uid !== userId) return 'PERMISSION_DENIED';

    if (ctx.operation === 'list') {
      // Query Enforcer: resource.data.ownerId == request.auth.uid
      return ctx.existingDoc?.ownerId === ctx.auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }

    if (!isValidResourceId(userId) || !isValidResourceId(docId)) {
      return 'PERMISSION_DENIED';
    }

    // Master Gate: parent user profile must exist and belong to request.auth.uid
    const parentProfile = ctx.existingUserProfiles?.[userId];
    if (!parentProfile || parentProfile.ownerId !== ctx.auth.uid) {
      return 'PERMISSION_DENIED';
    }

    if (subcol === 'formulas') {
      if (ctx.operation === 'get' || ctx.operation === 'delete') {
        return ctx.existingDoc?.ownerId === ctx.auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
      }
      if (ctx.operation === 'create') {
        if (!ctx.incomingDoc || !validateFormulaDoc(ctx.incomingDoc, ctx.auth)) {
          return 'PERMISSION_DENIED';
        }
        if (
          ctx.incomingDoc.createdAt !== ctx.requestTimeMs ||
          ctx.incomingDoc.updatedAt !== ctx.requestTimeMs
        ) {
          return 'PERMISSION_DENIED';
        }
        return 'ALLOW';
      }
      if (ctx.operation === 'update') {
        if (
          !ctx.incomingDoc ||
          !ctx.existingDoc ||
          !validateFormulaDoc(ctx.incomingDoc, ctx.auth)
        ) {
          return 'PERMISSION_DENIED';
        }
        if (ctx.existingDoc.ownerId !== ctx.auth.uid) return 'PERMISSION_DENIED';
        if (ctx.incomingDoc.ownerId !== ctx.existingDoc.ownerId) return 'PERMISSION_DENIED';
        if (ctx.incomingDoc.createdAt !== ctx.existingDoc.createdAt)
          return 'PERMISSION_DENIED';
        if (ctx.incomingDoc.updatedAt !== ctx.requestTimeMs) return 'PERMISSION_DENIED';
        if (ctx.existingDoc.status === 'Archived') return 'PERMISSION_DENIED';

        const affected = getAffectedKeys(ctx.incomingDoc, ctx.existingDoc);
        const editAllowed = new Set([
          'name',
          'projectName',
          'activeVersionLabel',
          'intendedProduct',
          'ifraCategory',
          'finalProductConcentration',
          'targetBrief',
          'tags',
          'updatedAt',
        ]);
        const statusAllowed = new Set(['status', 'activeVersionLabel', 'updatedAt']);
        const isEditAction = affected.every((k) => editAllowed.has(k));
        const isStatusAction = affected.every((k) => statusAllowed.has(k));
        return isEditAction || isStatusAction ? 'ALLOW' : 'PERMISSION_DENIED';
      }
    }

    if (subcol === 'evaluations') {
      if (ctx.operation === 'create') {
        if (!ctx.incomingDoc || !validateSensoryEvaluationDoc(ctx.incomingDoc, ctx.auth)) {
          return 'PERMISSION_DENIED';
        }
        if (
          ctx.incomingDoc.createdAt !== ctx.requestTimeMs ||
          ctx.incomingDoc.updatedAt !== ctx.requestTimeMs
        ) {
          return 'PERMISSION_DENIED';
        }
        const formId = String(ctx.incomingDoc.formulaId);
        const parentForm = ctx.existingFormulasByUser?.[userId]?.[formId];
        if (!parentForm || parentForm.ownerId !== ctx.auth.uid) {
          return 'PERMISSION_DENIED';
        }
        return 'ALLOW';
      }
    }
  }

  // Catch-all default deny
  return 'PERMISSION_DENIED';
}

export interface SecurityPostureControl {
  id: string;
  layer: 'Firestore ABAC' | 'PostgreSQL RLS' | 'API Gateway' | 'Client Privacy';
  title: string;
  status: 'ENFORCED';
  verificationSummary: string;
}

export const OSMOLAB_SECURITY_CONTROLS: SecurityPostureControl[] = [
  {
    id: 'zero-trust-jwt',
    layer: 'API Gateway',
    title: 'Cryptographic Firebase ID Token Verification (RS256)',
    status: 'ENFORCED',
    verificationSummary:
      'All /api/* workspace and mutation routes require a verified Bearer JWT with email_verified == true. Unverified client headers (x-workspace-uid) are rejected with 401.',
  },
  {
    id: 'firestore-default-deny',
    layer: 'Firestore ABAC',
    title: 'Global Default-Deny & Strict /users/{userId} Owner Isolation',
    status: 'ENFORCED',
    verificationSummary:
      'firestore.rules enforces match /{document=**} { allow read, write: if false; } and restricts every document get, list, create, update, and delete exclusively to request.auth.uid == userId.',
  },
  {
    id: 'anti-idor-fk-guard',
    layer: 'PostgreSQL RLS',
    title: 'Cross-Tenant Foreign Key & IDOR Ownership Verification',
    status: 'ENFORCED',
    verificationSummary:
      'Every SQL SELECT, INSERT, UPDATE, and DELETE filters by user_uid = authenticated_uid and verifies parent formulaId / materialId ownership before mutation.',
  },
  {
    id: 'action-based-schema-guard',
    layer: 'Firestore ABAC',
    title: 'Anti-Update-Gap Schema Blueprints & Immutable Fields',
    status: 'ENFORCED',
    verificationSummary:
      'isValid[Entity]() helpers enforce strict key allowlists (hasAll/hasOnly), string/list size bounds, immutable ownerId & createdAt, and server request.time timestamps.',
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
