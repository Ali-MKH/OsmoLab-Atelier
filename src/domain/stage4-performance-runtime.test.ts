import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiValidationError, validateCatalogQuery } from '../api/validation.ts';
import {
  resetMemoryStoreForTests,
  fetchBootstrapInfo,
  queryCatalogMaterials,
  getUserShelf,
  getUserFormulas,
  getUserAccords,
  getUserEvaluations,
  getUserExperiments,
  getUserScentMemories,
  getCatalogMaterialDetail,
  getCatalogMaterialRegulatoryDossier,
  getMemoryGlobalCatalogCount,
} from '../db/workspace-repo.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, '..');

function collectTsFilesRecursively(dirPath: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFilesRecursively(fullPath));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('Stage 4 — Performance, Bounded Pagination, Focused Repositories & Presentation Seed Boundary', () => {
  beforeEach(() => {
    process.env.PERSISTENCE_MODE = 'memory';
    resetMemoryStoreForTests();
  });

  it('validates catalog query bounds (default limit = 50, limit > 100 rejected, valid limits <= 100 preserved)', () => {
    const defaultQuery = validateCatalogQuery({});
    assert.equal(defaultQuery.limit, 50);
    assert.equal(defaultQuery.offset, 0);

    const valid25 = validateCatalogQuery({ limit: '25', offset: '0' });
    assert.equal(valid25.limit, 25);

    const valid100 = validateCatalogQuery({ limit: '100', offset: '50' });
    assert.equal(valid100.limit, 100);
    assert.equal(valid100.offset, 50);

    assert.throws(
      () => validateCatalogQuery({ limit: '101' }),
      (err: unknown) =>
        err instanceof ApiValidationError &&
        err.code === 'INVALID_QUERY_PARAMETERS' &&
        err.details.some((d) => d.field === 'limit')
    );
  });

  it('paginates the 815-material catalog in memory mode without page overlap', async () => {
    const uid = 'uid-stage4-pagination';
    const email = 'stage4-pagination@osmolab.test';

    const page1 = await queryCatalogMaterials({
      uid,
      email,
      limit: 50,
      offset: 0,
    });
    const page2 = await queryCatalogMaterials({
      uid,
      email,
      limit: 50,
      offset: 50,
    });

    const totalCatalogMaterials = getMemoryGlobalCatalogCount();
    assert.equal(totalCatalogMaterials, 815);
    assert.equal(page1.total, 815);
    assert.equal(page2.total, 815);
    assert.ok(page1.materials.length <= 50 && page1.materials.length > 0);
    assert.ok(page2.materials.length <= 50 && page2.materials.length > 0);
    assert.equal(page1.limit, 50);
    assert.equal(page1.offset, 0);
    assert.equal(page2.limit, 50);
    assert.equal(page2.offset, 50);
    assert.equal(page1.offset + page1.materials.length < page1.total, true);
    assert.equal(page2.offset + page2.materials.length < page2.total, true);

    const page1Ids = new Set(page1.materials.map((m) => m.id));
    for (const mat of page2.materials) {
      assert.equal(
        page1Ids.has(mat.id),
        false,
        `Material ID ${mat.id} appeared on both page 1 and page 2`
      );
    }

    const tailPage = await queryCatalogMaterials({
      uid,
      email,
      limit: 50,
      offset: 800,
    });
    assert.equal(tailPage.total, 815);
    assert.equal(tailPage.materials.length, 15);
    assert.equal(tailPage.offset + tailPage.materials.length < tailPage.total, false);
  });

  it('returns lightweight bootstrap metadata without full materials or regulatoryLimits arrays', async () => {
    const uid = 'uid-stage4-bootstrap';
    const email = 'stage4-bootstrap@osmolab.test';

    const bootstrap = await fetchBootstrapInfo(uid, email);
    assert.ok(bootstrap.user);
    assert.equal(bootstrap.user.uid, uid);
    assert.ok(bootstrap.counts);
    assert.equal(bootstrap.counts.catalog, 815);

    const rawBootstrap = bootstrap as unknown as Record<string, unknown>;
    assert.equal('materials' in rawBootstrap, false);
    assert.equal('regulatoryLimits' in rawBootstrap, false);
  });

  it('provides focused repository accessors returning valid arrays and targeted material details', async () => {
    const uid = 'uid-stage4-focused';
    const email = 'stage4-focused@osmolab.test';

    const [shelf, formulas, accords, evaluations, experiments, scentMemories] =
      await Promise.all([
        getUserShelf(uid),
        getUserFormulas(uid),
        getUserAccords(uid),
        getUserEvaluations(uid),
        getUserExperiments(uid),
        getUserScentMemories(uid),
      ]);

    assert.ok(Array.isArray(shelf));
    assert.ok(Array.isArray(formulas));
    assert.ok(Array.isArray(accords));
    assert.ok(Array.isArray(evaluations));
    assert.ok(Array.isArray(experiments));
    assert.ok(Array.isArray(scentMemories));

    const firstPage = await queryCatalogMaterials({
      uid,
      email,
      limit: 1,
      offset: 0,
    });
    assert.equal(firstPage.materials.length, 1);
    const targetMaterialId = firstPage.materials[0].id;

    const detail = await getCatalogMaterialDetail(targetMaterialId, uid, email);
    assert.ok(detail);
    assert.equal(detail.material.id, targetMaterialId);
    const rawDetail = detail as unknown as Record<string, unknown>;
    assert.equal('formulas' in rawDetail, false);
    assert.equal('materials' in rawDetail, false);

    const dossier = await getCatalogMaterialRegulatoryDossier(targetMaterialId, uid);
    assert.ok(dossier);
    assert.equal(dossier.materialId, targetMaterialId);
    assert.ok(Array.isArray(dossier.regulatoryRecords));
    assert.ok(Array.isArray(dossier.constituents));
  });

  it('enforces presentation seed boundary across App.tsx, components/**, and features/**', () => {
    const presentationFiles = [
      path.join(SRC_ROOT, 'App.tsx'),
      ...collectTsFilesRecursively(path.join(SRC_ROOT, 'components')),
      ...collectTsFilesRecursively(path.join(SRC_ROOT, 'features')),
    ];

    assert.ok(presentationFiles.length > 0, 'Expected presentation source files to exist');

    for (const filePath of presentationFiles) {
      const rawSource = fs.readFileSync(filePath, 'utf8');
      const codeOnly = stripComments(rawSource);
      const relPath = path.relative(SRC_ROOT, filePath);

      assert.equal(
        /from\s+['"][^'"]*domain\/seed-data(?:\.ts)?['"]/.test(codeOnly) ||
          /import\s*\(\s*['"][^'"]*domain\/seed-data(?:\.ts)?['"]\s*\)/.test(codeOnly),
        false,
        `Presentation file src/${relPath} must not import from domain/seed-data`
      );

      assert.equal(
        /\bSEED_[A-Z0-9_]+\b/.test(codeOnly),
        false,
        `Presentation file src/${relPath} must not reference runtime SEED_* symbols`
      );
    }
  });

  it('enforces workspace hydration boundary so src/App.tsx does not use /api/workspace', () => {
    const appPath = path.join(SRC_ROOT, 'App.tsx');
    const rawApp = fs.readFileSync(appPath, 'utf8');
    const codeOnly = stripComments(rawApp);

    assert.equal(
      codeOnly.includes('/api/workspace'),
      false,
      'src/App.tsx must not use /api/workspace for normal UI hydration'
    );
  });
});
