import {
  AccordDefinition,
  FormulaLineItem,
  FormulaVersion,
  RawMaterial,
} from './types';

const SCALE = 1_000_000; // Micro-unit integer scaling for deterministic decimal math

export function roundDecimal(value: number, decimals: number = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function toScaledInt(value: number): number {
  return Math.round(value * SCALE);
}

export function fromScaledInt(scaled: number, decimals: number = 4): number {
  return roundDecimal(scaled / SCALE, decimals);
}

export interface CalculatedLineItem extends FormulaLineItem {
  normalizedPercentage: number;
  activeMaterialGrams: number;
  activeMaterialPercentOfTotal: number;
  lineCost: number;
}

export interface FormulaCalculationResult {
  items: CalculatedLineItem[];
  totalWeightGrams: number;
  totalRawPercentage: number;
  totalNormalizedPercentage: number;
  totalActiveMaterialGrams: number;
  totalActiveConcentrationPercent: number;
  totalCost: number;
  costPerGram: number;
  isNormalized: boolean;
}

/**
 * Deterministic calculation of formula quantities, normalized percentages,
 * dilution-aware active material equivalents, and costs.
 */
export function calculateFormulaMetrics(
  items: FormulaLineItem[]
): FormulaCalculationResult {
  const totalScaledWeight = items.reduce(
    (sum, item) => sum + toScaledInt(Math.max(0, item.quantityGrams)),
    0
  );
  const totalWeightGrams = fromScaledInt(totalScaledWeight, 3);

  let totalScaledActiveGrams = 0;
  let totalScaledCost = 0;
  let totalScaledRawPct = 0;

  const calculatedItems: CalculatedLineItem[] = items.map((item) => {
    const qty = Math.max(0, item.quantityGrams);
    const dilution = Math.min(100, Math.max(0, item.dilutionPercent));
    const normalizedPct =
      totalWeightGrams > 0 ? roundDecimal((qty / totalWeightGrams) * 100, 3) : 0;

    const activeGrams = roundDecimal(qty * (dilution / 100), 4);
    const activePctOfTotal =
      totalWeightGrams > 0
        ? roundDecimal((activeGrams / totalWeightGrams) * 100, 3)
        : 0;

    const lineCost = roundDecimal(qty * Math.max(0, item.costPerGram), 2);

    totalScaledActiveGrams += toScaledInt(activeGrams);
    totalScaledCost += toScaledInt(lineCost);
    totalScaledRawPct += toScaledInt(item.percentage || normalizedPct);

    return {
      ...item,
      percentage: normalizedPct,
      normalizedPercentage: normalizedPct,
      activeMaterialPercent: activePctOfTotal,
      activeMaterialGrams: activeGrams,
      activeMaterialPercentOfTotal: activePctOfTotal,
      lineCost,
    };
  });

  // Ensure exact 100.000% sum when items exist and have positive weight
  if (calculatedItems.length > 0 && totalWeightGrams > 0) {
    const sumExceptLast = calculatedItems
      .slice(0, -1)
      .reduce((acc, i) => acc + toScaledInt(i.normalizedPercentage), 0);
    const lastRemainder = fromScaledInt(toScaledInt(100) - sumExceptLast, 3);
    const lastIdx = calculatedItems.length - 1;
    calculatedItems[lastIdx].normalizedPercentage = Math.max(0, lastRemainder);
    calculatedItems[lastIdx].percentage = calculatedItems[lastIdx].normalizedPercentage;
  }

  const totalActiveGrams = fromScaledInt(totalScaledActiveGrams, 3);
  const totalCost = fromScaledInt(totalScaledCost, 2);
  const costPerGram =
    totalWeightGrams > 0 ? roundDecimal(totalCost / totalWeightGrams, 3) : 0;
  const totalRawPercentage = fromScaledInt(totalScaledRawPct, 3);
  const totalNormalizedPercentage =
    calculatedItems.length > 0 && totalWeightGrams > 0 ? 100 : 0;

  return {
    items: calculatedItems,
    totalWeightGrams,
    totalRawPercentage,
    totalNormalizedPercentage,
    totalActiveMaterialGrams: totalActiveGrams,
    totalActiveConcentrationPercent:
      totalWeightGrams > 0
        ? roundDecimal((totalActiveGrams / totalWeightGrams) * 100, 2)
        : 0,
    totalCost,
    costPerGram,
    isNormalized: Math.abs(totalRawPercentage - 100) <= 0.01,
  };
}

/**
 * Normalizes a formula so that quantities sum to 100.000 g (and percentages sum to 100.000%).
 */
export function normalizeFormulaTo100(items: FormulaLineItem[]): FormulaLineItem[] {
  const metrics = calculateFormulaMetrics(items);
  if (metrics.totalWeightGrams <= 0) return items;

  return metrics.items.map((item) => {
    const newQty = roundDecimal(item.normalizedPercentage, 3);
    const activePct = roundDecimal(newQty * (item.dilutionPercent / 100), 3);
    return {
      ...item,
      quantityGrams: newQty,
      percentage: newQty,
      activeMaterialPercent: activePct,
    };
  });
}

/**
 * Scales a formula to any target batch weight (e.g., 10g, 25g, 50g, 100g, 250g, 500g, 1000g)
 * without changing ingredient ratios.
 */
export function scaleFormulaToBatch(
  items: FormulaLineItem[],
  targetBatchGrams: number
): FormulaLineItem[] {
  if (targetBatchGrams <= 0) {
    throw new Error('Target batch weight must be greater than 0 g.');
  }
  const metrics = calculateFormulaMetrics(items);
  if (metrics.totalWeightGrams <= 0) return items;

  const scaled = metrics.items.map((item) => {
    const exactGrams = roundDecimal(
      (item.normalizedPercentage / 100) * targetBatchGrams,
      3
    );
    const activePct = roundDecimal(
      item.normalizedPercentage * (item.dilutionPercent / 100),
      3
    );
    return {
      ...item,
      quantityGrams: exactGrams,
      percentage: item.normalizedPercentage,
      activeMaterialPercent: activePct,
    };
  });

  // Adjust last item by micro-gram remainder so total equals targetBatchGrams exactly
  if (scaled.length > 0) {
    const sumBeforeLast = scaled
      .slice(0, -1)
      .reduce((acc, i) => acc + toScaledInt(i.quantityGrams), 0);
    const lastGrams = fromScaledInt(
      toScaledInt(targetBatchGrams) - sumBeforeLast,
      3
    );
    scaled[scaled.length - 1].quantityGrams = Math.max(0, lastGrams);
  }

  return scaled;
}

/**
 * Detects circular references in nested accords (e.g., Accord A -> Accord B -> Accord A).
 */
export function detectAccordCircularReference(
  accordGraph: Record<number, number[]>
): { hasCycle: boolean; cyclePath: number[] } {
  const visited = new Set<number>();
  const recStack = new Set<number>();
  const path: number[] = [];

  function dfs(node: number): boolean {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = accordGraph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        path.push(neighbor);
        return true;
      }
    }

    recStack.delete(node);
    path.pop();
    return false;
  }

  for (const nodeStr of Object.keys(accordGraph)) {
    const node = Number(nodeStr);
    if (!visited.has(node)) {
      if (dfs(node)) {
        return { hasCycle: true, cyclePath: [...path] };
      }
    }
  }

  return { hasCycle: false, cyclePath: [] };
}

/**
 * Expands any nested accords inside a formula into their constituent raw materials,
 * combining identical materials while preserving dilution awareness.
 */
export function expandNestedAccords(
  items: FormulaLineItem[],
  accords: AccordDefinition[]
): FormulaLineItem[] {
  const accordMap = new Map<number, AccordDefinition>(
    accords.map((a) => [a.id, a])
  );
  const expanded: FormulaLineItem[] = [];

  for (const item of items) {
    if (item.type === 'accord' && item.accordId && accordMap.has(item.accordId)) {
      const accord = accordMap.get(item.accordId)!;
      const accordTotalPct = accord.items.reduce((s, i) => s + i.percentage, 0) || 100;

      for (const sub of accord.items) {
        const subRatio = sub.percentage / accordTotalPct;
        const subGrams = roundDecimal(item.quantityGrams * subRatio, 3);
        const subPct = roundDecimal(item.percentage * subRatio, 3);
        const effectiveDilution = roundDecimal(
          (sub.dilutionPercent * item.dilutionPercent) / 100,
          2
        );
        expanded.push({
          id: `${item.id}-accord-${accord.id}-mat-${sub.materialId}`,
          type: 'material',
          materialId: sub.materialId,
          name: `${sub.materialName} (via ${accord.name})`,
          quantityGrams: subGrams,
          percentage: subPct,
          dilutionPercent: effectiveDilution,
          solvent: effectiveDilution < 100 ? 'Ethanol' : 'Neat',
          activeMaterialPercent: roundDecimal(subPct * (effectiveDilution / 100), 3),
          supplier: item.supplier || 'Accord Component',
          costPerGram: item.costPerGram,
          notes: `Expanded from ${accord.name}`,
        });
      }
    } else {
      expanded.push({ ...item });
    }
  }

  return expanded;
}

export interface VersionComparisonLine {
  name: string;
  materialId?: number;
  accordId?: number;
  v1Percent: number;
  v2Percent: number;
  deltaPercent: number;
  status: 'added' | 'removed' | 'increased' | 'decreased' | 'unchanged';
}

/**
 * Compares any two formula versions deterministically.
 */
export function compareFormulaVersions(
  v1: FormulaVersion,
  v2: FormulaVersion
): VersionComparisonLine[] {
  const m1 = calculateFormulaMetrics(v1.items);
  const m2 = calculateFormulaMetrics(v2.items);

  const map1 = new Map<string, CalculatedLineItem>();
  const map2 = new Map<string, CalculatedLineItem>();

  for (const item of m1.items) {
    map1.set(item.name.toLowerCase(), item);
  }
  for (const item of m2.items) {
    map2.set(item.name.toLowerCase(), item);
  }

  const allKeys = Array.from(new Set([...map1.keys(), ...map2.keys()]));
  const diffs: VersionComparisonLine[] = [];

  for (const key of allKeys) {
    const i1 = map1.get(key);
    const i2 = map2.get(key);
    const p1 = i1 ? i1.normalizedPercentage : 0;
    const p2 = i2 ? i2.normalizedPercentage : 0;
    const delta = roundDecimal(p2 - p1, 3);

    let status: VersionComparisonLine['status'] = 'unchanged';
    if (!i1 && i2) status = 'added';
    else if (i1 && !i2) status = 'removed';
    else if (delta > 0.001) status = 'increased';
    else if (delta < -0.001) status = 'decreased';

    diffs.push({
      name: (i2 || i1)!.name,
      materialId: (i2 || i1)!.materialId,
      accordId: (i2 || i1)!.accordId,
      v1Percent: p1,
      v2Percent: p2,
      deltaPercent: delta,
      status,
    });
  }

  return diffs.sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent));
}

export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Validates formula integrity with human-readable messages for perfumers.
 */
export function validateFormula(
  items: FormulaLineItem[],
  accordGraph: Record<number, number[]> = {}
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (items.length === 0) {
    issues.push({
      field: 'items',
      severity: 'warning',
      message: 'Formula has no ingredients yet. Add raw materials or an accord to begin.',
    });
    return issues;
  }

  const cycleCheck = detectAccordCircularReference(accordGraph);
  if (cycleCheck.hasCycle) {
    issues.push({
      field: 'accords',
      severity: 'error',
      message: `Nested accord circular reference detected (${cycleCheck.cyclePath.join(' → ')}). Remove recursive nesting.`,
    });
  }

  let rawPctSum = 0;
  for (const item of items) {
    if (item.quantityGrams < 0) {
      issues.push({
        field: item.name,
        severity: 'error',
        message: `${item.name} has a negative quantity (${item.quantityGrams} g). Quantities must be non-negative.`,
      });
    }
    if (item.dilutionPercent <= 0 || item.dilutionPercent > 100) {
      issues.push({
        field: item.name,
        severity: 'error',
        message: `${item.name} has an invalid concentration (${item.dilutionPercent}%). Must be between 0.01% and 100%.`,
      });
    }
    rawPctSum += item.percentage;
  }

  if (rawPctSum > 100.05) {
    issues.push({
      field: 'percentage',
      severity: 'warning',
      message: `Unnormalized formula percentages exceed 100% (${roundDecimal(rawPctSum, 2)}%). Click "Normalize to 100%" to balance ratios.`,
    });
  }

  return issues;
}

export const RADAR_CORE_FACETS: string[] = [
  'Green',
  'Citrus',
  'Floral',
  'Woody',
  'Musky',
  'Mossy',
  'Earthy',
  'Amber',
  'Spicy',
  'Sweet',
];

const FACET_KEYWORD_RULES: Record<string, { strong: string[]; subtle: string[] }> = {
  Green: {
    strong: ['green', 'leafy', 'grassy', 'stemmy', 'galbanic', 'cut-grass', 'violet leaf', 'foliage', 'chlorophyll'],
    subtle: ['forest', 'petitgrain', 'herbal', 'fig', 'tea'],
  },
  Citrus: {
    strong: ['citrus', 'bergamot', 'zesty', 'bitter peel', 'lemon', 'mandarin', 'grapefruit', 'orange', 'hesperidic'],
    subtle: ['sparkling', 'petitgrain', 'neroli', 'juicy'],
  },
  Floral: {
    strong: ['floral', 'transparent floral', 'jasmine', 'rose', 'white floral', 'orris-powdery', 'petal', 'neroli', 'ylang'],
    subtle: ['solar', 'powdery', 'linalool'],
  },
  Woody: {
    strong: ['woody', 'dry cedar', 'vetiver-rooty', 'sandalwood', 'coniferous', 'smoky wood', 'cedar', 'cypress', 'iso e', 'velvety'],
    subtle: ['pine-musk', 'bark', 'ambergris-mineral', 'patchouli'],
  },
  Musky: {
    strong: ['musky', 'skin-like', 'cashmere', 'clean linen', 'powdery musk', 'alicyclic', 'macrocyclic', 'pine-musk'],
    subtle: ['airy', 'ambrette-pear', 'velvety'],
  },
  Mossy: {
    strong: ['mossy', 'oakmoss', 'lichen', 'phenolic-moss', 'undergrowth', 'chypre'],
    subtle: ['bark', 'forest', 'damp'],
  },
  Earthy: {
    strong: ['earthy', 'petrichor', 'humus', 'rooty', 'vetiver-rooty', 'damp stone', 'patchouli', 'geosmin'],
    subtle: ['oakmoss', 'lichen', 'forest', 'bark'],
  },
  Amber: {
    strong: ['amber', 'ambergris-mineral', 'crystalline', 'labdanum', 'resinous', 'warm balsamic', 'ambrox', 'benzoin'],
    subtle: ['warm', 'mineral', 'tonka'],
  },
  Spicy: {
    strong: ['spicy', 'cold spice', 'cardamom', 'peppery', 'warm clove', 'saffron', 'cinnamon', 'nutmeg', 'ginger'],
    subtle: ['pine-musk', 'warm'],
  },
  Sweet: {
    strong: ['sweet', 'vanilla', 'gourmand', 'caramel', 'praline', 'roasted', 'maltol', 'honeyed pipe', 'coumarin'],
    subtle: ['ambrette-pear', 'pear-ester', 'fruity', 'lactonic', 'tonka'],
  },
  Aromatic: {
    strong: ['aromatic', 'lavender', 'herbal-camphor', 'rosemary', 'minty', 'sage', 'thyme'],
    subtle: ['herbal', 'mate-tea'],
  },
  Fruity: {
    strong: ['fruity', 'pear-ester', 'fig', 'cassis', 'orchard', 'lactonic'],
    subtle: ['ambrette-pear', 'juicy'],
  },
  Marine: {
    strong: ['marine', 'ozonic', 'sea spray', 'algae', 'saline'],
    subtle: ['aquatic'],
  },
  Mineral: {
    strong: ['mineral', 'wet slate', 'flint', 'chalk', 'metallic-clean', 'ambergris-mineral'],
    subtle: ['crystalline', 'damp stone'],
  },
  Leather: {
    strong: ['leather', 'suede', 'birch smoke', 'animalic', 'quinoline'],
    subtle: ['smoky wood'],
  },
};

export interface FacetRadarAxisPoint {
  facet: string;
  targetScore: number; // 0..10
  currentScore: number; // 0..10
  delta: number; // currentScore - targetScore
  status: 'on-target' | 'under-target' | 'over-target';
  topContributors: Array<{
    name: string;
    sharePercent: number;
  }>;
}

export interface FormulaFacetRadarResult {
  axes: FacetRadarAxisPoint[];
  alignmentPercent: number; // 0..100 overall similarity to target profile
  meanAbsoluteDelta: number;
  onTargetCount: number;
  underTargetFacets: FacetRadarAxisPoint[];
  overTargetFacets: FacetRadarAxisPoint[];
  dominantCurrentFacets: string[];
}

/**
 * Computes the affinity (0.0 to 1.0) of a RawMaterial for a given olfactory facet.
 */
export function getMaterialFacetAffinity(
  material: RawMaterial,
  facet: string
): number {
  const facetKey = facet.trim();
  const facetLower = facetKey.toLowerCase();
  const primaryLower = material.primaryFamily.toLowerCase();

  let score = 0;

  // Direct primary family match
  if (
    primaryLower === facetLower ||
    (facetLower === 'sweet' && primaryLower === 'gourmand')
  ) {
    score = Math.max(score, 1.0);
  }

  // Direct sub-facet string match
  const materialFacetsLower = material.facets.map((f) => f.toLowerCase());
  if (materialFacetsLower.some((f) => f === facetLower || f.includes(facetLower))) {
    score = Math.max(score, 0.85);
  }

  // Keyword rule lookup
  const rule =
    FACET_KEYWORD_RULES[facetKey] ||
    Object.entries(FACET_KEYWORD_RULES).find(
      ([k]) => k.toLowerCase() === facetLower
    )?.[1];

  if (rule) {
    const combinedTokens = [
      primaryLower,
      ...materialFacetsLower,
    ];
    if (
      rule.strong.some((kw) =>
        combinedTokens.some((tok) => tok === kw || tok.includes(kw))
      )
    ) {
      score = Math.max(score, 0.78);
    } else if (
      rule.subtle.some((kw) =>
        combinedTokens.some((tok) => tok === kw || tok.includes(kw))
      )
    ) {
      score = Math.max(score, 0.35);
    }
  }

  return roundDecimal(Math.min(1, score), 3);
}

/**
 * Pure, deterministic calculation comparing a formula's target scent facets (0-10)
 * against the current formulation's weighted olfactory profile (0-10).
 */
export function computeFormulaFacetRadarComparison(
  items: FormulaLineItem[],
  materials: RawMaterial[],
  accords: AccordDefinition[],
  targetFacets: Record<string, number>,
  options?: {
    includeAllCoreFacets?: boolean;
    tolerance?: number;
  }
): FormulaFacetRadarResult {
  const tolerance = options?.tolerance ?? 1.2;
  const includeAllCore = options?.includeAllCoreFacets ?? false;

  // Determine ordered list of facets to evaluate
  const targetKeys = Object.keys(targetFacets);
  const facetSet = new Set<string>(targetKeys);

  if (includeAllCore || facetSet.size < 6) {
    for (const core of RADAR_CORE_FACETS) {
      if (includeAllCore || facetSet.size < 8) {
        facetSet.add(core);
      }
    }
  }

  const orderedFacets = Array.from(facetSet);

  // Expand nested accords so both raw materials and accords are accounted for
  const expandedItems = expandNestedAccords(items, accords);
  const materialMap = new Map<number, RawMaterial>(
    materials.map((m) => [m.id, m])
  );

  // Compute working olfactory dose and odor impact per expanded item
  const itemImpacts = expandedItems.map((item) => {
    const qty = Math.max(0, item.quantityGrams);
    const dilution = Math.min(100, Math.max(0, item.dilutionPercent));
    const mat = item.materialId ? materialMap.get(item.materialId) : undefined;
    const refDilution = Math.max(1, mat?.recommendedDilution || 100);
    // Working olfactory dose normalizes against the material's standard working dilution
    const workingOdorGrams = qty * Math.min(2.5, dilution / refDilution);
    return {
      item,
      mat,
      activeGrams: workingOdorGrams,
      intensity: mat ? mat.intensity : 6,
    };
  });

  const totalActiveGrams = itemImpacts.reduce((s, x) => s + x.activeGrams, 0);

  // Compute raw impact per facet
  const rawFacetScores: Record<string, number> = {};
  const facetContributors: Record<
    string,
    Map<string, number>
  > = {};

  for (const facet of orderedFacets) {
    rawFacetScores[facet] = 0;
    facetContributors[facet] = new Map<string, number>();
  }

  if (totalActiveGrams > 0) {
    for (const entry of itemImpacts) {
      if (entry.activeGrams <= 0) continue;
      const activeShare = entry.activeGrams / totalActiveGrams;
      // Psychophysical Stevens' Power Law compression + material odor intensity boost
      const intensityBoost = Math.pow(entry.intensity / 6, 1.35);
      const effectiveOdorImpact = Math.pow(activeShare, 0.56) * intensityBoost;

      for (const facet of orderedFacets) {
        let affinity = 0;
        if (entry.mat) {
          affinity = getMaterialFacetAffinity(entry.mat, facet);
        }
        if (affinity > 0) {
          const contribution = effectiveOdorImpact * affinity;
          rawFacetScores[facet] += contribution;
          const cleanName = entry.item.name.replace(/\s*\(via .*\)$/, '');
          const prev = facetContributors[facet].get(cleanName) || 0;
          facetContributors[facet].set(cleanName, prev + contribution);
        }
      }
    }
  }

  // Also blend explicit accord olfactoryProfile if an unexpanded accord has one
  const maxRaw = Math.max(...Object.values(rawFacetScores), 0.001);
  // Scale factor: maps typical perfumery odor impact sums onto the 0..10 scale
  // Uses adaptive saturation curve 10 * (1 - exp(-k * raw)) blended with relative dominance
  const axes: FacetRadarAxisPoint[] = orderedFacets.map((facet) => {
    const targetScore = roundDecimal(
      Math.min(10, Math.max(0, targetFacets[facet] ?? 0)),
      1
    );
    const raw = rawFacetScores[facet] || 0;

    let currentScore = 0;
    if (totalActiveGrams > 0 && raw > 0) {
      // Combine absolute saturation curve and relative dominance
      const saturationScore = 10 * (1 - Math.exp(-1.15 * raw));
      const relativeScore = (raw / Math.max(maxRaw, 0.8)) * 8.6;
      currentScore = roundDecimal(
        Math.min(10, Math.max(0, saturationScore * 0.65 + relativeScore * 0.35)),
        1
      );
    }

    const delta = roundDecimal(currentScore - targetScore, 1);
    let status: FacetRadarAxisPoint['status'] = 'on-target';
    if (delta < -tolerance) {
      status = 'under-target';
    } else if (delta > tolerance) {
      status = 'over-target';
    }

    const contribEntries = Array.from(facetContributors[facet].entries());
    const totalFacetContrib =
      contribEntries.reduce((s, [, v]) => s + v, 0) || 1;
    const topContributors = contribEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, val]) => ({
        name,
        sharePercent: roundDecimal((val / totalFacetContrib) * 100, 0),
      }));

    return {
      facet,
      targetScore,
      currentScore,
      delta,
      status,
      topContributors,
    };
  });

  // Compute overall alignment percentage (0..100%)
  let alignmentPercent = 0;
  let meanAbsoluteDelta = 0;
  if (axes.length > 0 && totalActiveGrams > 0) {
    const sumSqDiff = axes.reduce(
      (acc, ax) => acc + Math.pow(ax.currentScore - ax.targetScore, 2),
      0
    );
    const rmse = Math.sqrt(sumSqDiff / axes.length);
    alignmentPercent = Math.round(
      Math.max(0, Math.min(100, (1 - rmse / 10) * 100))
    );
    meanAbsoluteDelta = roundDecimal(
      axes.reduce((acc, ax) => acc + Math.abs(ax.delta), 0) / axes.length,
      2
    );
  }

  const onTargetCount = axes.filter((a) => a.status === 'on-target').length;
  const underTargetFacets = axes
    .filter((a) => a.status === 'under-target')
    .sort((a, b) => a.delta - b.delta);
  const overTargetFacets = axes
    .filter((a) => a.status === 'over-target')
    .sort((a, b) => b.delta - a.delta);
  const dominantCurrentFacets = [...axes]
    .filter((a) => a.currentScore >= 3.5)
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, 4)
    .map((a) => a.facet);

  return {
    axes,
    alignmentPercent,
    meanAbsoluteDelta,
    onTargetCount,
    underTargetFacets,
    overTargetFacets,
    dominantCurrentFacets,
  };
}

/**
 * Supported quick-access units for converting and scaling formula total mass/volume.
 * - 'g': Grams (metric mass)
 * - 'oz': Ounces (avoirdupois ounce: 1 oz = 28.349523125 g)
 * - 'ml': Milliliters (volume derived via fragrance specific gravity / density in g/mL)
 */
export type FormulaMassUnit = 'g' | 'oz' | 'ml';

export const GRAMS_PER_OUNCE = 28.349523125;
export const DEFAULT_PERFUME_DENSITY_G_PER_ML = 0.88;

export interface PerfumeDensityPreset {
  id: string;
  label: string;
  densityGPerMl: number;
  description: string;
}

export const PERFUME_DENSITY_PRESETS: PerfumeDensityPreset[] = [
  {
    id: 'edp-ethanol',
    label: '0.85 g/mL · EdP Alcohol Blend',
    densityGPerMl: 0.85,
    description: 'Standard Eau de Parfum in 96% perfumery ethanol (~0.85 g/mL)',
  },
  {
    id: 'concentrate-blend',
    label: '0.88 g/mL · Fragrance Concentrate',
    densityGPerMl: 0.88,
    description: 'Typical neat fragrance concentrate / aromatic blend (~0.88 g/mL)',
  },
  {
    id: 'heavy-resin-oil',
    label: '0.95 g/mL · Resin / Oil Base',
    densityGPerMl: 0.95,
    description: 'Dense resinoid, wood, or carrier oil composition (~0.95 g/mL)',
  },
  {
    id: 'water-reference',
    label: '1.00 g/mL · Aqueous Reference',
    densityGPerMl: 1.0,
    description: '1:1 nominal density reference (1.00 g/mL)',
  },
];

export interface FormulaMassConversionBreakdown {
  grams: number;
  ounces: number;
  milliliters: number;
  densityGPerMl: number;
  formattedGrams: string;
  formattedOunces: string;
  formattedMilliliters: string;
}

/**
 * Converts a mass in Grams (g) into the target unit ('g' | 'oz' | 'ml').
 */
export function convertGramsToUnit(
  grams: number,
  unit: FormulaMassUnit,
  densityGPerMl: number = DEFAULT_PERFUME_DENSITY_G_PER_ML,
  decimals: number = 3
): number {
  const safeGrams = Number.isFinite(grams) ? Math.max(0, grams) : 0;
  const safeDensity =
    Number.isFinite(densityGPerMl) && densityGPerMl > 0
      ? densityGPerMl
      : DEFAULT_PERFUME_DENSITY_G_PER_ML;

  if (unit === 'g') {
    return roundDecimal(safeGrams, decimals);
  }
  if (unit === 'oz') {
    return roundDecimal(safeGrams / GRAMS_PER_OUNCE, decimals);
  }
  return roundDecimal(safeGrams / safeDensity, decimals);
}

/**
 * Converts a value in the specified unit ('g' | 'oz' | 'ml') back to Grams (g).
 */
export function convertUnitToGrams(
  amount: number,
  unit: FormulaMassUnit,
  densityGPerMl: number = DEFAULT_PERFUME_DENSITY_G_PER_ML,
  decimals: number = 3
): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const safeDensity =
    Number.isFinite(densityGPerMl) && densityGPerMl > 0
      ? densityGPerMl
      : DEFAULT_PERFUME_DENSITY_G_PER_ML;

  if (unit === 'g') {
    return roundDecimal(safeAmount, decimals);
  }
  if (unit === 'oz') {
    return roundDecimal(safeAmount * GRAMS_PER_OUNCE, decimals);
  }
  return roundDecimal(safeAmount * safeDensity, decimals);
}

/**
 * Computes a complete, deterministic breakdown of a formula's total mass
 * across Grams (g), Ounces (oz), and Milliliters (mL) simultaneously.
 */
export function convertFormulaTotalMassBreakdown(
  totalWeightGrams: number,
  densityGPerMl: number = DEFAULT_PERFUME_DENSITY_G_PER_ML
): FormulaMassConversionBreakdown {
  const safeDensity =
    Number.isFinite(densityGPerMl) && densityGPerMl > 0
      ? roundDecimal(densityGPerMl, 3)
      : DEFAULT_PERFUME_DENSITY_G_PER_ML;

  const grams = convertGramsToUnit(totalWeightGrams, 'g', safeDensity, 3);
  const ounces = convertGramsToUnit(totalWeightGrams, 'oz', safeDensity, 3);
  const milliliters = convertGramsToUnit(totalWeightGrams, 'ml', safeDensity, 2);

  return {
    grams,
    ounces,
    milliliters,
    densityGPerMl: safeDensity,
    formattedGrams: `${grams.toFixed(3)} g`,
    formattedOunces: `${ounces.toFixed(3)} oz`,
    formattedMilliliters: `${milliliters.toFixed(2)} mL`,
  };
}

/**
 * Scales an entire formula's ingredients proportionally so its total mass
 * equals the requested target amount in Grams ('g'), Ounces ('oz'), or Milliliters ('ml').
 */
export function scaleFormulaByUnitTarget(
  items: FormulaLineItem[],
  targetAmount: number,
  unit: FormulaMassUnit,
  densityGPerMl: number = DEFAULT_PERFUME_DENSITY_G_PER_ML
): {
  targetGrams: number;
  scaledItems: FormulaLineItem[];
  breakdown: FormulaMassConversionBreakdown;
} {
  const targetGrams = convertUnitToGrams(targetAmount, unit, densityGPerMl, 3);
  if (targetGrams <= 0) {
    return {
      targetGrams: 0,
      scaledItems: items,
      breakdown: convertFormulaTotalMassBreakdown(0, densityGPerMl),
    };
  }
  const scaledItems = scaleFormulaToBatch(items, targetGrams);
  const actualTotalGrams = scaledItems.reduce(
    (sum, item) => sum + item.quantityGrams,
    0
  );
  return {
    targetGrams: roundDecimal(actualTotalGrams, 3),
    scaledItems,
    breakdown: convertFormulaTotalMassBreakdown(actualTotalGrams, densityGPerMl),
  };
}


