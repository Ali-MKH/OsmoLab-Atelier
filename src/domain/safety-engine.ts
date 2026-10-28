import {
  AccordDefinition,
  ComplianceState,
  FormulaLineItem,
  MaterialConstituent,
  MaterialRegulatoryLimit,
  MaterialRegulatoryRecord,
  ProductExposureType,
  RegulatoryRuleType,
  RegulatoryVerificationStatus,
} from './types';
import { calculateFormulaMetrics, resolveAccordItemsForLineItem } from './formula-engine';

export type SafetyStatus =
  | 'Within stored limit'
  | 'Approaching limit'
  | 'Exceeds stored limit'
  | 'Prohibited'
  | 'Specification required'
  | 'Safety information unavailable';

export const IFRA_CATEGORY_OPTIONS: Array<{
  code: string;
  value: string;
  shortLabel: string;
}> = [
  { code: 'Cat 1', value: 'Category 1 (Lip Products & Balms)', shortLabel: 'Cat 1 · Lip Products' },
  { code: 'Cat 2', value: 'Category 2 (Deodorants & Antiperspirants)', shortLabel: 'Cat 2 · Deodorants' },
  { code: 'Cat 3', value: 'Category 3 (Eye & Facial Makeup)', shortLabel: 'Cat 3 · Facial Makeup' },
  { code: 'Cat 4', value: 'Category 4 (Fine Fragrance)', shortLabel: 'Cat 4 · Fine Fragrance' },
  { code: 'Cat 5A', value: 'Category 5A (Body Lotions & Creams)', shortLabel: 'Cat 5A · Body Lotions' },
  { code: 'Cat 5B', value: 'Category 5B (Facial Moisturizers)', shortLabel: 'Cat 5B · Face Creams' },
  { code: 'Cat 7A', value: 'Category 7A (Rinse-off Hair Care)', shortLabel: 'Cat 7A · Rinse-off Hair' },
  { code: 'Cat 9', value: 'Category 9 (Bar Soaps & Body Wash)', shortLabel: 'Cat 9 · Soaps & Body Wash' },
  { code: 'Cat 11A', value: 'Category 11A (Candles & Reed Diffusers)', shortLabel: 'Cat 11A · Candles & Diffusers' },
];

export type EuSafetyStatus =
  | 'Within EU limit'
  | 'Exceeds EU limit'
  | 'Prohibited (EU Annex II)'
  | 'EU Allergen Declaration Required'
  | 'EU Specification Required'
  | 'EU limit unavailable';

export interface ContributingLineSource {
  lineId: string;
  lineName: string;
  sourceType: 'direct' | 'accord';
  accordId?: number;
  accordVersionId?: number | null;
  accordName?: string;
  activePercentInConcentrate: number;
  concentrationInFinalProduct: number;
}

export interface ConstituentContributionSource {
  materialId: number;
  materialName: string;
  sourceType: 'direct' | 'accord';
  accordName?: string;
  materialConcentrationInFinalProductPct: number;
  typicalPctInMaterial: number | null;
  contributedFinalProductPct: number | null;
}

export interface AggregatedConstituentAllergen {
  constituentKey: string;
  constituentName: string;
  constituentCas: string;
  totalFinalProductPct: number;
  leaveOnThresholdPct: number;
  rinseOffThresholdPct: number;
  applicableThresholdPct: number | null;
  exposureType: ProductExposureType;
  exceedsThreshold: boolean;
  requiresDeclaration: boolean;
  hasMissingPercentage: boolean;
  declarationStatus: 'DECLARATION_REQUIRED' | 'BELOW_THRESHOLD' | 'INDETERMINATE';
  verificationStatus: RegulatoryVerificationStatus;
  sources: ConstituentContributionSource[];
}

export interface MaterialSafetyEvaluation {
  materialId: number;
  materialName: string;
  activePercentInConcentrate: number;
  directActivePercentInConcentrate: number;
  accordActivePercentInConcentrate: number;
  concentrationInFinalProduct: number;
  maxAllowedPercentInFinalProduct: number | null;
  excessPercentInFinalProduct: number;
  utilizationPercentOfLimit: number | null;
  status: SafetyStatus;
  statusMessage: string;
  isSafetyRisk: boolean;
  badgeLabel: 'Safe' | 'Caution' | 'Safety Risk' | 'Prohibited' | 'Lookup Required' | 'Demo / Unverified';
  allergens: string;
  restrictions: string;
  sourceDocument: string;
  documentVersion: string;
  effectiveDate: string;
  isDemoData: boolean;
  verificationStatus: RegulatoryVerificationStatus;
  verificationStatusLabel: string;
  ifraRuleType: RegulatoryRuleType;
  ifraComplianceState: ComplianceState;
  missingCategoryRecord: boolean;
  sourceLineIds: string[];
  contributingSources: ContributingLineSource[];
  // EU Cosmetics Regulation (EC 1223/2009) Parallel Track
  euCosmeticLimitPercent: number | null;
  euUtilizationPercentOfLimit: number | null;
  euComplianceStatus: EuSafetyStatus;
  euComplianceState: ComplianceState;
  euRuleType: RegulatoryRuleType;
  euProhibited: boolean;
  euAllergenDeclarable: boolean;
  euRequiresAllergenDeclaration: boolean;
  euLabelThresholdLeaveOnPct: number | null;
  euLabelThresholdRinseOffPct: number | null;
  euApplicableLabelThresholdPct: number | null;
  euRegulationReference: string;
  euConditionText: string;
  sourceUrl: string;
}

export interface FormulaSafetyReport {
  ifraCategory: string;
  normalizedCategoryCode: string | null;
  intendedProduct: string;
  exposureType: ProductExposureType;
  finalProductConcentrationPercent: number;
  evaluations: MaterialSafetyEvaluation[];
  byLineId: Record<string, MaterialSafetyEvaluation>;
  // Three-state compliance semantics (Stage 2)
  complianceState: ComplianceState;
  ifraComplianceState: ComplianceState;
  euComplianceState: ComplianceState;
  overallCompliant: boolean;
  violationCount: number;
  missingDataCount: number;
  hasMissingData: boolean;
  cumulativeMultiSourceCount: number;
  safetyRiskEvaluations: MaterialSafetyEvaluation[];
  indeterminateCount: number;
  demoOrUnverifiedCount: number;
  disclaimer: string;
  // EU Cosmetics Regulation Summary
  euOverallCompliant: boolean;
  euViolationCount: number;
  euAllergenDeclarationCount: number;
  // Constituent-level allergen aggregation
  aggregatedAllergens: AggregatedConstituentAllergen[];
  declarableAllergens: AggregatedConstituentAllergen[];
  hasMissingConstituentPercentages: boolean;
}

export function formatVerificationStatusLabel(
  status: RegulatoryVerificationStatus | undefined
): string {
  switch (status) {
    case 'VERIFIED_OFFICIAL':
      return 'Official source verified';
    case 'PARTIALLY_VERIFIED':
      return 'Partially verified';
    case 'DEMO':
      return 'Educational demonstration data — not verified for compliance';
    case 'USER_ENTERED_UNVERIFIED':
      return 'User-entered, unverified';
    case 'LOOKUP_REQUIRED':
    default:
      return 'Lookup required';
  }
}

export function isVerifiedEvidenceStatus(
  status: RegulatoryVerificationStatus | undefined
): boolean {
  return status === 'VERIFIED_OFFICIAL' || status === 'PARTIALLY_VERIFIED';
}

export function inferVerificationStatusFromLimit(
  limitRecord?: MaterialRegulatoryLimit
): RegulatoryVerificationStatus {
  if (!limitRecord) return 'LOOKUP_REQUIRED';
  if (limitRecord.verificationStatus) return limitRecord.verificationStatus;
  if (limitRecord.documentVersion === 'User Entered') return 'USER_ENTERED_UNVERIFIED';
  if (limitRecord.isDemoData) return 'DEMO';
  if (
    limitRecord.maxAllowedPercent === null &&
    limitRecord.restrictionType !== 'SPECIFICATION' &&
    limitRecord.restrictionType !== 'PROHIBITION' &&
    limitRecord.restrictionType !== 'NOT_RESTRICTED'
  ) {
    return 'LOOKUP_REQUIRED';
  }
  return 'DEMO';
}

/**
 * Normalizes an IFRA category string such as:
 * - "Category 4 (Fine Fragrance)" -> "Cat 4"
 * - "Category 5A (Body Lotions & Creams)" -> "Cat 5A"
 * - "Cat 1" -> "Cat 1"
 * Returns null if no IFRA category code can be extracted.
 */
export function normalizeIfraCategoryCode(ifraCategory: string | undefined | null): string | null {
  if (!ifraCategory) return null;
  const trimmed = ifraCategory.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(?:category|cat\.?)\s*(\d+[a-d]?)/i);
  if (match) {
    return `Cat ${match[1].toUpperCase()}`;
  }
  const bareMatch = trimmed.match(/^(\d+[a-d]?)$/i);
  if (bareMatch) {
    return `Cat ${bareMatch[1].toUpperCase()}`;
  }
  return null;
}

/**
 * Determines whether the target consumer product is LEAVE_ON, RINSE_OFF, NON_SKIN, or AMBIGUOUS
 * so EU allergen declaration thresholds (0.001% leave-on vs 0.01% rinse-off) are applied accurately.
 */
export function resolveProductExposureType(
  ifraCategory: string | undefined | null,
  intendedProduct?: string | null
): ProductExposureType {
  const catCode = normalizeIfraCategoryCode(ifraCategory);
  const prod = (intendedProduct || '').toLowerCase();
  const catLower = (ifraCategory || '').toLowerCase();

  if (prod.includes('ambiguous') || catLower.includes('ambiguous')) {
    return 'AMBIGUOUS';
  }

  // Explicit intendedProduct cues
  const hasRinseOffCue =
    prod.includes('rinse-off') ||
    prod.includes('rinse off') ||
    prod.includes('soap') ||
    prod.includes('body wash') ||
    prod.includes('shampoo') ||
    prod.includes('shower gel') ||
    prod.includes('cleanser');

  const hasLeaveOnCue =
    prod.includes('leave-on') ||
    prod.includes('leave on') ||
    prod.includes('eau de parfum') ||
    prod.includes('edp') ||
    prod.includes('eau de toilette') ||
    prod.includes('edt') ||
    prod.includes('extrait') ||
    prod.includes('parfum') ||
    prod.includes('cologne') ||
    prod.includes('lotion') ||
    prod.includes('cream') ||
    prod.includes('moisturizer') ||
    prod.includes('deodorant') ||
    prod.includes('lip');

  if (hasRinseOffCue && hasLeaveOnCue) {
    return 'AMBIGUOUS';
  }
  if (hasRinseOffCue) return 'RINSE_OFF';

  if (catCode) {
    const numPart = catCode.replace(/^Cat\s+/i, '').toUpperCase();
    if (['1', '2', '3', '4', '5', '5A', '5B', '5C', '5D', '7B', '8', '10B'].includes(numPart)) {
      return 'LEAVE_ON';
    }
    if (['6', '7A', '9', '10A'].includes(numPart)) {
      return 'RINSE_OFF';
    }
    if (['11A', '11B', '12'].includes(numPart)) {
      return 'NON_SKIN';
    }
  }

  if (hasLeaveOnCue) return 'LEAVE_ON';
  return 'AMBIGUOUS';
}

interface ResolvedIfraCategoryRule {
  maxAllowedPercent: number | null;
  ruleType: RegulatoryRuleType;
  status: string;
  verificationStatus: RegulatoryVerificationStatus;
  missingCategoryRecord: boolean;
  summary: string;
  conditionText: string;
  sourceUrl: string;
  sourceDocument: string;
  sourceVersion: string;
}

/**
 * Resolves the IFRA rule for a material and target IFRA category WITHOUT ever falling back
 * to a different category's numeric limit.
 */
export function resolveIfraCategoryRule(
  limitRecord: MaterialRegulatoryLimit | undefined,
  ifraCategory: string,
  externalRecords?: MaterialRegulatoryRecord[]
): ResolvedIfraCategoryRule {
  const targetCatCode = normalizeIfraCategoryCode(ifraCategory);
  const baseVerStatus = inferVerificationStatusFromLimit(limitRecord);

  if (!limitRecord && (!externalRecords || externalRecords.length === 0)) {
    return {
      maxAllowedPercent: null,
      ruleType: 'INFORMATION',
      status: 'LOOKUP_REQUIRED',
      verificationStatus: 'LOOKUP_REQUIRED',
      missingCategoryRecord: true,
      summary: 'Safety information unavailable. Manual verification required.',
      conditionText: '',
      sourceUrl: '',
      sourceDocument: 'Unknown / Not Provided',
      sourceVersion: 'Unknown / Not Provided',
    };
  }

  const allRecords = [
    ...(externalRecords || []),
    ...(limitRecord?.regulatoryRecords || []),
  ].filter((r) => r.authority === 'IFRA');

  // 1. Check global IFRA PROHIBITION (applies across all categories)
  const prohibitionRec = allRecords.find(
    (r) => r.ruleType === 'PROHIBITION' || r.status === 'PROHIBITED'
  );
  if (
    prohibitionRec ||
    limitRecord?.restrictionType === 'PROHIBITION' ||
    limitRecord?.ifraStandardType === 'PROHIBITION' ||
    limitRecord?.ifraStandardStatus === 'PROHIBITED'
  ) {
    return {
      maxAllowedPercent: 0,
      ruleType: 'PROHIBITION',
      status: 'PROHIBITED',
      verificationStatus: prohibitionRec?.verificationStatus || baseVerStatus,
      missingCategoryRecord: false,
      summary:
        prohibitionRec?.summary ||
        limitRecord?.restrictions ||
        'Prohibited under IFRA Standards.',
      conditionText: prohibitionRec?.conditionText || '',
      sourceUrl: prohibitionRec?.sourceUrl || limitRecord?.regulatorySources || '',
      sourceDocument:
        prohibitionRec?.sourceDocument || limitRecord?.sourceDocument || 'IFRA Standard',
      sourceVersion:
        prohibitionRec?.sourceVersion || limitRecord?.documentVersion || 'IFRA_51',
    };
  }

  // 2. If target category cannot be parsed, return missing category record
  if (!targetCatCode) {
    return {
      maxAllowedPercent: null,
      ruleType: 'INFORMATION',
      status: 'MISSING_CATEGORY',
      verificationStatus: 'LOOKUP_REQUIRED',
      missingCategoryRecord: true,
      summary: `Unrecognized IFRA category "${ifraCategory}". Manual verification required.`,
      conditionText: '',
      sourceUrl: limitRecord?.regulatorySources || '',
      sourceDocument: limitRecord?.sourceDocument || 'Unknown / Not Provided',
      sourceVersion: limitRecord?.documentVersion || 'Unknown / Not Provided',
    };
  }

  // 3. Look for an explicit category match in MaterialRegulatoryRecord[]
  const matchedRecord = allRecords.find(
    (r) =>
      r.productCategory &&
      normalizeIfraCategoryCode(r.productCategory) === targetCatCode
  );

  if (matchedRecord) {
    if (matchedRecord.status === 'LOOKUP_REQUIRED' && matchedRecord.maxFinishedProductPct === null) {
      return {
        maxAllowedPercent: null,
        ruleType: 'INFORMATION',
        status: 'LOOKUP_REQUIRED',
        verificationStatus: 'LOOKUP_REQUIRED',
        missingCategoryRecord: false,
        summary: matchedRecord.summary || 'Safety information unavailable. Manual verification required.',
        conditionText: matchedRecord.conditionText || '',
        sourceUrl: matchedRecord.sourceUrl || '',
        sourceDocument: matchedRecord.sourceDocument || 'Unknown / Not Provided',
        sourceVersion: matchedRecord.sourceVersion || 'IFRA_51',
      };
    }

    return {
      maxAllowedPercent:
        matchedRecord.maxFinishedProductPct ??
        (matchedRecord.status === 'NO_IFRA_STANDARD_FOUND' ? 100 : null),
      ruleType: matchedRecord.ruleType,
      status: matchedRecord.status,
      verificationStatus: matchedRecord.verificationStatus,
      missingCategoryRecord: false,
      summary: matchedRecord.summary,
      conditionText: matchedRecord.conditionText,
      sourceUrl: matchedRecord.sourceUrl,
      sourceDocument: matchedRecord.sourceDocument,
      sourceVersion: matchedRecord.sourceVersion,
    };
  }

  // 4. Look for an explicit category match in limitRecord.categoryLimitsTable
  if (limitRecord?.categoryLimitsTable && limitRecord.categoryLimitsTable.length > 0) {
    const matchedTableRow = limitRecord.categoryLimitsTable.find(
      (row) => normalizeIfraCategoryCode(row.category) === targetCatCode
    );
    if (matchedTableRow) {
      return {
        maxAllowedPercent: matchedTableRow.maxAllowedPercent,
        ruleType:
          limitRecord.restrictionType === 'SPECIFICATION' &&
          matchedTableRow.maxAllowedPercent === null
            ? 'SPECIFICATION'
            : 'MAX_USE',
        status: matchedTableRow.maxAllowedPercent !== null ? 'RESTRICTED' : 'LOOKUP_REQUIRED',
        verificationStatus: matchedTableRow.verificationStatus || baseVerStatus,
        missingCategoryRecord: false,
        summary: matchedTableRow.description || limitRecord.restrictions || '',
        conditionText:
          limitRecord.puritySpecifications
            ?.map((p) => `${p.parameter}: ${p.standardLimit}`)
            .join('; ') || '',
        sourceUrl: limitRecord.regulatorySources || '',
        sourceDocument: limitRecord.sourceDocument || 'Unknown / Not Provided',
        sourceVersion: limitRecord.documentVersion || 'IFRA_51',
      };
    }
  }

  // 5. Check if limitRecord.ifraCategory itself matches targetCatCode
  const limitCatCode = normalizeIfraCategoryCode(limitRecord?.ifraCategory);
  if (limitRecord && limitCatCode === targetCatCode) {
    const isNoStd = limitRecord.ifraStandardStatus === 'NO_IFRA_STANDARD_FOUND';
    const isSpecOnly =
      (limitRecord.restrictionType === 'SPECIFICATION' ||
        limitRecord.ifraStandardType === 'SPECIFICATION') &&
      limitRecord.maxAllowedPercent === null;

    return {
      maxAllowedPercent: isNoStd && limitRecord.maxAllowedPercent === null ? 100 : limitRecord.maxAllowedPercent,
      ruleType: isSpecOnly
        ? 'SPECIFICATION'
        : limitRecord.maxAllowedPercent !== null
        ? 'MAX_USE'
        : 'INFORMATION',
      status:
        limitRecord.ifraStandardStatus ||
        (limitRecord.maxAllowedPercent !== null ? 'RESTRICTED' : 'LOOKUP_REQUIRED'),
      verificationStatus: baseVerStatus,
      missingCategoryRecord: false,
      summary:
        limitRecord.restrictions ||
        'Safety information unavailable. Manual verification required.',
      conditionText:
        limitRecord.puritySpecifications
          ?.map((p) => `${p.parameter}: ${p.standardLimit}`)
          .join('; ') || '',
      sourceUrl: limitRecord.regulatorySources || '',
      sourceDocument: limitRecord.sourceDocument || 'Unknown / Not Provided',
      sourceVersion: limitRecord.documentVersion || 'IFRA_51',
    };
  }

  // 6. Target category does NOT match any stored record -> NEVER fall back to Cat 4 limit!
  return {
    maxAllowedPercent: null,
    ruleType: 'INFORMATION',
    status: 'MISSING_CATEGORY_RECORD',
    verificationStatus: 'LOOKUP_REQUIRED',
    missingCategoryRecord: true,
    summary: `No IFRA record stored for ${targetCatCode}. Never inferred from another category.`,
    conditionText: '',
    sourceUrl: limitRecord?.regulatorySources || '',
    sourceDocument: limitRecord?.sourceDocument || 'Unknown / Not Provided',
    sourceVersion: limitRecord?.documentVersion || 'Unknown / Not Provided',
  };
}

/**
 * Resolves the numeric IFRA threshold % for a specific category without cross-category fallback.
 * Returns null if the requested category has no stored numeric limit.
 */
export function resolveCategoryThresholdPercent(
  limitRecord: MaterialRegulatoryLimit | undefined,
  ifraCategory: string,
  externalRecords?: MaterialRegulatoryRecord[]
): number | null {
  const resolved = resolveIfraCategoryRule(limitRecord, ifraCategory, externalRecords);
  if (resolved.missingCategoryRecord) return null;
  return resolved.maxAllowedPercent;
}

/**
 * Evaluates a formula's materials (including nested accords expanded to raw materials)
 * against stored IFRA regulatory limits, EU Cosmetics rules, and constituent-level allergen thresholds.
 */
export function evaluateFormulaSafety(
  items: FormulaLineItem[],
  accords: AccordDefinition[],
  regulatoryLimits: MaterialRegulatoryLimit[],
  ifraCategory: string,
  finalProductConcentrationPercent: number,
  options?: {
    intendedProduct?: string;
    regulatoryRecords?: MaterialRegulatoryRecord[];
    constituents?: MaterialConstituent[];
  }
): FormulaSafetyReport {
  const intendedProduct = options?.intendedProduct || 'Eau de Parfum (20% conc.)';
  const normalizedCategoryCode = normalizeIfraCategoryCode(ifraCategory);
  const exposureType = resolveProductExposureType(ifraCategory, intendedProduct);

  const metrics = calculateFormulaMetrics(items);
  const accordMap = new Map<number, AccordDefinition>(accords.map((a) => [a.id, a]));
  const limitByMaterialId = new Map<number, MaterialRegulatoryLimit>();
  for (const r of regulatoryLimits) {
    limitByMaterialId.set(r.materialId, r);
  }

  const externalRecordsByMaterialId = new Map<number, MaterialRegulatoryRecord[]>();
  if (options?.regulatoryRecords) {
    for (const rec of options.regulatoryRecords) {
      const list = externalRecordsByMaterialId.get(rec.materialId) || [];
      list.push(rec);
      externalRecordsByMaterialId.set(rec.materialId, list);
    }
  }

  const externalConstituentsByMaterialId = new Map<number, MaterialConstituent[]>();
  if (options?.constituents) {
    for (const c of options.constituents) {
      const list = externalConstituentsByMaterialId.get(c.materialId) || [];
      list.push(c);
      externalConstituentsByMaterialId.set(c.materialId, list);
    }
  }

  // Aggregate active material percentage in the fragrance concentrate across direct lines + nested accords
  const activeByMaterial = new Map<
    number,
    {
      name: string;
      activePercentInConcentrate: number;
      sourceLineIds: string[];
      contributingSources: ContributingLineSource[];
    }
  >();

  for (const line of metrics.items) {
    if (line.type === 'material' && line.materialId) {
      const existing = activeByMaterial.get(line.materialId) || {
        name: line.name,
        activePercentInConcentrate: 0,
        sourceLineIds: [],
        contributingSources: [],
      };
      const lineActiveInConcentrate = line.activeMaterialPercentOfTotal;
      const lineConcInFinal = Number(
        (lineActiveInConcentrate * (finalProductConcentrationPercent / 100)).toFixed(4)
      );
      existing.activePercentInConcentrate += lineActiveInConcentrate;
      if (!existing.sourceLineIds.includes(line.id)) {
        existing.sourceLineIds.push(line.id);
      }
      existing.contributingSources.push({
        lineId: line.id,
        lineName: line.name,
        sourceType: 'direct',
        activePercentInConcentrate: Number(lineActiveInConcentrate.toFixed(4)),
        concentrationInFinalProduct: lineConcInFinal,
      });
      activeByMaterial.set(line.materialId, existing);
    } else if (line.type === 'accord') {
      const accordById = line.accordId ? accordMap.get(line.accordId) : undefined;
      const accordByVer =
        !accordById && line.accordVersionId
          ? accords.find((a) =>
              a.versions?.some(
                (v) =>
                  v.id === line.accordVersionId ||
                  v.versionId === String(line.accordVersionId)
              )
            )
          : undefined;
      const accord = accordById || accordByVer;
      if (accord) {
        const accordItems = resolveAccordItemsForLineItem(line, accord);
        const totalAccordPct = accordItems.reduce((s, i) => s + i.percentage, 0) || 100;
        for (const sub of accordItems) {
          const subRatio = sub.percentage / totalAccordPct;
          const subSolutionPctInConcentrate = line.normalizedPercentage * subRatio;
          const effectiveDilution = (sub.dilutionPercent * line.dilutionPercent) / 100;
          const subActivePctInConcentrate =
            subSolutionPctInConcentrate * (effectiveDilution / 100);
          const subConcInFinal = Number(
            (subActivePctInConcentrate * (finalProductConcentrationPercent / 100)).toFixed(4)
          );

          const existing = activeByMaterial.get(sub.materialId) || {
            name: sub.materialName,
            activePercentInConcentrate: 0,
            sourceLineIds: [],
            contributingSources: [],
          };
          existing.activePercentInConcentrate += subActivePctInConcentrate;
          if (!existing.sourceLineIds.includes(line.id)) {
            existing.sourceLineIds.push(line.id);
          }
          existing.contributingSources.push({
            lineId: line.id,
            lineName: line.name,
            sourceType: 'accord',
            accordId: accord.id,
            accordVersionId: line.accordVersionId ?? null,
            accordName: accord.name,
            activePercentInConcentrate: Number(subActivePctInConcentrate.toFixed(4)),
            concentrationInFinalProduct: subConcInFinal,
          });
          activeByMaterial.set(sub.materialId, existing);
        }
      }
    }
  }

  const evaluations: MaterialSafetyEvaluation[] = [];
  const byLineId: Record<string, MaterialSafetyEvaluation> = {};
  let violationCount = 0;
  let missingDataCount = 0;
  let indeterminateCount = 0;
  let demoOrUnverifiedCount = 0;
  let euViolationCount = 0;
  let euAllergenDeclarationCount = 0;

  // Constituent-level allergen aggregation map
  const constituentAggregator = new Map<
    string,
    {
      constituentKey: string;
      constituentName: string;
      constituentCas: string;
      totalFinalProductPct: number;
      leaveOnThresholdPct: number;
      rinseOffThresholdPct: number;
      hasMissingPercentage: boolean;
      verificationStatus: RegulatoryVerificationStatus;
      sources: ConstituentContributionSource[];
    }
  >();

  for (const [materialId, entry] of activeByMaterial.entries()) {
    const activeInConc = Number(entry.activePercentInConcentrate.toFixed(4));
    const concInFinal = Number(
      (activeInConc * (finalProductConcentrationPercent / 100)).toFixed(4)
    );

    const limitRecord = limitByMaterialId.get(materialId);
    const matExternalRecords = externalRecordsByMaterialId.get(materialId);
    const ifraResolved = resolveIfraCategoryRule(
      limitRecord,
      ifraCategory,
      matExternalRecords
    );

    const verStatus = ifraResolved.verificationStatus;
    const verLabel = formatVerificationStatusLabel(verStatus);
    const isVerified = isVerifiedEvidenceStatus(verStatus);

    if (verStatus === 'DEMO' || verStatus === 'USER_ENTERED_UNVERIFIED') {
      demoOrUnverifiedCount += 1;
    }

    // --- 1. IFRA Evaluation ---
    let status: SafetyStatus;
    let statusMessage: string;
    let isSafetyRisk = false;
    let badgeLabel: MaterialSafetyEvaluation['badgeLabel'] = 'Safe';
    let utilizationPercentOfLimit: number | null = null;
    let ifraComplianceState: ComplianceState;

    if (ifraResolved.ruleType === 'PROHIBITION') {
      const violated = concInFinal > 0;
      if (violated) {
        status = 'Prohibited';
        statusMessage = `Prohibited under IFRA (${ifraResolved.summary || '0% max allowed'})`;
        isSafetyRisk = true;
        badgeLabel = 'Prohibited';
        ifraComplianceState = 'NON_COMPLIANT';
        violationCount += 1;
      } else {
        status = 'Within stored limit';
        statusMessage = '0% present (Prohibited substance)';
        ifraComplianceState = isVerified ? 'COMPLIANT' : 'INDETERMINATE';
      }
    } else if (ifraResolved.missingCategoryRecord) {
      status = 'Safety information unavailable';
      statusMessage = ifraResolved.summary;
      badgeLabel = 'Lookup Required';
      ifraComplianceState = 'INDETERMINATE';
      missingDataCount += 1;
    } else if (ifraResolved.ruleType === 'SPECIFICATION' && ifraResolved.maxAllowedPercent === null) {
      status = 'Specification required';
      statusMessage = `IFRA Specification: ${ifraResolved.conditionText || ifraResolved.summary}`;
      badgeLabel = isVerified ? 'Safe' : 'Demo / Unverified';
      ifraComplianceState = isVerified ? 'COMPLIANT' : 'INDETERMINATE';
    } else if (ifraResolved.maxAllowedPercent === null) {
      status = 'Safety information unavailable';
      statusMessage = 'Safety information unavailable. Manual verification required.';
      badgeLabel = 'Lookup Required';
      ifraComplianceState = 'INDETERMINATE';
      missingDataCount += 1;
    } else {
      const effectiveMaxAllowed = ifraResolved.maxAllowedPercent;
      utilizationPercentOfLimit =
        effectiveMaxAllowed > 0
          ? Number(((concInFinal / effectiveMaxAllowed) * 100).toFixed(1))
          : concInFinal > 0
          ? 100
          : 0;

      if (concInFinal > effectiveMaxAllowed) {
        status = 'Exceeds stored limit';
        statusMessage = `Exceeds stored limit (${concInFinal}% > ${effectiveMaxAllowed}% max in ${ifraCategory})`;
        isSafetyRisk = true;
        badgeLabel = 'Safety Risk';
        ifraComplianceState = 'NON_COMPLIANT';
        violationCount += 1;
      } else {
        status = 'Within stored limit';
        statusMessage = isVerified
          ? `Within stored limit (${concInFinal}% <= ${effectiveMaxAllowed}% max in ${ifraCategory})`
          : `Within reference limit (${concInFinal}% <= ${effectiveMaxAllowed}% in ${ifraCategory}; ${verLabel})`;
        badgeLabel =
          utilizationPercentOfLimit >= 80
            ? 'Caution'
            : isVerified
            ? 'Safe'
            : 'Demo / Unverified';
        ifraComplianceState = isVerified ? 'COMPLIANT' : 'INDETERMINATE';
      }
    }

    // --- 2. Separate EU Cosmetics Regulation Evaluation ---
    const allEuRecords = [
      ...(matExternalRecords || []),
      ...(limitRecord?.regulatoryRecords || []),
    ].filter((r) => r.authority === 'EU_COSMETICS');

    const euProhibitionRec = allEuRecords.find(
      (r) => r.ruleType === 'PROHIBITION' || r.status === 'PROHIBITED'
    );
    const euMaxUseRec = allEuRecords.find((r) => r.ruleType === 'MAX_USE');
    const euLabelRec = allEuRecords.find((r) => r.ruleType === 'LABEL_THRESHOLD');
    const euSpecRec = allEuRecords.find((r) => r.ruleType === 'SPECIFICATION');

    const isEuProhibited =
      Boolean(euProhibitionRec) ||
      limitRecord?.euCosmeticsStatus === 'PROHIBITED' ||
      limitRecord?.euAnnex === 'II';

    const euLimitPct = isEuProhibited
      ? 0
      : euMaxUseRec?.maxReadyForUsePct ?? limitRecord?.euCosmeticLimitPercent ?? null;

    const euLeaveOnPct =
      euLabelRec?.labelThresholdLeaveOnPct ??
      limitRecord?.euLabelThresholdLeaveOnPct ??
      (limitRecord?.euAllergenDeclarable ? 0.001 : null);

    const euRinseOffPct =
      euLabelRec?.labelThresholdRinseOffPct ??
      limitRecord?.euLabelThresholdRinseOffPct ??
      (limitRecord?.euAllergenDeclarable ? 0.01 : null);

    const euApplicableLabelThresholdPct =
      exposureType === 'LEAVE_ON'
        ? euLeaveOnPct
        : exposureType === 'RINSE_OFF'
        ? euRinseOffPct
        : null;

    const euAllergenDeclarable = Boolean(
      euLeaveOnPct !== null || euRinseOffPct !== null || limitRecord?.euAllergenDeclarable
    );

    const euRequiresAllergenDeclaration = Boolean(
      euAllergenDeclarable &&
        euApplicableLabelThresholdPct !== null &&
        concInFinal > euApplicableLabelThresholdPct
    );

    let euUtilizationPct: number | null = null;
    let euComplianceStatus: EuSafetyStatus = 'EU limit unavailable';
    let euComplianceState: ComplianceState = isVerified ? 'COMPLIANT' : 'INDETERMINATE';
    let euRuleType: RegulatoryRuleType = 'INFORMATION';

    if (isEuProhibited) {
      euRuleType = 'PROHIBITION';
      euUtilizationPct = concInFinal > 0 ? 100 : 0;
      if (concInFinal > 0) {
        euComplianceStatus = 'Prohibited (EU Annex II)';
        euComplianceState = 'NON_COMPLIANT';
        euViolationCount += 1;
        isSafetyRisk = true;
      } else {
        euComplianceStatus = 'Within EU limit';
      }
    } else if (euLimitPct !== null) {
      euRuleType = 'MAX_USE';
      euUtilizationPct =
        euLimitPct > 0
          ? Number(((concInFinal / euLimitPct) * 100).toFixed(1))
          : concInFinal > 0
          ? 100
          : 0;
      if (concInFinal > euLimitPct) {
        euComplianceStatus = 'Exceeds EU limit';
        euComplianceState = 'NON_COMPLIANT';
        euViolationCount += 1;
      } else if (euRequiresAllergenDeclaration) {
        euComplianceStatus = 'EU Allergen Declaration Required';
        euComplianceState = isVerified ? 'COMPLIANT' : 'INDETERMINATE';
      } else {
        euComplianceStatus = 'Within EU limit';
        euComplianceState = isVerified ? 'COMPLIANT' : 'INDETERMINATE';
      }
    } else if (euAllergenDeclarable) {
      euRuleType = 'LABEL_THRESHOLD';
      if (exposureType === 'AMBIGUOUS') {
        euComplianceStatus = 'EU limit unavailable';
        euComplianceState = 'INDETERMINATE';
      } else if (euRequiresAllergenDeclaration) {
        euComplianceStatus = 'EU Allergen Declaration Required';
        euComplianceState = isVerified ? 'COMPLIANT' : 'INDETERMINATE';
      } else {
        euComplianceStatus = 'Within EU limit';
        euComplianceState = isVerified ? 'COMPLIANT' : 'INDETERMINATE';
      }
    } else if (euSpecRec) {
      euRuleType = 'SPECIFICATION';
      euComplianceStatus = 'EU Specification Required';
      euComplianceState = isVerified ? 'COMPLIANT' : 'INDETERMINATE';
    } else if (limitRecord?.euCosmeticsStatus === 'NOT_SPECIFICALLY_LISTED') {
      euRuleType = 'INFORMATION';
      euComplianceStatus = 'Within EU limit';
      euComplianceState = isVerified ? 'COMPLIANT' : 'INDETERMINATE';
    } else {
      euRuleType = 'INFORMATION';
      euComplianceStatus = 'EU limit unavailable';
      euComplianceState = 'INDETERMINATE';
    }

    if (ifraComplianceState === 'INDETERMINATE' || euComplianceState === 'INDETERMINATE') {
      indeterminateCount += 1;
    }

    // --- 3. Constituent-Level Allergen Aggregation ---
    const matConstituents: Array<{
      name: string;
      cas: string;
      typicalPct: number | null;
      leaveOnPct: number;
      rinseOffPct: number;
      verificationStatus: RegulatoryVerificationStatus;
    }> = [];

    const extConst =
      externalConstituentsByMaterialId.get(materialId) || limitRecord?.constituents;

    if (extConst && extConst.length > 0) {
      for (const c of extConst) {
        matConstituents.push({
          name: c.constituentName,
          cas: c.constituentCas,
          typicalPct: c.typicalPct,
          leaveOnPct: c.labelThresholdLeaveOnPct ?? 0.001,
          rinseOffPct: c.labelThresholdRinseOffPct ?? 0.01,
          verificationStatus: c.verificationStatus || verStatus,
        });
      }
    } else if (limitRecord?.allergenBreakdown && limitRecord.allergenBreakdown.length > 0) {
      for (const ab of limitRecord.allergenBreakdown) {
        const normName =
          ab.casNumber === '5989-27-5' || ab.name.toLowerCase().includes('limonene')
            ? 'Limonene'
            : ab.casNumber === '5392-40-5' || ab.name.toLowerCase().startsWith('citral')
            ? 'Citral'
            : ab.name;
        matConstituents.push({
          name: normName,
          cas: ab.casNumber || '',
          typicalPct: ab.typicalPercent,
          leaveOnPct: ab.euThresholdPercent ?? 0.001,
          rinseOffPct: ab.euThresholdRinseOffPercent ?? 0.01,
          verificationStatus: ab.verificationStatus || verStatus,
        });
      }
    } else if (euAllergenDeclarable) {
      matConstituents.push({
        name: entry.name,
        cas: limitRecord?.casNumber || '',
        typicalPct: 100.0,
        leaveOnPct: euLeaveOnPct ?? 0.001,
        rinseOffPct: euRinseOffPct ?? 0.01,
        verificationStatus: verStatus,
      });
    }

    for (const c of matConstituents) {
      const normCas = (c.cas || '').trim();
      const key =
        normCas && normCas !== 'Unknown / Not Provided'
          ? `cas:${normCas}`
          : `name:${c.name.trim().toLowerCase()}`;

      const agg = constituentAggregator.get(key) || {
        constituentKey: key,
        constituentName: c.name,
        constituentCas: normCas,
        totalFinalProductPct: 0,
        leaveOnThresholdPct: c.leaveOnPct,
        rinseOffThresholdPct: c.rinseOffPct,
        hasMissingPercentage: false,
        verificationStatus: c.verificationStatus,
        sources: [],
      };

      if (c.typicalPct === null || c.typicalPct === undefined || Number.isNaN(c.typicalPct)) {
        agg.hasMissingPercentage = true;
        for (const src of entry.contributingSources) {
          agg.sources.push({
            materialId,
            materialName: entry.name,
            sourceType: src.sourceType,
            accordName: src.accordName,
            materialConcentrationInFinalProductPct: src.concentrationInFinalProduct,
            typicalPctInMaterial: null,
            contributedFinalProductPct: null,
          });
        }
      } else {
        for (const src of entry.contributingSources) {
          const contributed = Number(
            (src.concentrationInFinalProduct * (c.typicalPct / 100)).toFixed(6)
          );
          agg.totalFinalProductPct = Number(
            (agg.totalFinalProductPct + contributed).toFixed(6)
          );
          agg.sources.push({
            materialId,
            materialName: entry.name,
            sourceType: src.sourceType,
            accordName: src.accordName,
            materialConcentrationInFinalProductPct: src.concentrationInFinalProduct,
            typicalPctInMaterial: c.typicalPct,
            contributedFinalProductPct: contributed,
          });
        }
      }

      if (!isVerifiedEvidenceStatus(c.verificationStatus)) {
        agg.verificationStatus = c.verificationStatus;
      }

      constituentAggregator.set(key, agg);
    }

    const directActivePct = Number(
      entry.contributingSources
        .filter((s) => s.sourceType === 'direct')
        .reduce((sum, s) => sum + s.activePercentInConcentrate, 0)
        .toFixed(4)
    );
    const accordActivePct = Number(
      entry.contributingSources
        .filter((s) => s.sourceType === 'accord')
        .reduce((sum, s) => sum + s.activePercentInConcentrate, 0)
        .toFixed(4)
    );
    const excessPct =
      ifraResolved.maxAllowedPercent !== null && concInFinal > ifraResolved.maxAllowedPercent
        ? Number((concInFinal - ifraResolved.maxAllowedPercent).toFixed(4))
        : 0;

    const evalRecord: MaterialSafetyEvaluation = {
      materialId,
      materialName: entry.name,
      activePercentInConcentrate: activeInConc,
      directActivePercentInConcentrate: directActivePct,
      accordActivePercentInConcentrate: accordActivePct,
      concentrationInFinalProduct: concInFinal,
      maxAllowedPercentInFinalProduct: ifraResolved.maxAllowedPercent,
      excessPercentInFinalProduct: excessPct,
      utilizationPercentOfLimit,
      status,
      statusMessage,
      isSafetyRisk,
      badgeLabel,
      allergens: limitRecord?.allergens ?? 'Unknown / Not Provided',
      restrictions: ifraResolved.summary || limitRecord?.restrictions || '',
      sourceDocument: ifraResolved.sourceDocument,
      documentVersion: ifraResolved.sourceVersion,
      effectiveDate: limitRecord?.effectiveDate ?? 'Unknown / Not Provided',
      isDemoData: verStatus === 'DEMO',
      verificationStatus: verStatus,
      verificationStatusLabel: verLabel,
      ifraRuleType: ifraResolved.ruleType,
      ifraComplianceState,
      missingCategoryRecord: ifraResolved.missingCategoryRecord,
      sourceLineIds: entry.sourceLineIds,
      contributingSources: entry.contributingSources,
      euCosmeticLimitPercent: euLimitPct,
      euUtilizationPercentOfLimit: euUtilizationPct,
      euComplianceStatus,
      euComplianceState,
      euRuleType,
      euProhibited: isEuProhibited,
      euAllergenDeclarable,
      euRequiresAllergenDeclaration,
      euLabelThresholdLeaveOnPct: euLeaveOnPct,
      euLabelThresholdRinseOffPct: euRinseOffPct,
      euApplicableLabelThresholdPct,
      euRegulationReference:
        limitRecord?.euRegulationReference ??
        'EU Cosmetics Regulation (EC) No 1223/2009 Annex III',
      euConditionText: euSpecRec?.conditionText || ifraResolved.conditionText || '',
      sourceUrl: ifraResolved.sourceUrl || limitRecord?.regulatorySources || '',
    };

    evaluations.push(evalRecord);

    for (const lineId of entry.sourceLineIds) {
      const currentAssigned = byLineId[lineId];
      if (
        !currentAssigned ||
        (evalRecord.isSafetyRisk && !currentAssigned.isSafetyRisk) ||
        (evalRecord.status === 'Safety information unavailable' &&
          currentAssigned.status === 'Within stored limit')
      ) {
        byLineId[lineId] = evalRecord;
      }
    }
  }

  // Finalize aggregated constituent allergens
  const aggregatedAllergens: AggregatedConstituentAllergen[] = Array.from(
    constituentAggregator.values()
  ).map((agg) => {
    const applicableThresholdPct =
      exposureType === 'LEAVE_ON'
        ? agg.leaveOnThresholdPct
        : exposureType === 'RINSE_OFF'
        ? agg.rinseOffThresholdPct
        : null;

    const isIndeterminate = agg.hasMissingPercentage || exposureType === 'AMBIGUOUS';
    const exceedsThreshold =
      !isIndeterminate &&
      applicableThresholdPct !== null &&
      agg.totalFinalProductPct > applicableThresholdPct;

    const declarationStatus: AggregatedConstituentAllergen['declarationStatus'] = isIndeterminate
      ? 'INDETERMINATE'
      : exceedsThreshold
      ? 'DECLARATION_REQUIRED'
      : 'BELOW_THRESHOLD';

    return {
      constituentKey: agg.constituentKey,
      constituentName: agg.constituentName,
      constituentCas: agg.constituentCas,
      totalFinalProductPct: agg.totalFinalProductPct,
      leaveOnThresholdPct: agg.leaveOnThresholdPct,
      rinseOffThresholdPct: agg.rinseOffThresholdPct,
      applicableThresholdPct,
      exposureType,
      exceedsThreshold,
      requiresDeclaration: exceedsThreshold,
      hasMissingPercentage: agg.hasMissingPercentage,
      declarationStatus,
      verificationStatus: agg.verificationStatus,
      sources: agg.sources,
    };
  });

  aggregatedAllergens.sort((a, b) => b.totalFinalProductPct - a.totalFinalProductPct);

  const declarableAllergens = aggregatedAllergens.filter((a) => a.requiresDeclaration);
  euAllergenDeclarationCount = declarableAllergens.length;

  const hasMissingConstituentPercentages = aggregatedAllergens.some(
    (a) => a.hasMissingPercentage
  );

  // Formula-level 3-state compliance semantics
  let ifraComplianceState: ComplianceState;
  if (violationCount > 0) {
    ifraComplianceState = 'NON_COMPLIANT';
  } else if (
    evaluations.length === 0 ||
    evaluations.some((e) => e.ifraComplianceState === 'INDETERMINATE')
  ) {
    ifraComplianceState = 'INDETERMINATE';
  } else {
    ifraComplianceState = 'COMPLIANT';
  }

  let euComplianceState: ComplianceState;
  if (euViolationCount > 0) {
    euComplianceState = 'NON_COMPLIANT';
  } else if (
    evaluations.length === 0 ||
    exposureType === 'AMBIGUOUS' ||
    hasMissingConstituentPercentages ||
    evaluations.some((e) => e.euComplianceState === 'INDETERMINATE')
  ) {
    euComplianceState = 'INDETERMINATE';
  } else {
    euComplianceState = 'COMPLIANT';
  }

  let complianceState: ComplianceState;
  if (ifraComplianceState === 'NON_COMPLIANT' || euComplianceState === 'NON_COMPLIANT') {
    complianceState = 'NON_COMPLIANT';
  } else if (ifraComplianceState === 'INDETERMINATE' || euComplianceState === 'INDETERMINATE') {
    complianceState = 'INDETERMINATE';
  } else {
    complianceState = 'COMPLIANT';
  }

  const safetyRiskEvaluations = evaluations.filter((e) => e.isSafetyRisk);
  const cumulativeMultiSourceCount = evaluations.filter(
    (e) => e.contributingSources.length > 1
  ).length;

  return {
    ifraCategory,
    normalizedCategoryCode,
    intendedProduct,
    exposureType,
    finalProductConcentrationPercent,
    evaluations,
    byLineId,
    complianceState,
    ifraComplianceState,
    euComplianceState,
    overallCompliant: complianceState === 'COMPLIANT',
    violationCount,
    missingDataCount,
    hasMissingData: missingDataCount > 0,
    cumulativeMultiSourceCount,
    safetyRiskEvaluations,
    indeterminateCount,
    demoOrUnverifiedCount,
    disclaimer:
      'Regulatory checks distinguish verified official standards from educational demonstration data and unverified entries. Never treat INDETERMINATE or DEMO records as commercial compliance without supplier IFRA certificates and SDS.',
    euOverallCompliant: euComplianceState === 'COMPLIANT',
    euViolationCount,
    euAllergenDeclarationCount,
    aggregatedAllergens,
    declarableAllergens,
    hasMissingConstituentPercentages,
  };
}

/**
 * Automatically caps a material's contributing lines in the formula so that its
 * cumulative active concentration in the final product matches the IFRA limit for the category.
 */
export function autoCapMaterialToIfraLimit(
  items: FormulaLineItem[],
  accords: AccordDefinition[],
  regulatoryLimits: MaterialRegulatoryLimit[],
  targetMaterialId: number,
  ifraCategory: string,
  finalProductConcentrationPercent: number
): FormulaLineItem[] {
  const report = evaluateFormulaSafety(
    items,
    accords,
    regulatoryLimits,
    ifraCategory,
    finalProductConcentrationPercent
  );

  const targetEval = report.evaluations.find((e) => e.materialId === targetMaterialId);
  if (
    !targetEval ||
    targetEval.maxAllowedPercentInFinalProduct === null ||
    targetEval.concentrationInFinalProduct <= targetEval.maxAllowedPercentInFinalProduct ||
    targetEval.concentrationInFinalProduct <= 0
  ) {
    return items.map((i) => ({ ...i }));
  }

  const affectedLineIds = new Set(targetEval.sourceLineIds);
  const totalGrams = items.reduce(
    (sum, i) => sum + (i.quantityGrams > 0 ? i.quantityGrams : 0),
    0
  );
  const affectedGrams = items
    .filter((i) => affectedLineIds.has(i.id))
    .reduce((sum, i) => sum + (i.quantityGrams > 0 ? i.quantityGrams : 0), 0);
  const otherGrams = Math.max(0, totalGrams - affectedGrams);

  const targetRatio =
    (targetEval.maxAllowedPercentInFinalProduct * 0.95) /
    targetEval.concentrationInFinalProduct;
  const reductionRatio =
    otherGrams > 0 && totalGrams - targetRatio * affectedGrams > 0
      ? (targetRatio * otherGrams) / (totalGrams - targetRatio * affectedGrams)
      : targetRatio;

  return items.map((line) => {
    if (!affectedLineIds.has(line.id)) {
      return { ...line };
    }
    const newGrams = Number((line.quantityGrams * reductionRatio).toFixed(3));
    return {
      ...line,
      quantityGrams: Math.max(0.001, newGrams),
    };
  });
}
