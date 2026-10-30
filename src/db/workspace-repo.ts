import { eq, desc, and, or, isNull, ilike, inArray, count } from 'drizzle-orm';
import {
  getPersistenceMode,
  requirePostgresDb,
  CatalogNotInitializedError,
  isCatalogAutoBootstrapEnabled,
  isPostgresConfigured,
} from './index.ts';
import {
  users,
  materials,
  materialOlfactoryProfiles,
  userShelf,
  materialRegulatoryLimits,
  materialRegulatoryRecords,
  materialConstituents,
  scentMemories,
  accords,
  accordVersions,
  accordVersionItems,
  projects,
  formulas,
  formulaVersions,
  formulaVersionItems,
  experiments,
  evaluations,
  materialUsageReviews,
  suppliers,
  auditLogs,
} from './schema.ts';
import {
  SEED_ACCORDS,
  SEED_EVALUATIONS,
  SEED_EXPERIMENTS,
  SEED_FORMULAS,
  SEED_SCENT_MEMORIES,
  SEED_USAGE_REVIEWS,
} from '../domain/seed-data.ts';
import {
  loadGlobalCatalogV11,
  findGlobalCatalogMaterial,
  DEFAULT_STARTER_SHELF_IDS,
  SEED_ID_TO_CATALOG_KEY,
} from './catalog-v1-1.ts';
import type {
  AccordDefinition,
  AccordItem,
  AccordVersionSnapshot,
  ExperimentEntry,
  Formula,
  FormulaLineItem,
  FormulaStatus,
  FormulaVersion,
  MaterialConstituent,
  MaterialRegulatoryLimit,
  MaterialRegulatoryRecord,
  MaterialUsageReview,
  NormalizedFormulaVersionItem,
  PyramidConfidence,
  PyramidPrimaryZone,
  PyramidUiCode,
  RawMaterial,
  RegulatoryAuthority,
  RegulatoryRuleType,
  RegulatoryVerificationStatus,
  ScentMemoryRecord,
  SensoryEvaluation,
  ShelfMutationPayload,
  UserShelfItem,
  VolatilityTier,
} from '../domain/types.ts';

export class ShelfValidationError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ShelfValidationError';
    this.statusCode = statusCode;
  }
}

export class FormulaIntegrityError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'FormulaIntegrityError';
    this.statusCode = statusCode;
  }
}

export interface WorkspacePayload {
  user: {
    uid: string;
    email: string;
    displayName: string;
    theme: string;
    educationalPrompts: boolean;
    safetyEnabled: boolean;
  };
  materials: RawMaterial[];
  shelf: UserShelfItem[];
  userShelf: UserShelfItem[];
  regulatoryLimits: MaterialRegulatoryLimit[];
  regulatoryRecords: MaterialRegulatoryRecord[];
  constituents: MaterialConstituent[];
  scentMemories: ScentMemoryRecord[];
  accords: AccordDefinition[];
  formulas: Formula[];
  experiments: ExperimentEntry[];
  evaluations: SensoryEvaluation[];
  usageReviews: MaterialUsageReview[];
}

// ============================================================================
// IN-MEMORY STORE (Used ONLY when PERSISTENCE_MODE === 'memory')
// Shared GLOBAL catalog is stored ONCE and never duplicated per user.
// ============================================================================

interface MemoryAuditEntry {
  id: number;
  userUid: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

interface MemoryUserStore {
  user: WorkspacePayload['user'];
  shelfByMaterialId: Map<number, UserShelfItem>;
  userRegulatoryOverrides: Map<number, MaterialRegulatoryLimit>;
  userRegulatoryRecords: MaterialRegulatoryRecord[];
  scentMemories: ScentMemoryRecord[];
  accords: AccordDefinition[];
  formulas: Formula[];
  experiments: ExperimentEntry[];
  evaluations: SensoryEvaluation[];
  usageReviews: MaterialUsageReview[];
  auditLogs: MemoryAuditEntry[];
}

let memoryGlobalCatalogMaterials: RawMaterial[] | null = null;
let memoryGlobalRegulatoryLimits: MaterialRegulatoryLimit[] | null = null;
let memoryGlobalRegulatoryRecords: MaterialRegulatoryRecord[] | null = null;
let memoryGlobalConstituents: MaterialConstituent[] | null = null;
let memoryCustomUserMaterials: RawMaterial[] = [];
const memoryUserWorkspaces = new Map<string, MemoryUserStore>();
let memoryNextShelfId = 1;
let memoryNextCustomMaterialId = 10000;
let memoryNextAccordVersionId = 1;
let memoryNextFormulaVersionItemId = 1;
let memoryNextAuditLogId = 1;

function ensureMemoryGlobalCatalogLoaded(): {
  materials: RawMaterial[];
  regulatoryLimits: MaterialRegulatoryLimit[];
  regulatoryRecords: MaterialRegulatoryRecord[];
  constituents: MaterialConstituent[];
} {
  if (
    !memoryGlobalCatalogMaterials ||
    !memoryGlobalRegulatoryLimits ||
    !memoryGlobalRegulatoryRecords ||
    !memoryGlobalConstituents
  ) {
    const bundle = loadGlobalCatalogV11();
    memoryGlobalCatalogMaterials = bundle.materials.map((m) => ({
      ...m,
      scope: 'GLOBAL',
      ownerUid: null,
      personalNotes: '',
      isOnShelf: false,
      isOnWorkbench: false,
    }));
    memoryGlobalRegulatoryLimits = bundle.regulatoryLimits.map((r) => ({ ...r }));
    memoryGlobalRegulatoryRecords = bundle.regulatoryRecords.map((r) => ({ ...r }));
    memoryGlobalConstituents = bundle.constituents.map((c) => ({ ...c }));
  }
  return {
    materials: memoryGlobalCatalogMaterials,
    regulatoryLimits: memoryGlobalRegulatoryLimits,
    regulatoryRecords: memoryGlobalRegulatoryRecords,
    constituents: memoryGlobalConstituents,
  };
}

export function resetMemoryStoreForTests(): void {
  memoryGlobalCatalogMaterials = null;
  memoryGlobalRegulatoryLimits = null;
  memoryGlobalRegulatoryRecords = null;
  memoryGlobalConstituents = null;
  memoryCustomUserMaterials = [];
  memoryUserWorkspaces.clear();
  memoryNextShelfId = 1;
  memoryNextCustomMaterialId = 10000;
  memoryNextAccordVersionId = 1;
  memoryNextFormulaVersionItemId = 1;
  memoryNextAuditLogId = 1;
}

export function getMemoryGlobalCatalogCount(): number {
  return ensureMemoryGlobalCatalogLoaded().materials.length;
}

function normalizeSeedAccordsWithVersions(seedAccords: AccordDefinition[]): AccordDefinition[] {
  return seedAccords.map((acc) => {
    const cloned = structuredClone(acc);
    const activeLabel = cloned.activeVersionLabel || 'V1';
    const existingVers = cloned.versions && cloned.versions.length > 0 ? cloned.versions : [];
    const normalizedVers: AccordVersionSnapshot[] = [];

    for (const v of existingVers) {
      const numId = memoryNextAccordVersionId++;
      normalizedVers.push({
        id: numId,
        accordId: cloned.id,
        versionId: v.versionId || `acc-${cloned.id}-v${numId}`,
        versionLabel: v.versionLabel,
        status: 'Committed',
        createdAt: v.createdAt || '2026-09-20 10:00',
        versionNotes: v.versionNotes || '',
        items: v.items.map((it, idx) => ({
          ...it,
          id: idx + 1,
          lineOrder: idx,
        })),
      });
    }

    let activeVer = normalizedVers.find((v) => v.versionLabel === activeLabel);
    if (!activeVer) {
      const numId = memoryNextAccordVersionId++;
      activeVer = {
        id: numId,
        accordId: cloned.id,
        versionId: `acc-${cloned.id}-${activeLabel.toLowerCase()}`,
        versionLabel: activeLabel,
        status: 'Committed',
        createdAt: '2026-10-01 10:00',
        versionNotes: cloned.notes || 'Committed accord version',
        items: cloned.items.map((it, idx) => ({
          ...it,
          id: idx + 1,
          lineOrder: idx,
        })),
      };
      normalizedVers.push(activeVer);
    }

    return {
      ...cloned,
      activeVersionId: activeVer.id,
      activeVersionLabel: activeVer.versionLabel,
      items: structuredClone(activeVer.items),
      versions: normalizedVers,
    };
  });
}

function buildNormalizedItemsForVersion(
  formulaVersionId: number,
  items: FormulaLineItem[],
  accordsList: AccordDefinition[]
): {
  lineItems: FormulaLineItem[];
  normalizedItems: NormalizedFormulaVersionItem[];
} {
  const nowIso = new Date().toISOString();
  const lineItems: FormulaLineItem[] = [];
  const normalizedItems: NormalizedFormulaVersionItem[] = [];

  items.forEach((rawItem, idx) => {
    const isAccord =
      rawItem.type === 'accord' || rawItem.itemType === 'ACCORD';
    const itemType: 'MATERIAL' | 'ACCORD' = isAccord ? 'ACCORD' : 'MATERIAL';

    let resolvedAccordId: number | null = rawItem.accordId ?? null;
    let resolvedAccordVersionId: number | null = rawItem.accordVersionId ?? null;
    let resolvedAccordVersionLabel: string | undefined = rawItem.accordVersionLabel;

    if (isAccord) {
      const matchedAccord =
        (resolvedAccordId
          ? accordsList.find((a) => a.id === resolvedAccordId)
          : undefined) ||
        (resolvedAccordVersionId
          ? accordsList.find((a) =>
              a.versions?.some((v) => v.id === resolvedAccordVersionId)
            )
          : undefined);

      if (matchedAccord) {
        resolvedAccordId = matchedAccord.id;
        if (resolvedAccordVersionId) {
          const verSnap = matchedAccord.versions?.find(
            (v) => v.id === resolvedAccordVersionId
          );
          if (verSnap) {
            resolvedAccordVersionLabel = verSnap.versionLabel;
          }
        } else {
          resolvedAccordVersionId = matchedAccord.activeVersionId ?? null;
          resolvedAccordVersionLabel = matchedAccord.activeVersionLabel;
        }
      }
    }

    const normId = memoryNextFormulaVersionItemId++;
    const dilutionPct = rawItem.dilutionPercent ?? 100;
    const pct = rawItem.percentage ?? 0;
    const qty = rawItem.quantityGrams ?? 0;
    const activePct =
      rawItem.activeMaterialPercent ?? Number((pct * (dilutionPct / 100)).toFixed(4));

    const normRow: NormalizedFormulaVersionItem = {
      id: normId,
      formulaVersionId,
      lineOrder: idx,
      itemType,
      materialId: isAccord ? null : (rawItem.materialId ?? null),
      accordId: isAccord ? resolvedAccordId : null,
      accordVersionId: isAccord ? resolvedAccordVersionId : null,
      name: rawItem.name,
      percentage: pct,
      quantityGrams: qty,
      dilutionPct,
      solvent: rawItem.solvent || (dilutionPct < 100 ? 'Ethanol' : 'Neat'),
      activeMaterialPct: activePct,
      supplier: rawItem.supplier || '',
      costPerGram: rawItem.costPerGram ?? 0.35,
      notes: rawItem.notes || '',
      createdAt: nowIso,
    };

    normalizedItems.push(normRow);
    lineItems.push({
      ...rawItem,
      id: rawItem.id || `line-${normId}`,
      lineOrder: idx,
      type: isAccord ? 'accord' : 'material',
      itemType,
      materialId: isAccord ? undefined : rawItem.materialId,
      accordId: isAccord ? (resolvedAccordId ?? undefined) : undefined,
      accordVersionId: isAccord ? resolvedAccordVersionId : null,
      accordVersionLabel: isAccord ? resolvedAccordVersionLabel : undefined,
      percentage: pct,
      quantityGrams: qty,
      dilutionPercent: dilutionPct,
      solvent: normRow.solvent,
      activeMaterialPercent: activePct,
    });
  });

  return { lineItems, normalizedItems };
}

function getOrCreateMemoryUserStore(uid: string, email: string): MemoryUserStore {
  ensureMemoryGlobalCatalogLoaded();
  const existing = memoryUserWorkspaces.get(uid);
  if (existing) {
    return existing;
  }

  const nowIso = new Date().toISOString();
  const shelfMap = new Map<number, UserShelfItem>();

  for (const matId of DEFAULT_STARTER_SHELF_IDS) {
    const globalMat = memoryGlobalCatalogMaterials!.find((m) => m.id === matId);
    if (!globalMat) continue;
    shelfMap.set(matId, {
      id: memoryNextShelfId++,
      userUid: uid,
      materialId: matId,
      catalogKey: globalMat.catalogKey,
      supplierName: globalMat.supplier || '',
      supplierProductName: globalMat.supplierProductCode || '',
      workingDilutionPct: globalMat.recommendedDilution ?? 100,
      personalNotes: '',
      isOnWorkbench: true,
      pyramidOverrideCode: null,
      favorite: false,
      addedAt: nowIso,
      updatedAt: nowIso,
    });
  }

  const seededAccords = normalizeSeedAccordsWithVersions(SEED_ACCORDS);
  const seededFormulas: Formula[] = structuredClone(SEED_FORMULAS).map((f) => ({
    ...f,
    versions: f.versions.map((v) => {
      const { lineItems, normalizedItems } = buildNormalizedItemsForVersion(
        v.id,
        v.items,
        seededAccords
      );
      return {
        ...v,
        items: lineItems,
        normalizedItems,
      };
    }),
  }));

  const resolveSeedFormulaVersionId = (
    formulaId: number,
    versionLabel: string
  ): number | null => {
    const f = seededFormulas.find((form) => form.id === formulaId);
    if (!f) return null;
    const v =
      f.versions.find((ver) => ver.versionLabel === versionLabel) ||
      f.versions.find((ver) => ver.versionLabel === f.activeVersionLabel) ||
      f.versions[0];
    return v ? v.id : null;
  };

  const seededExperiments: ExperimentEntry[] = structuredClone(SEED_EXPERIMENTS).map(
    (exp) => ({
      ...exp,
      formulaVersionId: resolveSeedFormulaVersionId(
        exp.formulaId,
        exp.formulaVersionLabel
      ),
    })
  );

  const seededEvaluations: SensoryEvaluation[] = structuredClone(SEED_EVALUATIONS).map(
    (ev) => ({
      ...ev,
      formulaVersionId: resolveSeedFormulaVersionId(
        ev.formulaId,
        ev.formulaVersionLabel
      ),
    })
  );

  const seededReviews: MaterialUsageReview[] = structuredClone(SEED_USAGE_REVIEWS).map(
    (rev) => ({
      ...rev,
      formulaVersionId: resolveSeedFormulaVersionId(rev.formulaId, rev.versionLabel),
    })
  );

  const created: MemoryUserStore = {
    user: {
      uid,
      email,
      displayName: email.split('@')[0] || 'Perfumer',
      theme: 'dark',
      educationalPrompts: true,
      safetyEnabled: true,
    },
    shelfByMaterialId: shelfMap,
    userRegulatoryOverrides: new Map(),
    userRegulatoryRecords: [],
    scentMemories: structuredClone(SEED_SCENT_MEMORIES),
    accords: seededAccords,
    formulas: seededFormulas,
    experiments: seededExperiments,
    evaluations: seededEvaluations,
    usageReviews: seededReviews,
    auditLogs: [],
  };

  memoryUserWorkspaces.set(uid, created);
  return created;
}

function mergeCatalogAndShelfForUser(
  globalMaterials: RawMaterial[],
  customUserMaterials: RawMaterial[],
  shelfMap: Map<number, UserShelfItem>
): RawMaterial[] {
  const combined = [...globalMaterials, ...customUserMaterials];
  return combined.map((mat) => {
    const shelfEntry = shelfMap.get(mat.id);
    const isOnShelf = Boolean(shelfEntry);
    const isOnWorkbench = Boolean(shelfEntry && shelfEntry.isOnWorkbench);
    return {
      ...mat,
      isOnShelf,
      isOnWorkbench,
      supplier: shelfEntry?.supplierName ? shelfEntry.supplierName : mat.supplier,
      supplierProductName: shelfEntry?.supplierProductName || mat.supplierProductName || '',
      workingDilutionPct: shelfEntry?.workingDilutionPct ?? mat.workingDilutionPct ?? null,
      personalNotes: shelfEntry
        ? shelfEntry.personalNotes
        : mat.scope === 'USER'
        ? mat.personalNotes
        : '',
      pyramidOverrideCode: shelfEntry?.pyramidOverrideCode ?? null,
      favorite: Boolean(shelfEntry?.favorite),
    };
  });
}

function buildMemoryWorkspacePayload(uid: string, email: string): WorkspacePayload {
  const {
    materials: globalMats,
    regulatoryLimits: globalRegs,
    regulatoryRecords: globalRecs,
    constituents: globalConsts,
  } = ensureMemoryGlobalCatalogLoaded();
  const store = getOrCreateMemoryUserStore(uid, email);
  const ownedCustomMats = memoryCustomUserMaterials.filter(
    (m) => m.scope === 'USER' && m.ownerUid === uid
  );

  const hydratedMaterials = mergeCatalogAndShelfForUser(
    globalMats,
    ownedCustomMats,
    store.shelfByMaterialId
  );

  const regMap = new Map<number, MaterialRegulatoryLimit>();
  for (const r of globalRegs) {
    regMap.set(r.materialId, r);
  }
  for (const [matId, override] of store.userRegulatoryOverrides.entries()) {
    regMap.set(matId, override);
  }

  const combinedRecords = [...globalRecs, ...store.userRegulatoryRecords];
  const shelfItems = Array.from(store.shelfByMaterialId.values());

  return {
    user: { ...store.user },
    materials: hydratedMaterials,
    shelf: shelfItems,
    userShelf: shelfItems,
    regulatoryLimits: Array.from(regMap.values()),
    regulatoryRecords: combinedRecords,
    constituents: globalConsts,
    scentMemories: structuredClone(store.scentMemories),
    accords: structuredClone(store.accords),
    formulas: structuredClone(store.formulas),
    experiments: structuredClone(store.experiments),
    evaluations: structuredClone(store.evaluations),
    usageReviews: structuredClone(store.usageReviews),
  };
}

// ============================================================================
// SAFE PARSERS FOR POSTGRES ROWS
// ============================================================================

function safeParseArray(str: string | null | undefined): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function safeParseObject<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

// ============================================================================
// DETERMINISTIC GLOBAL CATALOG IMPORTER (POSTGRES + MEMORY)
// ============================================================================

let pgGlobalCatalogSeeded = false;

export const EXPECTED_CANONICAL_CATALOG_COUNT = 815;

export interface DataHealthResponse {
  persistenceMode: 'postgres' | 'memory';
  databaseReady: boolean;
  catalogReady: boolean;
  catalogCount: number;
  catalogVersion: 'v1.1';
}

export async function getCatalogReadiness(): Promise<DataHealthResponse> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const { materials: mats } = ensureMemoryGlobalCatalogLoaded();
    return {
      persistenceMode: 'memory',
      databaseReady: true,
      catalogReady: mats.length >= EXPECTED_CANONICAL_CATALOG_COUNT,
      catalogCount: mats.length,
      catalogVersion: 'v1.1',
    };
  }

  try {
    const activeDb = requirePostgresDb();
    const [row] = await activeDb
      .select({ value: count() })
      .from(materials)
      .where(eq(materials.scope, 'GLOBAL'));
    const catalogCount = Number(row?.value ?? 0);
    const catalogReady = catalogCount >= EXPECTED_CANONICAL_CATALOG_COUNT;
    pgGlobalCatalogSeeded = catalogReady;
    return {
      persistenceMode: 'postgres',
      databaseReady: true,
      catalogReady,
      catalogCount,
      catalogVersion: 'v1.1',
    };
  } catch {
    return {
      persistenceMode: 'postgres',
      databaseReady: false,
      catalogReady: false,
      catalogCount: 0,
      catalogVersion: 'v1.1',
    };
  }
}

export async function ensureCatalogReadyAtStartup(): Promise<DataHealthResponse> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    return getCatalogReadiness();
  }

  if (!isPostgresConfigured()) {
    return {
      persistenceMode: 'postgres',
      databaseReady: false,
      catalogReady: false,
      catalogCount: 0,
      catalogVersion: 'v1.1',
    };
  }

  const initial = await getCatalogReadiness();
  if (!initial.databaseReady) {
    return initial;
  }
  if (initial.catalogReady) {
    return initial;
  }

  if (isCatalogAutoBootstrapEnabled()) {
    await importGlobalCatalogV11();
    return await getCatalogReadiness();
  }

  return initial;
}

async function assertPostgresCatalogInitialized(
  activeDb: any
): Promise<number> {
  const [row] = await activeDb
    .select({ value: count() })
    .from(materials)
    .where(eq(materials.scope, 'GLOBAL'));
  const totalGlobal = Number(row?.value ?? 0);
  if (totalGlobal < EXPECTED_CANONICAL_CATALOG_COUNT) {
    throw new CatalogNotInitializedError(
      `Canonical v1.1 Global Catalog is not initialized in PostgreSQL (found ${totalGlobal} of ${EXPECTED_CANONICAL_CATALOG_COUNT} GLOBAL materials). Run catalog import or enable CATALOG_AUTO_BOOTSTRAP.`
    );
  }
  pgGlobalCatalogSeeded = true;
  return totalGlobal;
}

export interface CatalogImportSummary {
  mode: 'postgres' | 'memory';
  totalCatalogMaterials: number;
  insertedOrUpdatedMaterials: number;
  migratedLegacyUserMaterials: number;
  regulatoryRecordsUpserted: number;
  structuredRegulatoryRecordsUpserted?: number;
  constituentsUpserted: number;
}

/**
 * Idempotently imports all 815 v1.1 Global Catalog materials, olfactory profiles,
 * regulatory records, and constituents, and migrates any legacy per-user duplicate
 * seed materials to reference the shared GLOBAL catalog rows.
 */
export async function importGlobalCatalogV11(): Promise<CatalogImportSummary> {
  const mode = getPersistenceMode();
  const bundle = loadGlobalCatalogV11();

  if (mode === 'memory') {
    ensureMemoryGlobalCatalogLoaded();
    return {
      mode: 'memory',
      totalCatalogMaterials: bundle.materials.length,
      insertedOrUpdatedMaterials: bundle.materials.length,
      migratedLegacyUserMaterials: 0,
      regulatoryRecordsUpserted: bundle.regulatoryLimits.length,
      structuredRegulatoryRecordsUpserted: bundle.regulatoryRecords.length,
      constituentsUpserted: bundle.constituents.length,
    };
  }

  const activeDb = requirePostgresDb();
  return await activeDb.transaction(async (tx) => {
    return await upsertGlobalCatalogInTransaction(tx, bundle);
  });
}

async function upsertGlobalCatalogInTransaction(
  tx: any,
  bundle = loadGlobalCatalogV11()
): Promise<CatalogImportSummary> {
  const existingGlobalRows = await tx
    .select()
    .from(materials)
    .where(eq(materials.scope, 'GLOBAL'));

  const existingByCatalogKey = new Map<string, typeof materials.$inferSelect>();
  for (const row of existingGlobalRows) {
    if (row.catalogKey) {
      existingByCatalogKey.set(row.catalogKey, row);
    }
  }

  const catalogKeyToDbId = new Map<string, number>();
  const seedIdToDbId = new Map<number, number>();
  let upsertedCount = 0;

  for (const mat of bundle.materials) {
    const catalogKey = mat.catalogKey || `mat_seed_${mat.id}`;
    const existing = existingByCatalogKey.get(catalogKey);

    const materialValues = {
      catalogKey,
      scope: 'GLOBAL',
      ownerUid: null,
      userUid: null,
      displayName: mat.displayName || mat.name,
      name: mat.name,
      aliases: mat.aliases || '',
      casNumber: mat.casNumber || 'Unknown / Not Provided',
      inciName: mat.inciName || 'Unknown / Not Provided',
      naturalOrSynthetic: mat.naturalOrSynthetic,
      materialKind: mat.materialKind || 'SYNTHETIC',
      sourceSection: mat.sourceSection || '',
      catalogSource: mat.catalogSource || 'ScenTree',
      catalogSourceUrl: mat.catalogSourceUrl || '',
      sourceLicense: mat.sourceLicense || 'CC BY-NC 4.0',
      sourceLicenseUrl: mat.sourceLicenseUrl || '',
      starterPriority: mat.starterPriority || 'OPTIONAL',
      myShelfDefault: Boolean(mat.isOnShelf),
      shelfStatusDefault: mat.isOnShelf ? 'ON_SHELF' : 'NOT_ON_SHELF',
      supplier: mat.supplier || '',
      supplierProductCode: mat.supplierProductCode || '',
      manufacturer: mat.manufacturer || '',
      primaryFamily: mat.primaryFamily,
      facets: JSON.stringify(mat.facets || []),
      intensity: mat.intensity,
      substantivityHours: Math.round(mat.substantivityHours || 24),
      diffusion: mat.diffusion,
      volatility: mat.volatility,
      descriptiveNotes: mat.descriptiveNotes || '',
      texture: mat.texture || '',
      temperatureImpression: mat.temperatureImpression || 'Neutral',
      personalNotes: '',
      purity: mat.purity || '100%',
      density: mat.density || 0.95,
      recommendedDilution: mat.recommendedDilution || 100,
      storageInfo: mat.storageInfo || 'Cool, dark cabinet',
      shelfLifeMonths: mat.shelfLifeMonths || 24,
      flashPointCelsius: mat.flashPointCelsius ?? null,
      educationalObserve: JSON.stringify(mat.educationalObserve || []),
      complements: JSON.stringify(mat.complements || []),
      contrasts: JSON.stringify(mat.contrasts || []),
      isSeedData: true,
      isOnWorkbench: Boolean(mat.isOnWorkbench),
      costPerGram: mat.costPerGram ?? 0.35,
      updatedAt: new Date(),
    };

    let dbMatId: number;
    if (existing) {
      await tx
        .update(materials)
        .set(materialValues)
        .where(eq(materials.id, existing.id));
      dbMatId = existing.id;
    } else {
      const [inserted] = await tx
        .insert(materials)
        .values(materialValues)
        .returning();
      dbMatId = inserted.id;
    }
    catalogKeyToDbId.set(catalogKey, dbMatId);
    seedIdToDbId.set(mat.id, dbMatId);
    upsertedCount++;

    // Upsert olfactory profile row
    const profileValues = {
      materialId: dbMatId,
      primaryFamily: mat.primaryFamily,
      facets: JSON.stringify(mat.facets || []),
      odorSummary: mat.odorSummary || mat.descriptiveNotes || '',
      roleTopHeartBase: mat.roleTopHeartBase || mat.volatility,
      pyramidUsage: mat.pyramidUsage || 'UNSPECIFIED',
      pyramidPrimaryZone: mat.pyramidPrimaryZone || 'UNSPECIFIED',
      pyramidHighlightTop: Boolean(mat.pyramidHighlightTop),
      pyramidHighlightHeart: Boolean(mat.pyramidHighlightHeart),
      pyramidHighlightBase: Boolean(mat.pyramidHighlightBase),
      pyramidUiCode: mat.pyramidUiCode || 'NA',
      pyramidConfidence: mat.pyramidConfidence || 'UNKNOWN',
      pyramidBasis: mat.pyramidBasis || 'UNSPECIFIED',
      pyramidNote: mat.pyramidNote || '',
      olfactoryStrength: mat.olfactoryStrength || 'MEDIUM',
      intensity: mat.intensity,
      substantivityHours: Math.round(mat.substantivityHours || 24),
      diffusion: mat.diffusion,
      volatility: mat.volatility,
      descriptiveNotes: mat.descriptiveNotes || '',
      texture: mat.texture || '',
      temperatureImpression: mat.temperatureImpression || 'Neutral',
      educationalObserve: JSON.stringify(mat.educationalObserve || []),
      complements: JSON.stringify(mat.complements || []),
      contrasts: JSON.stringify(mat.contrasts || []),
    };

    const existingProfile = await tx
      .select()
      .from(materialOlfactoryProfiles)
      .where(eq(materialOlfactoryProfiles.materialId, dbMatId));

    if (existingProfile.length > 0) {
      await tx
        .update(materialOlfactoryProfiles)
        .set(profileValues)
        .where(eq(materialOlfactoryProfiles.materialId, dbMatId));
    } else {
      await tx.insert(materialOlfactoryProfiles).values(profileValues);
    }
  }

  // Upsert shared GLOBAL regulatory limits (userUid IS NULL)
  const existingGlobalLimits = await tx
    .select()
    .from(materialRegulatoryLimits)
    .where(isNull(materialRegulatoryLimits.userUid));
  const globalLimitByMatId = new Map<number, typeof materialRegulatoryLimits.$inferSelect>();
  for (const lim of existingGlobalLimits) {
    globalLimitByMatId.set(lim.materialId, lim);
  }

  for (const reg of bundle.regulatoryLimits) {
    const dbMatId = seedIdToDbId.get(reg.materialId);
    if (!dbMatId) continue;

    const seedMat = bundle.materials.find((m) => m.id === reg.materialId);
    const csvRow = seedMat?.catalogKey
      ? bundle.csvRowsByCatalogKey.get(seedMat.catalogKey)
      : undefined;

    const limitValues = {
      userUid: null,
      materialId: dbMatId,
      ifraCategory: reg.ifraCategory || 'Category 4 (Fine Fragrance)',
      maxAllowedPercent: reg.maxAllowedPercent ?? null,
      allergens: reg.allergens || 'Unknown / Not Provided',
      restrictions: reg.restrictions || '',
      sourceDocument: reg.sourceDocument || 'Unknown / Not Provided',
      documentVersion: reg.documentVersion || 'IFRA_51',
      effectiveDate: reg.effectiveDate || 'Unknown / Not Provided',
      ifraBaseline: csvRow?.ifra_baseline || 'IFRA_51',
      ifraStandardStatus:
        csvRow?.ifra_standard_status ||
        (reg.maxAllowedPercent !== null ? 'RESTRICTED' : 'LOOKUP_REQUIRED'),
      ifraStandardType:
        csvRow?.ifra_standard_type || reg.restrictionType || 'LOOKUP_REQUIRED',
      ifraAmendment: csvRow?.ifra_amendment || '',
      ifraCat4MaxPct: reg.maxAllowedPercent ?? null,
      ifraSummary: csvRow?.ifra_summary || reg.restrictions || '',
      euCosmeticsStatus: csvRow?.eu_cosmetics_status || 'LOOKUP_REQUIRED',
      euAnnex: csvRow?.eu_annex || '',
      euReferenceNo: csvRow?.eu_reference_no || '',
      euMaxReadyForUsePct: reg.euCosmeticLimitPercent ?? null,
      euLabelThresholdLeaveOnPct: reg.euLabelThresholdLeaveOnPct ?? null,
      euLabelThresholdRinseOffPct: reg.euLabelThresholdRinseOffPct ?? null,
      euSummary: csvRow?.eu_summary || '',
      regulatoryDataStatus:
        csvRow?.regulatory_data_status ||
        (reg.verificationStatus === 'PARTIALLY_VERIFIED'
          ? 'PARTIALLY_VERIFIED_OFFICIAL_SOURCES'
          : reg.verificationStatus === 'DEMO'
          ? 'DEMO'
          : 'UNVERIFIED_REQUIRES_LOOKUP'),
      regulatoryDisclaimer: csvRow?.regulatory_disclaimer || '',
      regulatorySources: csvRow?.regulatory_sources || '',
      lastVerifiedDate: csvRow?.last_verified_date || '',
      isDemoData: Boolean(reg.isDemoData),
    };

    const existingLim = globalLimitByMatId.get(dbMatId);
    if (existingLim) {
      await tx
        .update(materialRegulatoryLimits)
        .set(limitValues)
        .where(eq(materialRegulatoryLimits.id, existingLim.id));
    } else {
      await tx.insert(materialRegulatoryLimits).values(limitValues);
    }
  }

  // Replace shared GLOBAL material_regulatory_records (userUid IS NULL)
  await tx
    .delete(materialRegulatoryRecords)
    .where(isNull(materialRegulatoryRecords.userUid));

  let regRecordsUpserted = 0;
  for (const rec of bundle.regulatoryRecords) {
    const dbMatId = seedIdToDbId.get(rec.materialId);
    if (!dbMatId) continue;
    await tx.insert(materialRegulatoryRecords).values({
      userUid: null,
      materialId: dbMatId,
      jurisdiction: rec.jurisdiction,
      authority: rec.authority,
      ruleType: rec.ruleType,
      status: rec.status,
      standardOrAnnex: rec.standardOrAnnex,
      referenceNumber: rec.referenceNumber,
      productCategory: rec.productCategory,
      maxFinishedProductPct: rec.maxFinishedProductPct,
      maxReadyForUsePct: rec.maxReadyForUsePct,
      labelThresholdLeaveOnPct: rec.labelThresholdLeaveOnPct,
      labelThresholdRinseOffPct: rec.labelThresholdRinseOffPct,
      conditionText: rec.conditionText,
      summary: rec.summary,
      sourceUrl: rec.sourceUrl,
      sourceDocument: rec.sourceDocument,
      sourceVersion: rec.sourceVersion,
      verifiedAt: rec.verifiedAt,
      verificationStatus: rec.verificationStatus,
    });
    regRecordsUpserted++;
  }

  // Replace shared material_constituents
  await tx.delete(materialConstituents);
  let constituentsUpserted = 0;
  for (const c of bundle.constituents) {
    const dbMatId = seedIdToDbId.get(c.materialId);
    if (!dbMatId) continue;
    await tx.insert(materialConstituents).values({
      materialId: dbMatId,
      constituentName: c.constituentName,
      constituentCas: c.constituentCas,
      typicalPct: c.typicalPct,
      minPct: c.minPct,
      maxPct: c.maxPct,
      labelThresholdLeaveOnPct: c.labelThresholdLeaveOnPct ?? 0.001,
      labelThresholdRinseOffPct: c.labelThresholdRinseOffPct ?? 0.01,
      riskNote: c.riskNote || '',
      sourceUrl: c.sourceUrl,
      sourceDocument: c.sourceDocument,
      verificationStatus: c.verificationStatus,
    });
    constituentsUpserted++;
  }

  // Migrate any legacy per-user rows that were seeded before Global Catalog separation
  const allLegacyCandidates = await tx
    .select()
    .from(materials)
    .where(isNull(materials.catalogKey));

  let migratedCount = 0;
  for (const legacyRow of allLegacyCandidates) {
    const legacyUid = legacyRow.ownerUid || legacyRow.userUid;
    if (!legacyUid) continue;

    const matchedGlobal = findGlobalCatalogMaterial(
      { name: legacyRow.name },
      bundle.materials
    );

    if (matchedGlobal && matchedGlobal.catalogKey) {
      const targetGlobalDbId = catalogKeyToDbId.get(matchedGlobal.catalogKey);
      if (!targetGlobalDbId || targetGlobalDbId === legacyRow.id) continue;

      if (legacyRow.isOnWorkbench || (legacyRow.personalNotes && legacyRow.personalNotes.trim())) {
        const existingShelf = await tx
          .select()
          .from(userShelf)
          .where(
            and(
              eq(userShelf.userUid, legacyUid),
              eq(userShelf.materialId, targetGlobalDbId)
            )
          );
        if (existingShelf.length === 0) {
          await tx.insert(userShelf).values({
            userUid: legacyUid,
            materialId: targetGlobalDbId,
            supplierName: legacyRow.supplier || '',
            supplierProductName: legacyRow.supplierProductCode || '',
            workingDilutionPct: legacyRow.recommendedDilution ?? 100,
            personalNotes: legacyRow.personalNotes || '',
            isOnWorkbench: Boolean(legacyRow.isOnWorkbench),
            pyramidOverrideCode: null,
            favorite: false,
          });
        }
      }

      await tx
        .update(scentMemories)
        .set({ materialId: targetGlobalDbId })
        .where(
          and(
            eq(scentMemories.userUid, legacyUid),
            eq(scentMemories.materialId, legacyRow.id)
          )
        );
      await tx
        .update(materialUsageReviews)
        .set({ materialId: targetGlobalDbId })
        .where(
          and(
            eq(materialUsageReviews.userUid, legacyUid),
            eq(materialUsageReviews.materialId, legacyRow.id)
          )
        );

      const userAccords = await tx
        .select()
        .from(accords)
        .where(eq(accords.userUid, legacyUid));
      for (const acc of userAccords) {
        const items = safeParseObject<AccordItem[]>(acc.itemsJson, []);
        let changed = false;
        const nextItems = items.map((it) => {
          if (it.materialId === legacyRow.id) {
            changed = true;
            return { ...it, materialId: targetGlobalDbId };
          }
          return it;
        });
        if (changed) {
          await tx
            .update(accords)
            .set({ itemsJson: JSON.stringify(nextItems) })
            .where(eq(accords.id, acc.id));
        }
      }

      const userFormulas = await tx
        .select()
        .from(formulas)
        .where(eq(formulas.userUid, legacyUid));
      for (const f of userFormulas) {
        const fVers = await tx
          .select()
          .from(formulaVersions)
          .where(eq(formulaVersions.formulaId, f.id));
        for (const v of fVers) {
          const items = safeParseObject<FormulaLineItem[]>(v.itemsJson, []);
          let changed = false;
          const nextItems = items.map((it) => {
            if (it.materialId === legacyRow.id) {
              changed = true;
              return { ...it, materialId: targetGlobalDbId };
            }
            return it;
          });
          if (changed) {
            await tx
              .update(formulaVersions)
              .set({ itemsJson: JSON.stringify(nextItems) })
              .where(eq(formulaVersions.id, v.id));
          }
        }
      }

      await tx.delete(materials).where(eq(materials.id, legacyRow.id));
      migratedCount++;
    } else {
      await tx
        .update(materials)
        .set({
          scope: 'USER',
          ownerUid: legacyUid,
          displayName: legacyRow.displayName || legacyRow.name,
        })
        .where(eq(materials.id, legacyRow.id));
    }
  }

  pgGlobalCatalogSeeded = true;
  return {
    mode: 'postgres',
    totalCatalogMaterials: bundle.materials.length,
    insertedOrUpdatedMaterials: upsertedCount,
    migratedLegacyUserMaterials: migratedCount,
    regulatoryRecordsUpserted: bundle.regulatoryLimits.length,
    structuredRegulatoryRecordsUpserted: regRecordsUpserted,
    constituentsUpserted,
  };
}

// ============================================================================
// POSTGRES WORKSPACE INITIALIZATION & QUERIES
// ============================================================================

async function ensurePostgresUserRow(
  uid: string,
  email = 'perfumer@atelier.local'
): Promise<WorkspacePayload['user']> {
  const activeDb = requirePostgresDb();
  const existing = await activeDb
    .select()
    .from(users)
    .where(eq(users.uid, uid));

  if (existing.length > 0) {
    const u = existing[0];
    return {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || 'Perfumer',
      theme: u.theme || 'dark',
      educationalPrompts: u.educationalPrompts ?? true,
      safetyEnabled: u.safetyEnabled ?? true,
    };
  }

  const [inserted] = await activeDb
    .insert(users)
    .values({
      uid,
      email,
      displayName: email.split('@')[0] || 'Perfumer',
      theme: 'dark',
      educationalPrompts: true,
      safetyEnabled: true,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    return {
      uid: inserted.uid,
      email: inserted.email,
      displayName: inserted.displayName || 'Perfumer',
      theme: inserted.theme || 'dark',
      educationalPrompts: inserted.educationalPrompts ?? true,
      safetyEnabled: inserted.safetyEnabled ?? true,
    };
  }

  const [reloaded] = await activeDb
    .select()
    .from(users)
    .where(eq(users.uid, uid));
  return {
    uid: reloaded?.uid || uid,
    email: reloaded?.email || email,
    displayName: reloaded?.displayName || 'Perfumer',
    theme: reloaded?.theme || 'dark',
    educationalPrompts: reloaded?.educationalPrompts ?? true,
    safetyEnabled: reloaded?.safetyEnabled ?? true,
  };
}

/**
 * Explicit opt-in action ("Load Starter Organ") using canonical starter-set data
 * through the server/domain layer without silently seeding on user creation.
 */
export async function loadStarterOrganForUser(
  uid: string
): Promise<{ addedCount: number; shelf: UserShelfItem[] }> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    let addedCount = 0;
    for (const seedId of DEFAULT_STARTER_SHELF_IDS) {
      if (!store.shelfByMaterialId.has(seedId)) {
        await addToUserShelf(uid, seedId, { isOnWorkbench: true });
        addedCount++;
      }
    }
    return {
      addedCount,
      shelf: Array.from(store.shelfByMaterialId.values()),
    };
  }

  const activeDb = requirePostgresDb();
  await assertPostgresCatalogInitialized(activeDb);

  const starterKeys = DEFAULT_STARTER_SHELF_IDS.map(
    (seedId) => SEED_ID_TO_CATALOG_KEY[seedId]
  ).filter(Boolean);

  const globalStarterRows = await activeDb
    .select()
    .from(materials)
    .where(
      and(
        eq(materials.scope, 'GLOBAL'),
        inArray(materials.catalogKey, starterKeys)
      )
    );

  let addedCount = 0;
  for (const matRow of globalStarterRows) {
    const existing = await activeDb
      .select()
      .from(userShelf)
      .where(
        and(eq(userShelf.userUid, uid), eq(userShelf.materialId, matRow.id))
      );
    if (existing.length === 0) {
      await activeDb.insert(userShelf).values({
        userUid: uid,
        materialId: matRow.id,
        supplierName: matRow.supplier || '',
        supplierProductName: matRow.supplierProductCode || '',
        workingDilutionPct: matRow.recommendedDilution ?? 100,
        personalNotes: '',
        isOnWorkbench: true,
        pyramidOverrideCode: null,
        favorite: false,
      });
      addedCount++;
    } else if (!existing[0].isOnWorkbench) {
      await activeDb
        .update(userShelf)
        .set({ isOnWorkbench: true, updatedAt: new Date() })
        .where(eq(userShelf.id, existing[0].id));
    }
  }

  const shelf = await getUserShelf(uid);
  return { addedCount, shelf };
}

async function getOrInitializeWorkspaceInDb(
  uid: string,
  email: string
): Promise<WorkspacePayload> {
  const activeDb = requirePostgresDb();
  await assertPostgresCatalogInitialized(activeDb);
  await ensurePostgresUserRow(uid, email);

  // Query full workspace state for `uid`
  const [userRecord] = await activeDb.select().from(users).where(eq(users.uid, uid));
  const rawMats = await activeDb
    .select()
    .from(materials)
    .where(
      or(
        eq(materials.scope, 'GLOBAL'),
        and(eq(materials.scope, 'USER'), eq(materials.ownerUid, uid))
      )
    )
    .orderBy(materials.id);

  const rawProfiles = await activeDb.select().from(materialOlfactoryProfiles);
  const profileByMatId = new Map<number, typeof materialOlfactoryProfiles.$inferSelect>();
  for (const p of rawProfiles) {
    profileByMatId.set(p.materialId, p);
  }

  const rawShelfRows = await activeDb
    .select()
    .from(userShelf)
    .where(eq(userShelf.userUid, uid));

  const shelfByMatId = new Map<number, UserShelfItem>();
  const shelfList: UserShelfItem[] = rawShelfRows.map((s) => {
    const matRow = rawMats.find((m) => m.id === s.materialId);
    const item: UserShelfItem = {
      id: s.id,
      userUid: s.userUid,
      materialId: s.materialId,
      catalogKey: matRow?.catalogKey || undefined,
      supplierName: s.supplierName || '',
      supplierProductName: s.supplierProductName || '',
      workingDilutionPct: s.workingDilutionPct ?? null,
      personalNotes: s.personalNotes || '',
      isOnWorkbench: Boolean(s.isOnWorkbench),
      pyramidOverrideCode: (s.pyramidOverrideCode as PyramidUiCode | null) ?? null,
      favorite: Boolean(s.favorite),
      addedAt: s.addedAt ? s.addedAt.toISOString() : new Date().toISOString(),
      updatedAt: s.updatedAt ? s.updatedAt.toISOString() : new Date().toISOString(),
    };
    shelfByMatId.set(s.materialId, item);
    return item;
  });

  const rawLimits = await activeDb
    .select()
    .from(materialRegulatoryLimits)
    .where(
      or(
        isNull(materialRegulatoryLimits.userUid),
        eq(materialRegulatoryLimits.userUid, uid)
      )
    );

  const rawRegRecords = await activeDb
    .select()
    .from(materialRegulatoryRecords)
    .where(
      or(
        isNull(materialRegulatoryRecords.userUid),
        eq(materialRegulatoryRecords.userUid, uid)
      )
    );

  const rawConstituents = await activeDb.select().from(materialConstituents);

  const rawMemories = await activeDb
    .select()
    .from(scentMemories)
    .where(eq(scentMemories.userUid, uid));
  const rawAccords = await activeDb
    .select()
    .from(accords)
    .where(eq(accords.userUid, uid));
  const rawAccordVersions = await activeDb
    .select()
    .from(accordVersions)
    .where(eq(accordVersions.userUid, uid));
  const rawAccordVersionItems = await activeDb.select().from(accordVersionItems);

  const rawFormulas = await activeDb
    .select()
    .from(formulas)
    .where(eq(formulas.userUid, uid));
  const rawVersions = await activeDb
    .select()
    .from(formulaVersions)
    .where(eq(formulaVersions.userUid, uid));
  const rawFormulaVersionItems = await activeDb.select().from(formulaVersionItems);

  const rawExperiments = await activeDb
    .select()
    .from(experiments)
    .where(eq(experiments.userUid, uid))
    .orderBy(desc(experiments.id));
  const rawEvaluations = await activeDb
    .select()
    .from(evaluations)
    .where(eq(evaluations.userUid, uid))
    .orderBy(desc(evaluations.id));
  const rawReviews = await activeDb
    .select()
    .from(materialUsageReviews)
    .where(eq(materialUsageReviews.userUid, uid));

  const mappedMaterials: RawMaterial[] = rawMats.map((m) => {
    const prof = profileByMatId.get(m.id);
    const shelfItem = shelfByMatId.get(m.id);
    const isOnShelf = Boolean(shelfItem);
    const isOnWorkbench = Boolean(shelfItem && shelfItem.isOnWorkbench);

    return {
      id: m.id,
      catalogKey: m.catalogKey || undefined,
      scope: (m.scope as 'GLOBAL' | 'USER') || 'GLOBAL',
      ownerUid: m.ownerUid ?? null,
      displayName: m.displayName || m.name,
      name: m.name,
      aliases: m.aliases || '',
      casNumber: m.casNumber || 'Unknown / Not Provided',
      inciName: m.inciName || 'Unknown / Not Provided',
      naturalOrSynthetic:
        (m.naturalOrSynthetic as 'Natural' | 'Synthetic' | 'Base') || 'Synthetic',
      materialKind: m.materialKind || 'SYNTHETIC',
      supplier: shelfItem?.supplierName || m.supplier || '',
      supplierProductCode: m.supplierProductCode || '',
      supplierProductName: shelfItem?.supplierProductName || '',
      manufacturer: m.manufacturer || '',
      primaryFamily: prof?.primaryFamily || m.primaryFamily,
      facets: safeParseArray(prof?.facets || m.facets),
      odorSummary: prof?.odorSummary || m.descriptiveNotes || '',
      roleTopHeartBase: prof?.roleTopHeartBase || m.volatility,
      pyramidUsage: prof?.pyramidUsage || 'UNSPECIFIED',
      pyramidPrimaryZone:
        (prof?.pyramidPrimaryZone as PyramidPrimaryZone) || 'UNSPECIFIED',
      pyramidHighlightTop: Boolean(prof?.pyramidHighlightTop),
      pyramidHighlightHeart: Boolean(prof?.pyramidHighlightHeart),
      pyramidHighlightBase: Boolean(prof?.pyramidHighlightBase),
      pyramidUiCode: (prof?.pyramidUiCode as PyramidUiCode) || 'NA',
      pyramidConfidence: (prof?.pyramidConfidence as PyramidConfidence) || 'UNKNOWN',
      pyramidBasis: prof?.pyramidBasis || 'UNSPECIFIED',
      pyramidNote: prof?.pyramidNote || '',
      olfactoryStrength: prof?.olfactoryStrength || 'MEDIUM',
      intensity: prof?.intensity ?? m.intensity ?? 7,
      substantivityHours: prof?.substantivityHours ?? m.substantivityHours ?? 24,
      diffusion: prof?.diffusion ?? m.diffusion ?? 7,
      volatility: (prof?.volatility || m.volatility) as VolatilityTier,
      descriptiveNotes: prof?.descriptiveNotes || m.descriptiveNotes || '',
      texture: prof?.texture || m.texture || '',
      temperatureImpression:
        prof?.temperatureImpression || m.temperatureImpression || 'Neutral',
      personalNotes: shelfItem
        ? shelfItem.personalNotes
        : m.scope === 'USER'
        ? m.personalNotes || ''
        : '',
      purity: m.purity || 'Unknown / Not Provided',
      density: m.density ?? 1.0,
      recommendedDilution: m.recommendedDilution ?? 100,
      workingDilutionPct: shelfItem?.workingDilutionPct ?? null,
      storageInfo: m.storageInfo || '',
      shelfLifeMonths: m.shelfLifeMonths ?? 24,
      flashPointCelsius: m.flashPointCelsius ?? null,
      educationalObserve: safeParseArray(
        prof?.educationalObserve || m.educationalObserve
      ),
      complements: safeParseArray(prof?.complements || m.complements),
      contrasts: safeParseArray(prof?.contrasts || m.contrasts),
      isSeedData: m.isSeedData ?? false,
      isOnShelf,
      isOnWorkbench,
      pyramidOverrideCode: shelfItem?.pyramidOverrideCode ?? null,
      favorite: Boolean(shelfItem?.favorite),
      costPerGram: m.costPerGram ?? 0.35,
      sourceSection: m.sourceSection || '',
      catalogSource: m.catalogSource || '',
      catalogSourceUrl: m.catalogSourceUrl || '',
      sourceLicense: m.sourceLicense || '',
      sourceLicenseUrl: m.sourceLicenseUrl || '',
      starterPriority: m.starterPriority || 'OPTIONAL',
    };
  });

  const mappedRecords: MaterialRegulatoryRecord[] = rawRegRecords.map((rec) => ({
    id: rec.id,
    materialId: rec.materialId,
    userUid: rec.userUid,
    jurisdiction: rec.jurisdiction,
    authority: rec.authority as RegulatoryAuthority,
    ruleType: rec.ruleType as RegulatoryRuleType,
    status: rec.status,
    standardOrAnnex: rec.standardOrAnnex,
    referenceNumber: rec.referenceNumber,
    productCategory: rec.productCategory ?? null,
    maxFinishedProductPct: rec.maxFinishedProductPct ?? null,
    maxReadyForUsePct: rec.maxReadyForUsePct ?? null,
    labelThresholdLeaveOnPct: rec.labelThresholdLeaveOnPct ?? null,
    labelThresholdRinseOffPct: rec.labelThresholdRinseOffPct ?? null,
    conditionText: rec.conditionText || '',
    summary: rec.summary || '',
    sourceUrl: rec.sourceUrl || '',
    sourceDocument: rec.sourceDocument || '',
    sourceVersion: rec.sourceVersion || '',
    verifiedAt: rec.verifiedAt ?? null,
    verificationStatus: rec.verificationStatus as RegulatoryVerificationStatus,
  }));

  const mappedConstituents: MaterialConstituent[] = rawConstituents.map((c) => ({
    id: c.id,
    materialId: c.materialId,
    constituentName: c.constituentName,
    constituentCas: c.constituentCas || '',
    typicalPct: c.typicalPct ?? null,
    minPct: c.minPct ?? null,
    maxPct: c.maxPct ?? null,
    labelThresholdLeaveOnPct: c.labelThresholdLeaveOnPct ?? 0.001,
    labelThresholdRinseOffPct: c.labelThresholdRinseOffPct ?? 0.01,
    riskNote: c.riskNote || '',
    sourceUrl: c.sourceUrl || '',
    sourceDocument: c.sourceDocument || '',
    verificationStatus: c.verificationStatus as RegulatoryVerificationStatus,
  }));

  const recordsByMatId = new Map<number, MaterialRegulatoryRecord[]>();
  for (const rec of mappedRecords) {
    const arr = recordsByMatId.get(rec.materialId) || [];
    arr.push(rec);
    recordsByMatId.set(rec.materialId, arr);
  }

  const constituentsByMatId = new Map<number, MaterialConstituent[]>();
  for (const c of mappedConstituents) {
    const arr = constituentsByMatId.get(c.materialId) || [];
    arr.push(c);
    constituentsByMatId.set(c.materialId, arr);
  }

  const limitByMatId = new Map<number, MaterialRegulatoryLimit>();
  for (const r of rawLimits) {
    const existing = limitByMatId.get(r.materialId);
    if (existing && !r.userUid) continue;
    const matRecs = recordsByMatId.get(r.materialId) || [];
    const matConsts = constituentsByMatId.get(r.materialId) || [];
    const verStatus: RegulatoryVerificationStatus =
      r.regulatoryDataStatus === 'PARTIALLY_VERIFIED_OFFICIAL_SOURCES'
        ? 'PARTIALLY_VERIFIED'
        : r.userUid
        ? 'USER_ENTERED_UNVERIFIED'
        : r.isDemoData
        ? 'DEMO'
        : 'LOOKUP_REQUIRED';

    limitByMatId.set(r.materialId, {
      id: r.id,
      materialId: r.materialId,
      ifraCategory: r.ifraCategory,
      maxAllowedPercent: r.maxAllowedPercent ?? null,
      allergens: r.allergens || 'Unknown / Not Provided',
      restrictions: r.restrictions || '',
      sourceDocument: r.sourceDocument || 'Unknown / Not Provided',
      documentVersion: r.documentVersion || 'Unknown / Not Provided',
      effectiveDate: r.effectiveDate || 'Unknown / Not Provided',
      isDemoData: r.isDemoData ?? true,
      verificationStatus: verStatus,
      ifraStandardStatus: r.ifraStandardStatus || undefined,
      ifraStandardType: r.ifraStandardType || undefined,
      euCosmeticsStatus: r.euCosmeticsStatus || undefined,
      euAnnex: r.euAnnex || undefined,
      euReferenceNo: r.euReferenceNo || undefined,
      euLabelThresholdLeaveOnPct: r.euLabelThresholdLeaveOnPct ?? null,
      euLabelThresholdRinseOffPct: r.euLabelThresholdRinseOffPct ?? null,
      regulatorySources: r.regulatorySources || undefined,
      lastVerifiedDate: r.lastVerifiedDate || undefined,
      euCosmeticLimitPercent: r.euMaxReadyForUsePct ?? null,
      euAllergenDeclarable: r.euLabelThresholdLeaveOnPct !== null,
      regulatoryRecords: matRecs,
      constituents: matConsts,
    });
  }

  const mappedAccords: AccordDefinition[] = rawAccords.map((acc) => {
    const accVers = rawAccordVersions
      .filter((v) => v.accordId === acc.id)
      .sort((a, b) => a.id - b.id);

    const versionSnapshots: AccordVersionSnapshot[] = accVers.map((v) => {
      const vItems = rawAccordVersionItems
        .filter((it) => it.accordVersionId === v.id)
        .sort((a, b) => a.lineOrder - b.lineOrder)
        .map((it) => ({
          id: it.id,
          lineOrder: it.lineOrder,
          materialId: it.materialId,
          materialName: it.materialName,
          percentage: it.percentage,
          dilutionPercent: it.dilutionPct ?? 100,
          notes: it.notes || '',
        }));
      return {
        id: v.id,
        accordId: acc.id,
        versionId: `acc-${acc.id}-v${v.id}`,
        versionLabel: v.versionLabel,
        status: (v.status as 'Draft' | 'Committed') || 'Committed',
        createdAt: v.createdAt
          ? v.createdAt.toISOString().slice(0, 16).replace('T', ' ')
          : '2026-10-01 10:00',
        versionNotes: v.versionNotes || '',
        items: vItems.length > 0 ? vItems : safeParseObject(acc.itemsJson, []),
      };
    });

    const activeVerSnap =
      versionSnapshots.find((v) => v.versionLabel === acc.activeVersionLabel) ||
      versionSnapshots[versionSnapshots.length - 1];

    return {
      id: acc.id,
      name: acc.name,
      category: acc.category,
      description: acc.description || '',
      objective: acc.objective || '',
      usageSuggestions: acc.usageSuggestions || '',
      notes: acc.notes || '',
      isEducational: acc.isEducational ?? false,
      activeVersionId: activeVerSnap?.id,
      activeVersionLabel: acc.activeVersionLabel || activeVerSnap?.versionLabel || 'V1',
      items: activeVerSnap ? activeVerSnap.items : safeParseObject(acc.itemsJson, []),
      olfactoryProfile: safeParseObject(acc.olfactoryProfileJson, {}),
      versions: versionSnapshots,
    };
  });

  return {
    user: {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || 'Perfumer',
      theme: userRecord.theme || 'dark',
      educationalPrompts: userRecord.educationalPrompts ?? true,
      safetyEnabled: userRecord.safetyEnabled ?? true,
    },
    materials: mappedMaterials,
    shelf: shelfList,
    userShelf: shelfList,
    regulatoryLimits: Array.from(limitByMatId.values()),
    regulatoryRecords: mappedRecords,
    constituents: mappedConstituents,
    scentMemories: rawMemories.map((mem) => ({
      id: mem.id,
      materialId: mem.materialId,
      myPerception: safeParseArray(mem.myPerception),
      associatedMemories: safeParseArray(mem.associatedMemories),
      emotions: safeParseArray(mem.emotions),
      mentalImages: mem.mentalImages || '',
      places: mem.places || '',
      colors: mem.colors || '#2E6F40',
      textures: mem.textures || '',
      temperature: mem.temperature || 'Neutral',
      strengthScore: mem.strengthScore ?? 7,
      familiarityScore: mem.familiarityScore ?? 7,
      blindConfidenceScore: mem.blindConfidenceScore ?? 7,
      recognitionTrials: mem.recognitionTrials ?? 1,
      recognitionCorrect: mem.recognitionCorrect ?? 1,
      lastReviewedAt: mem.lastReviewedAt
        ? mem.lastReviewedAt.toISOString().slice(0, 10)
        : '2026-10-20',
    })),
    accords: mappedAccords,
    formulas: rawFormulas.map((f) => {
      const fVers = rawVersions
        .filter((v) => v.formulaId === f.id)
        .sort((a, b) => a.id - b.id);
      return {
        id: f.id,
        projectId: f.projectId || 1,
        projectName: f.projectName || 'Personal Study',
        name: f.name,
        status: (f.status as FormulaStatus) || 'Draft',
        description: f.description || '',
        intendedProduct: f.intendedProduct || 'Eau de Parfum (20% conc.)',
        ifraCategory: f.ifraCategory || 'Category 4 (Fine Fragrance)',
        finalProductConcentration: f.finalProductConcentration ?? 20,
        targetBrief: f.targetBrief || '',
        targetFamilies: safeParseArray(f.targetFamilies),
        targetFacets: safeParseObject(f.targetFacetsJson, {}),
        targetIntensity: f.targetIntensity ?? 7,
        targetTexture: f.targetTexture || '',
        targetAtmosphere: f.targetAtmosphere || '',
        targetTemperature: f.targetTemperature || 'Neutral',
        targetColor: f.targetColor || '#2E6F40',
        targetMood: f.targetMood || '',
        targetDiffusion: f.targetDiffusion ?? 7,
        targetEvolution: f.targetEvolution || '',
        targetDrydown: f.targetDrydown || '',
        materialsToAvoid: safeParseArray(f.materialsToAvoid),
        isFavorite: f.isFavorite ?? false,
        tags: safeParseArray(f.tags),
        activeVersionLabel: f.activeVersionLabel || 'V1',
        createdAt: f.createdAt ? f.createdAt.toISOString().slice(0, 10) : '2026-10-10',
        updatedAt: f.updatedAt ? f.updatedAt.toISOString().slice(0, 10) : '2026-10-22',
        versions: fVers.map((v): FormulaVersion => {
          const dbNormRows = rawFormulaVersionItems
            .filter((it) => it.formulaVersionId === v.id)
            .sort((a, b) => a.lineOrder - b.lineOrder);

          if (dbNormRows.length > 0) {
            const normalizedItems: NormalizedFormulaVersionItem[] = dbNormRows.map(
              (r) => ({
                id: r.id,
                formulaVersionId: r.formulaVersionId,
                lineOrder: r.lineOrder,
                itemType: (r.itemType as 'MATERIAL' | 'ACCORD') || 'MATERIAL',
                materialId: r.materialId ?? null,
                accordId: r.accordId ?? null,
                accordVersionId: r.accordVersionId ?? null,
                name: r.name,
                percentage: r.percentage,
                quantityGrams: r.quantityGrams,
                dilutionPct: r.dilutionPct,
                solvent: r.solvent,
                activeMaterialPct: r.activeMaterialPct,
                supplier: r.supplier,
                costPerGram: r.costPerGram,
                notes: r.notes,
                createdAt: r.createdAt
                  ? r.createdAt.toISOString()
                  : new Date().toISOString(),
              })
            );

            const items: FormulaLineItem[] = normalizedItems.map((n) => ({
              id: `line-${n.id}`,
              lineOrder: n.lineOrder,
              type: n.itemType === 'ACCORD' ? 'accord' : 'material',
              itemType: n.itemType,
              materialId: n.materialId ?? undefined,
              accordId: n.accordId ?? undefined,
              accordVersionId: n.accordVersionId,
              name: n.name,
              percentage: n.percentage,
              quantityGrams: n.quantityGrams,
              dilutionPercent: n.dilutionPct,
              solvent: n.solvent,
              activeMaterialPercent: n.activeMaterialPct,
              supplier: n.supplier,
              costPerGram: n.costPerGram,
              notes: n.notes,
            }));

            return {
              id: v.id,
              formulaId: v.formulaId,
              parentVersionId: v.parentVersionId ?? null,
              versionLabel: v.versionLabel,
              status: (v.status as 'Draft' | 'Committed') || 'Committed',
              versionNotes: v.versionNotes || '',
              maturationDays: v.maturationDays ?? 14,
              items,
              normalizedItems,
              createdAt: v.createdAt
                ? v.createdAt.toISOString().slice(0, 10)
                : '2026-10-15',
            };
          }

          return {
            id: v.id,
            formulaId: v.formulaId,
            parentVersionId: v.parentVersionId ?? null,
            versionLabel: v.versionLabel,
            status: (v.status as 'Draft' | 'Committed') || 'Committed',
            versionNotes: v.versionNotes || '',
            maturationDays: v.maturationDays ?? 14,
            items: safeParseObject(v.itemsJson, []),
            createdAt: v.createdAt
              ? v.createdAt.toISOString().slice(0, 10)
              : '2026-10-15',
          };
        }),
      };
    }),
    experiments: rawExperiments.map((exp) => ({
      id: exp.id,
      formulaId: exp.formulaId,
      formulaVersionId: exp.formulaVersionId ?? null,
      formulaVersionLabel: exp.formulaVersionLabel,
      stageLabel: exp.stageLabel,
      observation: exp.observation,
      recordedAt: exp.recordedAt,
    })),
    evaluations: rawEvaluations.map((ev) => ({
      id: ev.id,
      formulaId: ev.formulaId,
      formulaVersionId: ev.formulaVersionId ?? null,
      formulaVersionLabel: ev.formulaVersionLabel,
      checkpoint: ev.checkpoint,
      overallScore: ev.overallScore ?? 8,
      scores: safeParseObject(ev.scoresJson, {}),
      evaluatedFacets: safeParseObject(ev.evaluatedFacetsJson, {}),
      openingNotes: ev.openingNotes || '',
      heartNotes: ev.heartNotes || '',
      drydownNotes: ev.drydownNotes || '',
      voiceTranscript: ev.voiceTranscript || '',
      voiceDurationSeconds: ev.voiceDurationSeconds ?? 0,
      createdAt: ev.createdAt
        ? ev.createdAt.toISOString().slice(0, 16).replace('T', ' ')
        : '2026-10-20 10:00',
    })),
    usageReviews: rawReviews.map((rev) => ({
      id: rev.id,
      materialId: rev.materialId,
      formulaId: rev.formulaId,
      formulaVersionId: rev.formulaVersionId ?? null,
      formulaName: rev.formulaName,
      versionLabel: rev.versionLabel,
      percentageUsed: rev.percentageUsed,
      effectivenessScore: rev.effectivenessScore ?? 8,
      observation: rev.observation || '',
      createdAt: rev.createdAt
        ? rev.createdAt.toISOString().slice(0, 10)
        : '2026-10-20',
    })),
  };
}

export async function getGlobalCatalogSnapshot(): Promise<{
  totalCatalogMaterials: number;
  materials: RawMaterial[];
  regulatoryLimits: MaterialRegulatoryLimit[];
  regulatoryRecords: MaterialRegulatoryRecord[];
  constituents: MaterialConstituent[];
}> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const {
      materials: mats,
      regulatoryLimits: regs,
      regulatoryRecords: recs,
      constituents: consts,
    } = ensureMemoryGlobalCatalogLoaded();
    return {
      totalCatalogMaterials: mats.length,
      materials: mats,
      regulatoryLimits: regs,
      regulatoryRecords: recs,
      constituents: consts,
    };
  }

  const activeDb = requirePostgresDb();
  await assertPostgresCatalogInitialized(activeDb);

  const rawMats = await activeDb
    .select()
    .from(materials)
    .where(eq(materials.scope, 'GLOBAL'))
    .orderBy(materials.id);

  const rawProfiles = await activeDb.select().from(materialOlfactoryProfiles);
  const profileByMatId = new Map<number, typeof materialOlfactoryProfiles.$inferSelect>();
  for (const p of rawProfiles) {
    profileByMatId.set(p.materialId, p);
  }

  const rawLimits = await activeDb
    .select()
    .from(materialRegulatoryLimits)
    .where(isNull(materialRegulatoryLimits.userUid));
  const rawRecords = await activeDb
    .select()
    .from(materialRegulatoryRecords)
    .where(isNull(materialRegulatoryRecords.userUid));
  const rawConsts = await activeDb.select().from(materialConstituents);

  const mappedMaterials: RawMaterial[] = rawMats.map((m) => {
    const prof = profileByMatId.get(m.id);
    return {
      id: m.id,
      catalogKey: m.catalogKey || undefined,
      scope: 'GLOBAL',
      ownerUid: null,
      displayName: m.displayName || m.name,
      name: m.name,
      aliases: m.aliases || '',
      casNumber: m.casNumber || 'Unknown / Not Provided',
      inciName: m.inciName || 'Unknown / Not Provided',
      naturalOrSynthetic:
        (m.naturalOrSynthetic as 'Natural' | 'Synthetic' | 'Base') || 'Synthetic',
      materialKind: m.materialKind || 'SYNTHETIC',
      supplier: m.supplier || '',
      supplierProductCode: m.supplierProductCode || '',
      supplierProductName: '',
      manufacturer: m.manufacturer || '',
      primaryFamily: prof?.primaryFamily || m.primaryFamily,
      facets: safeParseArray(prof?.facets || m.facets),
      odorSummary: prof?.odorSummary || m.descriptiveNotes || '',
      roleTopHeartBase: prof?.roleTopHeartBase || m.volatility,
      pyramidUsage: prof?.pyramidUsage || 'UNSPECIFIED',
      pyramidPrimaryZone:
        (prof?.pyramidPrimaryZone as PyramidPrimaryZone) || 'UNSPECIFIED',
      pyramidHighlightTop: Boolean(prof?.pyramidHighlightTop),
      pyramidHighlightHeart: Boolean(prof?.pyramidHighlightHeart),
      pyramidHighlightBase: Boolean(prof?.pyramidHighlightBase),
      pyramidUiCode: (prof?.pyramidUiCode as PyramidUiCode) || 'NA',
      pyramidConfidence: (prof?.pyramidConfidence as PyramidConfidence) || 'UNKNOWN',
      pyramidBasis: prof?.pyramidBasis || 'UNSPECIFIED',
      pyramidNote: prof?.pyramidNote || '',
      olfactoryStrength: prof?.olfactoryStrength || 'MEDIUM',
      intensity: prof?.intensity ?? m.intensity ?? 7,
      substantivityHours: prof?.substantivityHours ?? m.substantivityHours ?? 24,
      diffusion: prof?.diffusion ?? m.diffusion ?? 7,
      volatility: (prof?.volatility || m.volatility) as VolatilityTier,
      descriptiveNotes: prof?.descriptiveNotes || m.descriptiveNotes || '',
      texture: prof?.texture || m.texture || '',
      temperatureImpression:
        prof?.temperatureImpression || m.temperatureImpression || 'Neutral',
      personalNotes: '',
      purity: m.purity || 'Unknown / Not Provided',
      density: m.density ?? 1.0,
      recommendedDilution: m.recommendedDilution ?? 100,
      workingDilutionPct: null,
      storageInfo: m.storageInfo || '',
      shelfLifeMonths: m.shelfLifeMonths ?? 24,
      flashPointCelsius: m.flashPointCelsius ?? null,
      educationalObserve: safeParseArray(
        prof?.educationalObserve || m.educationalObserve
      ),
      complements: safeParseArray(prof?.complements || m.complements),
      contrasts: safeParseArray(prof?.contrasts || m.contrasts),
      isSeedData: m.isSeedData ?? false,
      isOnShelf: false,
      isOnWorkbench: false,
      costPerGram: m.costPerGram ?? 0.35,
      sourceSection: m.sourceSection || '',
      catalogSource: m.catalogSource || '',
      catalogSourceUrl: m.catalogSourceUrl || '',
      sourceLicense: m.sourceLicense || '',
      sourceLicenseUrl: m.sourceLicenseUrl || '',
      starterPriority: m.starterPriority || 'OPTIONAL',
    };
  });

  const mappedRecords: MaterialRegulatoryRecord[] = rawRecords.map((rec) => ({
    id: rec.id,
    materialId: rec.materialId,
    userUid: rec.userUid,
    jurisdiction: rec.jurisdiction,
    authority: rec.authority as RegulatoryAuthority,
    ruleType: rec.ruleType as RegulatoryRuleType,
    status: rec.status,
    standardOrAnnex: rec.standardOrAnnex,
    referenceNumber: rec.referenceNumber,
    productCategory: rec.productCategory ?? null,
    maxFinishedProductPct: rec.maxFinishedProductPct ?? null,
    maxReadyForUsePct: rec.maxReadyForUsePct ?? null,
    labelThresholdLeaveOnPct: rec.labelThresholdLeaveOnPct ?? null,
    labelThresholdRinseOffPct: rec.labelThresholdRinseOffPct ?? null,
    conditionText: rec.conditionText || '',
    summary: rec.summary || '',
    sourceUrl: rec.sourceUrl || '',
    sourceDocument: rec.sourceDocument || '',
    sourceVersion: rec.sourceVersion || '',
    verifiedAt: rec.verifiedAt ?? null,
    verificationStatus: rec.verificationStatus as RegulatoryVerificationStatus,
  }));

  const mappedConstituents: MaterialConstituent[] = rawConsts.map((c) => ({
    id: c.id,
    materialId: c.materialId,
    constituentName: c.constituentName,
    constituentCas: c.constituentCas || '',
    typicalPct: c.typicalPct ?? null,
    minPct: c.minPct ?? null,
    maxPct: c.maxPct ?? null,
    labelThresholdLeaveOnPct: c.labelThresholdLeaveOnPct ?? 0.001,
    labelThresholdRinseOffPct: c.labelThresholdRinseOffPct ?? 0.01,
    riskNote: c.riskNote || '',
    sourceUrl: c.sourceUrl || '',
    sourceDocument: c.sourceDocument || '',
    verificationStatus: c.verificationStatus as RegulatoryVerificationStatus,
  }));

  const mappedLimits: MaterialRegulatoryLimit[] = rawLimits.map((r) => {
    const verStatus: RegulatoryVerificationStatus =
      r.regulatoryDataStatus === 'PARTIALLY_VERIFIED_OFFICIAL_SOURCES'
        ? 'PARTIALLY_VERIFIED'
        : r.isDemoData
        ? 'DEMO'
        : 'LOOKUP_REQUIRED';
    return {
      id: r.id,
      materialId: r.materialId,
      ifraCategory: r.ifraCategory,
      maxAllowedPercent: r.maxAllowedPercent ?? null,
      allergens: r.allergens || 'Unknown / Not Provided',
      restrictions: r.restrictions || '',
      sourceDocument: r.sourceDocument || 'Unknown / Not Provided',
      documentVersion: r.documentVersion || 'Unknown / Not Provided',
      effectiveDate: r.effectiveDate || 'Unknown / Not Provided',
      isDemoData: r.isDemoData ?? true,
      verificationStatus: verStatus,
      ifraStandardStatus: r.ifraStandardStatus || undefined,
      ifraStandardType: r.ifraStandardType || undefined,
      euCosmeticsStatus: r.euCosmeticsStatus || undefined,
      euAnnex: r.euAnnex || undefined,
      euReferenceNo: r.euReferenceNo || undefined,
      euLabelThresholdLeaveOnPct: r.euLabelThresholdLeaveOnPct ?? null,
      euLabelThresholdRinseOffPct: r.euLabelThresholdRinseOffPct ?? null,
      regulatorySources: r.regulatorySources || undefined,
      lastVerifiedDate: r.lastVerifiedDate || undefined,
      euCosmeticLimitPercent: r.euMaxReadyForUsePct ?? null,
      euAllergenDeclarable: r.euLabelThresholdLeaveOnPct !== null,
    };
  });

  return {
    totalCatalogMaterials: mappedMaterials.length,
    materials: mappedMaterials,
    regulatoryLimits: mappedLimits,
    regulatoryRecords: mappedRecords,
    constituents: mappedConstituents,
  };
}

export async function getOrInitializeWorkspace(
  uid: string,
  email = 'perfumer@atelier.local'
): Promise<WorkspacePayload> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    return buildMemoryWorkspacePayload(uid, email);
  }
  return await getOrInitializeWorkspaceInDb(uid, email);
}

export const getWorkspaceSnapshot = getOrInitializeWorkspace;
export const fetchFullWorkspace = getOrInitializeWorkspace;

// ============================================================================
// USER SHELF & WORKBENCH CRUD (STAGE 1)
// ============================================================================

export async function getUserShelf(uid: string): Promise<UserShelfItem[]> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    return Array.from(store.shelfByMaterialId.values());
  }

  const activeDb = requirePostgresDb();
  const rows = await activeDb
    .select()
    .from(userShelf)
    .where(eq(userShelf.userUid, uid));

  return rows.map((s) => ({
    id: s.id,
    userUid: s.userUid,
    materialId: s.materialId,
    supplierName: s.supplierName || '',
    supplierProductName: s.supplierProductName || '',
    workingDilutionPct: s.workingDilutionPct ?? null,
    personalNotes: s.personalNotes || '',
    isOnWorkbench: Boolean(s.isOnWorkbench),
    pyramidOverrideCode: (s.pyramidOverrideCode as PyramidUiCode | null) ?? null,
    favorite: Boolean(s.favorite),
    addedAt: s.addedAt ? s.addedAt.toISOString() : new Date().toISOString(),
    updatedAt: s.updatedAt ? s.updatedAt.toISOString() : new Date().toISOString(),
  }));
}

export async function addToUserShelf(
  uid: string,
  materialId: number,
  payload: ShelfMutationPayload = {}
): Promise<UserShelfItem> {
  if (!Number.isFinite(materialId) || materialId <= 0) {
    throw new ShelfValidationError('Invalid materialId.', 400);
  }

  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const { materials: globalMats } = ensureMemoryGlobalCatalogLoaded();
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const targetMat =
      globalMats.find((m) => m.id === materialId) ||
      memoryCustomUserMaterials.find(
        (m) => m.id === materialId && m.scope === 'USER' && m.ownerUid === uid
      );

    if (!targetMat) {
      throw new ShelfValidationError(
        `Material ${materialId} not found in Global Catalog or your custom materials.`,
        404
      );
    }

    const existing = store.shelfByMaterialId.get(materialId);
    const nowIso = new Date().toISOString();
    const updated: UserShelfItem = existing
      ? {
          ...existing,
          supplierName: payload.supplierName ?? existing.supplierName,
          supplierProductName:
            payload.supplierProductName ?? existing.supplierProductName,
          workingDilutionPct:
            payload.workingDilutionPct !== undefined
              ? payload.workingDilutionPct
              : existing.workingDilutionPct,
          personalNotes: payload.personalNotes ?? existing.personalNotes,
          isOnWorkbench:
            payload.isOnWorkbench !== undefined
              ? Boolean(payload.isOnWorkbench)
              : existing.isOnWorkbench,
          pyramidOverrideCode:
            payload.pyramidOverrideCode !== undefined
              ? payload.pyramidOverrideCode
              : existing.pyramidOverrideCode,
          favorite:
            payload.favorite !== undefined
              ? Boolean(payload.favorite)
              : existing.favorite,
          updatedAt: nowIso,
        }
      : {
          id: memoryNextShelfId++,
          userUid: uid,
          materialId,
          catalogKey: targetMat.catalogKey,
          supplierName: payload.supplierName ?? targetMat.supplier ?? '',
          supplierProductName:
            payload.supplierProductName ?? targetMat.supplierProductCode ?? '',
          workingDilutionPct:
            payload.workingDilutionPct !== undefined
              ? payload.workingDilutionPct
              : targetMat.recommendedDilution ?? 100,
          personalNotes: payload.personalNotes ?? '',
          isOnWorkbench: Boolean(payload.isOnWorkbench ?? false),
          pyramidOverrideCode: payload.pyramidOverrideCode ?? null,
          favorite: Boolean(payload.favorite ?? false),
          addedAt: nowIso,
          updatedAt: nowIso,
        };

    store.shelfByMaterialId.set(materialId, updated);
    return { ...updated };
  }

  const activeDb = requirePostgresDb();
  return await activeDb.transaction(async (tx) => {
    const [targetMat] = await tx
      .select()
      .from(materials)
      .where(
        and(
          eq(materials.id, materialId),
          or(
            eq(materials.scope, 'GLOBAL'),
            and(eq(materials.scope, 'USER'), eq(materials.ownerUid, uid))
          )
        )
      );

    if (!targetMat) {
      throw new ShelfValidationError(
        `Material ${materialId} not found in Global Catalog or your custom materials.`,
        404
      );
    }

    const existingRows = await tx
      .select()
      .from(userShelf)
      .where(
        and(eq(userShelf.userUid, uid), eq(userShelf.materialId, materialId))
      );

    if (existingRows.length > 0) {
      const existing = existingRows[0];
      const [updated] = await tx
        .update(userShelf)
        .set({
          supplierName: payload.supplierName ?? existing.supplierName,
          supplierProductName:
            payload.supplierProductName ?? existing.supplierProductName,
          workingDilutionPct:
            payload.workingDilutionPct !== undefined
              ? payload.workingDilutionPct
              : existing.workingDilutionPct,
          personalNotes: payload.personalNotes ?? existing.personalNotes,
          isOnWorkbench:
            payload.isOnWorkbench !== undefined
              ? Boolean(payload.isOnWorkbench)
              : existing.isOnWorkbench,
          pyramidOverrideCode:
            payload.pyramidOverrideCode !== undefined
              ? payload.pyramidOverrideCode
              : existing.pyramidOverrideCode,
          favorite:
            payload.favorite !== undefined
              ? Boolean(payload.favorite)
              : existing.favorite,
          updatedAt: new Date(),
        })
        .where(eq(userShelf.id, existing.id))
        .returning();

      return {
        id: updated.id,
        userUid: updated.userUid,
        materialId: updated.materialId,
        catalogKey: targetMat.catalogKey || undefined,
        supplierName: updated.supplierName,
        supplierProductName: updated.supplierProductName,
        workingDilutionPct: updated.workingDilutionPct ?? null,
        personalNotes: updated.personalNotes,
        isOnWorkbench: Boolean(updated.isOnWorkbench),
        pyramidOverrideCode:
          (updated.pyramidOverrideCode as PyramidUiCode | null) ?? null,
        favorite: Boolean(updated.favorite),
        addedAt: updated.addedAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    }

    const [inserted] = await tx
      .insert(userShelf)
      .values({
        userUid: uid,
        materialId,
        supplierName: payload.supplierName ?? targetMat.supplier ?? '',
        supplierProductName:
          payload.supplierProductName ?? targetMat.supplierProductCode ?? '',
        workingDilutionPct:
          payload.workingDilutionPct !== undefined
            ? payload.workingDilutionPct
            : targetMat.recommendedDilution ?? 100,
        personalNotes: payload.personalNotes ?? '',
        isOnWorkbench: Boolean(payload.isOnWorkbench ?? false),
        pyramidOverrideCode: payload.pyramidOverrideCode ?? null,
        favorite: Boolean(payload.favorite ?? false),
      })
      .returning();

    return {
      id: inserted.id,
      userUid: inserted.userUid,
      materialId: inserted.materialId,
      catalogKey: targetMat.catalogKey || undefined,
      supplierName: inserted.supplierName,
      supplierProductName: inserted.supplierProductName,
      workingDilutionPct: inserted.workingDilutionPct ?? null,
      personalNotes: inserted.personalNotes,
      isOnWorkbench: Boolean(inserted.isOnWorkbench),
      pyramidOverrideCode:
        (inserted.pyramidOverrideCode as PyramidUiCode | null) ?? null,
      favorite: Boolean(inserted.favorite),
      addedAt: inserted.addedAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString(),
    };
  });
}

export async function updateUserShelfItem(
  uid: string,
  materialId: number,
  patch: ShelfMutationPayload
): Promise<UserShelfItem> {
  if (!Number.isFinite(materialId) || materialId <= 0) {
    throw new ShelfValidationError('Invalid materialId.', 400);
  }

  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const existing = store.shelfByMaterialId.get(materialId);
    if (!existing) {
      throw new ShelfValidationError(
        'Material is not on My Shelf. Add the material to My Shelf before updating shelf metadata or pinning to Current Workbench.',
        400
      );
    }

    const updated: UserShelfItem = {
      ...existing,
      supplierName:
        patch.supplierName !== undefined ? patch.supplierName : existing.supplierName,
      supplierProductName:
        patch.supplierProductName !== undefined
          ? patch.supplierProductName
          : existing.supplierProductName,
      workingDilutionPct:
        patch.workingDilutionPct !== undefined
          ? patch.workingDilutionPct
          : existing.workingDilutionPct,
      personalNotes:
        patch.personalNotes !== undefined
          ? patch.personalNotes
          : existing.personalNotes,
      isOnWorkbench:
        patch.isOnWorkbench !== undefined
          ? Boolean(patch.isOnWorkbench)
          : existing.isOnWorkbench,
      pyramidOverrideCode:
        patch.pyramidOverrideCode !== undefined
          ? patch.pyramidOverrideCode
          : existing.pyramidOverrideCode,
      favorite:
        patch.favorite !== undefined ? Boolean(patch.favorite) : existing.favorite,
      updatedAt: new Date().toISOString(),
    };
    store.shelfByMaterialId.set(materialId, updated);
    return { ...updated };
  }

  const activeDb = requirePostgresDb();
  return await activeDb.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(userShelf)
      .where(
        and(eq(userShelf.userUid, uid), eq(userShelf.materialId, materialId))
      );

    if (existingRows.length === 0) {
      throw new ShelfValidationError(
        'Material is not on My Shelf. Add the material to My Shelf before updating shelf metadata or pinning to Current Workbench.',
        400
      );
    }

    const existing = existingRows[0];
    const [updated] = await tx
      .update(userShelf)
      .set({
        supplierName:
          patch.supplierName !== undefined ? patch.supplierName : existing.supplierName,
        supplierProductName:
          patch.supplierProductName !== undefined
            ? patch.supplierProductName
            : existing.supplierProductName,
        workingDilutionPct:
          patch.workingDilutionPct !== undefined
            ? patch.workingDilutionPct
            : existing.workingDilutionPct,
        personalNotes:
          patch.personalNotes !== undefined
            ? patch.personalNotes
            : existing.personalNotes,
        isOnWorkbench:
          patch.isOnWorkbench !== undefined
            ? Boolean(patch.isOnWorkbench)
            : existing.isOnWorkbench,
        pyramidOverrideCode:
          patch.pyramidOverrideCode !== undefined
            ? patch.pyramidOverrideCode
            : existing.pyramidOverrideCode,
        favorite:
          patch.favorite !== undefined ? Boolean(patch.favorite) : existing.favorite,
        updatedAt: new Date(),
      })
      .where(eq(userShelf.id, existing.id))
      .returning();

    return {
      id: updated.id,
      userUid: updated.userUid,
      materialId: updated.materialId,
      supplierName: updated.supplierName,
      supplierProductName: updated.supplierProductName,
      workingDilutionPct: updated.workingDilutionPct ?? null,
      personalNotes: updated.personalNotes,
      isOnWorkbench: Boolean(updated.isOnWorkbench),
      pyramidOverrideCode:
        (updated.pyramidOverrideCode as PyramidUiCode | null) ?? null,
      favorite: Boolean(updated.favorite),
      addedAt: updated.addedAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function removeFromUserShelf(
  uid: string,
  materialId: number
): Promise<{ removed: boolean; materialId: number }> {
  if (!Number.isFinite(materialId) || materialId <= 0) {
    throw new ShelfValidationError('Invalid materialId.', 400);
  }

  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const existed = store.shelfByMaterialId.delete(materialId);
    return { removed: existed, materialId };
  }

  const activeDb = requirePostgresDb();
  return await activeDb.transaction(async (tx) => {
    const deletedRows = await tx
      .delete(userShelf)
      .where(
        and(eq(userShelf.userUid, uid), eq(userShelf.materialId, materialId))
      )
      .returning();

    return { removed: deletedRows.length > 0, materialId };
  });
}

// ============================================================================
// STAGE 2: FORMULA, VERSION, ACCORD, EXPERIMENT, EVALUATION & MEMORY MUTATIONS
// ============================================================================

export async function saveFormulaAndVersion(
  uid: string,
  formulaPayload: Partial<Formula> & { id?: number; name: string },
  versionPayload: {
    versionLabel: string;
    parentVersionId?: number | null;
    status: 'Draft' | 'Committed';
    versionNotes: string;
    maturationDays: number;
    items: FormulaLineItem[];
  }
) {
  const cleanLabel = (versionPayload.versionLabel || '').trim();
  if (!cleanLabel) {
    throw new FormulaIntegrityError('versionLabel is required.', 400);
  }

  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const { materials: globalMats } = ensureMemoryGlobalCatalogLoaded();
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    let targetFormula = formulaPayload.id
      ? store.formulas.find((f) => f.id === formulaPayload.id)
      : undefined;

    // 1. Validate parentVersionId belongs to the same formula
    if (
      versionPayload.parentVersionId !== undefined &&
      versionPayload.parentVersionId !== null
    ) {
      if (!targetFormula) {
        throw new FormulaIntegrityError(
          'Invalid parentVersionId: cannot reference a parent version when creating a brand new formula.',
          400
        );
      }
      const parentInSameFormula = targetFormula.versions.find(
        (v) => v.id === versionPayload.parentVersionId
      );
      if (!parentInSameFormula) {
        throw new FormulaIntegrityError(
          `Invalid parentVersionId ${versionPayload.parentVersionId}: parent version must exist and belong to formula ${targetFormula.id}.`,
          400
        );
      }
    }

    // 2. Validate all line item references (materialId / accordId / accordVersionId)
    for (const item of versionPayload.items) {
      const isAccord = item.type === 'accord' || item.itemType === 'ACCORD';
      if (isAccord) {
        const matchedAccord =
          (item.accordId
            ? store.accords.find((a) => a.id === item.accordId)
            : undefined) ||
          (item.accordVersionId
            ? store.accords.find((a) =>
                a.versions?.some((v) => v.id === item.accordVersionId)
              )
            : undefined);
        if (!matchedAccord) {
          throw new FormulaIntegrityError(
            `Invalid accord reference on line item "${item.name}".`,
            400
          );
        }
      } else {
        const matId = item.materialId;
        const matchedMat =
          (matId ? globalMats.find((m) => m.id === matId) : undefined) ||
          (matId
            ? memoryCustomUserMaterials.find(
                (m) => m.id === matId && m.scope === 'USER' && m.ownerUid === uid
              )
            : undefined);
        if (!matchedMat) {
          throw new FormulaIntegrityError(
            `Invalid materialId ${String(matId)} on line item "${item.name}".`,
            400
          );
        }
      }
    }

    // 3. Enforce immutability of Committed versions & uniqueness of (formulaId, versionLabel)
    if (targetFormula) {
      const existingMatchingVer = targetFormula.versions.find(
        (v) => v.versionLabel.toLowerCase() === cleanLabel.toLowerCase()
      );
      if (existingMatchingVer && existingMatchingVer.status === 'Committed') {
        throw new FormulaIntegrityError(
          `Formula version "${cleanLabel}" is Committed and immutable. Create a new branched version label instead.`,
          409
        );
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    if (targetFormula) {
      targetFormula.name = formulaPayload.name || targetFormula.name;
      targetFormula.status = formulaPayload.status || targetFormula.status;
      targetFormula.description =
        formulaPayload.description ?? targetFormula.description;
      targetFormula.intendedProduct =
        formulaPayload.intendedProduct || targetFormula.intendedProduct;
      targetFormula.ifraCategory =
        formulaPayload.ifraCategory || targetFormula.ifraCategory;
      targetFormula.finalProductConcentration =
        formulaPayload.finalProductConcentration ??
        targetFormula.finalProductConcentration;
      targetFormula.targetBrief =
        formulaPayload.targetBrief ?? targetFormula.targetBrief;
      targetFormula.targetFamilies =
        formulaPayload.targetFamilies || targetFormula.targetFamilies;
      targetFormula.targetFacets =
        formulaPayload.targetFacets || targetFormula.targetFacets;
      targetFormula.activeVersionLabel = cleanLabel;
      targetFormula.updatedAt = today;
    } else {
      const nextId = Math.max(0, ...store.formulas.map((f) => f.id)) + 1;
      targetFormula = {
        id: nextId,
        projectId: 1,
        projectName: formulaPayload.projectName || 'Personal Study',
        name: formulaPayload.name,
        status: formulaPayload.status || 'Draft',
        description: formulaPayload.description || '',
        intendedProduct:
          formulaPayload.intendedProduct || 'Eau de Parfum (20% conc.)',
        ifraCategory:
          formulaPayload.ifraCategory || 'Category 4 (Fine Fragrance)',
        finalProductConcentration:
          formulaPayload.finalProductConcentration ?? 20,
        targetBrief: formulaPayload.targetBrief || '',
        targetFamilies: formulaPayload.targetFamilies || ['Green'],
        targetFacets: formulaPayload.targetFacets || { Green: 7 },
        targetIntensity: formulaPayload.targetIntensity ?? 7,
        targetTexture: formulaPayload.targetTexture || '',
        targetAtmosphere: formulaPayload.targetAtmosphere || '',
        targetTemperature: formulaPayload.targetTemperature || 'Cool',
        targetColor: formulaPayload.targetColor || '#2E6F40',
        targetMood: formulaPayload.targetMood || '',
        targetDiffusion: formulaPayload.targetDiffusion ?? 7,
        targetEvolution: formulaPayload.targetEvolution || '',
        targetDrydown: formulaPayload.targetDrydown || '',
        materialsToAvoid: formulaPayload.materialsToAvoid || [],
        isFavorite: formulaPayload.isFavorite ?? false,
        tags: formulaPayload.tags || ['Custom'],
        activeVersionLabel: cleanLabel,
        createdAt: today,
        updatedAt: today,
        versions: [],
      };
      store.formulas.push(targetFormula);
    }

    const existingDraftVer = targetFormula.versions.find(
      (v) =>
        v.versionLabel.toLowerCase() === cleanLabel.toLowerCase() &&
        v.status === 'Draft'
    );

    let savedVersionId: number;
    if (existingDraftVer) {
      savedVersionId = existingDraftVer.id;
      const { lineItems, normalizedItems } = buildNormalizedItemsForVersion(
        savedVersionId,
        versionPayload.items,
        store.accords
      );
      existingDraftVer.status = versionPayload.status;
      existingDraftVer.versionNotes = versionPayload.versionNotes;
      existingDraftVer.maturationDays = versionPayload.maturationDays;
      existingDraftVer.items = lineItems;
      existingDraftVer.normalizedItems = normalizedItems;
    } else {
      savedVersionId =
        Math.max(
          0,
          ...store.formulas.flatMap((f) => f.versions.map((v) => v.id))
        ) + 1;
      const { lineItems, normalizedItems } = buildNormalizedItemsForVersion(
        savedVersionId,
        versionPayload.items,
        store.accords
      );
      targetFormula.versions.push({
        id: savedVersionId,
        formulaId: targetFormula.id,
        parentVersionId: versionPayload.parentVersionId ?? null,
        versionLabel: cleanLabel,
        status: versionPayload.status,
        versionNotes: versionPayload.versionNotes,
        maturationDays: versionPayload.maturationDays,
        items: lineItems,
        normalizedItems,
        createdAt: today,
      });
    }

    store.auditLogs.push({
      id: memoryNextAuditLogId++,
      userUid: uid,
      action: 'SAVE_FORMULA_VERSION',
      entityType: 'formula_version',
      entityId: String(savedVersionId),
      summary: `Saved ${targetFormula.name} version ${cleanLabel} (${versionPayload.status})`,
      createdAt: new Date().toISOString(),
    });

    return { formulaId: targetFormula.id, formulaVersionId: savedVersionId };
  }

  const activeDb = requirePostgresDb();
  return await activeDb.transaction(async (tx) => {
    let targetFormulaId = formulaPayload.id;

    if (targetFormulaId) {
      const existing = await tx
        .select()
        .from(formulas)
        .where(
          and(eq(formulas.id, targetFormulaId), eq(formulas.userUid, uid))
        );
      if (existing.length === 0) {
        targetFormulaId = undefined;
      }
    }

    // 1. Validate parentVersionId belongs to the same formula
    if (
      versionPayload.parentVersionId !== undefined &&
      versionPayload.parentVersionId !== null
    ) {
      if (!targetFormulaId) {
        throw new FormulaIntegrityError(
          'Invalid parentVersionId: cannot reference a parent version when creating a new formula.',
          400
        );
      }
      const parentRows = await tx
        .select()
        .from(formulaVersions)
        .where(
          and(
            eq(formulaVersions.id, versionPayload.parentVersionId),
            eq(formulaVersions.formulaId, targetFormulaId)
          )
        );
      if (parentRows.length === 0) {
        throw new FormulaIntegrityError(
          `Invalid parentVersionId ${versionPayload.parentVersionId}: parent version must belong to formula ${targetFormulaId}.`,
          400
        );
      }
    }

    // 2. Validate all line item references
    for (const item of versionPayload.items) {
      const isAccord = item.type === 'accord' || item.itemType === 'ACCORD';
      if (isAccord) {
        if (!item.accordId && !item.accordVersionId) {
          throw new FormulaIntegrityError(
            `Accord line item "${item.name}" is missing accordId or accordVersionId.`,
            400
          );
        }
        if (item.accordId) {
          const accRows = await tx
            .select()
            .from(accords)
            .where(and(eq(accords.id, item.accordId), eq(accords.userUid, uid)));
          if (accRows.length === 0) {
            throw new FormulaIntegrityError(
              `Invalid accordId ${item.accordId} on line item "${item.name}".`,
              400
            );
          }
        }
      } else {
        if (!item.materialId) {
          throw new FormulaIntegrityError(
            `Material line item "${item.name}" is missing materialId.`,
            400
          );
        }
        const matRows = await tx
          .select()
          .from(materials)
          .where(
            and(
              eq(materials.id, item.materialId),
              or(
                eq(materials.scope, 'GLOBAL'),
                and(eq(materials.scope, 'USER'), eq(materials.ownerUid, uid))
              )
            )
          );
        if (matRows.length === 0) {
          throw new FormulaIntegrityError(
            `Invalid materialId ${item.materialId} on line item "${item.name}".`,
            400
          );
        }
      }
    }

    if (targetFormulaId) {
      await tx
        .update(formulas)
        .set({
          name: formulaPayload.name,
          status: formulaPayload.status || 'Draft',
          description: formulaPayload.description || '',
          intendedProduct:
            formulaPayload.intendedProduct || 'Eau de Parfum (20% conc.)',
          ifraCategory:
            formulaPayload.ifraCategory || 'Category 4 (Fine Fragrance)',
          finalProductConcentration:
            formulaPayload.finalProductConcentration ?? 20,
          targetBrief: formulaPayload.targetBrief || '',
          targetFamilies: JSON.stringify(formulaPayload.targetFamilies || []),
          targetFacetsJson: JSON.stringify(formulaPayload.targetFacets || {}),
          targetIntensity: formulaPayload.targetIntensity ?? 7,
          targetTexture: formulaPayload.targetTexture || '',
          targetAtmosphere: formulaPayload.targetAtmosphere || '',
          targetTemperature: formulaPayload.targetTemperature || 'Neutral',
          targetColor: formulaPayload.targetColor || '#2E6F40',
          targetMood: formulaPayload.targetMood || '',
          targetDiffusion: formulaPayload.targetDiffusion ?? 7,
          targetEvolution: formulaPayload.targetEvolution || '',
          targetDrydown: formulaPayload.targetDrydown || '',
          materialsToAvoid: JSON.stringify(
            formulaPayload.materialsToAvoid || []
          ),
          isFavorite: formulaPayload.isFavorite ?? false,
          tags: JSON.stringify(formulaPayload.tags || []),
          activeVersionLabel: cleanLabel,
          updatedAt: new Date(),
        })
        .where(
          and(eq(formulas.id, targetFormulaId), eq(formulas.userUid, uid))
        );
    } else {
      const [insertedFormula] = await tx
        .insert(formulas)
        .values({
          userUid: uid,
          projectName: formulaPayload.projectName || 'Personal Study',
          name: formulaPayload.name,
          status: formulaPayload.status || 'Draft',
          description: formulaPayload.description || '',
          intendedProduct:
            formulaPayload.intendedProduct || 'Eau de Parfum (20% conc.)',
          ifraCategory:
            formulaPayload.ifraCategory || 'Category 4 (Fine Fragrance)',
          finalProductConcentration:
            formulaPayload.finalProductConcentration ?? 20,
          targetBrief: formulaPayload.targetBrief || '',
          targetFamilies: JSON.stringify(formulaPayload.targetFamilies || []),
          targetFacetsJson: JSON.stringify(formulaPayload.targetFacets || {}),
          targetIntensity: formulaPayload.targetIntensity ?? 7,
          targetTexture: formulaPayload.targetTexture || '',
          targetAtmosphere: formulaPayload.targetAtmosphere || '',
          targetTemperature: formulaPayload.targetTemperature || 'Neutral',
          targetColor: formulaPayload.targetColor || '#2E6F40',
          targetMood: formulaPayload.targetMood || '',
          targetDiffusion: formulaPayload.targetDiffusion ?? 7,
          targetEvolution: formulaPayload.targetEvolution || '',
          targetDrydown: formulaPayload.targetDrydown || '',
          materialsToAvoid: JSON.stringify(
            formulaPayload.materialsToAvoid || []
          ),
          isFavorite: formulaPayload.isFavorite ?? false,
          tags: JSON.stringify(formulaPayload.tags || []),
          activeVersionLabel: cleanLabel,
        })
        .returning();
      targetFormulaId = insertedFormula.id;
    }

    const existingVers = await tx
      .select()
      .from(formulaVersions)
      .where(
        and(
          eq(formulaVersions.formulaId, targetFormulaId),
          eq(formulaVersions.userUid, uid)
        )
      );

    const matchingVer = existingVers.find(
      (v) => v.versionLabel.toLowerCase() === cleanLabel.toLowerCase()
    );

    if (matchingVer && matchingVer.status === 'Committed') {
      throw new FormulaIntegrityError(
        `Formula version "${cleanLabel}" is Committed and immutable. Create a new branched version label instead.`,
        409
      );
    }

    let formulaVersionId: number;
    if (matchingVer && matchingVer.status === 'Draft') {
      await tx
        .update(formulaVersions)
        .set({
          status: versionPayload.status,
          versionNotes: versionPayload.versionNotes,
          maturationDays: versionPayload.maturationDays,
          itemsJson: JSON.stringify(versionPayload.items),
        })
        .where(eq(formulaVersions.id, matchingVer.id));
      formulaVersionId = matchingVer.id;
      await tx
        .delete(formulaVersionItems)
        .where(eq(formulaVersionItems.formulaVersionId, formulaVersionId));
    } else {
      const [insertedVer] = await tx
        .insert(formulaVersions)
        .values({
          userUid: uid,
          formulaId: targetFormulaId,
          parentVersionId: versionPayload.parentVersionId ?? null,
          versionLabel: cleanLabel,
          status: versionPayload.status,
          versionNotes: versionPayload.versionNotes,
          maturationDays: versionPayload.maturationDays,
          itemsJson: JSON.stringify(versionPayload.items),
        })
        .returning();
      formulaVersionId = insertedVer.id;
    }

    // Insert normalized formula_version_items
    for (let idx = 0; idx < versionPayload.items.length; idx++) {
      const item = versionPayload.items[idx];
      const isAccord = item.type === 'accord' || item.itemType === 'ACCORD';
      let accordVerId = item.accordVersionId ?? null;
      if (isAccord && !accordVerId && item.accordId) {
        const accVerRows = await tx
          .select()
          .from(accordVersions)
          .where(eq(accordVersions.accordId, item.accordId))
          .orderBy(desc(accordVersions.id));
        if (accVerRows.length > 0) {
          accordVerId = accVerRows[0].id;
        }
      }

      const dilutionPct = item.dilutionPercent ?? 100;
      const pct = item.percentage ?? 0;
      const activePct =
        item.activeMaterialPercent ?? Number((pct * (dilutionPct / 100)).toFixed(4));

      await tx.insert(formulaVersionItems).values({
        formulaVersionId,
        lineOrder: idx,
        itemType: isAccord ? 'ACCORD' : 'MATERIAL',
        materialId: isAccord ? null : (item.materialId ?? null),
        accordId: isAccord ? (item.accordId ?? null) : null,
        accordVersionId: isAccord ? accordVerId : null,
        name: item.name,
        percentage: pct,
        quantityGrams: item.quantityGrams ?? 0,
        dilutionPct,
        solvent: item.solvent || (dilutionPct < 100 ? 'Ethanol' : 'Neat'),
        activeMaterialPct: activePct,
        supplier: item.supplier || '',
        costPerGram: item.costPerGram ?? 0.35,
        notes: item.notes || '',
      });
    }

    await tx.insert(auditLogs).values({
      userUid: uid,
      action: 'SAVE_FORMULA_VERSION',
      entityType: 'formula_version',
      entityId: String(formulaVersionId),
      summary: `Saved ${formulaPayload.name} version ${cleanLabel} (${versionPayload.status})`,
    });

    return { formulaId: targetFormulaId, formulaVersionId };
  });
}

export async function createMaterial(
  uid: string,
  payload: Partial<RawMaterial> & {
    name: string;
    maxAllowedPercent?: number | null;
    ifraSource?: string;
    addToShelf?: boolean;
  }
) {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const nextId = memoryNextCustomMaterialId++;
    const newMat: RawMaterial = {
      id: nextId,
      catalogKey: `mat_user_${uid}_${nextId}`,
      scope: 'USER',
      ownerUid: uid,
      displayName: payload.displayName || payload.name,
      name: payload.name,
      aliases: payload.aliases || '',
      casNumber: payload.casNumber || 'Unknown / Not Provided',
      inciName: payload.inciName || 'Unknown / Not Provided',
      naturalOrSynthetic: payload.naturalOrSynthetic || 'Synthetic',
      materialKind: payload.materialKind || 'SYNTHETIC',
      supplier: payload.supplier || '',
      supplierProductCode: payload.supplierProductCode || '',
      manufacturer: payload.manufacturer || '',
      primaryFamily: payload.primaryFamily || 'Woody',
      facets: payload.facets || ['Woody'],
      intensity: payload.intensity ?? 7,
      substantivityHours: payload.substantivityHours ?? 24,
      diffusion: payload.diffusion ?? 7,
      volatility: payload.volatility || 'Base',
      descriptiveNotes: payload.descriptiveNotes || '',
      texture: payload.texture || '',
      temperatureImpression: payload.temperatureImpression || 'Neutral',
      personalNotes: payload.personalNotes || '',
      purity: payload.purity || '100%',
      density: payload.density ?? 0.95,
      recommendedDilution: payload.recommendedDilution ?? 100,
      storageInfo: payload.storageInfo || '',
      shelfLifeMonths: payload.shelfLifeMonths ?? 24,
      flashPointCelsius: payload.flashPointCelsius ?? null,
      educationalObserve: payload.educationalObserve || [],
      complements: payload.complements || [],
      contrasts: payload.contrasts || [],
      isSeedData: false,
      isOnShelf: true,
      isOnWorkbench: payload.isOnWorkbench ?? true,
      costPerGram: payload.costPerGram ?? 0.35,
    };
    memoryCustomUserMaterials.push(newMat);

    const nowIso = new Date().toISOString();
    store.shelfByMaterialId.set(nextId, {
      id: memoryNextShelfId++,
      userUid: uid,
      materialId: nextId,
      catalogKey: newMat.catalogKey,
      supplierName: payload.supplier || '',
      supplierProductName: payload.supplierProductCode || '',
      workingDilutionPct: payload.recommendedDilution ?? 100,
      personalNotes: payload.personalNotes || '',
      isOnWorkbench: payload.isOnWorkbench ?? true,
      pyramidOverrideCode: null,
      favorite: false,
      addedAt: nowIso,
      updatedAt: nowIso,
    });

    const hasUserLimit =
      payload.maxAllowedPercent !== undefined && payload.maxAllowedPercent !== null;
    const verStatus: RegulatoryVerificationStatus = hasUserLimit
      ? 'USER_ENTERED_UNVERIFIED'
      : 'LOOKUP_REQUIRED';

    const userRecord: MaterialRegulatoryRecord = {
      id: nextId,
      materialId: nextId,
      userUid: uid,
      jurisdiction: 'USER',
      authority: 'USER',
      ruleType: hasUserLimit ? 'MAX_USE' : 'INFORMATION',
      status: hasUserLimit ? 'USER_ENTERED' : 'LOOKUP_REQUIRED',
      standardOrAnnex: 'IFRA_51',
      referenceNumber: '',
      productCategory: 'Cat 4',
      maxFinishedProductPct: payload.maxAllowedPercent ?? null,
      maxReadyForUsePct: null,
      labelThresholdLeaveOnPct: null,
      labelThresholdRinseOffPct: null,
      conditionText: '',
      summary: hasUserLimit
        ? 'User-entered IFRA limit (unverified)'
        : 'Safety information unavailable. Manual verification required.',
      sourceUrl: '',
      sourceDocument: payload.ifraSource || 'Unknown / Not Provided',
      sourceVersion: 'User Entered',
      verifiedAt: null,
      verificationStatus: verStatus,
    };

    store.userRegulatoryRecords.push(userRecord);
    store.userRegulatoryOverrides.set(nextId, {
      id: nextId,
      materialId: nextId,
      ifraCategory: 'Category 4 (Fine Fragrance)',
      maxAllowedPercent: payload.maxAllowedPercent ?? null,
      allergens: 'Unknown / Not Provided',
      restrictions: userRecord.summary,
      sourceDocument: payload.ifraSource || 'Unknown / Not Provided',
      documentVersion: 'User Entered',
      effectiveDate: new Date().toISOString().slice(0, 10),
      isDemoData: false,
      verificationStatus: verStatus,
      regulatoryRecords: [userRecord],
    });
    return newMat;
  }

  const activeDb = requirePostgresDb();
  return await activeDb.transaction(async (tx) => {
    const customKey = `mat_user_${uid}_${Date.now()}`;
    const vol = payload.volatility || 'Base';
    const [inserted] = await tx
      .insert(materials)
      .values({
        catalogKey: customKey,
        scope: 'USER',
        ownerUid: uid,
        userUid: uid,
        displayName: payload.displayName || payload.name,
        name: payload.name,
        aliases: payload.aliases || '',
        casNumber: payload.casNumber || 'Unknown / Not Provided',
        inciName: payload.inciName || 'Unknown / Not Provided',
        naturalOrSynthetic: payload.naturalOrSynthetic || 'Synthetic',
        materialKind:
          payload.materialKind ||
          (payload.naturalOrSynthetic === 'Natural'
            ? 'NATURAL_COMPLEX'
            : 'SYNTHETIC'),
        supplier: payload.supplier || '',
        supplierProductCode: payload.supplierProductCode || '',
        manufacturer: payload.manufacturer || '',
        primaryFamily: payload.primaryFamily || 'Woody',
        facets: JSON.stringify(payload.facets || ['Woody']),
        intensity: payload.intensity ?? 7,
        substantivityHours: Math.round(payload.substantivityHours || 24),
        diffusion: payload.diffusion ?? 7,
        volatility: vol,
        descriptiveNotes: payload.descriptiveNotes || '',
        texture: payload.texture || '',
        temperatureImpression: payload.temperatureImpression || 'Neutral',
        personalNotes: payload.personalNotes || '',
        purity: payload.purity || '100%',
        density: payload.density ?? 0.95,
        recommendedDilution: payload.recommendedDilution ?? 100,
        storageInfo: payload.storageInfo || '',
        shelfLifeMonths: payload.shelfLifeMonths ?? 24,
        flashPointCelsius: payload.flashPointCelsius ?? null,
        educationalObserve: JSON.stringify(payload.educationalObserve || []),
        complements: JSON.stringify(payload.complements || []),
        contrasts: JSON.stringify(payload.contrasts || []),
        isSeedData: false,
        isOnWorkbench: payload.isOnWorkbench ?? true,
        costPerGram: payload.costPerGram ?? 0.35,
      })
      .returning();

    await tx.insert(materialOlfactoryProfiles).values({
      materialId: inserted.id,
      primaryFamily: payload.primaryFamily || 'Woody',
      facets: JSON.stringify(payload.facets || ['Woody']),
      odorSummary: payload.descriptiveNotes || '',
      roleTopHeartBase: vol,
      pyramidUsage: 'USER_DEFINED',
      pyramidPrimaryZone: vol.includes('Top')
        ? 'TOP'
        : vol.includes('Base')
        ? 'BASE'
        : 'HEART',
      pyramidHighlightTop: vol.includes('Top'),
      pyramidHighlightHeart: vol.includes('Heart'),
      pyramidHighlightBase: vol.includes('Base'),
      pyramidUiCode:
        vol === 'Top'
          ? 'T'
          : vol === 'Top-Heart'
          ? 'TH'
          : vol === 'Heart'
          ? 'H'
          : vol === 'Heart-Base'
          ? 'HB'
          : 'B',
      pyramidConfidence: 'HIGH',
      pyramidBasis: 'USER_CUSTOM',
      pyramidNote: '',
      olfactoryStrength: 'MEDIUM',
      intensity: payload.intensity ?? 7,
      substantivityHours: Math.round(payload.substantivityHours || 24),
      diffusion: payload.diffusion ?? 7,
      volatility: vol,
      descriptiveNotes: payload.descriptiveNotes || '',
      texture: payload.texture || '',
      temperatureImpression: payload.temperatureImpression || 'Neutral',
      educationalObserve: JSON.stringify(payload.educationalObserve || []),
      complements: JSON.stringify(payload.complements || []),
      contrasts: JSON.stringify(payload.contrasts || []),
    });

    await tx.insert(userShelf).values({
      userUid: uid,
      materialId: inserted.id,
      supplierName: payload.supplier || '',
      supplierProductName: payload.supplierProductCode || '',
      workingDilutionPct: payload.recommendedDilution ?? 100,
      personalNotes: payload.personalNotes || '',
      isOnWorkbench: payload.isOnWorkbench ?? true,
      pyramidOverrideCode: null,
      favorite: false,
    });

    const hasUserLimit =
      payload.maxAllowedPercent !== undefined && payload.maxAllowedPercent !== null;
    const verStatus: RegulatoryVerificationStatus = hasUserLimit
      ? 'USER_ENTERED_UNVERIFIED'
      : 'LOOKUP_REQUIRED';

    await tx.insert(materialRegulatoryLimits).values({
      userUid: uid,
      materialId: inserted.id,
      ifraCategory: 'Category 4 (Fine Fragrance)',
      maxAllowedPercent: payload.maxAllowedPercent ?? null,
      allergens: 'Unknown / Not Provided',
      restrictions: hasUserLimit
        ? 'User-entered IFRA limit (unverified)'
        : 'Safety information unavailable. Manual verification required.',
      sourceDocument: payload.ifraSource || 'Unknown / Not Provided',
      documentVersion: 'User Entered',
      effectiveDate: new Date().toISOString().slice(0, 10),
      isDemoData: false,
    });

    await tx.insert(materialRegulatoryRecords).values({
      userUid: uid,
      materialId: inserted.id,
      jurisdiction: 'USER',
      authority: 'USER',
      ruleType: hasUserLimit ? 'MAX_USE' : 'INFORMATION',
      status: hasUserLimit ? 'USER_ENTERED' : 'LOOKUP_REQUIRED',
      standardOrAnnex: 'IFRA_51',
      referenceNumber: '',
      productCategory: 'Cat 4',
      maxFinishedProductPct: payload.maxAllowedPercent ?? null,
      summary: hasUserLimit
        ? 'User-entered IFRA limit (unverified)'
        : 'Safety information unavailable. Manual verification required.',
      sourceDocument: payload.ifraSource || 'Unknown / Not Provided',
      sourceVersion: 'User Entered',
      verificationStatus: verStatus,
    });

    return {
      ...inserted,
      scope: 'USER' as const,
      ownerUid: uid,
      isOnShelf: true,
      isOnWorkbench: Boolean(payload.isOnWorkbench ?? true),
    };
  });
}

export async function createAccord(
  uid: string,
  payload: Omit<AccordDefinition, 'id'>
) {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const nextId = Math.max(0, ...store.accords.map((a) => a.id)) + 1;
    const verNumId = memoryNextAccordVersionId++;
    const verLabel = payload.activeVersionLabel || 'V1';
    const verSnap: AccordVersionSnapshot = {
      id: verNumId,
      accordId: nextId,
      versionId: `acc-${nextId}-${verLabel.toLowerCase()}`,
      versionLabel: verLabel,
      status: 'Committed',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      versionNotes: payload.notes || 'Initial accord version',
      items: payload.items.map((it, idx) => ({
        ...it,
        id: idx + 1,
        lineOrder: idx,
      })),
    };
    const newAcc: AccordDefinition = {
      ...payload,
      id: nextId,
      activeVersionId: verNumId,
      activeVersionLabel: verLabel,
      versions: [verSnap],
    };
    store.accords.push(newAcc);
    return newAcc;
  }

  const activeDb = requirePostgresDb();
  return await activeDb.transaction(async (tx) => {
    const verLabel = payload.activeVersionLabel || 'V1';
    const [inserted] = await tx
      .insert(accords)
      .values({
        userUid: uid,
        name: payload.name,
        category: payload.category,
        description: payload.description,
        objective: payload.objective,
        usageSuggestions: payload.usageSuggestions,
        notes: payload.notes,
        isEducational: false,
        activeVersionLabel: verLabel,
        itemsJson: JSON.stringify(payload.items),
        olfactoryProfileJson: JSON.stringify(payload.olfactoryProfile),
      })
      .returning();

    const [insertedVer] = await tx
      .insert(accordVersions)
      .values({
        userUid: uid,
        accordId: inserted.id,
        versionLabel: verLabel,
        status: 'Committed',
        versionNotes: payload.notes || 'Initial accord version',
      })
      .returning();

    for (let idx = 0; idx < payload.items.length; idx++) {
      const it = payload.items[idx];
      await tx.insert(accordVersionItems).values({
        accordVersionId: insertedVer.id,
        lineOrder: idx,
        materialId: it.materialId,
        materialName: it.materialName,
        percentage: it.percentage,
        dilutionPct: it.dilutionPercent ?? 100,
        notes: it.notes || '',
      });
    }

    return {
      ...payload,
      id: inserted.id,
      activeVersionId: insertedVer.id,
      activeVersionLabel: verLabel,
      versions: [
        {
          id: insertedVer.id,
          accordId: inserted.id,
          versionId: `acc-${inserted.id}-v${insertedVer.id}`,
          versionLabel: verLabel,
          status: 'Committed' as const,
          createdAt: insertedVer.createdAt
            ? insertedVer.createdAt.toISOString().slice(0, 16).replace('T', ' ')
            : new Date().toISOString().slice(0, 16).replace('T', ' '),
          versionNotes: payload.notes || 'Initial accord version',
          items: payload.items.map((it, idx) => ({
            ...it,
            id: idx + 1,
            lineOrder: idx,
          })),
        },
      ],
    };
  });
}

/**
 * Creates a new immutable AccordVersion on an existing Accord without modifying
 * any historical AccordVersion snapshots referenced by earlier FormulaVersions.
 */
export async function updateAccordAndCreateVersion(
  uid: string,
  accordId: number,
  payload: {
    versionLabel: string;
    versionNotes?: string;
    items: AccordItem[];
    description?: string;
    notes?: string;
  }
): Promise<AccordDefinition> {
  const cleanLabel = (payload.versionLabel || '').trim();
  if (!cleanLabel) {
    throw new FormulaIntegrityError('Accord versionLabel is required.', 400);
  }

  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const accord = store.accords.find((a) => a.id === accordId);
    if (!accord) {
      throw new FormulaIntegrityError(`Accord ${accordId} not found.`, 404);
    }

    const dup = accord.versions?.find(
      (v) => v.versionLabel.toLowerCase() === cleanLabel.toLowerCase()
    );
    if (dup) {
      throw new FormulaIntegrityError(
        `Accord version "${cleanLabel}" already exists on accord "${accord.name}".`,
        409
      );
    }

    const verNumId = memoryNextAccordVersionId++;
    const newSnap: AccordVersionSnapshot = {
      id: verNumId,
      accordId: accord.id,
      versionId: `acc-${accord.id}-${cleanLabel.toLowerCase()}`,
      versionLabel: cleanLabel,
      status: 'Committed',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      versionNotes: payload.versionNotes || '',
      items: payload.items.map((it, idx) => ({
        ...it,
        id: idx + 1,
        lineOrder: idx,
      })),
    };

    accord.versions = [...(accord.versions || []), newSnap];
    accord.activeVersionId = verNumId;
    accord.activeVersionLabel = cleanLabel;
    accord.items = structuredClone(newSnap.items);
    if (payload.description !== undefined) accord.description = payload.description;
    if (payload.notes !== undefined) accord.notes = payload.notes;

    return structuredClone(accord);
  }

  const activeDb = requirePostgresDb();
  const updatedId = await activeDb.transaction(async (tx) => {
    const existingAccRows = await tx
      .select()
      .from(accords)
      .where(and(eq(accords.id, accordId), eq(accords.userUid, uid)));
    if (existingAccRows.length === 0) {
      throw new FormulaIntegrityError(`Accord ${accordId} not found.`, 404);
    }

    const existingVers = await tx
      .select()
      .from(accordVersions)
      .where(eq(accordVersions.accordId, accordId));
    if (
      existingVers.some(
        (v) => v.versionLabel.toLowerCase() === cleanLabel.toLowerCase()
      )
    ) {
      throw new FormulaIntegrityError(
        `Accord version "${cleanLabel}" already exists on accord "${existingAccRows[0].name}".`,
        409
      );
    }

    const [insertedVer] = await tx
      .insert(accordVersions)
      .values({
        userUid: uid,
        accordId,
        versionLabel: cleanLabel,
        status: 'Committed',
        versionNotes: payload.versionNotes || '',
      })
      .returning();

    for (let idx = 0; idx < payload.items.length; idx++) {
      const it = payload.items[idx];
      await tx.insert(accordVersionItems).values({
        accordVersionId: insertedVer.id,
        lineOrder: idx,
        materialId: it.materialId,
        materialName: it.materialName,
        percentage: it.percentage,
        dilutionPct: it.dilutionPercent ?? 100,
        notes: it.notes || '',
      });
    }

    await tx
      .update(accords)
      .set({
        activeVersionLabel: cleanLabel,
        itemsJson: JSON.stringify(payload.items),
        description: payload.description ?? existingAccRows[0].description,
        notes: payload.notes ?? existingAccRows[0].notes,
        updatedAt: new Date(),
      })
      .where(eq(accords.id, accordId));

    return accordId;
  });

  const userAccords = await getUserAccords(uid);
  const found = userAccords.find((a) => a.id === updatedId);
  if (!found) {
    throw new FormulaIntegrityError(`Accord ${accordId} not found.`, 404);
  }
  return found;
}

export async function addExperiment(
  uid: string,
  payload: Omit<ExperimentEntry, 'id'>
) {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const targetFormula = store.formulas.find((f) => f.id === payload.formulaId);
    if (!targetFormula) {
      throw new FormulaIntegrityError(
        `Formula ${payload.formulaId} not found.`,
        404
      );
    }

    let resolvedVersion = payload.formulaVersionId
      ? targetFormula.versions.find((v) => v.id === payload.formulaVersionId)
      : undefined;

    if (payload.formulaVersionId && !resolvedVersion) {
      throw new FormulaIntegrityError(
        `Invalid formulaVersionId ${payload.formulaVersionId} for formula ${payload.formulaId}.`,
        400
      );
    }

    if (!resolvedVersion) {
      resolvedVersion = targetFormula.versions.find(
        (v) => v.versionLabel === (payload.formulaVersionLabel || 'V1')
      );
    }

    if (!resolvedVersion) {
      throw new FormulaIntegrityError(
        `Formula version "${payload.formulaVersionLabel}" not found on formula ${payload.formulaId}.`,
        400
      );
    }

    const nextId = Math.max(0, ...store.experiments.map((e) => e.id)) + 1;
    const created: ExperimentEntry = {
      ...payload,
      id: nextId,
      formulaVersionId: resolvedVersion.id,
      formulaVersionLabel: resolvedVersion.versionLabel,
    };
    store.experiments.unshift(created);
    return created;
  }

  const activeDb = requirePostgresDb();
  const fVers = await activeDb
    .select()
    .from(formulaVersions)
    .where(
      and(
        eq(formulaVersions.formulaId, payload.formulaId),
        eq(formulaVersions.userUid, uid)
      )
    );

  const matchedVer = payload.formulaVersionId
    ? fVers.find((v) => v.id === payload.formulaVersionId)
    : fVers.find(
        (v) => v.versionLabel === (payload.formulaVersionLabel || 'V1')
      );

  if (!matchedVer) {
    throw new FormulaIntegrityError(
      `Formula version "${payload.formulaVersionLabel || payload.formulaVersionId}" not found on formula ${payload.formulaId}.`,
      400
    );
  }

  const [inserted] = await activeDb
    .insert(experiments)
    .values({
      userUid: uid,
      formulaId: payload.formulaId,
      formulaVersionId: matchedVer.id,
      formulaVersionLabel: matchedVer.versionLabel,
      stageLabel: payload.stageLabel || 'Day 0',
      observation: payload.observation || '',
      recordedAt:
        payload.recordedAt ||
        new Date().toISOString().slice(0, 16).replace('T', ' '),
    })
    .returning();
  return inserted;
}

export async function addEvaluation(
  uid: string,
  payload: Omit<SensoryEvaluation, 'id' | 'createdAt'>
) {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const targetFormula = store.formulas.find((f) => f.id === payload.formulaId);
    if (!targetFormula) {
      throw new FormulaIntegrityError(
        `Formula ${payload.formulaId} not found.`,
        404
      );
    }

    let resolvedVersion = payload.formulaVersionId
      ? targetFormula.versions.find((v) => v.id === payload.formulaVersionId)
      : undefined;

    if (payload.formulaVersionId && !resolvedVersion) {
      throw new FormulaIntegrityError(
        `Invalid formulaVersionId ${payload.formulaVersionId} for formula ${payload.formulaId}.`,
        400
      );
    }

    if (!resolvedVersion) {
      resolvedVersion = targetFormula.versions.find(
        (v) => v.versionLabel === (payload.formulaVersionLabel || 'V1')
      );
    }

    if (!resolvedVersion) {
      throw new FormulaIntegrityError(
        `Formula version "${payload.formulaVersionLabel}" not found on formula ${payload.formulaId}.`,
        400
      );
    }

    const nextId = Math.max(0, ...store.evaluations.map((e) => e.id)) + 1;
    const created: SensoryEvaluation = {
      ...payload,
      id: nextId,
      formulaVersionId: resolvedVersion.id,
      formulaVersionLabel: resolvedVersion.versionLabel,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    store.evaluations.unshift(created);
    return created;
  }

  const activeDb = requirePostgresDb();
  const fVers = await activeDb
    .select()
    .from(formulaVersions)
    .where(
      and(
        eq(formulaVersions.formulaId, payload.formulaId),
        eq(formulaVersions.userUid, uid)
      )
    );

  const matchedVer = payload.formulaVersionId
    ? fVers.find((v) => v.id === payload.formulaVersionId)
    : fVers.find(
        (v) => v.versionLabel === (payload.formulaVersionLabel || 'V1')
      );

  if (!matchedVer) {
    throw new FormulaIntegrityError(
      `Formula version "${payload.formulaVersionLabel || payload.formulaVersionId}" not found on formula ${payload.formulaId}.`,
      400
    );
  }

  const [inserted] = await activeDb
    .insert(evaluations)
    .values({
      userUid: uid,
      formulaId: payload.formulaId,
      formulaVersionId: matchedVer.id,
      formulaVersionLabel: matchedVer.versionLabel,
      checkpoint: payload.checkpoint || '24 hours',
      overallScore: payload.overallScore ?? 8,
      scoresJson: JSON.stringify(payload.scores || {}),
      evaluatedFacetsJson: JSON.stringify(payload.evaluatedFacets || {}),
      openingNotes: payload.openingNotes || '',
      heartNotes: payload.heartNotes || '',
      drydownNotes: payload.drydownNotes || '',
      voiceTranscript: payload.voiceTranscript || '',
      voiceDurationSeconds: payload.voiceDurationSeconds ?? 0,
    })
    .returning();
  return {
    id: inserted.id,
    formulaId: inserted.formulaId,
    formulaVersionId: inserted.formulaVersionId ?? null,
    formulaVersionLabel: inserted.formulaVersionLabel,
    checkpoint: inserted.checkpoint,
    overallScore: inserted.overallScore ?? 8,
    scores: safeParseObject(inserted.scoresJson, payload.scores || { opening: 8, heart: 8, drydown: 8, diffusion: 8, longevity: 8 }),
    evaluatedFacets: safeParseObject(inserted.evaluatedFacetsJson, payload.evaluatedFacets || {}),
    openingNotes: inserted.openingNotes || '',
    heartNotes: inserted.heartNotes || '',
    drydownNotes: inserted.drydownNotes || '',
    voiceTranscript: inserted.voiceTranscript || '',
    voiceDurationSeconds: inserted.voiceDurationSeconds ?? 0,
    createdAt: inserted.createdAt
      ? inserted.createdAt.toISOString().slice(0, 16).replace('T', ' ')
      : new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
}

export async function upsertScentMemory(
  uid: string,
  payload: Omit<ScentMemoryRecord, 'id' | 'lastReviewedAt'>
): Promise<ScentMemoryRecord> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const today = new Date().toISOString().slice(0, 10);
    const existing = store.scentMemories.find(
      (m) => m.materialId === payload.materialId
    );
    if (existing) {
      Object.assign(existing, payload, { lastReviewedAt: today });
      return { ...existing };
    }
    const nextId = Math.max(0, ...store.scentMemories.map((m) => m.id)) + 1;
    const created: ScentMemoryRecord = { ...payload, id: nextId, lastReviewedAt: today };
    store.scentMemories.push(created);
    return { ...created };
  }

  const activeDb = requirePostgresDb();
  const existing = await activeDb
    .select()
    .from(scentMemories)
    .where(
      and(
        eq(scentMemories.userUid, uid),
        eq(scentMemories.materialId, payload.materialId)
      )
    );

  const todayStr = new Date().toISOString().slice(0, 10);
  if (existing.length > 0) {
    await activeDb
      .update(scentMemories)
      .set({
        myPerception: JSON.stringify(payload.myPerception),
        associatedMemories: JSON.stringify(payload.associatedMemories),
        emotions: JSON.stringify(payload.emotions),
        mentalImages: payload.mentalImages,
        places: payload.places,
        colors: payload.colors,
        textures: payload.textures,
        temperature: payload.temperature,
        strengthScore: payload.strengthScore,
        familiarityScore: payload.familiarityScore,
        blindConfidenceScore: payload.blindConfidenceScore,
        recognitionTrials: payload.recognitionTrials,
        recognitionCorrect: payload.recognitionCorrect,
        lastReviewedAt: new Date(),
      })
      .where(eq(scentMemories.id, existing[0].id));
    return {
      ...payload,
      id: existing[0].id,
      lastReviewedAt: todayStr,
    };
  }

  const [inserted] = await activeDb
    .insert(scentMemories)
    .values({
      userUid: uid,
      materialId: payload.materialId,
      myPerception: JSON.stringify(payload.myPerception),
      associatedMemories: JSON.stringify(payload.associatedMemories),
      emotions: JSON.stringify(payload.emotions),
      mentalImages: payload.mentalImages,
      places: payload.places,
      colors: payload.colors,
      textures: payload.textures,
      temperature: payload.temperature,
      strengthScore: payload.strengthScore,
      familiarityScore: payload.familiarityScore,
      blindConfidenceScore: payload.blindConfidenceScore,
      recognitionTrials: payload.recognitionTrials,
      recognitionCorrect: payload.recognitionCorrect,
    })
    .returning();
  return {
    ...payload,
    id: inserted.id,
    lastReviewedAt: todayStr,
  };
}

export async function updateUserSettingsInDb(
  uid: string,
  payload: {
    theme?: string;
    educationalPrompts?: boolean;
    safetyEnabled?: boolean;
  }
) {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    if (payload.theme !== undefined) store.user.theme = payload.theme;
    if (payload.educationalPrompts !== undefined) {
      store.user.educationalPrompts = Boolean(payload.educationalPrompts);
    }
    if (payload.safetyEnabled !== undefined) {
      store.user.safetyEnabled = Boolean(payload.safetyEnabled);
    }
    return store.user;
  }

  const activeDb = requirePostgresDb();
  await activeDb
    .update(users)
    .set({
      theme: payload.theme,
      educationalPrompts: payload.educationalPrompts,
      safetyEnabled: payload.safetyEnabled,
      updatedAt: new Date(),
    })
    .where(eq(users.uid, uid));
  return payload;
}

/**
 * Deletes all user-owned data inside a single transaction.
 * In 'postgres' mode, database failures are NEVER swallowed and never return { deleted: true } on error.
 */
export async function deleteAccountData(uid: string): Promise<{ deleted: true }> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    memoryUserWorkspaces.delete(uid);
    memoryCustomUserMaterials = memoryCustomUserMaterials.filter(
      (m) => !(m.scope === 'USER' && m.ownerUid === uid)
    );
    return { deleted: true };
  }

  const activeDb = requirePostgresDb();
  await activeDb.transaction(async (tx) => {
    await tx.delete(evaluations).where(eq(evaluations.userUid, uid));
    await tx
      .delete(materialUsageReviews)
      .where(eq(materialUsageReviews.userUid, uid));
    await tx.delete(experiments).where(eq(experiments.userUid, uid));
    await tx.delete(scentMemories).where(eq(scentMemories.userUid, uid));
    await tx.delete(formulaVersions).where(eq(formulaVersions.userUid, uid));
    await tx.delete(formulas).where(eq(formulas.userUid, uid));
    await tx.delete(accordVersions).where(eq(accordVersions.userUid, uid));
    await tx.delete(accords).where(eq(accords.userUid, uid));
    await tx.delete(projects).where(eq(projects.userUid, uid));
    await tx.delete(userShelf).where(eq(userShelf.userUid, uid));
    await tx
      .delete(materialRegulatoryRecords)
      .where(eq(materialRegulatoryRecords.userUid, uid));
    await tx
      .delete(materialRegulatoryLimits)
      .where(eq(materialRegulatoryLimits.userUid, uid));
    await tx
      .delete(materials)
      .where(and(eq(materials.scope, 'USER'), eq(materials.ownerUid, uid)));
    await tx.delete(suppliers).where(eq(suppliers.userUid, uid));
    await tx.delete(auditLogs).where(eq(auditLogs.userUid, uid));
    await tx.delete(users).where(eq(users.uid, uid));
  });

  return { deleted: true };
}

export const createMaterialRecord = createMaterial;
export const createMaterialInDb = createMaterial;
export const saveFormulaAndVersionInDb = saveFormulaAndVersion;
export const addExperimentEntryInDb = addExperiment;
export const addEvaluationInDb = addEvaluation;
export const upsertScentMemoryInDb = upsertScentMemory;
export const createAccordInDb = createAccord;
export const deleteAccountDataInDb = deleteAccountData;

// ============================================================================
// STAGE 3 BOUNDED REPOSITORY QUERIES & FOCUSED DOMAIN READERS
// ============================================================================

export interface BootstrapResponse {
  user: WorkspacePayload['user'];
  counts: {
    catalog: number;
    shelf: number;
    workbench: number;
    formulas: number;
    accords: number;
    evaluations: number;
    experiments: number;
    scentMemories: number;
  };
  activeFormulaId: number | null;
  activeVersionLabel: string | null;
}

export async function fetchBootstrapInfo(
  uid: string,
  email: string
): Promise<BootstrapResponse> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const { materials: globalMats } = ensureMemoryGlobalCatalogLoaded();
    const store = getOrCreateMemoryUserStore(uid, email);
    const customCount = memoryCustomUserMaterials.filter(
      (m) => m.scope === 'USER' && m.ownerUid === uid
    ).length;
    const shelfArr = Array.from(store.shelfByMaterialId.values());
    const firstFormula = store.formulas[0] || null;
    return {
      user: { ...store.user },
      counts: {
        catalog: globalMats.length + customCount,
        shelf: shelfArr.length,
        workbench: shelfArr.filter((s) => s.isOnWorkbench).length,
        formulas: store.formulas.length,
        accords: store.accords.length,
        evaluations: store.evaluations.length,
        experiments: store.experiments.length,
        scentMemories: store.scentMemories.length,
      },
      activeFormulaId: firstFormula ? firstFormula.id : null,
      activeVersionLabel: firstFormula ? firstFormula.activeVersionLabel : null,
    };
  }

  const activeDb = requirePostgresDb();
  await assertPostgresCatalogInitialized(activeDb);
  const userObj = await ensurePostgresUserRow(uid, email);

  const [
    [catalogRow],
    [shelfRow],
    [workbenchRow],
    [formulasRow],
    [accordsRow],
    [evaluationsRow],
    [experimentsRow],
    [memoriesRow],
    firstFormulaRows,
  ] = await Promise.all([
    activeDb
      .select({ value: count() })
      .from(materials)
      .where(
        or(
          eq(materials.scope, 'GLOBAL'),
          and(eq(materials.scope, 'USER'), eq(materials.ownerUid, uid))
        )
      ),
    activeDb
      .select({ value: count() })
      .from(userShelf)
      .where(eq(userShelf.userUid, uid)),
    activeDb
      .select({ value: count() })
      .from(userShelf)
      .where(
        and(eq(userShelf.userUid, uid), eq(userShelf.isOnWorkbench, true))
      ),
    activeDb
      .select({ value: count() })
      .from(formulas)
      .where(eq(formulas.userUid, uid)),
    activeDb
      .select({ value: count() })
      .from(accords)
      .where(eq(accords.userUid, uid)),
    activeDb
      .select({ value: count() })
      .from(evaluations)
      .where(eq(evaluations.userUid, uid)),
    activeDb
      .select({ value: count() })
      .from(experiments)
      .where(eq(experiments.userUid, uid)),
    activeDb
      .select({ value: count() })
      .from(scentMemories)
      .where(eq(scentMemories.userUid, uid)),
    activeDb
      .select({
        id: formulas.id,
        activeVersionLabel: formulas.activeVersionLabel,
      })
      .from(formulas)
      .where(eq(formulas.userUid, uid))
      .orderBy(formulas.id)
      .limit(1),
  ]);

  const firstFormula = firstFormulaRows[0] || null;
  return {
    user: userObj,
    counts: {
      catalog: Number(catalogRow?.value ?? 0),
      shelf: Number(shelfRow?.value ?? 0),
      workbench: Number(workbenchRow?.value ?? 0),
      formulas: Number(formulasRow?.value ?? 0),
      accords: Number(accordsRow?.value ?? 0),
      evaluations: Number(evaluationsRow?.value ?? 0),
      experiments: Number(experimentsRow?.value ?? 0),
      scentMemories: Number(memoriesRow?.value ?? 0),
    },
    activeFormulaId: firstFormula ? firstFormula.id : null,
    activeVersionLabel: firstFormula
      ? firstFormula.activeVersionLabel || 'V1'
      : null,
  };
}

function mapPgMaterialRowToRawMaterial(
  m: typeof materials.$inferSelect,
  prof?: typeof materialOlfactoryProfiles.$inferSelect | null,
  shelfItem?: UserShelfItem | null
): RawMaterial {
  const isOnShelf = Boolean(shelfItem);
  const isOnWorkbench = Boolean(shelfItem && shelfItem.isOnWorkbench);
  return {
    id: m.id,
    catalogKey: m.catalogKey || undefined,
    scope: (m.scope as 'GLOBAL' | 'USER') || 'GLOBAL',
    ownerUid: m.ownerUid ?? null,
    displayName: m.displayName || m.name,
    name: m.name,
    aliases: m.aliases || '',
    casNumber: m.casNumber || 'Unknown / Not Provided',
    inciName: m.inciName || 'Unknown / Not Provided',
    naturalOrSynthetic:
      (m.naturalOrSynthetic as 'Natural' | 'Synthetic' | 'Base') || 'Synthetic',
    materialKind: m.materialKind || 'SYNTHETIC',
    supplier: shelfItem?.supplierName || m.supplier || '',
    supplierProductCode: m.supplierProductCode || '',
    supplierProductName: shelfItem?.supplierProductName || '',
    manufacturer: m.manufacturer || '',
    primaryFamily: prof?.primaryFamily || m.primaryFamily,
    facets: safeParseArray(prof?.facets || m.facets),
    odorSummary: prof?.odorSummary || m.descriptiveNotes || '',
    roleTopHeartBase: prof?.roleTopHeartBase || m.volatility,
    pyramidUsage: prof?.pyramidUsage || 'UNSPECIFIED',
    pyramidPrimaryZone:
      (prof?.pyramidPrimaryZone as PyramidPrimaryZone) || 'UNSPECIFIED',
    pyramidHighlightTop: Boolean(prof?.pyramidHighlightTop),
    pyramidHighlightHeart: Boolean(prof?.pyramidHighlightHeart),
    pyramidHighlightBase: Boolean(prof?.pyramidHighlightBase),
    pyramidUiCode: (prof?.pyramidUiCode as PyramidUiCode) || 'NA',
    pyramidConfidence:
      (prof?.pyramidConfidence as PyramidConfidence) || 'UNKNOWN',
    pyramidBasis: prof?.pyramidBasis || 'UNSPECIFIED',
    pyramidNote: prof?.pyramidNote || '',
    olfactoryStrength: prof?.olfactoryStrength || 'MEDIUM',
    intensity: prof?.intensity ?? m.intensity ?? 7,
    substantivityHours: prof?.substantivityHours ?? m.substantivityHours ?? 24,
    diffusion: prof?.diffusion ?? m.diffusion ?? 7,
    volatility: (prof?.volatility || m.volatility) as VolatilityTier,
    descriptiveNotes: prof?.descriptiveNotes || m.descriptiveNotes || '',
    texture: prof?.texture || m.texture || '',
    temperatureImpression:
      prof?.temperatureImpression || m.temperatureImpression || 'Neutral',
    personalNotes: shelfItem
      ? shelfItem.personalNotes
      : m.scope === 'USER'
      ? m.personalNotes || ''
      : '',
    purity: m.purity || 'Unknown / Not Provided',
    density: m.density ?? 1.0,
    recommendedDilution: m.recommendedDilution ?? 100,
    workingDilutionPct: shelfItem?.workingDilutionPct ?? null,
    storageInfo: m.storageInfo || '',
    shelfLifeMonths: m.shelfLifeMonths ?? 24,
    flashPointCelsius: m.flashPointCelsius ?? null,
    educationalObserve: safeParseArray(
      prof?.educationalObserve || m.educationalObserve
    ),
    complements: safeParseArray(prof?.complements || m.complements),
    contrasts: safeParseArray(prof?.contrasts || m.contrasts),
    isSeedData: m.isSeedData ?? false,
    isOnShelf,
    isOnWorkbench,
    pyramidOverrideCode: shelfItem?.pyramidOverrideCode ?? null,
    favorite: Boolean(shelfItem?.favorite),
    costPerGram: m.costPerGram ?? 0.35,
    sourceSection: m.sourceSection || '',
    catalogSource: m.catalogSource || '',
    catalogSourceUrl: m.catalogSourceUrl || '',
    sourceLicense: m.sourceLicense || '',
    sourceLicenseUrl: m.sourceLicenseUrl || '',
    starterPriority: m.starterPriority || 'OPTIONAL',
  };
}

function mapPgLimitRowToDomain(
  r: typeof materialRegulatoryLimits.$inferSelect,
  matRecs?: MaterialRegulatoryRecord[],
  matConsts?: MaterialConstituent[]
): MaterialRegulatoryLimit {
  const verStatus: RegulatoryVerificationStatus =
    r.regulatoryDataStatus === 'PARTIALLY_VERIFIED_OFFICIAL_SOURCES'
      ? 'PARTIALLY_VERIFIED'
      : r.userUid
      ? 'USER_ENTERED_UNVERIFIED'
      : r.isDemoData
      ? 'DEMO'
      : 'LOOKUP_REQUIRED';
  return {
    id: r.id,
    materialId: r.materialId,
    ifraCategory: r.ifraCategory,
    maxAllowedPercent: r.maxAllowedPercent ?? null,
    allergens: r.allergens || 'Unknown / Not Provided',
    restrictions: r.restrictions || '',
    sourceDocument: r.sourceDocument || 'Unknown / Not Provided',
    documentVersion: r.documentVersion || 'Unknown / Not Provided',
    effectiveDate: r.effectiveDate || 'Unknown / Not Provided',
    isDemoData: r.isDemoData ?? true,
    verificationStatus: verStatus,
    ifraStandardStatus: r.ifraStandardStatus || undefined,
    ifraStandardType: r.ifraStandardType || undefined,
    euCosmeticsStatus: r.euCosmeticsStatus || undefined,
    euAnnex: r.euAnnex || undefined,
    euReferenceNo: r.euReferenceNo || undefined,
    euLabelThresholdLeaveOnPct: r.euLabelThresholdLeaveOnPct ?? null,
    euLabelThresholdRinseOffPct: r.euLabelThresholdRinseOffPct ?? null,
    regulatorySources: r.regulatorySources || undefined,
    lastVerifiedDate: r.lastVerifiedDate || undefined,
    euCosmeticLimitPercent: r.euMaxReadyForUsePct ?? null,
    euAllergenDeclarable: r.euLabelThresholdLeaveOnPct !== null,
    ...(matRecs ? { regulatoryRecords: matRecs } : {}),
    ...(matConsts ? { constituents: matConsts } : {}),
  };
}

export interface CatalogQueryOptions {
  uid?: string | null;
  email?: string;
  search?: string;
  family?: string;
  origin?: string;
  noteRole?: string;
  pyramidCode?: string;
  shelfOnly?: boolean;
  workbenchOnly?: boolean;
  includeRegulatory?: boolean;
  limit?: number;
  offset?: number;
}

export interface CatalogQueryResponse {
  totalCatalogMaterials: number;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  items: RawMaterial[];
  materials: RawMaterial[];
  regulatoryLimits: MaterialRegulatoryLimit[];
  regulatoryRecords?: MaterialRegulatoryRecord[];
  constituents?: MaterialConstituent[];
}

export async function queryCatalogMaterials(
  options: CatalogQueryOptions = {}
): Promise<CatalogQueryResponse> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);
  const mode = getPersistenceMode();

  if (mode === 'memory') {
    const {
      materials: globalMats,
      regulatoryLimits: globalLimits,
      regulatoryRecords: globalRecs,
      constituents: globalConsts,
    } = ensureMemoryGlobalCatalogLoaded();

    let allMaterials: RawMaterial[];
    let allLimits: MaterialRegulatoryLimit[];
    let allRecords: MaterialRegulatoryRecord[] = [];
    const allConstituents: MaterialConstituent[] = globalConsts;

    if (options.uid) {
      const store = getOrCreateMemoryUserStore(
        options.uid,
        options.email || `${options.uid}@perfumery.studio`
      );
      const ownedCustomMats = memoryCustomUserMaterials.filter(
        (m) => m.scope === 'USER' && m.ownerUid === options.uid
      );
      allMaterials = mergeCatalogAndShelfForUser(
        globalMats,
        ownedCustomMats,
        store.shelfByMaterialId
      );
      const regMap = new Map<number, MaterialRegulatoryLimit>();
      for (const r of globalLimits) regMap.set(r.materialId, r);
      for (const [mId, ov] of store.userRegulatoryOverrides.entries()) {
        regMap.set(mId, ov);
      }
      allLimits = Array.from(regMap.values());
      if (options.includeRegulatory) {
        allRecords = [...globalRecs, ...store.userRegulatoryRecords];
      }
    } else {
      allMaterials = globalMats;
      allLimits = globalLimits;
      if (options.includeRegulatory) {
        allRecords = globalRecs;
      }
    }

    const totalCatalogMaterials = allMaterials.length;
    const searchLower = (options.search || '').trim().toLowerCase();
    const familyLower = (options.family || '').trim().toLowerCase();
    const originLower = (options.origin || '').trim().toLowerCase();
    const noteRoleLower = (options.noteRole || '').trim().toLowerCase();
    const pyramidUpper = (options.pyramidCode || '').trim().toUpperCase();

    const filtered = allMaterials.filter((m) => {
      if (options.workbenchOnly && !m.isOnWorkbench) return false;
      if (options.shelfOnly && !m.isOnShelf && !m.isOnWorkbench) return false;
      if (
        familyLower &&
        familyLower !== 'all' &&
        m.primaryFamily.toLowerCase() !== familyLower
      ) {
        return false;
      }
      if (
        originLower &&
        originLower !== 'all' &&
        m.naturalOrSynthetic.toLowerCase() !== originLower &&
        (m.materialKind || '').toLowerCase() !== originLower
      ) {
        return false;
      }
      if (
        noteRoleLower &&
        noteRoleLower !== 'all' &&
        m.volatility.toLowerCase() !== noteRoleLower
      ) {
        return false;
      }
      if (pyramidUpper && pyramidUpper !== 'ALL') {
        const effectiveCode = (
          m.pyramidOverrideCode ||
          m.pyramidUiCode ||
          ''
        ).toUpperCase();
        if (effectiveCode !== pyramidUpper) return false;
      }
      if (searchLower) {
        const hay = [
          m.name,
          m.displayName,
          m.casNumber,
          m.inciName,
          m.primaryFamily,
          m.descriptiveNotes,
          ...(m.facets || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const pagedItems = filtered.slice(offset, offset + limit);
    const pagedIds = new Set(pagedItems.map((m) => m.id));
    const pagedLimits = allLimits
      .filter((l) => pagedIds.has(l.materialId))
      .map((l) => {
        if (!options.includeRegulatory) {
          const { regulatoryRecords: _r, constituents: _c, ...light } = l;
          return light;
        }
        return l;
      });

    const response: CatalogQueryResponse = {
      totalCatalogMaterials,
      total,
      limit,
      offset,
      hasMore: offset + pagedItems.length < total,
      items: pagedItems,
      materials: pagedItems,
      regulatoryLimits: pagedLimits,
    };

    if (options.includeRegulatory) {
      response.regulatoryRecords = allRecords.filter((r) =>
        pagedIds.has(r.materialId)
      );
      response.constituents = allConstituents.filter((c) =>
        pagedIds.has(c.materialId)
      );
    }

    return response;
  }

  // PostgreSQL mode: execute filtering, count, and pagination directly in SQL/Drizzle
  const activeDb = requirePostgresDb();
  const totalCatalogMaterials = await assertPostgresCatalogInitialized(activeDb);

  const scopeClause = options.uid
    ? or(
        eq(materials.scope, 'GLOBAL'),
        and(eq(materials.scope, 'USER'), eq(materials.ownerUid, options.uid))
      )
    : eq(materials.scope, 'GLOBAL');

  const conditions: any[] = [scopeClause];

  let shelfByMatId = new Map<number, UserShelfItem>();
  if (options.uid || options.shelfOnly || options.workbenchOnly) {
    const uidToLoad = options.uid || '';
    if (uidToLoad) {
      const shelfItems = await getUserShelf(uidToLoad);
      shelfByMatId = new Map(shelfItems.map((s) => [s.materialId, s]));
    }
    if (options.workbenchOnly) {
      const wbIds = Array.from(shelfByMatId.values())
        .filter((s) => s.isOnWorkbench)
        .map((s) => s.materialId);
      if (wbIds.length === 0) {
        return {
          totalCatalogMaterials,
          total: 0,
          limit,
          offset,
          hasMore: false,
          items: [],
          materials: [],
          regulatoryLimits: [],
        };
      }
      conditions.push(inArray(materials.id, wbIds));
    } else if (options.shelfOnly) {
      const shIds = Array.from(shelfByMatId.keys());
      if (shIds.length === 0) {
        return {
          totalCatalogMaterials,
          total: 0,
          limit,
          offset,
          hasMore: false,
          items: [],
          materials: [],
          regulatoryLimits: [],
        };
      }
      conditions.push(inArray(materials.id, shIds));
    }
  }

  const familyTrimmed = (options.family || '').trim();
  if (familyTrimmed && familyTrimmed.toLowerCase() !== 'all') {
    conditions.push(ilike(materials.primaryFamily, familyTrimmed));
  }

  const originTrimmed = (options.origin || '').trim();
  if (originTrimmed && originTrimmed.toLowerCase() !== 'all') {
    conditions.push(
      or(
        ilike(materials.naturalOrSynthetic, originTrimmed),
        ilike(materials.materialKind, originTrimmed)
      )
    );
  }

  const noteRoleTrimmed = (options.noteRole || '').trim();
  if (noteRoleTrimmed && noteRoleTrimmed.toLowerCase() !== 'all') {
    conditions.push(ilike(materials.volatility, noteRoleTrimmed));
  }

  const pyramidTrimmed = (options.pyramidCode || '').trim().toUpperCase();
  if (pyramidTrimmed && pyramidTrimmed !== 'ALL') {
    conditions.push(eq(materialOlfactoryProfiles.pyramidUiCode, pyramidTrimmed));
  }

  const searchTrimmed = (options.search || '').trim();
  if (searchTrimmed) {
    const pattern = `%${searchTrimmed}%`;
    conditions.push(
      or(
        ilike(materials.name, pattern),
        ilike(materials.displayName, pattern),
        ilike(materials.casNumber, pattern),
        ilike(materials.inciName, pattern),
        ilike(materials.primaryFamily, pattern),
        ilike(materials.descriptiveNotes, pattern),
        ilike(materials.facets, pattern)
      )
    );
  }

  const whereCondition = and(...conditions);

  const [countRow] = await activeDb
    .select({ value: count() })
    .from(materials)
    .leftJoin(
      materialOlfactoryProfiles,
      eq(materials.id, materialOlfactoryProfiles.materialId)
    )
    .where(whereCondition);

  const total = Number(countRow?.value ?? 0);
  if (total === 0) {
    return {
      totalCatalogMaterials,
      total: 0,
      limit,
      offset,
      hasMore: false,
      items: [],
      materials: [],
      regulatoryLimits: [],
    };
  }

  const joinedRows = await activeDb
    .select({
      material: materials,
      profile: materialOlfactoryProfiles,
    })
    .from(materials)
    .leftJoin(
      materialOlfactoryProfiles,
      eq(materials.id, materialOlfactoryProfiles.materialId)
    )
    .where(whereCondition)
    .orderBy(materials.id)
    .limit(limit)
    .offset(offset);

  const pagedItems: RawMaterial[] = joinedRows.map(({ material, profile }) =>
    mapPgMaterialRowToRawMaterial(
      material,
      profile,
      shelfByMatId.get(material.id) || null
    )
  );

  const pagedIds = pagedItems.map((m) => m.id);
  const limitRows =
    pagedIds.length > 0
      ? await activeDb
          .select()
          .from(materialRegulatoryLimits)
          .where(
            and(
              inArray(materialRegulatoryLimits.materialId, pagedIds),
              options.uid
                ? or(
                    isNull(materialRegulatoryLimits.userUid),
                    eq(materialRegulatoryLimits.userUid, options.uid)
                  )
                : isNull(materialRegulatoryLimits.userUid)
            )
          )
      : [];

  const limitByMatId = new Map<number, MaterialRegulatoryLimit>();
  for (const r of limitRows) {
    const existing = limitByMatId.get(r.materialId);
    if (existing && !r.userUid) continue;
    limitByMatId.set(r.materialId, mapPgLimitRowToDomain(r));
  }

  const response: CatalogQueryResponse = {
    totalCatalogMaterials,
    total,
    limit,
    offset,
    hasMore: offset + pagedItems.length < total,
    items: pagedItems,
    materials: pagedItems,
    regulatoryLimits: Array.from(limitByMatId.values()),
  };

  if (options.includeRegulatory && pagedIds.length > 0) {
    const recRows = await activeDb
      .select()
      .from(materialRegulatoryRecords)
      .where(
        and(
          inArray(materialRegulatoryRecords.materialId, pagedIds),
          options.uid
            ? or(
                isNull(materialRegulatoryRecords.userUid),
                eq(materialRegulatoryRecords.userUid, options.uid)
              )
            : isNull(materialRegulatoryRecords.userUid)
        )
      );
    const constRows = await activeDb
      .select()
      .from(materialConstituents)
      .where(inArray(materialConstituents.materialId, pagedIds));

    response.regulatoryRecords = recRows.map((rec) => ({
      id: rec.id,
      materialId: rec.materialId,
      userUid: rec.userUid,
      jurisdiction: rec.jurisdiction,
      authority: rec.authority as RegulatoryAuthority,
      ruleType: rec.ruleType as RegulatoryRuleType,
      status: rec.status,
      standardOrAnnex: rec.standardOrAnnex,
      referenceNumber: rec.referenceNumber,
      productCategory: rec.productCategory ?? null,
      maxFinishedProductPct: rec.maxFinishedProductPct ?? null,
      maxReadyForUsePct: rec.maxReadyForUsePct ?? null,
      labelThresholdLeaveOnPct: rec.labelThresholdLeaveOnPct ?? null,
      labelThresholdRinseOffPct: rec.labelThresholdRinseOffPct ?? null,
      conditionText: rec.conditionText || '',
      summary: rec.summary || '',
      sourceUrl: rec.sourceUrl || '',
      sourceDocument: rec.sourceDocument || '',
      sourceVersion: rec.sourceVersion || '',
      verifiedAt: rec.verifiedAt ?? null,
      verificationStatus: rec.verificationStatus as RegulatoryVerificationStatus,
    }));

    response.constituents = constRows.map((c) => ({
      id: c.id,
      materialId: c.materialId,
      constituentName: c.constituentName,
      constituentCas: c.constituentCas || '',
      typicalPct: c.typicalPct ?? null,
      minPct: c.minPct ?? null,
      maxPct: c.maxPct ?? null,
      labelThresholdLeaveOnPct: c.labelThresholdLeaveOnPct ?? 0.001,
      labelThresholdRinseOffPct: c.labelThresholdRinseOffPct ?? 0.01,
      riskNote: c.riskNote || '',
      sourceUrl: c.sourceUrl || '',
      sourceDocument: c.sourceDocument || '',
      verificationStatus: c.verificationStatus as RegulatoryVerificationStatus,
    }));
  }

  return response;
}

export interface MaterialDetailResponse {
  material: RawMaterial;
  regulatoryLimit: MaterialRegulatoryLimit | null;
  usageReviews: MaterialUsageReview[];
}

export async function getCatalogMaterialDetail(
  materialId: number,
  uid?: string | null,
  email?: string
): Promise<MaterialDetailResponse> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const { materials: globalMats, regulatoryLimits: globalLimits } =
      ensureMemoryGlobalCatalogLoaded();
    if (uid) {
      const store = getOrCreateMemoryUserStore(
        uid,
        email || `${uid}@perfumery.studio`
      );
      const ownedCustomMats = memoryCustomUserMaterials.filter(
        (m) => m.scope === 'USER' && m.ownerUid === uid
      );
      const hydrated = mergeCatalogAndShelfForUser(
        globalMats,
        ownedCustomMats,
        store.shelfByMaterialId
      );
      const mat = hydrated.find((m) => m.id === materialId);
      if (!mat) {
        throw new Error(`NotFound: Material #${materialId} not found.`);
      }
      const limit =
        store.userRegulatoryOverrides.get(materialId) ||
        globalLimits.find((r) => r.materialId === materialId) ||
        null;
      const reviews = store.usageReviews.filter(
        (u) => u.materialId === materialId
      );
      return {
        material: mat,
        regulatoryLimit: limit,
        usageReviews: reviews,
      };
    }

    const mat = globalMats.find((m) => m.id === materialId);
    if (!mat) {
      throw new Error(`NotFound: Material #${materialId} not found.`);
    }
    const limit =
      globalLimits.find((r) => r.materialId === materialId) || null;
    return {
      material: mat,
      regulatoryLimit: limit,
      usageReviews: [],
    };
  }

  const activeDb = requirePostgresDb();
  await assertPostgresCatalogInitialized(activeDb);

  const [matRow] = await activeDb
    .select()
    .from(materials)
    .where(
      and(
        eq(materials.id, materialId),
        uid
          ? or(
              eq(materials.scope, 'GLOBAL'),
              and(eq(materials.scope, 'USER'), eq(materials.ownerUid, uid))
            )
          : eq(materials.scope, 'GLOBAL')
      )
    );

  if (!matRow) {
    throw new Error(`NotFound: Material #${materialId} not found.`);
  }

  const [profRow] = await activeDb
    .select()
    .from(materialOlfactoryProfiles)
    .where(eq(materialOlfactoryProfiles.materialId, materialId));

  let shelfEntry: UserShelfItem | null = null;
  let reviews: MaterialUsageReview[] = [];
  if (uid) {
    const userShelfList = await getUserShelf(uid);
    shelfEntry =
      userShelfList.find((s) => s.materialId === materialId) || null;
    const rawRevs = await activeDb
      .select()
      .from(materialUsageReviews)
      .where(
        and(
          eq(materialUsageReviews.userUid, uid),
          eq(materialUsageReviews.materialId, materialId)
        )
      );
    reviews = rawRevs.map((rev) => ({
      id: rev.id,
      materialId: rev.materialId,
      formulaId: rev.formulaId,
      formulaVersionId: rev.formulaVersionId ?? null,
      formulaName: rev.formulaName,
      versionLabel: rev.versionLabel,
      percentageUsed: rev.percentageUsed,
      effectivenessScore: rev.effectivenessScore ?? 8,
      observation: rev.observation || '',
      createdAt: rev.createdAt
        ? rev.createdAt.toISOString().slice(0, 10)
        : '2026-10-20',
    }));
  }

  const limitRows = await activeDb
    .select()
    .from(materialRegulatoryLimits)
    .where(
      and(
        eq(materialRegulatoryLimits.materialId, materialId),
        uid
          ? or(
              isNull(materialRegulatoryLimits.userUid),
              eq(materialRegulatoryLimits.userUid, uid)
            )
          : isNull(materialRegulatoryLimits.userUid)
      )
    );

  const chosenLimitRow =
    limitRows.find((r) => r.userUid === uid) || limitRows[0] || null;

  return {
    material: mapPgMaterialRowToRawMaterial(matRow, profRow, shelfEntry),
    regulatoryLimit: chosenLimitRow
      ? mapPgLimitRowToDomain(chosenLimitRow)
      : null,
    usageReviews: reviews,
  };
}

export interface MaterialRegulatoryDossierResponse {
  materialId: number;
  materialName: string;
  casNumber: string;
  verificationStatus: RegulatoryVerificationStatus;
  regulatoryLimit: MaterialRegulatoryLimit | null;
  regulatoryRecords: MaterialRegulatoryRecord[];
  constituents: MaterialConstituent[];
}

export async function getCatalogMaterialRegulatoryDossier(
  materialId: number,
  uid?: string | null,
  email?: string
): Promise<MaterialRegulatoryDossierResponse> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const {
      materials: globalMats,
      regulatoryLimits: globalLimits,
      regulatoryRecords: globalRecs,
      constituents: globalConsts,
    } = ensureMemoryGlobalCatalogLoaded();

    if (uid) {
      const store = getOrCreateMemoryUserStore(
        uid,
        email || `${uid}@perfumery.studio`
      );
      const ownedCustomMats = memoryCustomUserMaterials.filter(
        (m) => m.scope === 'USER' && m.ownerUid === uid
      );
      const mat = [...globalMats, ...ownedCustomMats].find(
        (m) => m.id === materialId
      );
      if (!mat) {
        throw new Error(`NotFound: Material #${materialId} not found.`);
      }
      const limit =
        store.userRegulatoryOverrides.get(materialId) ||
        globalLimits.find((r) => r.materialId === materialId) ||
        null;
      const records = [
        ...globalRecs.filter((r) => r.materialId === materialId),
        ...store.userRegulatoryRecords.filter((r) => r.materialId === materialId),
      ];
      const constituents = globalConsts.filter(
        (c) => c.materialId === materialId
      );
      const verificationStatus: RegulatoryVerificationStatus =
        limit?.verificationStatus ||
        records[0]?.verificationStatus ||
        'LOOKUP_REQUIRED';
      return {
        materialId: mat.id,
        materialName: mat.name,
        casNumber: mat.casNumber,
        verificationStatus,
        regulatoryLimit: limit,
        regulatoryRecords: records,
        constituents,
      };
    }

    const mat = globalMats.find((m) => m.id === materialId);
    if (!mat) {
      throw new Error(`NotFound: Material #${materialId} not found.`);
    }
    const limit =
      globalLimits.find((r) => r.materialId === materialId) || null;
    const records = globalRecs.filter((r) => r.materialId === materialId);
    const constituents = globalConsts.filter(
      (c) => c.materialId === materialId
    );
    const verificationStatus: RegulatoryVerificationStatus =
      limit?.verificationStatus ||
      records[0]?.verificationStatus ||
      'LOOKUP_REQUIRED';
    return {
      materialId: mat.id,
      materialName: mat.name,
      casNumber: mat.casNumber,
      verificationStatus,
      regulatoryLimit: limit,
      regulatoryRecords: records,
      constituents,
    };
  }

  const activeDb = requirePostgresDb();
  await assertPostgresCatalogInitialized(activeDb);

  const [matRow] = await activeDb
    .select()
    .from(materials)
    .where(
      and(
        eq(materials.id, materialId),
        uid
          ? or(
              eq(materials.scope, 'GLOBAL'),
              and(eq(materials.scope, 'USER'), eq(materials.ownerUid, uid))
            )
          : eq(materials.scope, 'GLOBAL')
      )
    );

  if (!matRow) {
    throw new Error(`NotFound: Material #${materialId} not found.`);
  }

  const [limitRows, recRows, constRows] = await Promise.all([
    activeDb
      .select()
      .from(materialRegulatoryLimits)
      .where(
        and(
          eq(materialRegulatoryLimits.materialId, materialId),
          uid
            ? or(
                isNull(materialRegulatoryLimits.userUid),
                eq(materialRegulatoryLimits.userUid, uid)
              )
            : isNull(materialRegulatoryLimits.userUid)
        )
      ),
    activeDb
      .select()
      .from(materialRegulatoryRecords)
      .where(
        and(
          eq(materialRegulatoryRecords.materialId, materialId),
          uid
            ? or(
                isNull(materialRegulatoryRecords.userUid),
                eq(materialRegulatoryRecords.userUid, uid)
              )
            : isNull(materialRegulatoryRecords.userUid)
        )
      ),
    activeDb
      .select()
      .from(materialConstituents)
      .where(eq(materialConstituents.materialId, materialId)),
  ]);

  const mappedRecords: MaterialRegulatoryRecord[] = recRows.map((rec) => ({
    id: rec.id,
    materialId: rec.materialId,
    userUid: rec.userUid,
    jurisdiction: rec.jurisdiction,
    authority: rec.authority as RegulatoryAuthority,
    ruleType: rec.ruleType as RegulatoryRuleType,
    status: rec.status,
    standardOrAnnex: rec.standardOrAnnex,
    referenceNumber: rec.referenceNumber,
    productCategory: rec.productCategory ?? null,
    maxFinishedProductPct: rec.maxFinishedProductPct ?? null,
    maxReadyForUsePct: rec.maxReadyForUsePct ?? null,
    labelThresholdLeaveOnPct: rec.labelThresholdLeaveOnPct ?? null,
    labelThresholdRinseOffPct: rec.labelThresholdRinseOffPct ?? null,
    conditionText: rec.conditionText || '',
    summary: rec.summary || '',
    sourceUrl: rec.sourceUrl || '',
    sourceDocument: rec.sourceDocument || '',
    sourceVersion: rec.sourceVersion || '',
    verifiedAt: rec.verifiedAt ?? null,
    verificationStatus: rec.verificationStatus as RegulatoryVerificationStatus,
  }));

  const mappedConstituents: MaterialConstituent[] = constRows.map((c) => ({
    id: c.id,
    materialId: c.materialId,
    constituentName: c.constituentName,
    constituentCas: c.constituentCas || '',
    typicalPct: c.typicalPct ?? null,
    minPct: c.minPct ?? null,
    maxPct: c.maxPct ?? null,
    labelThresholdLeaveOnPct: c.labelThresholdLeaveOnPct ?? 0.001,
    labelThresholdRinseOffPct: c.labelThresholdRinseOffPct ?? 0.01,
    riskNote: c.riskNote || '',
    sourceUrl: c.sourceUrl || '',
    sourceDocument: c.sourceDocument || '',
    verificationStatus: c.verificationStatus as RegulatoryVerificationStatus,
  }));

  const chosenLimitRow =
    limitRows.find((r) => r.userUid === uid) || limitRows[0] || null;
  const domainLimit = chosenLimitRow
    ? mapPgLimitRowToDomain(chosenLimitRow, mappedRecords, mappedConstituents)
    : null;

  const verificationStatus: RegulatoryVerificationStatus =
    domainLimit?.verificationStatus ||
    mappedRecords[0]?.verificationStatus ||
    'LOOKUP_REQUIRED';

  return {
    materialId: matRow.id,
    materialName: matRow.name,
    casNumber: matRow.casNumber || 'Unknown / Not Provided',
    verificationStatus,
    regulatoryLimit: domainLimit,
    regulatoryRecords: mappedRecords,
    constituents: mappedConstituents,
  };
}

export async function getUserFormulas(uid: string): Promise<Formula[]> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    return structuredClone(store.formulas);
  }

  const activeDb = requirePostgresDb();
  const rawFormulas = await activeDb
    .select()
    .from(formulas)
    .where(eq(formulas.userUid, uid))
    .orderBy(formulas.id);

  if (rawFormulas.length === 0) {
    return [];
  }

  const rawVersions = await activeDb
    .select()
    .from(formulaVersions)
    .where(eq(formulaVersions.userUid, uid));

  const versionIds = rawVersions.map((v) => v.id);
  const rawFormulaVersionItems =
    versionIds.length > 0
      ? await activeDb
          .select()
          .from(formulaVersionItems)
          .where(inArray(formulaVersionItems.formulaVersionId, versionIds))
      : [];

  return rawFormulas.map((f) => {
    const fVers = rawVersions
      .filter((v) => v.formulaId === f.id)
      .sort((a, b) => a.id - b.id);
    return {
      id: f.id,
      projectId: f.projectId || 1,
      projectName: f.projectName || 'Personal Study',
      name: f.name,
      status: (f.status as FormulaStatus) || 'Draft',
      description: f.description || '',
      intendedProduct: f.intendedProduct || 'Eau de Parfum (20% conc.)',
      ifraCategory: f.ifraCategory || 'Category 4 (Fine Fragrance)',
      finalProductConcentration: f.finalProductConcentration ?? 20,
      targetBrief: f.targetBrief || '',
      targetFamilies: safeParseArray(f.targetFamilies),
      targetFacets: safeParseObject(f.targetFacetsJson, {}),
      targetIntensity: f.targetIntensity ?? 7,
      targetTexture: f.targetTexture || '',
      targetAtmosphere: f.targetAtmosphere || '',
      targetTemperature: f.targetTemperature || 'Neutral',
      targetColor: f.targetColor || '#2E6F40',
      targetMood: f.targetMood || '',
      targetDiffusion: f.targetDiffusion ?? 7,
      targetEvolution: f.targetEvolution || '',
      targetDrydown: f.targetDrydown || '',
      materialsToAvoid: safeParseArray(f.materialsToAvoid),
      isFavorite: f.isFavorite ?? false,
      tags: safeParseArray(f.tags),
      activeVersionLabel: f.activeVersionLabel || 'V1',
      createdAt: f.createdAt ? f.createdAt.toISOString().slice(0, 10) : '2026-10-10',
      updatedAt: f.updatedAt ? f.updatedAt.toISOString().slice(0, 10) : '2026-10-22',
      versions: fVers.map((v): FormulaVersion => {
        const dbNormRows = rawFormulaVersionItems
          .filter((it) => it.formulaVersionId === v.id)
          .sort((a, b) => a.lineOrder - b.lineOrder);

        if (dbNormRows.length > 0) {
          const normalizedItems: NormalizedFormulaVersionItem[] = dbNormRows.map(
            (r) => ({
              id: r.id,
              formulaVersionId: r.formulaVersionId,
              lineOrder: r.lineOrder,
              itemType: (r.itemType as 'MATERIAL' | 'ACCORD') || 'MATERIAL',
              materialId: r.materialId ?? null,
              accordId: r.accordId ?? null,
              accordVersionId: r.accordVersionId ?? null,
              name: r.name,
              percentage: r.percentage,
              quantityGrams: r.quantityGrams,
              dilutionPct: r.dilutionPct,
              solvent: r.solvent,
              activeMaterialPct: r.activeMaterialPct,
              supplier: r.supplier,
              costPerGram: r.costPerGram,
              notes: r.notes,
              createdAt: r.createdAt
                ? r.createdAt.toISOString()
                : new Date().toISOString(),
            })
          );

          const items: FormulaLineItem[] = normalizedItems.map((n) => ({
            id: `line-${n.id}`,
            lineOrder: n.lineOrder,
            type: n.itemType === 'ACCORD' ? 'accord' : 'material',
            itemType: n.itemType,
            materialId: n.materialId ?? undefined,
            accordId: n.accordId ?? undefined,
            accordVersionId: n.accordVersionId,
            name: n.name,
            percentage: n.percentage,
            quantityGrams: n.quantityGrams,
            dilutionPercent: n.dilutionPct,
            solvent: n.solvent,
            activeMaterialPercent: n.activeMaterialPct,
            supplier: n.supplier,
            costPerGram: n.costPerGram,
            notes: n.notes,
          }));

          return {
            id: v.id,
            formulaId: v.formulaId,
            parentVersionId: v.parentVersionId ?? null,
            versionLabel: v.versionLabel,
            status: (v.status as 'Draft' | 'Committed') || 'Committed',
            versionNotes: v.versionNotes || '',
            maturationDays: v.maturationDays ?? 14,
            items,
            normalizedItems,
            createdAt: v.createdAt
              ? v.createdAt.toISOString().slice(0, 10)
              : '2026-10-15',
          };
        }

        return {
          id: v.id,
          formulaId: v.formulaId,
          parentVersionId: v.parentVersionId ?? null,
          versionLabel: v.versionLabel,
          status: (v.status as 'Draft' | 'Committed') || 'Committed',
          versionNotes: v.versionNotes || '',
          maturationDays: v.maturationDays ?? 14,
          items: safeParseObject(v.itemsJson, []),
          createdAt: v.createdAt
            ? v.createdAt.toISOString().slice(0, 10)
            : '2026-10-15',
        };
      }),
    };
  });
}

export async function getUserFormulaById(
  uid: string,
  formulaId: number
): Promise<Formula> {
  const all = await getUserFormulas(uid);
  const found = all.find((f) => f.id === formulaId);
  if (!found) {
    throw new Error(`NotFound: Formula #${formulaId} not found.`);
  }
  return found;
}

export async function getUserAccords(uid: string): Promise<AccordDefinition[]> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    return structuredClone(store.accords);
  }

  const activeDb = requirePostgresDb();
  const rawAccords = await activeDb
    .select()
    .from(accords)
    .where(eq(accords.userUid, uid))
    .orderBy(accords.id);

  if (rawAccords.length === 0) {
    return [];
  }

  const rawAccordVersions = await activeDb
    .select()
    .from(accordVersions)
    .where(eq(accordVersions.userUid, uid));

  const versionIds = rawAccordVersions.map((v) => v.id);
  const rawAccordVersionItems =
    versionIds.length > 0
      ? await activeDb
          .select()
          .from(accordVersionItems)
          .where(inArray(accordVersionItems.accordVersionId, versionIds))
      : [];

  return rawAccords.map((acc) => {
    const accVers = rawAccordVersions
      .filter((v) => v.accordId === acc.id)
      .sort((a, b) => a.id - b.id);

    const versionSnapshots: AccordVersionSnapshot[] = accVers.map((v) => {
      const vItems = rawAccordVersionItems
        .filter((it) => it.accordVersionId === v.id)
        .sort((a, b) => a.lineOrder - b.lineOrder)
        .map((it) => ({
          id: it.id,
          lineOrder: it.lineOrder,
          materialId: it.materialId,
          materialName: it.materialName,
          percentage: it.percentage,
          dilutionPercent: it.dilutionPct ?? 100,
          notes: it.notes || '',
        }));
      return {
        id: v.id,
        accordId: acc.id,
        versionId: `acc-${acc.id}-v${v.id}`,
        versionLabel: v.versionLabel,
        status: (v.status as 'Draft' | 'Committed') || 'Committed',
        createdAt: v.createdAt
          ? v.createdAt.toISOString().slice(0, 16).replace('T', ' ')
          : '2026-10-01 10:00',
        versionNotes: v.versionNotes || '',
        items: vItems.length > 0 ? vItems : safeParseObject(acc.itemsJson, []),
      };
    });

    const activeVerSnap =
      versionSnapshots.find((v) => v.versionLabel === acc.activeVersionLabel) ||
      versionSnapshots[versionSnapshots.length - 1];

    return {
      id: acc.id,
      name: acc.name,
      category: acc.category,
      description: acc.description || '',
      objective: acc.objective || '',
      usageSuggestions: acc.usageSuggestions || '',
      notes: acc.notes || '',
      isEducational: acc.isEducational ?? false,
      activeVersionId: activeVerSnap?.id,
      activeVersionLabel:
        acc.activeVersionLabel || activeVerSnap?.versionLabel || 'V1',
      items: activeVerSnap
        ? activeVerSnap.items
        : safeParseObject(acc.itemsJson, []),
      olfactoryProfile: safeParseObject(acc.olfactoryProfileJson, {}),
      versions: versionSnapshots,
    };
  });
}

export async function getUserExperiments(
  uid: string,
  formulaId?: number | null
): Promise<ExperimentEntry[]> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const list = formulaId
      ? store.experiments.filter((e) => e.formulaId === formulaId)
      : store.experiments;
    return structuredClone(list);
  }

  const activeDb = requirePostgresDb();
  const rows = await activeDb
    .select()
    .from(experiments)
    .where(
      formulaId
        ? and(eq(experiments.userUid, uid), eq(experiments.formulaId, formulaId))
        : eq(experiments.userUid, uid)
    )
    .orderBy(desc(experiments.id));

  return rows.map((exp) => ({
    id: exp.id,
    formulaId: exp.formulaId,
    formulaVersionId: exp.formulaVersionId ?? null,
    formulaVersionLabel: exp.formulaVersionLabel,
    stageLabel: exp.stageLabel,
    observation: exp.observation,
    recordedAt: exp.recordedAt,
  }));
}

export async function getUserEvaluations(
  uid: string,
  formulaId?: number | null
): Promise<SensoryEvaluation[]> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const list = formulaId
      ? store.evaluations.filter((e) => e.formulaId === formulaId)
      : store.evaluations;
    return structuredClone(list);
  }

  const activeDb = requirePostgresDb();
  const rows = await activeDb
    .select()
    .from(evaluations)
    .where(
      formulaId
        ? and(eq(evaluations.userUid, uid), eq(evaluations.formulaId, formulaId))
        : eq(evaluations.userUid, uid)
    )
    .orderBy(desc(evaluations.id));

  return rows.map((ev) => ({
    id: ev.id,
    formulaId: ev.formulaId,
    formulaVersionId: ev.formulaVersionId ?? null,
    formulaVersionLabel: ev.formulaVersionLabel,
    checkpoint: ev.checkpoint,
    overallScore: ev.overallScore ?? 8,
    scores: safeParseObject(ev.scoresJson, {
      opening: 8,
      heart: 8,
      drydown: 8,
      diffusion: 8,
      longevity: 8,
    }),
    evaluatedFacets: safeParseObject(ev.evaluatedFacetsJson, {}),
    openingNotes: ev.openingNotes || '',
    heartNotes: ev.heartNotes || '',
    drydownNotes: ev.drydownNotes || '',
    voiceTranscript: ev.voiceTranscript || '',
    voiceDurationSeconds: ev.voiceDurationSeconds ?? 0,
    createdAt: ev.createdAt
      ? ev.createdAt.toISOString().slice(0, 16).replace('T', ' ')
      : '2026-10-20 10:00',
  }));
}

export async function getUserScentMemories(
  uid: string,
  materialId?: number | null
): Promise<ScentMemoryRecord[]> {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const list = materialId
      ? store.scentMemories.filter((m) => m.materialId === materialId)
      : store.scentMemories;
    return structuredClone(list);
  }

  const activeDb = requirePostgresDb();
  const rows = await activeDb
    .select()
    .from(scentMemories)
    .where(
      materialId
        ? and(
            eq(scentMemories.userUid, uid),
            eq(scentMemories.materialId, materialId)
          )
        : eq(scentMemories.userUid, uid)
    );

  return rows.map((mem) => ({
    id: mem.id,
    materialId: mem.materialId,
    myPerception: safeParseArray(mem.myPerception),
    associatedMemories: safeParseArray(mem.associatedMemories),
    emotions: safeParseArray(mem.emotions),
    mentalImages: mem.mentalImages || '',
    places: mem.places || '',
    colors: mem.colors || '#2E6F40',
    textures: mem.textures || '',
    temperature: mem.temperature || 'Neutral',
    strengthScore: mem.strengthScore ?? 7,
    familiarityScore: mem.familiarityScore ?? 7,
    blindConfidenceScore: mem.blindConfidenceScore ?? 7,
    recognitionTrials: mem.recognitionTrials ?? 1,
    recognitionCorrect: mem.recognitionCorrect ?? 1,
    lastReviewedAt: mem.lastReviewedAt
      ? mem.lastReviewedAt.toISOString().slice(0, 10)
      : '2026-10-20',
  }));
}

export async function toggleUserWorkbenchPin(
  uid: string,
  materialId: number,
  isOnWorkbench?: boolean
): Promise<UserShelfItem> {
  const shelf = await getUserShelf(uid);
  const existing = shelf.find((s) => s.materialId === materialId);
  if (!existing) {
    return addToUserShelf(uid, materialId, {
      isOnWorkbench: isOnWorkbench ?? true,
    });
  }
  const nextPin =
    isOnWorkbench !== undefined ? isOnWorkbench : !existing.isOnWorkbench;
  return updateUserShelfItem(uid, materialId, { isOnWorkbench: nextPin });
}


