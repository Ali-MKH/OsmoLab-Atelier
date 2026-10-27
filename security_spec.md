# OsmoLab Security Specification & Red-Team Audit (`security_spec.md`)

## 1. Zero-Trust Data Invariants

OsmoLab enforces strict multi-layered tenant isolation across **Cloud Firestore**, **PostgreSQL (Cloud SQL)**, **Express API Middleware**, and **Browser Local State**:

1. **Global Default-Deny Invariant**:
   - Every unmapped path in Firestore (`match /{document=**} { allow read, write: if false; }`) and every unauthenticated `/api/*` mutation/workspace route is denied by default.
2. **Strict Verified Identity & Zero Header-Spoofing Invariant**:
   - All cloud reads and writes require a cryptographically verified Firebase Authentication session (`request.auth != null` in Firestore; `adminAuth.verifyIdToken(token, true)` in Express) with `email_verified == true`.
   - Client-supplied identity headers (`x-workspace-uid`) or body fields (`userUid`, `ownerId`) are **never** trusted to establish identity.
3. **Strict Owner Isolation (Zero Cross-User Access)**:
   - User A (`uid_alice`) can **never** read (`get`), query (`list`), create, update, or delete any document or row belonging to User B (`uid_bob`).
   - Every `allow list` rule in `firestore.rules` explicitly enforces `resource.data.ownerId == request.auth.uid` (Query Enforcer).
   - Every PostgreSQL query in `src/db/workspace-repo.ts` scopes `WHERE user_uid = $authenticated_uid`.
4. **Relational Integrity & Cross-Tenant Foreign Key Guard (Anti-IDOR)**:
   - An `InventoryLot` cannot be created unless the referenced `materialId` exists AND belongs to the same authenticated `uid`.
   - A `FormulaVersion`, `PhysicalBatch`, `ExperimentEntry`, or `SensoryEvaluation` cannot be created or updated unless the referenced `formulaId` exists AND belongs to the same authenticated `uid`.
5. **Anti-Update-Gap & Action-Based Mutations**:
   - Every Firestore `update` rule begins with `isValid[Entity](incoming())`, verifies immutable fields (`ownerId`, `createdAt`), enforces server timestamps (`updatedAt == request.time`), locks terminal states (`status == 'Archived'`), and restricts changed keys via `incoming().diff(existing()).affectedKeys().hasOnly(...)`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Collection / Endpoint | Malicious Payload | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Identity Spoofing on Create** | `/users/uid_alice/formulas/f1` | `{ ownerId: "uid_bob", name: "Stolen Formula", ... }` | `PERMISSION_DENIED` (`ownerId != request.auth.uid`) |
| **2** | **Unverified Email Spoof Attack** | `/users/uid_alice` | Auth token with `uid: "uid_alice"`, `email_verified: false` | `PERMISSION_DENIED` (`isVerifiedUser()` fails) |
| **3** | **Cross-Tenant PII Read (`get`)** | `/users/uid_bob` | Authenticated as `uid_alice` (`email_verified: true`) reading `uid_bob` | `PERMISSION_DENIED` (`isOwner(userId)` fails) |
| **4** | **Unconstrained Collection Scrape (`list`)** | `/users/uid_bob/formulas` | Authenticated as `uid_alice` listing `uid_bob`'s formulas | `PERMISSION_DENIED` (`isOwner(userId) && existing().ownerId == request.auth.uid`) |
| **5** | **Shadow Field Injection** | `/users/uid_alice/formulas/f1` | Valid formula fields + `{ isAdmin: true, role: "superuser" }` | `PERMISSION_DENIED` (`hasOnly()` blocks undeclared keys) |
| **6** | **Path ID Poisoning (Denial of Wallet)** | `/users/uid_alice/formulas/bad$id!@#` | Document ID containing invalid characters or > 128 chars | `PERMISSION_DENIED` (`isValidId(formulaId)` fails) |
| **7** | **Value / Size Poisoning on Update** | `/users/uid_alice/formulas/f1` | Update `name` with a 50,000-character string or boolean `true` | `PERMISSION_DENIED` (`isValidFormulaDocument(incoming())` fails) |
| **8** | **Immortal Field Tampering (`ownerId` / `createdAt`)** | `/users/uid_alice/formulas/f1` | Update changing `ownerId` to `"uid_bob"` or altering `createdAt` | `PERMISSION_DENIED` (`incoming().ownerId == existing().ownerId` fails) |
| **9** | **Terminal State Unlocking Bypass** | `/users/uid_alice/formulas/f1` | Updating a formula whose existing `status` is `'Archived'` | `PERMISSION_DENIED` (`existing().status != 'Archived'` fails) |
| **10** | **Orphaned Sub-Resource Write (No Parent)** | `/users/uid_alice/inventoryLots/lot1` | Creating a lot referencing non-existent `/materials/mat_ghost` | `PERMISSION_DENIED` (`exists(.../materials/$(incoming().materialId))` fails) |
| **11** | **Forged Client Timestamp Injection** | `/users/uid_alice/materials/m1` | Creating or updating with backdated `updatedAt: Timestamp(2020, 1, 1)` | `PERMISSION_DENIED` (`incoming().updatedAt == request.time` fails) |
| **12** | **Unauthenticated Header Spoof (`x-workspace-uid`)** | `GET /api/workspace` & `DELETE /api/account` | HTTP request with `x-workspace-uid: uid_victim` and no `Bearer` token | `401 Unauthorized` (Header spoofing rejected) |

---

## 3. Red-Team Conflict Report & Verification Summary

- **Shadow Update Test**: PASS — All `create` rules enforce `data.keys().hasAll(...) && data.keys().hasOnly(...)` inside `isValid[Entity]()`; all `update` rules enforce `incoming().diff(existing()).affectedKeys().hasOnly(...)` wrapped inside `isValid[Entity](incoming())`.
- **Email Spoofing Test**: PASS — `isVerifiedUser()` enforces `request.auth != null && request.auth.token.email_verified == true`.
- **PII Blanket Test**: PASS — `/users/{userId}` containing `email` and `displayName` restricts `get` and `write` strictly to `isOwner(userId) && existing().ownerId == request.auth.uid`.
- **Query Trust Test**: PASS — Every `allow list` rule enforces `isOwner(userId) && existing().ownerId == request.auth.uid` without `get()`/`exists()` inside `list`.
- **PostgreSQL IDOR & Header Bypass Audit**: PASS — Removed `x-workspace-uid` fallback in `src/middleware/auth.ts`; added parent ownership verification (`assertMaterialOwnedByUser`, `assertFormulaOwnedByUser`) in `src/db/workspace-repo.ts`.
