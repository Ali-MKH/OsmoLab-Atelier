import fs from 'fs';
import path from 'path';
import type {
  MaterialConstituent,
  MaterialRegulatoryLimit,
  MaterialRegulatoryRecord,
  PyramidConfidence,
  PyramidPrimaryZone,
  PyramidUiCode,
  RawMaterial,
  RegulatoryVerificationStatus,
  VolatilityTier,
} from '../domain/types.ts';
import { SEED_MATERIALS, SEED_REGULATORY_LIMITS } from '../domain/seed-data.ts';

export interface CatalogV11CsvRow {
  [key: string]: string;
  schema_version: string;
  material_id: string;
  display_name: string;
  source_section: string;
  catalog_source: string;
  catalog_source_url: string;
  source_license: string;
  source_license_url: string;
  my_shelf_default: string;
  shelf_status_default: string;
  material_kind: string;
  cas_number: string;
  inci_name: string;
  primary_family: string;
  facets: string;
  odor_summary: string;
  role_top_heart_base: string;
  pyramid_usage: string;
  pyramid_primary_zone: string;
  pyramid_highlight_top: string;
  pyramid_highlight_heart: string;
  pyramid_highlight_base: string;
  pyramid_ui_code: string;
  pyramid_confidence: string;
  pyramid_basis: string;
  pyramid_note: string;
  olfactory_strength: string;
  starter_priority: string;
  ifra_baseline: string;
  ifra_standard_status: string;
  ifra_standard_type: string;
  ifra_amendment: string;
  ifra_category_4_max_finished_product_pct: string;
  ifra_summary: string;
  eu_cosmetics_status: string;
  eu_annex: string;
  eu_reference_no: string;
  eu_max_ready_for_use_pct: string;
  eu_label_threshold_leave_on_pct: string;
  eu_label_threshold_rinse_off_pct: string;
  eu_summary: string;
  regulatory_data_status: string;
  regulatory_disclaimer: string;
  regulatory_sources: string;
  last_verified_date: string;
}

/**
 * Deterministic mapping between the 18 educational SEED_MATERIALS (IDs 1..18)
 * and their canonical v1.1 `material_id` (`catalogKey`) in `data/catalog/v1.1/materials.csv`.
 */
export const SEED_ID_TO_CATALOG_KEY: Record<number, string> = {
  1: 'mat_97cf3c5c6938', // Bergamot FCF -> Bergamot oil (expressed)
  2: 'mat_32a2b8704132', // Hedione
  3: 'mat_2034976361fd', // Oakmoss Absolute 10% -> Oakmoss absolute (low atranol & chloratranol)
  4: 'mat_5c7a1b097b70', // Ambroxan
  5: 'mat_863caec9e843', // Iso E Super
  6: 'mat_22248dc61c7c', // Violet Leaf Absolute 10% -> Violet leaf absolute
  7: 'mat_58eca36efd96', // Galbanum Oil 10% -> Galbanum oil
  8: 'mat_f94930f4ec12', // Vetiver Haiti EO -> Vetiver oil (Haiti)
  9: 'mat_cf417a2c68ee', // Cashmeran
  10: 'mat_e32b88b5e84b', // Virginia Cedarwood EO -> Cedarwood Virginia oil
  11: 'mat_e6fb3a72d967', // Helvetolide
  12: 'mat_09408d339392', // Cis-3-Hexenol 10% -> (Z)-3-Hexenol
  13: 'mat_86a1029c3d98', // Lavender Essential Oil -> Lavender oil
  14: 'mat_8a43835073dc', // Lemon Essential Oil -> Lemon oil (steam distilled)
  15: 'mat_a806647552ec', // Orange Essential Oil -> Orange cold pressed (Sweet)
  16: 'mat_c65612660a24', // Geranium Essential Oil Egypt -> Geranium oil
  17: 'mat_ad2b39755cbb', // Rose Absolute (Rosa damascena) -> Rose absolute (damascena)
  18: 'mat_fb71be286db1', // Jasmine Grandiflorum -> Jasmine Grandiflorum absolute
};

export const CATALOG_KEY_TO_SEED_ID: Record<string, number> = Object.fromEntries(
  Object.entries(SEED_ID_TO_CATALOG_KEY).map(([idStr, key]) => [key, Number(idStr)])
);

/**
 * Default starter shelf material IDs (the 13 default workbench materials from SEED_MATERIALS)
 */
export const DEFAULT_STARTER_SHELF_IDS: number[] = SEED_MATERIALS.filter(
  (m) => m.isOnWorkbench !== false
).map((m) => m.id);

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsvObjects<T extends Record<string, string>>(csvContent: string): T[] {
  const clean = csvContent.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  const lines = clean.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: T[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCsvLine(line);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (vals[j] ?? '').trim();
    }
    rows.push(obj as T);
  }
  return rows;
}

function mapUiCodeToVolatility(uiCode: string, roleText: string): VolatilityTier {
  const code = (uiCode || '').toUpperCase().trim();
  if (code === 'T') return 'Top';
  if (code === 'TH') return 'Top-Heart';
  if (code === 'H') return 'Heart';
  if (code === 'HB') return 'Heart-Base';
  if (code === 'B') return 'Base';
  if (code === 'THB' || code === 'TB') return 'Heart-Base';

  const role = (roleText || '').toLowerCase();
  if (role.includes('top') && role.includes('heart')) return 'Top-Heart';
  if (role.includes('heart') && role.includes('base')) return 'Heart-Base';
  if (role.includes('top')) return 'Top';
  if (role.includes('base')) return 'Base';
  return 'Heart';
}

function mapMaterialKindToOrigin(kind: string, sourceSection: string): 'Natural' | 'Synthetic' | 'Base' {
  const k = (kind || '').toUpperCase();
  const s = (sourceSection || '').toUpperCase();
  if (k.includes('NATURAL') || s.includes('NATURAL')) return 'Natural';
  if (k.includes('BASE') || k.includes('ACCORD')) return 'Base';
  return 'Synthetic';
}

function mapOlfactoryStrengthToIntensity(strength: string): {
  intensity: number;
  diffusion: number;
  substantivityHours: number;
} {
  const s = (strength || '').toUpperCase();
  if (s === 'VERY_HIGH' || s === 'EXTREME') {
    return { intensity: 9, diffusion: 9, substantivityHours: 120 };
  }
  if (s === 'HIGH' || s === 'STRONG') {
    return { intensity: 8, diffusion: 8, substantivityHours: 72 };
  }
  if (s === 'LOW' || s === 'SUBTLE' || s === 'WEAK') {
    return { intensity: 4, diffusion: 5, substantivityHours: 16 };
  }
  return { intensity: 6, diffusion: 6, substantivityHours: 36 };
}

function parseNullableNumber(val: string | undefined): number | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed.toUpperCase() === 'LOOKUP_REQUIRED' || trimmed.toUpperCase() === 'NA') {
    return null;
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function resolveCsvVerificationStatus(
  csvStatus: string | undefined,
  fallbackDemo: boolean
): RegulatoryVerificationStatus {
  const norm = (csvStatus || '').trim().toUpperCase();
  if (norm === 'VERIFIED_OFFICIAL') return 'VERIFIED_OFFICIAL';
  if (norm === 'PARTIALLY_VERIFIED_OFFICIAL_SOURCES' || norm === 'PARTIALLY_VERIFIED') {
    return 'PARTIALLY_VERIFIED';
  }
  if (norm === 'USER_ENTERED_UNVERIFIED') return 'USER_ENTERED_UNVERIFIED';
  if (fallbackDemo) return 'DEMO';
  return 'LOOKUP_REQUIRED';
}

function buildRegulatoryRecordsAndConstituentsForMaterial(params: {
  materialId: number;
  materialName: string;
  casNumber: string;
  csvRow?: CatalogV11CsvRow;
  seedLimit?: MaterialRegulatoryLimit;
  nextRecordIdRef: { current: number };
  nextConstituentIdRef: { current: number };
}): {
  records: MaterialRegulatoryRecord[];
  constituents: MaterialConstituent[];
  verificationStatus: RegulatoryVerificationStatus;
} {
  const {
    materialId,
    materialName,
    casNumber,
    csvRow,
    seedLimit,
    nextRecordIdRef,
    nextConstituentIdRef,
  } = params;

  const hasOfficialCsv =
    csvRow?.regulatory_data_status === 'PARTIALLY_VERIFIED_OFFICIAL_SOURCES' ||
    csvRow?.regulatory_data_status === 'VERIFIED_OFFICIAL';

  const primaryVerificationStatus = resolveCsvVerificationStatus(
    csvRow?.regulatory_data_status,
    Boolean(seedLimit?.isDemoData && !hasOfficialCsv)
  );

  const records: MaterialRegulatoryRecord[] = [];
  const constituents: MaterialConstituent[] = [];

  const csvCat4Max = parseNullableNumber(csvRow?.ifra_category_4_max_finished_product_pct);
  const effectiveCat4Max =
    seedLimit?.maxAllowedPercent !== undefined && seedLimit?.maxAllowedPercent !== null
      ? seedLimit.maxAllowedPercent
      : csvCat4Max;

  const ifraTypeRaw = (
    csvRow?.ifra_standard_type ||
    seedLimit?.restrictionType ||
    'LOOKUP_REQUIRED'
  ).toUpperCase();

  const ifraStatusRaw = (
    csvRow?.ifra_standard_status ||
    (effectiveCat4Max !== null ? 'RESTRICTED' : 'LOOKUP_REQUIRED')
  ).toUpperCase();

  const ifraRuleType =
    ifraTypeRaw === 'PROHIBITION' || ifraStatusRaw === 'PROHIBITED'
      ? 'PROHIBITION'
      : ifraTypeRaw === 'SPECIFICATION' && effectiveCat4Max === null
      ? 'SPECIFICATION'
      : effectiveCat4Max !== null
      ? 'MAX_USE'
      : 'INFORMATION';

  const sourceUrl = csvRow?.regulatory_sources || '';
  const sourceDoc =
    (hasOfficialCsv ? csvRow?.regulatory_sources : seedLimit?.sourceDocument) ||
    csvRow?.regulatory_sources ||
    seedLimit?.sourceDocument ||
    'Unknown / Not Provided';
  const sourceVer =
    csvRow?.ifra_amendment ||
    seedLimit?.documentVersion ||
    csvRow?.ifra_baseline ||
    'IFRA_51';
  const verifiedAt = csvRow?.last_verified_date || seedLimit?.effectiveDate || null;

  // 1. Primary IFRA Cat 4 record
  records.push({
    id: nextRecordIdRef.current++,
    materialId,
    userUid: null,
    jurisdiction: 'GLOBAL',
    authority: 'IFRA',
    ruleType: ifraRuleType,
    status: ifraStatusRaw,
    standardOrAnnex: csvRow?.ifra_baseline || 'IFRA_51',
    referenceNumber: csvRow?.ifra_amendment || '',
    productCategory: 'Cat 4',
    maxFinishedProductPct: ifraRuleType === 'PROHIBITION' ? 0 : effectiveCat4Max,
    maxReadyForUsePct: null,
    labelThresholdLeaveOnPct: null,
    labelThresholdRinseOffPct: null,
    conditionText:
      seedLimit?.puritySpecifications
        ?.map((p) => `${p.parameter}: ${p.standardLimit}`)
        .join('; ') || '',
    summary:
      csvRow?.ifra_summary ||
      seedLimit?.restrictions ||
      'Safety information unavailable. Manual verification required.',
    sourceUrl,
    sourceDocument: sourceDoc,
    sourceVersion: sourceVer,
    verifiedAt,
    verificationStatus: primaryVerificationStatus,
  });

  // 2. Additional IFRA category records from seedLimit.categoryLimitsTable (excluding Cat 4 duplicate)
  if (seedLimit?.categoryLimitsTable && seedLimit.categoryLimitsTable.length > 0) {
    for (const catRow of seedLimit.categoryLimitsTable) {
      const normCat = catRow.category.trim();
      if (normCat.toLowerCase() === 'cat 4') continue;
      records.push({
        id: nextRecordIdRef.current++,
        materialId,
        userUid: null,
        jurisdiction: 'GLOBAL',
        authority: 'IFRA',
        ruleType: 'MAX_USE',
        status: catRow.maxAllowedPercent !== null ? 'RESTRICTED' : 'LOOKUP_REQUIRED',
        standardOrAnnex: 'IFRA_51',
        referenceNumber: csvRow?.ifra_amendment || '51',
        productCategory: normCat,
        maxFinishedProductPct: catRow.maxAllowedPercent,
        maxReadyForUsePct: null,
        labelThresholdLeaveOnPct: null,
        labelThresholdRinseOffPct: null,
        conditionText: catRow.description || '',
        summary: `${catRow.categoryName}: ${catRow.description}`,
        sourceUrl,
        sourceDocument: seedLimit.sourceDocument || sourceDoc,
        sourceVersion: seedLimit.documentVersion || 'Amendment 51 (DEMO DATA)',
        verifiedAt,
        verificationStatus: catRow.verificationStatus || 'DEMO',
      });
    }
  }

  // 3. Separate EU Cosmetics Regulation records
  const euStatusRaw = (csvRow?.eu_cosmetics_status || '').toUpperCase();
  const euAnnex = csvRow?.eu_annex || (seedLimit?.euRegulationReference ? 'III' : '');
  const euRefNo = csvRow?.eu_reference_no || '';
  const euMaxReadyPct =
    parseNullableNumber(csvRow?.eu_max_ready_for_use_pct) ??
    seedLimit?.euCosmeticLimitPercent ??
    null;
  const euLeaveOnPct =
    parseNullableNumber(csvRow?.eu_label_threshold_leave_on_pct) ??
    (seedLimit?.euAllergenDeclarable ? 0.001 : null);
  const euRinseOffPct =
    parseNullableNumber(csvRow?.eu_label_threshold_rinse_off_pct) ??
    (seedLimit?.euAllergenDeclarable ? 0.01 : null);
  const euSummary =
    csvRow?.eu_summary ||
    seedLimit?.euRegulationReference ||
    'EU Cosmetics Regulation (EC) No 1223/2009';

  if (euStatusRaw === 'PROHIBITED' || euAnnex === 'II') {
    records.push({
      id: nextRecordIdRef.current++,
      materialId,
      userUid: null,
      jurisdiction: 'EU',
      authority: 'EU_COSMETICS',
      ruleType: 'PROHIBITION',
      status: 'PROHIBITED',
      standardOrAnnex: 'ANNEX_II',
      referenceNumber: euRefNo,
      productCategory: null,
      maxFinishedProductPct: null,
      maxReadyForUsePct: 0,
      labelThresholdLeaveOnPct: null,
      labelThresholdRinseOffPct: null,
      conditionText: euSummary,
      summary: euSummary,
      sourceUrl,
      sourceDocument: sourceDoc,
      sourceVersion: 'EC 1223/2009 Annex II',
      verifiedAt,
      verificationStatus: primaryVerificationStatus,
    });
  } else {
    if (euMaxReadyPct !== null) {
      records.push({
        id: nextRecordIdRef.current++,
        materialId,
        userUid: null,
        jurisdiction: 'EU',
        authority: 'EU_COSMETICS',
        ruleType: 'MAX_USE',
        status: euStatusRaw || 'ANNEX_III_RESTRICTED',
        standardOrAnnex: euAnnex ? `ANNEX_${euAnnex}` : 'ANNEX_III',
        referenceNumber: euRefNo,
        productCategory: null,
        maxFinishedProductPct: null,
        maxReadyForUsePct: euMaxReadyPct,
        labelThresholdLeaveOnPct: null,
        labelThresholdRinseOffPct: null,
        conditionText: euSummary,
        summary: euSummary,
        sourceUrl,
        sourceDocument: sourceDoc,
        sourceVersion: 'EC 1223/2009 Annex III',
        verifiedAt,
        verificationStatus: primaryVerificationStatus,
      });
    }

    if (euLeaveOnPct !== null || euRinseOffPct !== null) {
      records.push({
        id: nextRecordIdRef.current++,
        materialId,
        userUid: null,
        jurisdiction: 'EU',
        authority: 'EU_COSMETICS',
        ruleType: 'LABEL_THRESHOLD',
        status: euStatusRaw || 'ANNEX_III_LABEL',
        standardOrAnnex: euAnnex ? `ANNEX_${euAnnex}` : 'ANNEX_III',
        referenceNumber: euRefNo,
        productCategory: null,
        maxFinishedProductPct: null,
        maxReadyForUsePct: null,
        labelThresholdLeaveOnPct: euLeaveOnPct ?? 0.001,
        labelThresholdRinseOffPct: euRinseOffPct ?? 0.01,
        conditionText: 'Mandatory on-pack cosmetic allergen declaration if threshold exceeded.',
        summary: euSummary,
        sourceUrl,
        sourceDocument: sourceDoc,
        sourceVersion: 'Regulation (EU) 2023/1545 / Annex III',
        verifiedAt,
        verificationStatus: primaryVerificationStatus,
      });
    }

    if (
      euStatusRaw === 'ANNEX_III_LABEL_SPEC' ||
      euStatusRaw === 'ANNEX_III_COMPLEX' ||
      (seedLimit?.puritySpecifications && seedLimit.puritySpecifications.length > 0)
    ) {
      records.push({
        id: nextRecordIdRef.current++,
        materialId,
        userUid: null,
        jurisdiction: 'EU',
        authority: 'EU_COSMETICS',
        ruleType: 'SPECIFICATION',
        status: euStatusRaw || 'SPECIFICATION',
        standardOrAnnex: euAnnex ? `ANNEX_${euAnnex}` : 'ANNEX_III',
        referenceNumber: euRefNo,
        productCategory: null,
        maxFinishedProductPct: null,
        maxReadyForUsePct: null,
        labelThresholdLeaveOnPct: null,
        labelThresholdRinseOffPct: null,
        conditionText:
          seedLimit?.puritySpecifications
            ?.map((p) => `${p.parameter}: ${p.standardLimit}`)
            .join('; ') || euSummary,
        summary: euSummary,
        sourceUrl,
        sourceDocument: sourceDoc,
        sourceVersion: 'EC 1223/2009',
        verifiedAt,
        verificationStatus: primaryVerificationStatus,
      });
    }

    if (
      euMaxReadyPct === null &&
      euLeaveOnPct === null &&
      euRinseOffPct === null &&
      euStatusRaw !== 'ANNEX_III_LABEL_SPEC' &&
      euStatusRaw !== 'ANNEX_III_COMPLEX'
    ) {
      records.push({
        id: nextRecordIdRef.current++,
        materialId,
        userUid: null,
        jurisdiction: 'EU',
        authority: 'EU_COSMETICS',
        ruleType: 'INFORMATION',
        status: euStatusRaw || 'LOOKUP_REQUIRED',
        standardOrAnnex: euAnnex ? `ANNEX_${euAnnex}` : 'EU_1223_2009',
        referenceNumber: euRefNo,
        productCategory: null,
        maxFinishedProductPct: null,
        maxReadyForUsePct: null,
        labelThresholdLeaveOnPct: null,
        labelThresholdRinseOffPct: null,
        conditionText: '',
        summary: euSummary,
        sourceUrl,
        sourceDocument: sourceDoc,
        sourceVersion: 'EC 1223/2009',
        verifiedAt,
        verificationStatus: primaryVerificationStatus,
      });
    }
  }

  // 4. Constituents (from seedLimit.allergenBreakdown or direct EU declarable single-molecule CSV rows)
  if (seedLimit?.allergenBreakdown && seedLimit.allergenBreakdown.length > 0) {
    for (const ab of seedLimit.allergenBreakdown) {
      const normName =
        ab.casNumber === '5989-27-5' || ab.name.toLowerCase().includes('limonene')
          ? 'Limonene'
          : ab.casNumber === '5392-40-5' || ab.name.toLowerCase().startsWith('citral')
          ? 'Citral'
          : ab.name;
      constituents.push({
        id: nextConstituentIdRef.current++,
        materialId,
        constituentName: normName,
        constituentCas: ab.casNumber || '',
        typicalPct: ab.typicalPercent ?? null,
        minPct: null,
        maxPct: null,
        labelThresholdLeaveOnPct: ab.euThresholdPercent ?? 0.001,
        labelThresholdRinseOffPct: ab.euThresholdRinseOffPercent ?? 0.01,
        riskNote: ab.riskNote || '',
        sourceUrl,
        sourceDocument: sourceDoc,
        verificationStatus: ab.verificationStatus || primaryVerificationStatus,
      });
    }
  } else if (euLeaveOnPct !== null && casNumber && casNumber !== 'Unknown / Not Provided') {
    // Direct declarable allergen molecule (e.g., Linalool, Citral, Coumarin, Eugenol, Isoeugenol, Cinnamal, etc.)
    constituents.push({
      id: nextConstituentIdRef.current++,
      materialId,
      constituentName: materialName,
      constituentCas: casNumber,
      typicalPct: 100.0,
      minPct: 98.0,
      maxPct: 100.0,
      labelThresholdLeaveOnPct: euLeaveOnPct,
      labelThresholdRinseOffPct: euRinseOffPct ?? 0.01,
      riskNote: 'Direct regulated EU fragrance allergen',
      sourceUrl,
      sourceDocument: sourceDoc,
      verificationStatus: primaryVerificationStatus,
    });
  }

  return {
    records,
    constituents,
    verificationStatus: primaryVerificationStatus,
  };
}

export interface LoadedCatalogBundle {
  materials: RawMaterial[];
  regulatoryLimits: MaterialRegulatoryLimit[];
  regulatoryRecords: MaterialRegulatoryRecord[];
  constituents: MaterialConstituent[];
  csvRowsByCatalogKey: Map<string, CatalogV11CsvRow>;
}

let cachedCatalogBundle: LoadedCatalogBundle | null = null;

export function resolveCatalogCsvPath(fileName = 'materials.csv'): string {
  const primaryPath = path.resolve(process.cwd(), 'data', 'catalog', 'v1.1', fileName);
  if (fs.existsSync(primaryPath)) return primaryPath;

  const fallbackMap: Record<string, string> = {
    'materials.csv': 'perfumery_material_catalog_v1_1_3c081720.csv',
    'regulatory.csv': 'perfumery_regulatory_verified_v1_1_1013e75e.csv',
    'starter-sets.csv': 'perfumery_starter_sets_v1_1_30be9321.csv',
  };
  const fallbackName = fallbackMap[fileName];
  if (fallbackName) {
    const fallbackPath = path.resolve(process.cwd(), 'public', 'assets', 'aistudio', fallbackName);
    if (fs.existsSync(fallbackPath)) return fallbackPath;
  }
  return primaryPath;
}

/**
 * Loads the canonical v1.1 Global Catalog (815 materials) merged with the 18 rich
 * educational materials, distinct IFRA/EU regulatory records, and constituent breakdowns.
 */
export function loadGlobalCatalogV11(forceReload = false): LoadedCatalogBundle {
  if (cachedCatalogBundle && !forceReload) {
    return cachedCatalogBundle;
  }

  const materialsCsvPath = resolveCatalogCsvPath('materials.csv');
  const csvRows: CatalogV11CsvRow[] = fs.existsSync(materialsCsvPath)
    ? parseCsvObjects<CatalogV11CsvRow>(fs.readFileSync(materialsCsvPath, 'utf8'))
    : [];

  const csvRowsByCatalogKey = new Map<string, CatalogV11CsvRow>();
  for (const row of csvRows) {
    if (row.material_id) {
      csvRowsByCatalogKey.set(row.material_id, row);
    }
  }

  const materialsOut: RawMaterial[] = [];
  const regulatoryLimitsOut: MaterialRegulatoryLimit[] = [];
  const regulatoryRecordsOut: MaterialRegulatoryRecord[] = [];
  const constituentsOut: MaterialConstituent[] = [];
  const nextRecordIdRef = { current: 1 };
  const nextConstituentIdRef = { current: 1 };

  // 1. Build IDs 1..18 from SEED_MATERIALS enriched with their canonical v1.1 CSV row
  for (const seedMat of SEED_MATERIALS) {
    const catalogKey = SEED_ID_TO_CATALOG_KEY[seedMat.id] || `mat_seed_${seedMat.id}`;
    const csvRow = csvRowsByCatalogKey.get(catalogKey);

    const alsoCalledSet = new Set<string>(seedMat.alsoCalled || []);
    if (csvRow?.display_name && csvRow.display_name.toLowerCase() !== seedMat.name.toLowerCase()) {
      alsoCalledSet.add(csvRow.display_name);
    }
    const aliasesCombined = Array.from(
      new Set(
        [
          ...(seedMat.aliases ? seedMat.aliases.split(',').map((s) => s.trim()) : []),
          ...(csvRow?.display_name && csvRow.display_name !== seedMat.name ? [csvRow.display_name] : []),
        ].filter(Boolean)
      )
    ).join(', ');

    const mergedMaterial: RawMaterial = {
      ...seedMat,
      id: seedMat.id,
      catalogKey,
      scope: 'GLOBAL',
      ownerUid: null,
      displayName: csvRow?.display_name || seedMat.name,
      name: seedMat.name,
      aliases: aliasesCombined,
      alsoCalled: Array.from(alsoCalledSet),
      casNumber: seedMat.casNumber || csvRow?.cas_number || 'Unknown / Not Provided',
      inciName: seedMat.inciName || csvRow?.inci_name || 'Unknown / Not Provided',
      materialKind:
        csvRow?.material_kind ||
        (seedMat.naturalOrSynthetic === 'Natural' ? 'NATURAL_COMPLEX' : 'SYNTHETIC_MOLECULE'),
      odorSummary: csvRow?.odor_summary || seedMat.descriptiveNotes,
      roleTopHeartBase: csvRow?.role_top_heart_base || seedMat.volatility,
      pyramidUsage: csvRow?.pyramid_usage || seedMat.volatility.toUpperCase(),
      pyramidPrimaryZone:
        (csvRow?.pyramid_primary_zone as PyramidPrimaryZone) ||
        (seedMat.volatility.includes('Top')
          ? 'TOP'
          : seedMat.volatility.includes('Base')
          ? 'BASE'
          : 'HEART'),
      pyramidHighlightTop:
        csvRow !== undefined
          ? csvRow.pyramid_highlight_top.toLowerCase() === 'true'
          : seedMat.volatility.includes('Top'),
      pyramidHighlightHeart:
        csvRow !== undefined
          ? csvRow.pyramid_highlight_heart.toLowerCase() === 'true'
          : seedMat.volatility.includes('Heart'),
      pyramidHighlightBase:
        csvRow !== undefined
          ? csvRow.pyramid_highlight_base.toLowerCase() === 'true'
          : seedMat.volatility.includes('Base'),
      pyramidUiCode:
        (csvRow?.pyramid_ui_code as PyramidUiCode) ||
        (seedMat.volatility === 'Top'
          ? 'T'
          : seedMat.volatility === 'Top-Heart'
          ? 'TH'
          : seedMat.volatility === 'Heart'
          ? 'H'
          : seedMat.volatility === 'Heart-Base'
          ? 'HB'
          : 'B'),
      pyramidConfidence: (csvRow?.pyramid_confidence as PyramidConfidence) || 'HIGH',
      pyramidBasis: csvRow?.pyramid_basis || 'CURATED_ATELIER',
      pyramidNote: csvRow?.pyramid_note || '',
      olfactoryStrength: csvRow?.olfactory_strength || 'HIGH',
      sourceSection: csvRow?.source_section || 'Atelier Core Organ',
      catalogSource: csvRow?.catalog_source || 'ScenTree',
      catalogSourceUrl: csvRow?.catalog_source_url || 'https://www.scentree.co/',
      sourceLicense: csvRow?.source_license || 'CC BY-NC 4.0',
      sourceLicenseUrl:
        csvRow?.source_license_url || 'https://creativecommons.org/licenses/by-nc/4.0/',
      starterPriority: csvRow?.starter_priority || 'CORE_STARTER',
      isSeedData: true,
      isOnShelf: seedMat.isOnWorkbench !== false,
      isOnWorkbench: seedMat.isOnWorkbench !== false,
    };

    materialsOut.push(mergedMaterial);

    const existingSeedReg = SEED_REGULATORY_LIMITS.find((r) => r.materialId === seedMat.id);
    const { records, constituents, verificationStatus } =
      buildRegulatoryRecordsAndConstituentsForMaterial({
        materialId: seedMat.id,
        materialName: mergedMaterial.name,
        casNumber: mergedMaterial.casNumber,
        csvRow,
        seedLimit: existingSeedReg,
        nextRecordIdRef,
        nextConstituentIdRef,
      });

    regulatoryRecordsOut.push(...records);
    constituentsOut.push(...constituents);

    if (existingSeedReg) {
      regulatoryLimitsOut.push({
        ...existingSeedReg,
        verificationStatus,
        ifraStandardStatus: csvRow?.ifra_standard_status || undefined,
        ifraStandardType: csvRow?.ifra_standard_type || existingSeedReg.restrictionType,
        euCosmeticsStatus: csvRow?.eu_cosmetics_status || undefined,
        euAnnex: csvRow?.eu_annex || undefined,
        euReferenceNo: csvRow?.eu_reference_no || undefined,
        euLabelThresholdLeaveOnPct: parseNullableNumber(csvRow?.eu_label_threshold_leave_on_pct) ??
          (existingSeedReg.euAllergenDeclarable ? 0.001 : null),
        euLabelThresholdRinseOffPct: parseNullableNumber(csvRow?.eu_label_threshold_rinse_off_pct) ??
          (existingSeedReg.euAllergenDeclarable ? 0.01 : null),
        regulatorySources: csvRow?.regulatory_sources || undefined,
        lastVerifiedDate: csvRow?.last_verified_date || existingSeedReg.effectiveDate,
        regulatoryRecords: records,
        constituents,
      });
    }
  }

  // 2. Build IDs 19..815 from the remaining 797 rows in materials.csv
  let nextId = 19;
  let nextRegId = Math.max(0, ...regulatoryLimitsOut.map((r) => r.id)) + 1;

  for (const row of csvRows) {
    if (CATALOG_KEY_TO_SEED_ID[row.material_id] !== undefined) {
      continue; // Already included in 1..18
    }

    const matId = nextId++;
    const facetsList = row.facets
      ? row.facets
          .split(/[;|,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [row.primary_family || 'Aromatic'];

    const volatility = mapUiCodeToVolatility(row.pyramid_ui_code, row.role_top_heart_base);
    const origin = mapMaterialKindToOrigin(row.material_kind, row.source_section);
    const strengthMetrics = mapOlfactoryStrengthToIntensity(row.olfactory_strength);
    const ifraCat4Max = parseNullableNumber(row.ifra_category_4_max_finished_product_pct);
    const euMaxPct = parseNullableNumber(row.eu_max_ready_for_use_pct);
    const euLeaveOn = parseNullableNumber(row.eu_label_threshold_leave_on_pct);
    const euRinseOff = parseNullableNumber(row.eu_label_threshold_rinse_off_pct);

    const descriptiveText =
      row.odor_summary ||
      `${row.display_name} (${row.primary_family || 'Perfumery'} family, ${volatility} tier).`;

    const rawMat: RawMaterial = {
      id: matId,
      catalogKey: row.material_id,
      scope: 'GLOBAL',
      ownerUid: null,
      displayName: row.display_name,
      name: row.display_name,
      aliases: row.inci_name && row.inci_name !== row.display_name ? row.inci_name : '',
      casNumber: row.cas_number || 'Unknown / Not Provided',
      inciName: row.inci_name || row.display_name || 'Unknown / Not Provided',
      naturalOrSynthetic: origin,
      materialKind: row.material_kind || (origin === 'Natural' ? 'NATURAL_COMPLEX' : 'SYNTHETIC'),
      supplier: '',
      supplierProductCode: '',
      supplierProductName: '',
      manufacturer: '',
      primaryFamily: row.primary_family || 'Aromatic',
      facets: facetsList.length > 0 ? facetsList : [row.primary_family || 'Aromatic'],
      odorSummary: row.odor_summary || descriptiveText,
      roleTopHeartBase: row.role_top_heart_base || volatility,
      pyramidUsage: row.pyramid_usage || 'UNSPECIFIED',
      pyramidPrimaryZone: (row.pyramid_primary_zone as PyramidPrimaryZone) || 'UNSPECIFIED',
      pyramidHighlightTop: row.pyramid_highlight_top.toLowerCase() === 'true',
      pyramidHighlightHeart: row.pyramid_highlight_heart.toLowerCase() === 'true',
      pyramidHighlightBase: row.pyramid_highlight_base.toLowerCase() === 'true',
      pyramidUiCode: (row.pyramid_ui_code as PyramidUiCode) || 'NA',
      pyramidConfidence: (row.pyramid_confidence as PyramidConfidence) || 'UNKNOWN',
      pyramidBasis: row.pyramid_basis || 'UNSPECIFIED',
      pyramidNote: row.pyramid_note || '',
      olfactoryStrength: row.olfactory_strength || 'MEDIUM',
      intensity: strengthMetrics.intensity,
      substantivityHours: strengthMetrics.substantivityHours,
      diffusion: strengthMetrics.diffusion,
      volatility,
      descriptiveNotes: descriptiveText,
      texture: facetsList.slice(0, 2).join(', ') || 'Balanced',
      temperatureImpression: 'Neutral',
      personalNotes: '',
      purity: origin === 'Natural' ? '100% Natural Extract / EO' : 'Perfumery Grade',
      density: 0.95,
      recommendedDilution: 100,
      workingDilutionPct: null,
      storageInfo: 'Cool, dark cabinet (15–20°C)',
      shelfLifeMonths: 24,
      flashPointCelsius: null,
      educationalObserve: [
        `Evaluate ${row.display_name} on blotter across opening, heart, and drydown (${row.pyramid_ui_code || volatility})`,
        row.pyramid_note || `Observe ${row.primary_family} facet evolution in dilutions`,
      ],
      complements: ['Hedione', 'Iso E Super', 'Bergamot FCF'],
      contrasts: ['Ambroxan'],
      isSeedData: true,
      isOnShelf: false,
      isOnWorkbench: false,
      costPerGram: 0.35,
      impactRating: strengthMetrics.intensity,
      alsoCalled: row.inci_name && row.inci_name !== row.display_name ? [row.inci_name] : [],
      euCosmeticLimitPercent: euMaxPct,
      euCosmeticNote: row.eu_summary || undefined,
      euAllergenDeclarable: euLeaveOn !== null,
      sourceSection: row.source_section,
      catalogSource: row.catalog_source,
      catalogSourceUrl: row.catalog_source_url,
      sourceLicense: row.source_license,
      sourceLicenseUrl: row.source_license_url,
      starterPriority: row.starter_priority,
    };

    materialsOut.push(rawMat);

    const { records, constituents, verificationStatus } =
      buildRegulatoryRecordsAndConstituentsForMaterial({
        materialId: matId,
        materialName: rawMat.name,
        casNumber: rawMat.casNumber,
        csvRow: row,
        nextRecordIdRef,
        nextConstituentIdRef,
      });

    regulatoryRecordsOut.push(...records);
    constituentsOut.push(...constituents);

    // Regulatory limit record: NEVER infer unknown / blank as safe or unrestricted
    const restrictionType =
      row.ifra_standard_type === 'PROHIBITION' || row.ifra_standard_status === 'PROHIBITED'
        ? 'PROHIBITION'
        : row.ifra_standard_type === 'SPECIFICATION'
        ? 'SPECIFICATION'
        : ifraCat4Max !== null
        ? 'RESTRICTION'
        : row.ifra_standard_status === 'NO_IFRA_STANDARD_FOUND'
        ? 'NOT_RESTRICTED'
        : undefined;

    regulatoryLimitsOut.push({
      id: nextRegId++,
      materialId: matId,
      ifraCategory: 'Category 4 (Fine Fragrance)',
      maxAllowedPercent:
        row.ifra_standard_type === 'PROHIBITION' || row.ifra_standard_status === 'PROHIBITED'
          ? 0
          : ifraCat4Max,
      allergens:
        euLeaveOn !== null
          ? `EU Declarable Allergen (leave-on threshold ${euLeaveOn}%)`
          : 'Unknown / Not Provided',
      restrictions:
        row.ifra_summary ||
        row.regulatory_disclaimer ||
        'Safety information unavailable. Manual verification required.',
      sourceDocument:
        row.regulatory_sources ||
        (row.ifra_amendment ? `IFRA ${row.ifra_amendment}` : 'Unknown / Not Provided'),
      documentVersion: row.ifra_amendment || row.ifra_baseline || 'IFRA_51',
      effectiveDate: row.last_verified_date || 'Unknown / Not Provided',
      isDemoData: verificationStatus === 'DEMO',
      verificationStatus,
      ifraStandardStatus: row.ifra_standard_status,
      ifraStandardType: row.ifra_standard_type,
      euCosmeticsStatus: row.eu_cosmetics_status,
      euAnnex: row.eu_annex,
      euReferenceNo: row.eu_reference_no,
      euLabelThresholdLeaveOnPct: euLeaveOn,
      euLabelThresholdRinseOffPct: euRinseOff,
      regulatorySources: row.regulatory_sources,
      lastVerifiedDate: row.last_verified_date,
      amendmentStatus: row.ifra_amendment
        ? `IFRA Amendment ${row.ifra_amendment}`
        : 'IFRA 51st Amendment Baseline',
      restrictionType,
      casNumber: row.cas_number || undefined,
      euCosmeticLimitPercent:
        row.eu_cosmetics_status === 'PROHIBITED' || row.eu_annex === 'II' ? 0 : euMaxPct,
      euRegulationReference: row.eu_annex
        ? `EU 1223/2009 Annex ${row.eu_annex}${row.eu_reference_no ? ` #${row.eu_reference_no}` : ''}`
        : undefined,
      euAllergenDeclarable: euLeaveOn !== null,
      regulatoryRecords: records,
      constituents,
    });
  }

  cachedCatalogBundle = {
    materials: materialsOut,
    regulatoryLimits: regulatoryLimitsOut,
    regulatoryRecords: regulatoryRecordsOut,
    constituents: constituentsOut,
    csvRowsByCatalogKey,
  };
  return cachedCatalogBundle;
}

/**
 * Resolves a legacy material reference (by catalogKey, displayName, name, or aliases)
 * to a canonical GLOBAL material in the loaded catalog.
 */
export function findGlobalCatalogMaterial(
  query: { id?: number; catalogKey?: string | null; name?: string | null },
  catalogMaterials: RawMaterial[] = loadGlobalCatalogV11().materials
): RawMaterial | undefined {
  if (query.catalogKey) {
    const byKey = catalogMaterials.find((m) => m.catalogKey === query.catalogKey);
    if (byKey) return byKey;
  }
  if (query.id && query.id >= 1 && query.id <= 18) {
    const bySeedId = catalogMaterials.find((m) => m.id === query.id);
    if (bySeedId && (!query.name || bySeedId.name.toLowerCase() === query.name.trim().toLowerCase())) {
      return bySeedId;
    }
  }
  if (query.name) {
    const norm = query.name.trim().toLowerCase();
    const exact = catalogMaterials.find(
      (m) =>
        m.name.toLowerCase() === norm ||
        (m.displayName && m.displayName.toLowerCase() === norm) ||
        (m.alsoCalled && m.alsoCalled.some((a) => a.toLowerCase() === norm))
    );
    if (exact) return exact;
  }
  return undefined;
}
