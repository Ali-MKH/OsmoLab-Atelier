import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPersistenceMode,
  requirePostgresDb,
  setPersistenceModeOverride,
  setPostgresDbOverride,
  PersistenceModeError,
} from '../db/index';
import {
  getGlobalCatalogSnapshot,
  getWorkspaceSnapshot,
  getUserShelf,
  addToUserShelf,
  updateUserShelfItem,
  removeFromUserShelf,
  createMaterialRecord,
  importGlobalCatalogV11,
  resetMemoryStoreForTests,
  ShelfValidationError,
} from '../db/workspace-repo';
import { loadGlobalCatalogV11 } from '../db/catalog-v1-1';
import type { MaterialRegulatoryLimit, RawMaterial } from './types';

test('1. PERSISTENCE_MODE=memory works explicitly for test/dev mode', async () => {
  setPersistenceModeOverride('memory');
  setPostgresDbOverride(null);
  resetMemoryStoreForTests();

  assert.equal(getPersistenceMode(), 'memory');
  const catalog = await getGlobalCatalogSnapshot();
  assert.equal(catalog.materials.length, 815);
  assert.equal(catalog.regulatoryLimits.length, 815);
});

test('2. PERSISTENCE_MODE=postgres fails explicitly when PostgreSQL cannot be reached (no silent RAM fallback)', async () => {
  setPersistenceModeOverride('postgres');
  setPostgresDbOverride(null);

  assert.equal(getPersistenceMode(), 'postgres');
  assert.throws(
    () => requirePostgresDb(),
    (err: unknown) =>
      err instanceof PersistenceModeError &&
      err.message.includes('PERSISTENCE_MODE="postgres"')
  );

  await assert.rejects(
    async () => {
      await getWorkspaceSnapshot('user-postgres-fail-check');
    },
    (err: unknown) => err instanceof PersistenceModeError
  );

  await assert.rejects(
    async () => {
      await getGlobalCatalogSnapshot();
    },
    (err: unknown) => err instanceof PersistenceModeError
  );

  // Restore memory mode for remaining tests
  setPersistenceModeOverride('memory');
});

test('3. Importing data/catalog/v1.1 twice is idempotent and leaves 815 global materials + preserves LOOKUP_REQUIRED null limits', async () => {
  setPersistenceModeOverride('memory');
  resetMemoryStoreForTests();

  const firstImport = await importGlobalCatalogV11();
  const secondImport = await importGlobalCatalogV11();

  assert.equal(firstImport.totalCatalogMaterials, 815);
  assert.equal(secondImport.totalCatalogMaterials, 815);
  assert.equal(secondImport.regulatoryRecordsUpserted, 815);

  const catalog = await getGlobalCatalogSnapshot();
  assert.equal(catalog.materials.length, 815);
  assert.ok(
    catalog.materials.every(
      (m: RawMaterial) => m.scope === 'GLOBAL' && m.ownerUid === null
    )
  );

  const lookupRows = catalog.regulatoryLimits.filter(
    (r: MaterialRegulatoryLimit) => r.maxAllowedPercent === null
  );
  assert.equal(lookupRows.length, 787);
  assert.ok(
    lookupRows.every((r: MaterialRegulatoryLimit) => r.maxAllowedPercent === null),
    'All LOOKUP_REQUIRED regulatory rows must preserve maxAllowedPercent === null'
  );
});

test('4. Creating two users does not duplicate global catalog rows', async () => {
  setPersistenceModeOverride('memory');
  resetMemoryStoreForTests();

  const snapA = await getWorkspaceSnapshot('atelier-user-a');
  const snapB = await getWorkspaceSnapshot('atelier-user-b');
  const globalCatalog = await getGlobalCatalogSnapshot();

  assert.equal(globalCatalog.materials.length, 815);
  assert.equal(
    snapA.materials.filter((m: RawMaterial) => m.scope === 'GLOBAL').length,
    815
  );
  assert.equal(
    snapB.materials.filter((m: RawMaterial) => m.scope === 'GLOBAL').length,
    815
  );
});

test('5. User A shelf items do not appear in User B shelf', async () => {
  setPersistenceModeOverride('memory');
  resetMemoryStoreForTests();

  const userA = 'shelf-isolation-user-a';
  const userB = 'shelf-isolation-user-b';

  // Pick a catalog material outside the 18 starter seed materials (e.g., materialId 50)
  await addToUserShelf(userA, 50, {
    supplierName: 'Fraterworks',
    supplierProductName: 'Specialty Lot A',
    workingDilutionPct: 10,
    personalNotes: 'User A private organ note',
    isOnWorkbench: true,
  });

  const shelfA = await getUserShelf(userA);
  const shelfB = await getUserShelf(userB);

  const itemA50 = shelfA.find((s) => s.materialId === 50);
  const itemB50 = shelfB.find((s) => s.materialId === 50);

  assert.ok(itemA50, 'User A must have material 50 on their shelf');
  assert.equal(itemA50.supplierName, 'Fraterworks');
  assert.equal(itemA50.workingDilutionPct, 10);
  assert.equal(itemA50.isOnWorkbench, true);
  assert.equal(itemB50, undefined, 'User B must not see User A shelf item');

  const wsB = await getWorkspaceSnapshot(userB);
  const matB50 = wsB.materials.find((m: RawMaterial) => m.id === 50);
  assert.ok(matB50);
  assert.equal(matB50.isOnShelf, false);
  assert.equal(matB50.isOnWorkbench, false);
});

test('6. Pinning to Workbench requires or creates Shelf membership', async () => {
  setPersistenceModeOverride('memory');
  resetMemoryStoreForTests();

  const uid = 'workbench-rule-user';
  await getWorkspaceSnapshot(uid);

  // Material 100 is not on shelf initially. Attempting to PATCH isOnWorkbench=true without shelf membership fails:
  await assert.rejects(
    async () => {
      await updateUserShelfItem(uid, 100, { isOnWorkbench: true });
    },
    (err: unknown) =>
      err instanceof ShelfValidationError &&
      err.message.includes('Material is not on My Shelf')
  );

  // Adding to shelf with isOnWorkbench=true creates shelf membership AND workbench pin:
  const created = await addToUserShelf(uid, 100, { isOnWorkbench: true });
  assert.equal(created.materialId, 100);
  assert.equal(created.isOnWorkbench, true);

  // Unpinning from Workbench keeps the material on My Shelf:
  const unpinned = await updateUserShelfItem(uid, 100, { isOnWorkbench: false });
  assert.equal(unpinned.isOnWorkbench, false);

  const shelfAfterUnpin = await getUserShelf(uid);
  assert.ok(
    shelfAfterUnpin.some((s) => s.materialId === 100 && s.isOnWorkbench === false),
    'Unpinning from Workbench must not remove the material from My Shelf'
  );
});

test('7. Removing from Shelf clears Workbench membership', async () => {
  setPersistenceModeOverride('memory');
  resetMemoryStoreForTests();

  const uid = 'shelf-removal-user';
  await getWorkspaceSnapshot(uid);

  await addToUserShelf(uid, 120, { isOnWorkbench: true });
  let ws = await getWorkspaceSnapshot(uid);
  let mat120 = ws.materials.find((m: RawMaterial) => m.id === 120);
  assert.equal(mat120?.isOnShelf, true);
  assert.equal(mat120?.isOnWorkbench, true);

  await removeFromUserShelf(uid, 120);
  ws = await getWorkspaceSnapshot(uid);
  mat120 = ws.materials.find((m: RawMaterial) => m.id === 120);
  assert.equal(mat120?.isOnShelf, false);
  assert.equal(mat120?.isOnWorkbench, false);
});

test('8. User-created custom material is visible only to its owner', async () => {
  setPersistenceModeOverride('memory');
  resetMemoryStoreForTests();

  const ownerUid = 'custom-mat-owner';
  const otherUid = 'custom-mat-other';

  const created = await createMaterialRecord(ownerUid, {
    name: 'Private Tincture of Assam Oud',
    casNumber: '99999-01-2',
    primaryFamily: 'Woody',
    volatility: 'Base',
    naturalOrSynthetic: 'Natural',
  });

  assert.equal(created.scope, 'USER');
  assert.equal(created.ownerUid, ownerUid);
  assert.equal(created.isOnShelf, true);
  assert.equal(created.isOnWorkbench, true);

  const ownerWs = await getWorkspaceSnapshot(ownerUid);
  const otherWs = await getWorkspaceSnapshot(otherUid);
  const publicCatalog = await getGlobalCatalogSnapshot();

  assert.ok(ownerWs.materials.some((m: RawMaterial) => m.id === created.id));
  assert.ok(!otherWs.materials.some((m: RawMaterial) => m.id === created.id));
  assert.ok(!publicCatalog.materials.some((m: RawMaterial) => m.id === created.id));
});

test('9. Existing formulas still resolve their materials from the canonical 815-row catalog', async () => {
  setPersistenceModeOverride('memory');
  resetMemoryStoreForTests();

  const ws = await getWorkspaceSnapshot('formula-resolution-user');
  const materialIds = new Set(ws.materials.map((m: RawMaterial) => m.id));

  assert.ok(ws.formulas.length >= 3, 'Seeded formulas must be present');
  for (const formula of ws.formulas) {
    for (const version of formula.versions) {
      for (const item of version.items) {
        if (item.type === 'material' && item.materialId) {
          assert.ok(
            materialIds.has(item.materialId),
            `Formula "${formula.name}" version "${version.versionLabel}" materialId=${item.materialId} (${item.name}) must resolve in catalog`
          );
        }
      }
    }
  }

  const parsedCatalog = loadGlobalCatalogV11();
  assert.equal(parsedCatalog.materials.length, 815);
  assert.equal(parsedCatalog.regulatoryLimits.length, 815);
});
