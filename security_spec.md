# OsmoLab Security Specification (`security_spec.md`)

## 1. Architecture & Data Flow

OsmoLab uses a single, explicit authentication and persistence pipeline:

```text
Firebase Authentication (Client)
  -> Cryptographically Signed RS256 Firebase ID Token (Authorization: Bearer <jwt>)
  -> Express API Gateway (requireAuth + verifyIdToken(token, true) + Schema Validation)
  -> PostgreSQL Relational Persistence (Drizzle ORM, tenant-scoped by user_uid)
```

- **Firebase Authentication** is used strictly for identity verification (`src/lib/firebase.ts` on the client, `src/lib/firebase-admin.ts` and `src/middleware/auth.ts` on the server).
- **Cloud Firestore is not used** for runtime application data. All global catalog records (`GLOBAL` scope) and user-owned records (`USER` scope: My Shelf, Current Workbench flags, Formulas, Formula Versions, Accords, Accord Versions, Evaluations, Experiments, Scent Memories) reside in **PostgreSQL** (or the explicit `PERSISTENCE_MODE=memory` store during automated testing).

---

## 2. Core Zero-Trust Invariants

1. **Verified Identity & Token Revocation Check (`verifyIdToken(token, true)`)**:
   - Every authenticated route under `/api/*` passes through `requireAuth` (`src/middleware/auth.ts`), which calls `adminAuth.verifyIdToken(token, true)`.
   - Revoked tokens (`auth/id-token-revoked`) are rejected with `401 Unauthorized` (`code: "AUTH_TOKEN_REVOKED"`).
   - Unverified email tokens (`email_verified !== true`) are rejected with `403 Forbidden` (`code: "AUTH_EMAIL_NOT_VERIFIED"`).
   - Client-supplied headers (`x-workspace-uid`) or payload fields (`userUid`, `ownerId`, `uid`) are never trusted to establish identity; attempting to pass a mismatched tenant UID in a request body throws `403 Forbidden` (`code: "IDENTITY_SPOOFING_BLOCKED"`).

2. **Strict Tenant Isolation & Global Catalog Immutability**:
   - Global catalog materials (`scope = 'GLOBAL'`, `owner_uid IS NULL`) and their canonical olfactory/regulatory rows are read-only for end users.
   - User-specific selections (`user_shelf`), custom materials (`scope = 'USER'`, `owner_uid = authenticated_uid`), formulas, formula versions, accords, accord versions, evaluations, experiments, and scent memories are strictly scoped by `WHERE user_uid = $authenticated_uid`.

3. **Relational Anti-IDOR & Immutability Guards**:
   - **Shelf & Formula Reference Guard**: Users can only add or reference materials that are either `GLOBAL` or owned by the same `authenticated_uid`. Referencing another user's private material or accord is rejected with `403`/`400`.
   - **Immutable Formula & Accord Versions**: Saved `formula_versions` and `accord_versions` are append-only snapshots. Editing an accord creates a new `accord_versions` row (`v2`, `v3`) without mutating historical formula versions pinned to an earlier `accord_version_id`.
   - **Transactional Account Deletion**: `DELETE /api/account` deletes all user-owned records inside a single PostgreSQL transaction and never masks database failures with a false success response.

4. **Runtime Boundary Validation & Standardized Error Contract**:
   - Every API mutation payload and query parameter is validated at the Express boundary (`src/api/validation.ts`) before reaching repository functions.
   - All validation, authentication, and domain errors return a standardized JSON structure without leaking SQL queries or stack traces:
     ```json
     {
       "error": "Human-readable safe message",
       "code": "STABLE_ERROR_CODE",
       "details": []
     }
     ```

5. **Transport & Volumetric Hardening**:
   - `express.json({ limit: '256kb' })` caps request payload size.
   - Prototype pollution keys (`__proto__`, `constructor`, `prototype`) and nesting depths > 8 are rejected by `assertNoPrototypePollution`.
   - `/api/*` responses set `Cache-Control: no-store, no-cache, must-revalidate, private`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and enforce per-IP sliding-window rate limiting (`120 req / 60s`).

6. **Continuous Integration & Persistence Verification**:
   - GitHub Actions CI enforces reproducible installs (`npm ci`), strict TypeScript (`tsc --noEmit`), AST-parsed ESLint architectural rules (`osmolab/no-firestore-runtime`, `osmolab/no-seed-data-in-presentation`, `osmolab/no-hardcoded-pyramid-overrides`), memory-mode regression tests, and a real PostgreSQL 16 migration, 815-material catalog import, `/api/health/data`, and bounded `/api/catalog` smoke gate.
