import {
  AccordDefinition,
  FormulaLineItem,
  MaterialRegulatoryLimit,
} from './types';
import {
  calculateFormulaMetrics,
  expandNestedAccords,
  roundDecimal,
} from './formula-engine';

export type SafetyComplianceStatus =
  | 'Within stored limit'
  | 'Approaching limit'
  | 'Exceeds stored limit'
  | 'Safety information unavailable';

export type SafetyBadgeLabel =
  | 'Safety Risk'
  | 'Approaching Limit'
  | 'Safe'
  | 'Unverified';

export interface SafetyContributingSource {
  lineId: string;
  parentLineId: string;
  sourceLabel: string;
  isFromAccord: boolean;
  accordName: string | null;
  solutionGrams: number;
  dilutionPercent: number;
  activePercentInConcentrate: number;
  concentrationInFinalProduct: number;
}

export interface MaterialSafetyEvaluation {
  materialId: number;
  materialName: string;
  ifraCategory: string;
  activePercentInConcentrate: number;
  directActivePercentInConcentrate: number;
  accordActivePercentInConcentrate: number;
  concentrationInFinalProduct: number;
  maxAllowedPercentInFinalProduct: number | null;
  maxSafeActivePercentInConcentrate: number | null;
  safetyMarginPercent: number | null;
  excessPercentInFinalProduct: number;
  utilizationPercentOfLimit: number | null;
  isSafetyRisk: boolean;
  badgeLabel: SafetyBadgeLabel;
  contributingSources: SafetyContributingSource[];
  sourceLineIds: string[];
  status: SafetyComplianceStatus;
  statusMessage: string;
  allergens: string;
  sourceDocument: string;
  documentVersion: string;
  effectiveDate: string;
  isDemoData: boolean;
  // Dual Regulatory Compliance: EU Cosmetics Regulation (EC No 1223/2009)
  euCosmeticLimitPercent: number | null;
  euUtilizationPercentOfLimit: number | null;
  euComplianceStatus: 'Within EU limit' | 'Approaching EU limit' | 'Exceeds EU limit' | 'EU Allergen Disclosure Required' | 'Not restricted in EU' | 'EU info unavailable';
  euStatusMessage: string;
  euAllergenDeclarable: boolean;
}

export interface FormulaSafetyReport {
  ifraCategory: string;
  finalProductConcentrationPercent: number;
  overallCompliant: boolean;
  hasMissingData: boolean;
  violationCount: number;
  warningCount: number;
  cumulativeMultiSourceCount: number;
  evaluations: MaterialSafetyEvaluation[];
  safetyRiskEvaluations: MaterialSafetyEvaluation[];
  // EU Cosmetics Regulation Report
  euOverallCompliant: boolean;
  euViolationCount: number;
  euAllergenDeclarationCount: number;
  disclaimer: string;
}

export interface IfraCategoryOption {
  code: string;
  value: string;
  shortLabel: string;
  description: string;
}

export const IFRA_CATEGORY_OPTIONS: IfraCategoryOption[] = [
  {
    code: 'Cat 1',
    value: 'Category 1 (Lip Products & Balms)',
    shortLabel: 'Cat 1 · Lip Products',
    description: 'Products applied to the lips (direct oral/mucosal exposure)',
  },
  {
    code: 'Cat 2',
    value: 'Category 2 (Deodorants & Antiperspirants)',
    shortLabel: 'Cat 2 · Deodorants',
    description: 'Axillary leave-on deodorants and antiperspirants',
  },
  {
    code: 'Cat 3',
    value: 'Category 3 (Eye & Facial Makeup)',
    shortLabel: 'Cat 3 · Eye & Face Makeup',
    description: 'Hydroalcoholic and cosmetic products applied to eye/facial skin',
  },
  {
    code: 'Cat 4',
    value: 'Category 4 (Fine Fragrance)',
    shortLabel: 'Cat 4 · Fine Fragrance',
    description: 'Hydroalcoholic fine fragrances (EDP, EDT, Extrait, Cologne)',
  },
  {
    code: 'Cat 5A',
    value: 'Category 5A (Body Lotions & Creams)',
    shortLabel: 'Cat 5A · Body Lotions',
    description: 'Body creams, oils, and leave-on body lotions',
  },
  {
    code: 'Cat 5B',
    value: 'Category 5B (Facial Moisturizers)',
    shortLabel: 'Cat 5B · Face Moisturizers',
    description: 'Leave-on facial moisturizers and serums',
  },
  {
    code: 'Cat 7A',
    value: 'Category 7A (Rinse-off Hair Care)',
    shortLabel: 'Cat 7A · Hair Care (Rinse-off)',
    description: 'Rinse-off shampoos, conditioners, and hair treatments',
  },
  {
    code: 'Cat 9',
    value: 'Category 9 (Bar Soaps & Body Wash)',
    shortLabel: 'Cat 9 · Soaps & Body Wash',
    description: 'Rinse-off bath, shower gels, and bar soaps',
  },
  {
    code: 'Cat 11A',
    value: 'Category 11A (Candles & Reed Diffusers)',
    shortLabel: 'Cat 11A · Candles & Diffusers',
    description: 'Non-skin contact air care, candles, and reed diffusers',
  },
];

/**
 * Extracts normalized IFRA category code (e.g., "Cat 4", "Cat 5A", "Cat 11A")
 * from a full category string such as "Category 4 (Fine Fragrance)" or "Cat 5A".
 */
export function normalizeIfraCategoryCode(ifraCategory: string): string {
  const trimmed = (ifraCategory || '').trim();
  const match = trimmed.match(/^(?:Category|Cat\.?)\s*(\d+[A-Z]?)/i);
  if (match) {
    return `Cat ${match[1].toUpperCase()}`;
  }
  return trimmed;
}

/**
 * Resolves the authoritative maximum allowed percentage in finished product for a given
 * MaterialRegulatoryLimit record and target IFRA Category.
 * Checks `categoryLimitsTable` first when a specific IFRA Category is requested,
 * then falls back to `limitRecord.maxAllowedPercent` when matching the record's primary category.
 */
export function resolveCategoryThresholdPercent(
  limitRecord: MaterialRegulatoryLimit | undefined,
  ifraCategory: string
): number | null {
  if (!limitRecord) return null;
  if (
    limitRecord.maxAllowedPercent === null ||
    limitRecord.maxAllowedPercent === undefined
  ) {
    return null;
  }

  const targetCode = normalizeIfraCategoryCode(ifraCategory).toLowerCase();

  if (
    Array.isArray(limitRecord.categoryLimitsTable) &&
    limitRecord.categoryLimitsTable.length > 0
  ) {
    const tableHit = limitRecord.categoryLimitsTable.find(
      (row) => normalizeIfraCategoryCode(row.category).toLowerCase() === targetCode
    );
    if (
      tableHit &&
      tableHit.maxAllowedPercent !== null &&
      tableHit.maxAllowedPercent !== undefined
    ) {
      return tableHit.maxAllowedPercent;
    }
  }

  return limitRecord.maxAllowedPercent;
}

/**
 * Dedicated Safety & Regulatory Engine.
 * Strictly evaluates stored authoritative regulatory records across cumulative direct + nested accord contributions.
 * NEVER fabricates or infers missing safety limits.
 */
export function evaluateFormulaSafety(
  items: FormulaLineItem[],
  accords: AccordDefinition[],
  regulatoryLimits: MaterialRegulatoryLimit[],
  ifraCategory: string = 'Category 4 (Fine Fragrance)',
  finalProductConcentrationPercent: number = 20
): FormulaSafetyReport {
  const safeFinalConc = Math.max(0.01, finalProductConcentrationPercent || 20);
  const expanded = expandNestedAccords(items, accords);
  const metrics = calculateFormulaMetrics(expanded);

  // Aggregate cumulative active material percentage by materialId across direct lines and nested accords
  const aggregatedByMaterial = new Map<
    number,
    {
      name: string;
      activePctInConcentrate: number;
      directActivePct: number;
      accordActivePct: number;
      contributingSources: SafetyContributingSource[];
      sourceLineIds: Set<string>;
    }
  >();

  for (const item of metrics.items) {
    if (!item.materialId) continue;

    const accordViaMatch = item.name.match(/^(.*?)\s*\(via\s+(.*)\)$/);
    const cleanName = accordViaMatch ? accordViaMatch[1].trim() : item.name;
    const accordName = accordViaMatch ? accordViaMatch[2].trim() : null;
    const isFromAccord = Boolean(accordName) || item.id.includes('-accord-');
    const parentLineId = isFromAccord
      ? item.id.split('-accord-')[0]
      : item.id;

    const lineConcInFinal = roundDecimal(
      item.activeMaterialPercentOfTotal * (safeFinalConc / 100),
      4
    );

    const sourceEntry: SafetyContributingSource = {
      lineId: item.id,
      parentLineId,
      sourceLabel: isFromAccord ? `Accord: ${accordName}` : 'Direct Formula Line',
      isFromAccord,
      accordName,
      solutionGrams: item.quantityGrams,
      dilutionPercent: item.dilutionPercent,
      activePercentInConcentrate: item.activeMaterialPercentOfTotal,
      concentrationInFinalProduct: lineConcInFinal,
    };

    const existing = aggregatedByMaterial.get(item.materialId);
    if (existing) {
      existing.activePctInConcentrate = roundDecimal(
        existing.activePctInConcentrate + item.activeMaterialPercentOfTotal,
        4
      );
      if (isFromAccord) {
        existing.accordActivePct = roundDecimal(
          existing.accordActivePct + item.activeMaterialPercentOfTotal,
          4
        );
      } else {
        existing.directActivePct = roundDecimal(
          existing.directActivePct + item.activeMaterialPercentOfTotal,
          4
        );
      }
      existing.contributingSources.push(sourceEntry);
      existing.sourceLineIds.add(parentLineId);
    } else {
      aggregatedByMaterial.set(item.materialId, {
        name: cleanName,
        activePctInConcentrate: item.activeMaterialPercentOfTotal,
        directActivePct: isFromAccord ? 0 : item.activeMaterialPercentOfTotal,
        accordActivePct: isFromAccord ? item.activeMaterialPercentOfTotal : 0,
        contributingSources: [sourceEntry],
        sourceLineIds: new Set([parentLineId]),
      });
    }
  }

  const evaluations: MaterialSafetyEvaluation[] = [];
  let violationCount = 0;
  let warningCount = 0;
  let hasMissingData = false;
  let cumulativeMultiSourceCount = 0;
  let euViolationCount = 0;
  let euAllergenDeclarationCount = 0;

  for (const [materialId, data] of aggregatedByMaterial.entries()) {
    if (data.contributingSources.length > 1) {
      cumulativeMultiSourceCount += 1;
    }

    const limitRecord =
      regulatoryLimits.find(
        (r) =>
          r.materialId === materialId &&
          (r.ifraCategory === ifraCategory ||
            normalizeIfraCategoryCode(r.ifraCategory) ===
              normalizeIfraCategoryCode(ifraCategory))
      ) || regulatoryLimits.find((r) => r.materialId === materialId);

    const concInFinal = roundDecimal(
      data.activePctInConcentrate * (safeFinalConc / 100),
      4
    );

    const resolvedThreshold = resolveCategoryThresholdPercent(
      limitRecord,
      ifraCategory
    );

    if (
      !limitRecord ||
      resolvedThreshold === null ||
      resolvedThreshold === undefined
    ) {
      hasMissingData = true;
      warningCount += 1;
      evaluations.push({
        materialId,
        materialName: data.name,
        ifraCategory,
        activePercentInConcentrate: roundDecimal(data.activePctInConcentrate, 3),
        directActivePercentInConcentrate: roundDecimal(data.directActivePct, 3),
        accordActivePercentInConcentrate: roundDecimal(data.accordActivePct, 3),
        concentrationInFinalProduct: concInFinal,
        maxAllowedPercentInFinalProduct: null,
        maxSafeActivePercentInConcentrate: null,
        safetyMarginPercent: null,
        excessPercentInFinalProduct: 0,
        utilizationPercentOfLimit: null,
        isSafetyRisk: false,
        badgeLabel: 'Unverified',
        contributingSources: data.contributingSources,
        sourceLineIds: Array.from(data.sourceLineIds),
        status: 'Safety information unavailable',
        statusMessage:
          'Safety information unavailable. Manual verification required.',
        allergens: limitRecord?.allergens || 'Unknown / Not Provided',
        sourceDocument: limitRecord?.sourceDocument || 'Unknown / Not Provided',
        documentVersion: limitRecord?.documentVersion || 'Unknown / Not Provided',
        effectiveDate: limitRecord?.effectiveDate || 'Unknown / Not Provided',
        isDemoData: limitRecord?.isDemoData ?? false,
        euCosmeticLimitPercent: limitRecord?.euCosmeticLimitPercent ?? null,
        euUtilizationPercentOfLimit: null,
        euComplianceStatus: 'EU info unavailable',
        euStatusMessage: 'EU cosmetic regulatory data unverified',
        euAllergenDeclarable: false,
      });
      continue;
    }

    const maxAllowed = resolvedThreshold;
    const maxSafeInConcentrate = roundDecimal(
      (maxAllowed / safeFinalConc) * 100,
      3
    );
    const margin = roundDecimal(maxAllowed - concInFinal, 4);
    const utilizationPct =
      maxAllowed > 0 ? roundDecimal((concInFinal / maxAllowed) * 100, 1) : 0;

    let status: SafetyComplianceStatus = 'Within stored limit';
    let statusMessage = 'Within stored limit';
    let badgeLabel: SafetyBadgeLabel = 'Safe';
    let isSafetyRisk = false;
    let excessPct = 0;

    if (concInFinal > maxAllowed) {
      status = 'Exceeds stored limit';
      statusMessage = `Exceeds stored maximum (${concInFinal}% > ${maxAllowed}%)`;
      badgeLabel = 'Safety Risk';
      isSafetyRisk = true;
      excessPct = roundDecimal(concInFinal - maxAllowed, 4);
      violationCount += 1;
    } else if (concInFinal >= maxAllowed * 0.85 && maxAllowed < 100) {
      status = 'Approaching limit';
      statusMessage = `Within 15% of stored maximum (${concInFinal}% / ${maxAllowed}%)`;
      badgeLabel = 'Approaching Limit';
      warningCount += 1;
    }

    // EU Cosmetics Regulation (EC No 1223/2009 & Annex III)
    const euLimit = limitRecord?.euCosmeticLimitPercent ?? null;
    let euStatus: 'Within EU limit' | 'Approaching EU limit' | 'Exceeds EU limit' | 'EU Allergen Disclosure Required' | 'Not restricted in EU' | 'EU info unavailable' = 'Within EU limit';
    let euStatusMessage = 'Complies with EU Cosmetics Regulation';
    let euUtilizationPct: number | null = null;
    const isEuAllergenDeclarable = Boolean(
      limitRecord?.euAllergenDeclarable ||
      (limitRecord?.allergenBreakdown && limitRecord.allergenBreakdown.length > 0 && concInFinal >= 0.001)
    );

    if (euLimit !== null && euLimit !== undefined) {
      euUtilizationPct = euLimit > 0 ? roundDecimal((concInFinal / euLimit) * 100, 1) : 0;
      if (concInFinal > euLimit) {
        euStatus = 'Exceeds EU limit';
        euStatusMessage = `Exceeds EU Annex III limit (${concInFinal}% > ${euLimit}%)`;
        euViolationCount += 1;
      } else if (concInFinal >= euLimit * 0.85 && euLimit < 100) {
        euStatus = 'Approaching EU limit';
        euStatusMessage = `Within 15% of EU limit (${concInFinal}% / ${euLimit}%)`;
      } else {
        euStatus = 'Within EU limit';
        euStatusMessage = `Within EU limit (${concInFinal}% ≤ ${euLimit}%)`;
      }
    } else if (limitRecord?.restrictionType === 'NOT_RESTRICTED') {
      euStatus = 'Not restricted in EU';
      euStatusMessage = 'No specific EU Annex III quantitative restriction';
    } else if (!limitRecord) {
      euStatus = 'EU info unavailable';
      euStatusMessage = 'EU regulatory data unavailable';
    }

    if (isEuAllergenDeclarable) {
      euAllergenDeclarationCount += 1;
      if (euStatus === 'Within EU limit' || euStatus === 'Not restricted in EU') {
        euStatus = 'EU Allergen Disclosure Required';
        euStatusMessage = 'Compliant, but mandatory INCI allergen declaration required on finished product label (> 0.001% / 10 ppm for leave-on)';
      }
    }

    evaluations.push({
      materialId,
      materialName: data.name,
      ifraCategory,
      activePercentInConcentrate: roundDecimal(data.activePctInConcentrate, 3),
      directActivePercentInConcentrate: roundDecimal(data.directActivePct, 3),
      accordActivePercentInConcentrate: roundDecimal(data.accordActivePct, 3),
      concentrationInFinalProduct: concInFinal,
      maxAllowedPercentInFinalProduct: maxAllowed,
      maxSafeActivePercentInConcentrate: maxSafeInConcentrate,
      safetyMarginPercent: margin,
      excessPercentInFinalProduct: excessPct,
      utilizationPercentOfLimit: utilizationPct,
      isSafetyRisk,
      badgeLabel,
      contributingSources: data.contributingSources,
      sourceLineIds: Array.from(data.sourceLineIds),
      status,
      statusMessage,
      allergens: limitRecord.allergens || 'None listed',
      sourceDocument: limitRecord.sourceDocument,
      documentVersion: limitRecord.documentVersion,
      effectiveDate: limitRecord.effectiveDate,
      isDemoData: limitRecord.isDemoData,
      euCosmeticLimitPercent: euLimit,
      euUtilizationPercentOfLimit: euUtilizationPct,
      euComplianceStatus: euStatus,
      euStatusMessage,
      euAllergenDeclarable: isEuAllergenDeclarable,
    });
  }

  const safetyRiskEvaluations = evaluations.filter((e) => e.isSafetyRisk);

  return {
    ifraCategory,
    finalProductConcentrationPercent: safeFinalConc,
    overallCompliant: violationCount === 0,
    hasMissingData,
    violationCount,
    warningCount,
    cumulativeMultiSourceCount,
    evaluations,
    safetyRiskEvaluations,
    euOverallCompliant: euViolationCount === 0,
    euViolationCount,
    euAllergenDeclarationCount,
    disclaimer:
      'Educational and formulation-support calculation based strictly on stored records. Not a substitute for certified toxicological, IFRA SDS, or regulatory review.',
  };
}

/**
 * Scales down any direct formula lines (or parent accord lines) contributing to a material
 * that exceeds its IFRA threshold so that its cumulative concentration in the finished product
 * fits safely within the IFRA limit (95% of maxAllowedPercentInFinalProduct).
 */
export function autoCapMaterialToIfraLimit(
  items: FormulaLineItem[],
  accords: AccordDefinition[],
  regulatoryLimits: MaterialRegulatoryLimit[],
  materialId: number,
  ifraCategory: string,
  finalProductConcentrationPercent: number
): FormulaLineItem[] {
  let working = items.map((line) => ({ ...line }));

  for (let pass = 0; pass < 5; pass += 1) {
    const report = evaluateFormulaSafety(
      working,
      accords,
      regulatoryLimits,
      ifraCategory,
      finalProductConcentrationPercent
    );
    const targetEval = report.evaluations.find(
      (e) => e.materialId === materialId
    );
    if (
      !targetEval ||
      !targetEval.isSafetyRisk ||
      targetEval.maxAllowedPercentInFinalProduct === null ||
      targetEval.concentrationInFinalProduct <= 0
    ) {
      return working;
    }

    // Aim for 92% of the regulatory ceiling to account for denominator renormalization
    const safeTargetFinalPct =
      targetEval.maxAllowedPercentInFinalProduct * 0.92;
    const ratio = Math.max(
      0.01,
      Math.min(0.9, safeTargetFinalPct / targetEval.concentrationInFinalProduct)
    );

    const affectedLineIds = new Set(targetEval.sourceLineIds);
    working = working.map((line) => {
      if (!affectedLineIds.has(line.id)) return line;
      const nextGrams = Math.max(
        0.001,
        roundDecimal(line.quantityGrams * ratio, 3)
      );
      return {
        ...line,
        quantityGrams: nextGrams,
      };
    });
  }

  return working;
}
