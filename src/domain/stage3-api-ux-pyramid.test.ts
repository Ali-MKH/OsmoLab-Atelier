import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { verifyBearerTokenWithPolicy } from '../middleware/auth';
import {
  ApiValidationError,
  formatStandardizedApiError,
  validateCatalogQuery,
  validateShelfMutationPayload,
  validateSaveFormulaPayload,
  validateAccordPayload,
  validateEvaluationPayload,
  validateExperimentPayload,
  validateScentMemoryPayload,
} from '../api/validation';
import {
  resolveEffectiveMaterialPyramidMetadata,
  resolveFormulaPickerDefaultSource,
} from './formula-engine';
import {
  resetMemoryStoreForTests,
  fetchBootstrapInfo,
  queryCatalogMaterials,
  getCatalogMaterialDetail,
  getCatalogMaterialRegulatoryDossier,
  toggleUserWorkbenchPin,
  removeFromUserShelf,
} from '../db/workspace-repo';
import { RawMaterial } from './types';

function makeMockDecodedToken(
  overrides: Partial<DecodedIdToken> & { uid: string; email?: string; email_verified?: boolean }
): DecodedIdToken {
  return {
    aud: 'osmolab-project',
    auth_time: 1700000000,
    exp: 1900000000,
    iat: 1700000000,
    iss: 'https://securetoken.google.com/osmolab-project',
    sub: overrides.uid,
    firebase: {
      identities: {},
      sign_in_provider: 'google.com',
    },
    ...overrides,
  };
}

describe('Stage 3 — Auth Token Revocation Policy, Validation, Bounded API, Pyramid v1.1 & Simple Shelf/Workbench UX', () => {
  beforeEach(() => {
    process.env.PERSISTENCE_MODE = 'memory';
    resetMemoryStoreForTests();
  });

  it('enforces checkRevoked: true and standardized error codes in verifyBearerTokenWithPolicy', async () => {
    let capturedCheckRevoked: boolean | undefined;

    // 1. Missing header
    const missing = await verifyBearerTokenWithPolicy(undefined, async () => {
      throw new Error('Should not be called');
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.statusCode, 401);
    assert.equal(missing.code, 'AUTH_BEARER_TOKEN_REQUIRED');

    // 2. Valid verified token passes checkRevoked === true
    const valid = await verifyBearerTokenWithPolicy(
      'Bearer valid-firebase-jwt',
      async (_token, checkRevoked) => {
        capturedCheckRevoked = checkRevoked;
        return makeMockDecodedToken({
          uid: 'user-stage3-alpha',
          email: 'alpha@osmolab.test',
          email_verified: true,
        });
      }
    );
    assert.equal(
      capturedCheckRevoked,
      true,
      'Must call verifyIdToken(token, true) with checkRevoked=true'
    );
    assert.equal(valid.ok, true);
    assert.equal(valid.workspaceUid, 'user-stage3-alpha');
    assert.equal(valid.workspaceEmail, 'alpha@osmolab.test');

    // 3. Revoked token is rejected with AUTH_TOKEN_REVOKED
    const revoked = await verifyBearerTokenWithPolicy(
      'Bearer revoked-firebase-jwt',
      async () => {
        const err = new Error('Firebase ID token has been revoked.') as Error & {
          code?: string;
        };
        err.code = 'auth/id-token-revoked';
        throw err;
      }
    );
    assert.equal(revoked.ok, false);
    assert.equal(revoked.statusCode, 401);
    assert.equal(revoked.code, 'AUTH_TOKEN_REVOKED');

    // 4. Unverified email is rejected with 403 AUTH_EMAIL_NOT_VERIFIED
    const unverified = await verifyBearerTokenWithPolicy(
      'Bearer unverified-email-jwt',
      async () =>
        makeMockDecodedToken({
          uid: 'user-unverified',
          email: 'unverified@osmolab.test',
          email_verified: false,
        })
    );
    assert.equal(unverified.ok, false);
    assert.equal(unverified.statusCode, 403);
    assert.equal(unverified.code, 'AUTH_EMAIL_NOT_VERIFIED');
  });

  it('validates API query parameters and mutation payloads with standardized error contracts', () => {
    // Valid catalog query
    const q = validateCatalogQuery({
      search: 'Bergamot',
      family: 'Citrus',
      origin: 'Natural',
      pyramidCode: 'T',
      shelfOnly: 'true',
      workbenchOnly: 'false',
      limit: '50',
      offset: '10',
    });
    assert.equal(q.search, 'Bergamot');
    assert.equal(q.pyramidCode, 'T');
    assert.equal(q.shelfOnly, true);
    assert.equal(q.workbenchOnly, false);
    assert.equal(q.limit, 50);
    assert.equal(q.offset, 10);

    // Invalid pyramidCode throws ApiValidationError
    assert.throws(
      () => validateCatalogQuery({ pyramidCode: 'INVALID_TIER' }),
      (err: unknown) =>
        err instanceof ApiValidationError && err.code === 'INVALID_QUERY_PARAMETERS'
    );

    // Shelf mutation payload validation
    const shelfValid = validateShelfMutationPayload({
      supplierName: 'Fraterworks',
      workingDilutionPct: 10,
      pyramidOverrideCode: 'HB',
      isOnWorkbench: true,
    });
    assert.equal(shelfValid.supplierName, 'Fraterworks');
    assert.equal(shelfValid.workingDilutionPct, 10);
    assert.equal(shelfValid.pyramidOverrideCode, 'HB');
    assert.equal(shelfValid.isOnWorkbench, true);

    assert.throws(
      () => validateShelfMutationPayload({ workingDilutionPct: 150 }),
      (err: unknown) =>
        err instanceof ApiValidationError &&
        err.details.some((d) => d.field === 'workingDilutionPct')
    );

    // Formula save payload validation
    const formulaValid = validateSaveFormulaPayload({
      formula: {
        name: 'Chypre Atelier Study',
        finalProductConcentration: 20,
        ifraCategory: 'Category 4 (Fine Fragrance)',
      },
      version: {
        versionLabel: 'V1',
        status: 'Draft',
        items: [
          {
            type: 'material',
            materialId: 1,
            name: 'Bergamot EO FCF',
            quantityGrams: 5.0,
            dilutionPercent: 100,
          },
        ],
      },
    });
    assert.equal(formulaValid.formula.name, 'Chypre Atelier Study');
    assert.ok(Array.isArray(formulaValid.version.items));
    assert.equal((formulaValid.version.items as unknown[]).length, 1);

    assert.throws(
      () =>
        validateSaveFormulaPayload({
          formula: { name: '' },
          version: { items: [] },
        }),
      (err: unknown) => err instanceof ApiValidationError
    );

    // Accord, Evaluation, Experiment, Memory validations
    const accord = validateAccordPayload({
      name: 'Ambergris Base',
      items: [
        {
          materialId: 1,
          materialName: 'Ambroxan',
          percentage: 100,
          dilutionPercent: 10,
        },
      ],
    });
    assert.equal(accord.name, 'Ambergris Base');

    const evaluation = validateEvaluationPayload({
      formulaId: 1,
      versionLabel: 'V1',
      checkpoint: '1 hour',
    });
    assert.equal(evaluation.checkpoint, '1 hour');

    const experiment = validateExperimentPayload({
      formulaId: 1,
      stageLabel: 'Day 14',
      observation: 'Cleaner smoky facet at 10% in DPG',
    });
    assert.equal(experiment.observation, 'Cleaner smoky facet at 10% in DPG');

    const memory = validateScentMemoryPayload({
      materialId: 1,
      personalAssociation: 'Crushed citrus peel in Amalfi',
    });
    assert.equal(memory.materialId, 1);

    // Standardized error formatting masks unexpected internal errors
    const internalFormatted = formatStandardizedApiError(
      new Error('SELECT * FROM users WHERE password_hash = ...'),
      'Failed to process request.'
    );
    assert.equal(internalFormatted.statusCode, 500);
    assert.equal(internalFormatted.body.code, 'INTERNAL_SERVER_ERROR');
    assert.ok(!internalFormatted.body.error.includes('SELECT *'));
  });

  it('supports bounded catalog pagination, light default payloads, on-demand regulatory dossiers, and simple Shelf/Workbench pinning', async () => {
    const uid = 'uid-stage3-bench';
    const email = 'bench@osmolab.test';

    // 1. Bootstrap endpoint data is lightweight
    const bootstrap = await fetchBootstrapInfo(uid, email);
    assert.ok(
      bootstrap.counts.catalog >= 815,
      `Expected >= 815 catalog materials, got ${bootstrap.counts.catalog}`
    );
    assert.equal(bootstrap.user?.uid, uid);

    // 2. Bounded catalog query omits heavy regulatoryRecords & constituents by default
    const page1 = await queryCatalogMaterials({
      uid,
      email,
      limit: 25,
      offset: 0,
      includeRegulatory: false,
    });
    assert.equal(page1.materials.length, 25);
    assert.ok(page1.total >= 815);
    assert.equal(page1.regulatoryRecords, undefined);
    assert.equal(page1.constituents, undefined);

    // 3. On-demand single-material detail & regulatory dossier
    const firstId = page1.materials[0].id;
    const detail = await getCatalogMaterialDetail(firstId, uid, email);
    assert.ok(detail);
    assert.equal(detail.material.id, firstId);

    const regDossier = await getCatalogMaterialRegulatoryDossier(firstId, uid);
    assert.ok(regDossier);
    assert.equal(regDossier.materialId, firstId);
    assert.ok(Array.isArray(regDossier.regulatoryRecords));
    assert.ok(Array.isArray(regDossier.constituents));

    // 4. Pinning to Workbench automatically places material on My Shelf; unpinning keeps it on My Shelf
    await removeFromUserShelf(uid, firstId);
    const afterRemove = await getCatalogMaterialDetail(firstId, uid, email);
    assert.equal(afterRemove.material.isOnShelf, false);
    assert.equal(afterRemove.material.isOnWorkbench, false);

    // Pin directly to Workbench -> must also be on My Shelf
    await toggleUserWorkbenchPin(uid, firstId, true);
    const afterPin = await getCatalogMaterialDetail(firstId, uid, email);
    assert.equal(afterPin.material.isOnShelf, true);
    assert.equal(afterPin.material.isOnWorkbench, true);

    // Unpin from Workbench -> remains on My Shelf
    await toggleUserWorkbenchPin(uid, firstId, false);
    const afterUnpin = await getCatalogMaterialDetail(firstId, uid, email);
    assert.equal(afterUnpin.material.isOnShelf, true);
    assert.equal(afterUnpin.material.isOnWorkbench, false);
  });

  it('resolves v1.1 pyramid metadata (T, H, B, TH, HB, THB, NONE), user Shelf overrides, and Suggested confidence badges', () => {
    const baseMat: RawMaterial = {
      id: 901,
      name: 'Galbanum Resinoid',
      aliases: 'Ferula galbaniflua',
      casNumber: '8023-91-4',
      inciName: 'FERULA GALBANIFLUA RESIN OIL',
      naturalOrSynthetic: 'Natural',
      supplier: 'Robertet',
      supplierProductCode: 'GAL-01',
      manufacturer: 'Robertet',
      primaryFamily: 'Green',
      facets: ['Green', 'Resinous'],
      descriptiveNotes: 'Classic green top-heart bridge.',
      volatility: 'Top-Heart',
      pyramidUiCode: 'TH',
      pyramidHighlightTop: true,
      pyramidHighlightHeart: true,
      pyramidHighlightBase: false,
      pyramidConfidence: 'LOW',
      pyramidBasis: 'DESCRIPTOR_HEURISTIC',
      substantivityHours: 24,
      intensity: 9,
      diffusion: 8,
      flashPointCelsius: 65,
      density: 0.95,
      recommendedDilution: 10,
      purity: '100%',
      storageInfo: 'Cool dark place',
      shelfLifeMonths: 24,
      personalNotes: '',
      educationalObserve: [],
      complements: [],
      contrasts: [],
      texture: 'Crisp',
      temperatureImpression: 'Cool',
    };

    // 1. Default v1.1 metadata with LOW confidence -> isSuggested: true
    const metaDefault = resolveEffectiveMaterialPyramidMetadata(baseMat);
    assert.equal(metaDefault.uiCode, 'TH');
    assert.equal(metaDefault.highlightTop, true);
    assert.equal(metaDefault.highlightHeart, true);
    assert.equal(metaDefault.highlightBase, false);
    assert.equal(metaDefault.isSuggested, true);
    assert.equal(metaDefault.isUserOverride, false);
    assert.equal(metaDefault.tierId, 'top-heart');

    // 2. User Shelf override wins for that user and clears Suggested status
    const overriddenMat: RawMaterial = {
      ...baseMat,
      pyramidOverrideCode: 'THB',
    };
    const metaOverride = resolveEffectiveMaterialPyramidMetadata(overriddenMat);
    assert.equal(metaOverride.uiCode, 'THB');
    assert.equal(metaOverride.highlightTop, true);
    assert.equal(metaOverride.highlightHeart, true);
    assert.equal(metaOverride.highlightBase, true);
    assert.equal(metaOverride.isUserOverride, true);
    assert.equal(metaOverride.isSuggested, false);
    assert.equal(metaOverride.tierId, 'heart-base');

    // 3. Functional carrier NONE
    const solventMat: RawMaterial = {
      ...baseMat,
      name: 'Dipropylene Glycol (DPG)',
      pyramidUiCode: 'NONE',
      pyramidHighlightTop: false,
      pyramidHighlightHeart: false,
      pyramidHighlightBase: false,
      pyramidConfidence: 'HIGH',
      pyramidBasis: 'FUNCTIONAL_SOLVENT',
      pyramidOverrideCode: null,
    };
    const metaSolvent = resolveEffectiveMaterialPyramidMetadata(solventMat);
    assert.equal(metaSolvent.uiCode, 'NONE');
    assert.equal(metaSolvent.highlightTop, false);
    assert.equal(metaSolvent.highlightHeart, false);
    assert.equal(metaSolvent.highlightBase, false);
    assert.equal(metaSolvent.tierId, 'none');
    assert.equal(metaSolvent.isFunctionalCarrier, true);
  });

  it('gracefully defaults Formula Lab ingredient picker source to My Shelf when Current Workbench is empty', () => {
    assert.equal(
      resolveFormulaPickerDefaultSource([
        { isOnShelf: true, isOnWorkbench: true },
        { isOnShelf: true, isOnWorkbench: false },
      ]),
      'workbench'
    );
    assert.equal(
      resolveFormulaPickerDefaultSource([
        { isOnShelf: true, isOnWorkbench: false },
      ]),
      'shelf'
    );
    assert.equal(
      resolveFormulaPickerDefaultSource([
        { isOnShelf: false, isOnWorkbench: false },
      ]),
      'catalog'
    );
  });

  it('enforces Part 1 bounded catalog limits (default 50, max 100), 503 CATALOG_NOT_INITIALIZED formatting, and data readiness reporting', async () => {
    const defaultQuery = validateCatalogQuery({});
    assert.equal(defaultQuery.limit, 50);
    assert.equal(defaultQuery.offset, 0);

    assert.throws(
      () => validateCatalogQuery({ limit: '101' }),
      (err: unknown) =>
        err instanceof ApiValidationError &&
        err.code === 'INVALID_QUERY_PARAMETERS' &&
        err.details.some((d) => d.field === 'limit')
    );

    const { CatalogNotInitializedError } = await import('../db');
    const formatted503 = formatStandardizedApiError(
      new CatalogNotInitializedError(),
      'Fallback message'
    );
    assert.equal(formatted503.statusCode, 503);
    assert.equal(formatted503.body.code, 'CATALOG_NOT_INITIALIZED');

    const { getCatalogReadiness, loadStarterOrganForUser, getUserShelf } = await import(
      '../db/workspace-repo'
    );
    const readiness = await getCatalogReadiness();
    assert.equal(readiness.persistenceMode, 'memory');
    assert.equal(readiness.databaseReady, true);
    assert.equal(readiness.catalogReady, true);
    assert.ok(readiness.catalogCount >= 815);
    assert.equal(readiness.catalogVersion, 'v1.1');

    const initialShelf = await getUserShelf('uid-starter-organ-test');
    assert.ok(initialShelf.length > 0);
    await removeFromUserShelf('uid-starter-organ-test', initialShelf[0].materialId);
    const starterResult = await loadStarterOrganForUser('uid-starter-organ-test');
    assert.equal(starterResult.addedCount, 1);
    const shelfItems = await getUserShelf('uid-starter-organ-test');
    assert.equal(shelfItems.length, initialShelf.length);
  });
});


