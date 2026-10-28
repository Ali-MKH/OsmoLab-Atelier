import { eq, desc, and, or, isNull } from 'drizzle-orm';
import { getPersistenceMode, requirePostgresDb } from './index.ts';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

async function getOrInitializeWorkspaceInDb(
  uid: string,
  email: string
): Promise<WorkspacePayload> {
  const activeDb = requirePostgresDb();
  const bundle = loadGlobalCatalogV11();

  if (!pgGlobalCatalogSeeded) {
    await activeDb.transaction(async (tx) => {
      await upsertGlobalCatalogInTransaction(tx, bundle);
    });
  }

  await activeDb.transaction(async (tx) => {
    const existingUsers = await tx.select().from(users).where(eq(users.uid, uid));
    if (existingUsers.length > 0) {
      return;
    }

    await tx.insert(users).values({
      uid,
      email,
      displayName: email.split('@')[0] || 'Perfumer',
      theme: 'dark',
      educationalPrompts: true,
      safetyEnabled: true,
    });

    const globalRows = await tx
      .select()
      .from(materials)
      .where(eq(materials.scope, 'GLOBAL'));
    const seedIdToDbMatId = new Map<number, number>();
    for (const [seedIdStr, catKey] of Object.entries(SEED_ID_TO_CATALOG_KEY)) {
      const found = globalRows.find((r) => r.catalogKey === catKey);
      if (found) {
        seedIdToDbMatId.set(Number(seedIdStr), found.id);
      }
    }

    for (const seedId of DEFAULT_STARTER_SHELF_IDS) {
      const dbMatId = seedIdToDbMatId.get(seedId);
      const seedMat = bundle.materials.find((m) => m.id === seedId);
      if (!dbMatId || !seedMat) continue;
      await tx.insert(userShelf).values({
        userUid: uid,
        materialId: dbMatId,
        supplierName: seedMat.supplier || '',
        supplierProductName: seedMat.supplierProductCode || '',
        workingDilutionPct: seedMat.recommendedDilution ?? 100,
        personalNotes: seedMat.personalNotes || '',
        isOnWorkbench: true,
        pyramidOverrideCode: null,
        favorite: false,
      });
    }

    for (const mem of SEED_SCENT_MEMORIES) {
      const dbMatId = seedIdToDbMatId.get(mem.materialId);
      if (!dbMatId) continue;
      await tx.insert(scentMemories).values({
        userUid: uid,
        materialId: dbMatId,
        myPerception: JSON.stringify(mem.myPerception),
        associatedMemories: JSON.stringify(mem.associatedMemories),
        emotions: JSON.stringify(mem.emotions),
        mentalImages: mem.mentalImages,
        places: mem.places,
        colors: mem.colors,
        textures: mem.textures,
        temperature: mem.temperature,
        strengthScore: mem.strengthScore,
        familiarityScore: mem.familiarityScore,
        blindConfidenceScore: mem.blindConfidenceScore,
        recognitionTrials: mem.recognitionTrials,
        recognitionCorrect: mem.recognitionCorrect,
      });
    }

    // Seed Accords + normalized accord_versions + accord_version_items
    const accordIdMap = new Map<number, number>();
    const accordActiveVersionIdMap = new Map<number, number>();
    for (const acc of SEED_ACCORDS) {
      const remappedItems = acc.items.map((item) => ({
        ...item,
        materialId: seedIdToDbMatId.get(item.materialId) || item.materialId,
      }));
      const activeVerLabel = acc.activeVersionLabel || 'V1';
      const [insertedAcc] = await tx
        .insert(accords)
        .values({
          userUid: uid,
          name: acc.name,
          category: acc.category,
          description: acc.description,
          objective: acc.objective,
          usageSuggestions: acc.usageSuggestions,
          notes: acc.notes,
          isEducational: acc.isEducational,
          activeVersionLabel: activeVerLabel,
          itemsJson: JSON.stringify(remappedItems),
          olfactoryProfileJson: JSON.stringify(acc.olfactoryProfile),
        })
        .returning();
      accordIdMap.set(acc.id, insertedAcc.id);

      const versionsToSeed =
        acc.versions && acc.versions.length > 0
          ? acc.versions
          : [
              {
                versionId: `acc-${acc.id}-v1`,
                versionLabel: activeVerLabel,
                createdAt: '2026-10-01 10:00',
                versionNotes: acc.notes || 'Initial accord version',
                items: acc.items,
              },
            ];

      let activeVerDbId: number | null = null;
      for (const ver of versionsToSeed) {
        const [insertedAccVer] = await tx
          .insert(accordVersions)
          .values({
            userUid: uid,
            accordId: insertedAcc.id,
            versionLabel: ver.versionLabel,
            status: 'Committed',
            versionNotes: ver.versionNotes || '',
          })
          .returning();

        if (ver.versionLabel === activeVerLabel || activeVerDbId === null) {
          activeVerDbId = insertedAccVer.id;
        }

        for (let idx = 0; idx < ver.items.length; idx++) {
          const it = ver.items[idx];
          const dbMatId = seedIdToDbMatId.get(it.materialId) || it.materialId;
          await tx.insert(accordVersionItems).values({
            accordVersionId: insertedAccVer.id,
            lineOrder: idx,
            materialId: dbMatId,
            materialName: it.materialName,
            percentage: it.percentage,
            dilutionPct: it.dilutionPercent ?? 100,
            notes: it.notes || '',
          });
        }
      }

      if (activeVerDbId !== null) {
        accordActiveVersionIdMap.set(acc.id, activeVerDbId);
      }
    }

    const [insertedProject] = await tx
      .insert(projects)
      .values({
        userUid: uid,
        name: 'Forest Project',
        description: 'Exploring wet moss, crisp galbanum stems, and airy woody drydowns.',
        status: 'Active',
      })
      .returning();

    // Seed Formulas + formula_versions + normalized formula_version_items
    const formulaIdMap = new Map<number, number>();
    const formulaVersionDbIdMap = new Map<string, number>();

    for (const f of SEED_FORMULAS) {
      const [insertedFormula] = await tx
        .insert(formulas)
        .values({
          userUid: uid,
          projectId: insertedProject.id,
          projectName: f.projectName,
          name: f.name,
          status: f.status,
          description: f.description,
          intendedProduct: f.intendedProduct,
          ifraCategory: f.ifraCategory,
          finalProductConcentration: f.finalProductConcentration,
          targetBrief: f.targetBrief,
          targetFamilies: JSON.stringify(f.targetFamilies),
          targetFacetsJson: JSON.stringify(f.targetFacets),
          targetIntensity: f.targetIntensity,
          targetTexture: f.targetTexture,
          targetAtmosphere: f.targetAtmosphere,
          targetTemperature: f.targetTemperature,
          targetColor: f.targetColor,
          targetMood: f.targetMood,
          targetDiffusion: f.targetDiffusion,
          targetEvolution: f.targetEvolution,
          targetDrydown: f.targetDrydown,
          materialsToAvoid: JSON.stringify(f.materialsToAvoid),
          isFavorite: f.isFavorite,
          tags: JSON.stringify(f.tags),
          activeVersionLabel: f.activeVersionLabel,
        })
        .returning();

      formulaIdMap.set(f.id, insertedFormula.id);

      let prevVersionDbId: number | null = null;
      for (const ver of f.versions) {
        const remappedItems: FormulaLineItem[] = ver.items.map((item) => {
          const isAccord = item.type === 'accord' || item.itemType === 'ACCORD';
          return {
            ...item,
            materialId:
              !isAccord && item.materialId
                ? seedIdToDbMatId.get(item.materialId) || item.materialId
                : undefined,
            accordId:
              isAccord && item.accordId
                ? accordIdMap.get(item.accordId) || item.accordId
                : undefined,
            accordVersionId:
              isAccord && item.accordId
                ? accordActiveVersionIdMap.get(item.accordId) ?? null
                : null,
          };
        });

        const [insertedVer]: Array<{ id: number }> = await tx
          .insert(formulaVersions)
          .values({
            userUid: uid,
            formulaId: insertedFormula.id,
            parentVersionId: prevVersionDbId,
            versionLabel: ver.versionLabel,
            status: ver.status,
            versionNotes: ver.versionNotes,
            maturationDays: ver.maturationDays,
            itemsJson: JSON.stringify(remappedItems),
          })
          .returning();

        prevVersionDbId = insertedVer.id;
        formulaVersionDbIdMap.set(
          `${insertedFormula.id}:${ver.versionLabel}`,
          insertedVer.id
        );

        for (let idx = 0; idx < remappedItems.length; idx++) {
          const item = remappedItems[idx];
          const isAccord = item.type === 'accord' || item.itemType === 'ACCORD';
          await tx.insert(formulaVersionItems).values({
            formulaVersionId: insertedVer.id,
            lineOrder: idx,
            itemType: isAccord ? 'ACCORD' : 'MATERIAL',
            materialId: isAccord ? null : (item.materialId ?? null),
            accordId: isAccord ? (item.accordId ?? null) : null,
            accordVersionId: isAccord ? (item.accordVersionId ?? null) : null,
            name: item.name,
            percentage: item.percentage,
            quantityGrams: item.quantityGrams,
            dilutionPct: item.dilutionPercent ?? 100,
            solvent: item.solvent || 'Neat',
            activeMaterialPct: item.activeMaterialPercent ?? item.percentage,
            supplier: item.supplier || '',
            costPerGram: item.costPerGram ?? 0.35,
            notes: item.notes || '',
          });
        }
      }
    }

    // Seed Experiments with formulaVersionId
    for (const exp of SEED_EXPERIMENTS) {
      const targetFormulaId = formulaIdMap.get(exp.formulaId) || formulaIdMap.get(1);
      if (!targetFormulaId) continue;
      const verDbId =
        formulaVersionDbIdMap.get(`${targetFormulaId}:${exp.formulaVersionLabel}`) ??
        null;
      await tx.insert(experiments).values({
        userUid: uid,
        formulaId: targetFormulaId,
        formulaVersionId: verDbId,
        formulaVersionLabel: exp.formulaVersionLabel,
        stageLabel: exp.stageLabel,
        observation: exp.observation,
        recordedAt: exp.recordedAt,
      });
    }

    // Seed Evaluations with formulaVersionId
    for (const ev of SEED_EVALUATIONS) {
      const targetFormulaId = formulaIdMap.get(ev.formulaId) || formulaIdMap.get(1);
      if (!targetFormulaId) continue;
      const verDbId =
        formulaVersionDbIdMap.get(`${targetFormulaId}:${ev.formulaVersionLabel}`) ??
        null;
      await tx.insert(evaluations).values({
        userUid: uid,
        formulaId: targetFormulaId,
        formulaVersionId: verDbId,
        formulaVersionLabel: ev.formulaVersionLabel,
        checkpoint: ev.checkpoint,
        overallScore: ev.overallScore,
        scoresJson: JSON.stringify(ev.scores),
        evaluatedFacetsJson: JSON.stringify(ev.evaluatedFacets),
        openingNotes: ev.openingNotes,
        heartNotes: ev.heartNotes,
        drydownNotes: ev.drydownNotes,
        voiceTranscript: ev.voiceTranscript,
        voiceDurationSeconds: ev.voiceDurationSeconds,
      });
    }

    // Seed Material Usage Reviews with formulaVersionId
    for (const rev of SEED_USAGE_REVIEWS) {
      const targetFormulaId = formulaIdMap.get(rev.formulaId) || formulaIdMap.get(1);
      const dbMatId = seedIdToDbMatId.get(rev.materialId);
      if (!targetFormulaId || !dbMatId) continue;
      const verDbId =
        formulaVersionDbIdMap.get(`${targetFormulaId}:${rev.versionLabel}`) ?? null;
      await tx.insert(materialUsageReviews).values({
        userUid: uid,
        materialId: dbMatId,
        formulaId: targetFormulaId,
        formulaVersionId: verDbId,
        formulaName: rev.formulaName,
        versionLabel: rev.versionLabel,
        percentageUsed: rev.percentageUsed,
        effectivenessScore: rev.effectivenessScore,
        observation: rev.observation,
      });
    }
  });

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
  const bundle = loadGlobalCatalogV11();
  if (!pgGlobalCatalogSeeded) {
    await activeDb.transaction(async (tx) => {
      await upsertGlobalCatalogInTransaction(tx, bundle);
    });
  }

  const rawMats = await activeDb
    .select()
    .from(materials)
    .where(eq(materials.scope, 'GLOBAL'))
    .orderBy(materials.id);

  return {
    totalCatalogMaterials: rawMats.length || bundle.materials.length,
    materials: bundle.materials,
    regulatoryLimits: bundle.regulatoryLimits,
    regulatoryRecords: bundle.regulatoryRecords,
    constituents: bundle.constituents,
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
      ...inserted,
      activeVersionId: insertedVer.id,
      activeVersionLabel: verLabel,
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
  return await activeDb.transaction(async (tx) => {
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

    const snap = await getOrInitializeWorkspaceInDb(uid, `${uid}@perfumery.studio`);
    return snap.accords.find((a) => a.id === accordId)!;
  });
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
  return inserted;
}

export async function upsertScentMemory(
  uid: string,
  payload: Omit<ScentMemoryRecord, 'id' | 'lastReviewedAt'>
) {
  const mode = getPersistenceMode();
  if (mode === 'memory') {
    const store = getOrCreateMemoryUserStore(uid, `${uid}@perfumery.studio`);
    const today = new Date().toISOString().slice(0, 10);
    const existing = store.scentMemories.find(
      (m) => m.materialId === payload.materialId
    );
    if (existing) {
      Object.assign(existing, payload, { lastReviewedAt: today });
      return { id: existing.id };
    }
    const nextId = Math.max(0, ...store.scentMemories.map((m) => m.id)) + 1;
    store.scentMemories.push({ ...payload, id: nextId, lastReviewedAt: today });
    return { id: nextId };
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
    return { id: existing[0].id };
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
  return { id: inserted.id };
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
