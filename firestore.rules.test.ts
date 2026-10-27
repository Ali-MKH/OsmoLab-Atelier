import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateFirestoreSecurityRule,
  assertStrictTenantPayload,
  sanitizeBoundedString,
  isValidResourceId,
  SecurityPolicyViolationError,
  OSMOLAB_SECURITY_CONTROLS,
} from './src/domain/security-policy';

const NOW_MS = 1761300000000;
const ALICE_AUTH = {
  uid: 'uid_alice_01',
  email: 'alice@osmolab.org',
  email_verified: true,
};
const BOB_AUTH = {
  uid: 'uid_bob_02',
  email: 'bob@osmolab.org',
  email_verified: true,
};

const VALID_ALICE_FORMULA = {
  ownerId: 'uid_alice_01',
  name: 'Forest Study V5',
  projectName: 'Mediterranean Woods',
  status: 'Draft',
  activeVersionLabel: 'V5',
  intendedProduct: 'Eau de Parfum (20% conc.)',
  ifraCategory: 'Category 4 (Fine Fragrance)',
  finalProductConcentration: 20,
  targetBrief: 'Damp cedar needles and coastal bergamot.',
  tags: ['Woody', 'Green'],
  createdAt: NOW_MS,
  updatedAt: NOW_MS,
};

const PROFILES = {
  uid_alice_01: { ownerId: 'uid_alice_01', email: 'alice@osmolab.org' },
  uid_bob_02: { ownerId: 'uid_bob_02', email: 'bob@osmolab.org' },
};

test('Firestore Rules Structure: contains global default-deny catch-all and all blueprint collections', () => {
  const rulesText = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('match /{document=**} {\n      allow read, write: if false;\n    }'));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesText.includes('match /users/{userId}'));
  assert.ok(rulesText.includes('match /formulas/{formulaId}'));
  assert.ok(rulesText.includes('match /materials/{materialId}'));
  assert.ok(rulesText.includes('match /evaluations/{evaluationId}'));
});

test('Baseline Valid Operations: owner with verified email can create, read, and update own formula', () => {
  const createRes = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'create',
    path: '/users/uid_alice_01/formulas/formula_101',
    requestTimeMs: NOW_MS,
    incomingDoc: VALID_ALICE_FORMULA,
    existingUserProfiles: PROFILES,
  });
  assert.equal(createRes, 'ALLOW');

  const updateRes = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'update',
    path: '/users/uid_alice_01/formulas/formula_101',
    requestTimeMs: NOW_MS + 5000,
    existingDoc: VALID_ALICE_FORMULA,
    incomingDoc: {
      ...VALID_ALICE_FORMULA,
      name: 'Forest Study V6',
      activeVersionLabel: 'V6',
      updatedAt: NOW_MS + 5000,
    },
    existingUserProfiles: PROFILES,
  });
  assert.equal(updateRes, 'ALLOW');
});

test('Dirty Dozen #1 (Identity Spoofing): creating a formula with ownerId set to another user returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'create',
    path: '/users/uid_alice_01/formulas/formula_101',
    requestTimeMs: NOW_MS,
    incomingDoc: {
      ...VALID_ALICE_FORMULA,
      ownerId: 'uid_bob_02',
    },
    existingUserProfiles: PROFILES,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #2 (Email Spoofing / Unverified Token): email_verified == false returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: { ...ALICE_AUTH, email_verified: false },
    operation: 'get',
    path: '/users/uid_alice_01',
    requestTimeMs: NOW_MS,
    existingDoc: PROFILES.uid_alice_01,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #3 (Cross-Tenant PII Blanket Read): Alice attempting to read Bob user profile returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'get',
    path: '/users/uid_bob_02',
    requestTimeMs: NOW_MS,
    existingDoc: PROFILES.uid_bob_02,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #4 (Query Trust / Unauthorized Collection List): Alice attempting to list Bob formulas returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'list',
    path: '/users/uid_bob_02/formulas',
    requestTimeMs: NOW_MS,
    existingDoc: { ...VALID_ALICE_FORMULA, ownerId: 'uid_bob_02' },
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #5 (Shadow Field Injection): sending an undeclared ghost field (isAdmin: true) returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'create',
    path: '/users/uid_alice_01/formulas/formula_101',
    requestTimeMs: NOW_MS,
    incomingDoc: {
      ...VALID_ALICE_FORMULA,
      isAdmin: true,
    },
    existingUserProfiles: PROFILES,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #6 (Path ID Poisoning): injecting special characters or oversized ID in path returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'create',
    path: '/users/uid_alice_01/formulas/bad$id!@#script',
    requestTimeMs: NOW_MS,
    incomingDoc: VALID_ALICE_FORMULA,
    existingUserProfiles: PROFILES,
  });
  assert.equal(res, 'PERMISSION_DENIED');
  assert.equal(isValidResourceId('bad$id!@#'), false);
  assert.equal(isValidResourceId('a'.repeat(129)), false);
});

test('Dirty Dozen #7 (Value / Size Poisoning on Update): updating whitelisted field with oversized string returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'update',
    path: '/users/uid_alice_01/formulas/formula_101',
    requestTimeMs: NOW_MS + 1000,
    existingDoc: VALID_ALICE_FORMULA,
    incomingDoc: {
      ...VALID_ALICE_FORMULA,
      name: 'X'.repeat(500),
      updatedAt: NOW_MS + 1000,
    },
    existingUserProfiles: PROFILES,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #8 (Immortal Field Tampering): mutating createdAt or ownerId during update returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'update',
    path: '/users/uid_alice_01/formulas/formula_101',
    requestTimeMs: NOW_MS + 1000,
    existingDoc: VALID_ALICE_FORMULA,
    incomingDoc: {
      ...VALID_ALICE_FORMULA,
      createdAt: NOW_MS - 999999,
      updatedAt: NOW_MS + 1000,
    },
    existingUserProfiles: PROFILES,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #9 (Terminal State Locking): updating a formula once status is Archived returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'update',
    path: '/users/uid_alice_01/formulas/formula_101',
    requestTimeMs: NOW_MS + 1000,
    existingDoc: {
      ...VALID_ALICE_FORMULA,
      status: 'Archived',
    },
    incomingDoc: {
      ...VALID_ALICE_FORMULA,
      status: 'Draft',
      updatedAt: NOW_MS + 1000,
    },
    existingUserProfiles: PROFILES,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #10 (Orphaned Sub-Resource Write): creating an evaluation for a non-existent or foreign formulaId returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'create',
    path: '/users/uid_alice_01/evaluations/eval_01',
    requestTimeMs: NOW_MS,
    incomingDoc: {
      ownerId: 'uid_alice_01',
      formulaId: 'formula_belonging_to_bob',
      checkpoint: '24 hours',
      overallScore: 8.5,
      openingNotes: 'Bright',
      heartNotes: 'Floral',
      drydownNotes: 'Woody',
      createdAt: NOW_MS,
      updatedAt: NOW_MS,
    },
    existingUserProfiles: PROFILES,
    existingFormulasByUser: {
      uid_alice_01: {
        formula_alice_1: { ownerId: 'uid_alice_01' },
      },
      uid_bob_02: {
        formula_belonging_to_bob: { ownerId: 'uid_bob_02' },
      },
    },
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #11 (Forged Client Timestamp): creating or updating with non-server timestamp returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreSecurityRule({
    auth: ALICE_AUTH,
    operation: 'create',
    path: '/users/uid_alice_01/formulas/formula_101',
    requestTimeMs: NOW_MS,
    incomingDoc: {
      ...VALID_ALICE_FORMULA,
      createdAt: NOW_MS - 60000,
    },
    existingUserProfiles: PROFILES,
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #12 (Backend Cross-Tenant Payload & Prototype Pollution Guard): blocks spoofed userUid and script injection', () => {
  assert.throws(
    () => assertStrictTenantPayload({ name: 'Bergamot', userUid: BOB_AUTH.uid }, ALICE_AUTH.uid),
    (err: unknown) =>
      err instanceof SecurityPolicyViolationError &&
      err.code === 'IDENTITY_SPOOFING_BLOCKED' &&
      err.statusCode === 403
  );

  const sanitized = sanitizeBoundedString('<script>alert(1)</script>Bergamot Reggio', 50);
  assert.equal(sanitized, 'alert(1)Bergamot Reggio');
  assert.equal(OSMOLAB_SECURITY_CONTROLS.length, 6);
});
