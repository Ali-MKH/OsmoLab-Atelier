import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  setPersistenceModeOverride,
  setPostgresDbOverride,
} from '../db/index';
import {
  validateCatalogQuery,
  ApiValidationError,
} from '../api/validation';
import {
  resetMemoryStoreForTests,
  fetchBootstrapInfo,
  queryCatalogMaterials,
  getUserShelfWithMaterials,
  getCatalogMaterialDetail,
  getCatalogMaterialRegulatoryDossier,
  listFormulasForUser,
  listAccordsForUser,
  listEvaluationsForUser,
  listExperimentsForUser,
  listScentMemoriesForUser,
} from '../db/workspace-repo';

describe('Stage 4 — Runtime Data Boundary, Performance, Bounded Endpoints & Zero SEED in Presentation', () => {
  beforeEach(() => {
    setPersistenceModeOverride('memory');
    setPostgresDbOverride(null);
    resetMemoryStoreForTests();
  });

  it('enforces catalog query default limit = 50 and rejects limit > 100', () => {
    const defaultQuery = validateCatalogQuery({});
    assert.equal(defaultQuery.limit, 50, 'Default limit should be 50');

    assert.throws(
      () => validateCatalogQuery({ limit: 500 }),
      (err: unknown) => err instanceof ApiValidationError && (err as ApiValidationError).statusCode === 400,
      'Limit above 100 must be rejected with 400'
    );

    const validQuery = validateCatalogQuery({ limit: 25 });
    assert.equal(validQuery.limit, 25, 'Valid limit <= 100 must be preserved');
  });

  it('returns lightweight bootstrap info without monolithic catalog or regulatory arrays', async () => {
    const bootstrap = await fetchBootstrapInfo('test-perf-user', 'perf@atelier.local');
    assert.ok(bootstrap.user, 'Bootstrap response must have user profile');
    assert.ok(bootstrap.counts, 'Bootstrap response must have counts');
    assert.equal(typeof bootstrap.counts.catalog, 'number');
    assert.equal(typeof bootstrap.counts.shelf, 'number');
    assert.equal(typeof bootstrap.counts.workbench, 'number');
    assert.equal(typeof bootstrap.counts.formulas, 'number');

    // Invariant: Bootstrap must NOT contain massive materials or regulatory limits arrays
    assert.equal(
      (bootstrap as unknown as Record<string, unknown>).materials,
      undefined,
      'Bootstrap must not return materials array'
    );
    assert.equal(
      (bootstrap as unknown as Record<string, unknown>).regulatoryLimits,
      undefined,
      'Bootstrap must not return regulatoryLimits array'
    );
  });

  it('bounds catalog query results to 50 items by default and supports pagination', async () => {
    const res = await queryCatalogMaterials({});
    assert.ok(res.items.length <= 50, `Default result count must be <= 50, got ${res.items.length}`);
    assert.equal(res.limit, 50);
    assert.equal(res.offset, 0);
    assert.ok(res.totalCatalogMaterials >= 800, 'Total catalog materials count must reflect full catalog');
  });

  it('getUserShelfWithMaterials returns only shelf materials with workbench count', async () => {
    const uid = 'test-shelf-user';
    const shelfData = await getUserShelfWithMaterials(uid);
    assert.ok(Array.isArray(shelfData.shelf));
    assert.ok(Array.isArray(shelfData.materials));
    assert.equal(shelfData.shelfCount, shelfData.shelf.length);
    assert.equal(
      shelfData.workbenchCount,
      shelfData.shelf.filter((s) => s.isOnWorkbench).length
    );
    // Shelf size must be small, not the entire 815 library
    assert.ok(shelfData.materials.length <= 50, 'Shelf materials must only contain shelf items');
  });

  it('provides focused repository methods without full workspace loads', async () => {
    const uid = 'test-focused-user';
    const formulas = await listFormulasForUser(uid);
    assert.ok(Array.isArray(formulas));

    const accords = await listAccordsForUser(uid);
    assert.ok(Array.isArray(accords));

    const evaluations = await listEvaluationsForUser(uid);
    assert.ok(Array.isArray(evaluations));

    const experiments = await listExperimentsForUser(uid);
    assert.ok(Array.isArray(experiments));

    const memories = await listScentMemoriesForUser(uid);
    assert.ok(Array.isArray(memories));
  });

  it('getCatalogMaterialDetail and RegulatoryDossier load targeted records on demand', async () => {
    const detail = await getCatalogMaterialDetail(1);
    assert.ok(detail.material, 'Must return requested material');
    assert.equal(detail.material.id, 1);

    const dossier = await getCatalogMaterialRegulatoryDossier(1);
    assert.equal(dossier.materialId, 1);
    assert.ok(dossier.materialName);
    assert.ok(Array.isArray(dossier.regulatoryRecords));
    assert.ok(Array.isArray(dossier.constituents));
  });

  it('presentation files do not import SEED_* data from domain/seed-data', () => {
    const presentationFiles = [
      'src/App.tsx',
      'src/components/DualRegulatorySlider.tsx',
      'src/components/FormulaFacetRadarChart.tsx',
      'src/components/FormulaLabView.tsx',
      'src/components/HelpAndAboutViews.tsx',
      'src/components/MaterialsAndInventoryView.tsx',
      'src/components/MentorAndSearchModal.tsx',
      'src/components/OlfactoryPyramidView.tsx',
      'src/components/OlfactoryWheelView.tsx',
      'src/features/accords/AccordStudioView.tsx',
      'src/features/catalog/MaterialCatalogView.tsx',
      'src/features/catalog/MaterialFilters.tsx',
      'src/features/catalog/PyramidBadge.tsx',
      'src/features/catalog/ShelfControls.tsx',
      'src/features/evaluation/EvaluationAndJournalView.tsx',
      'src/features/formula/FormulaIngredientPicker.tsx',
      'src/features/formula/FormulaLabView.tsx',
      'src/features/mentor/OlfactoryMentorView.tsx',
      'src/features/regulatory/RegulatoryBadge.tsx',
      'src/features/regulatory/RegulatoryDossier.tsx',
      'src/features/scent-memory/ScentMemoryTrainerView.tsx',
    ];

    for (const relPath of presentationFiles) {
      const fullPath = path.resolve(relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const hasSeedImport =
          /from\s+['"][^'"]*domain\/seed-data['"]/.test(content) ||
          /SEED_[A-Z_]+/.test(content);
        assert.equal(
          hasSeedImport,
          false,
          `Presentation file ${relPath} must not import or reference SEED_* data`
        );
      }
    }
  });
});
