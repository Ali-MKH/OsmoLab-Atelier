import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFormulaMetrics,
  normalizeFormulaTo100,
  scaleFormulaToBatch,
  detectAccordCircularReference,
  expandNestedAccords,
  compareFormulaVersions,
  validateFormula,
  computeFormulaFacetRadarComparison,
  getMaterialFacetAffinity,
  GRAMS_PER_OUNCE,
  DEFAULT_PERFUME_DENSITY_G_PER_ML,
  convertGramsToUnit,
  convertUnitToGrams,
  convertFormulaTotalMassBreakdown,
  scaleFormulaByUnitTarget,
} from './formula-engine';
import {
  evaluateFormulaSafety,
  autoCapMaterialToIfraLimit,
  resolveCategoryThresholdPercent,
} from './safety-engine';
import {
  SEED_ACCORDS,
  SEED_FORMULAS,
  SEED_MATERIALS,
  SEED_REGULATORY_LIMITS,
} from './seed-data';

test('Formula normalization normalizes arbitrary gram weights to 100.000%', () => {
  const rawItems = [
    {
      id: '1',
      type: 'material' as const,
      materialId: 1,
      name: 'Bergamot FCF',
      quantityGrams: 5,
      percentage: 5,
      dilutionPercent: 100,
      solvent: 'Neat',
      activeMaterialPercent: 5,
      supplier: 'Capua',
      costPerGram: 0.5,
      notes: '',
    },
    {
      id: '2',
      type: 'material' as const,
      materialId: 2,
      name: 'Hedione',
      quantityGrams: 15,
      percentage: 15,
      dilutionPercent: 100,
      solvent: 'Neat',
      activeMaterialPercent: 15,
      supplier: 'Firmenich',
      costPerGram: 0.2,
      notes: '',
    },
  ];

  const normalized = normalizeFormulaTo100(rawItems);
  assert.equal(normalized[0].percentage, 25);
  assert.equal(normalized[1].percentage, 75);
  assert.equal(normalized[0].quantityGrams + normalized[1].quantityGrams, 100);
});

test('Batch scaling preserves ingredient ratios across 10g, 250g, 500g, and 1000g batches', () => {
  const v5Items = SEED_FORMULAS[0].versions[2].items;
  for (const targetWeight of [10, 25, 50, 100, 250, 500, 1000]) {
    const scaled = scaleFormulaToBatch(v5Items, targetWeight);
    const sum = scaled.reduce((acc, i) => acc + i.quantityGrams, 0);
    assert.ok(
      Math.abs(sum - targetWeight) < 0.005,
      `Expected sum ${sum} to equal ${targetWeight}`
    );
    // Bergamot is 8% of V5
    const bergamot = scaled.find((i) => i.name === 'Bergamot FCF')!;
    assert.equal(bergamot.quantityGrams, Number((0.08 * targetWeight).toFixed(3)));
  }
});

test('Dilution awareness distinguishes solution weight vs active material weight', () => {
  const v4Items = SEED_FORMULAS[0].versions[1].items;
  const metrics = calculateFormulaMetrics(v4Items);
  const oakmoss = metrics.items.find((i) => i.name.includes('Oakmoss'))!;
  // 2.0g of 10% Oakmoss in 100g formula = 2.0% solution, 0.2% active material
  assert.equal(oakmoss.normalizedPercentage, 2.0);
  assert.equal(oakmoss.activeMaterialGrams, 0.2);
  assert.equal(oakmoss.activeMaterialPercentOfTotal, 0.2);
});

test('Nested accord circular reference detector catches cycles and expandNestedAccords flattens accords', () => {
  const cyclicGraph = {
    1: [2],
    2: [3],
    3: [1],
  };
  const check = detectAccordCircularReference(cyclicGraph);
  assert.equal(check.hasCycle, true);

  const acyclicGraph = {
    1: [2, 3],
    2: [3],
    3: [],
  };
  assert.equal(detectAccordCircularReference(acyclicGraph).hasCycle, false);

  const formulaWithAccord = [
    {
      id: 'acc-1',
      type: 'accord' as const,
      accordId: 1,
      name: 'Mediterranean Citrus Accord',
      quantityGrams: 20,
      percentage: 20,
      dilutionPercent: 100,
      solvent: 'Neat',
      activeMaterialPercent: 20,
      supplier: 'In-House',
      costPerGram: 0.35,
      notes: '',
    },
  ];
  const expanded = expandNestedAccords(formulaWithAccord, SEED_ACCORDS);
  assert.equal(expanded.length, 3);
  assert.equal(expanded[0].quantityGrams, 13); // 65% of 20g = 13g Bergamot FCF
});

test('Version comparison accurately computes V4 vs V5 deltas (+4% Hedione, +1% Ambroxan)', () => {
  const v4 = SEED_FORMULAS[0].versions[1];
  const v5 = SEED_FORMULAS[0].versions[2];
  const diffs = compareFormulaVersions(v4, v5);

  const hedioneDiff = diffs.find((d) => d.name === 'Hedione')!;
  assert.equal(hedioneDiff.v1Percent, 12);
  assert.equal(hedioneDiff.v2Percent, 16);
  assert.equal(hedioneDiff.deltaPercent, 4);

  const ambroxanDiff = diffs.find((d) => d.name === 'Ambroxan')!;
  assert.equal(ambroxanDiff.v1Percent, 3);
  assert.equal(ambroxanDiff.v2Percent, 4);
  assert.equal(ambroxanDiff.deltaPercent, 1);

  const bergamotDiff = diffs.find((d) => d.name === 'Bergamot FCF')!;
  assert.equal(bergamotDiff.deltaPercent, 0);
  assert.equal(bergamotDiff.status, 'unchanged');
});

test('Safety engine strictly checks stored IFRA limits and flags missing regulatory data without fabricating limits', () => {
  const v5Items = SEED_FORMULAS[0].versions[2].items;
  const safety = evaluateFormulaSafety(
    v5Items,
    SEED_ACCORDS,
    SEED_REGULATORY_LIMITS,
    'Category 4 (Fine Fragrance)',
    20
  );

  // Virginia Cedarwood EO (materialId 10) has maxAllowedPercent: null in seed data
  const cedarEval = safety.evaluations.find((e) => e.materialId === 10)!;
  assert.equal(cedarEval.status, 'Safety information unavailable');
  assert.equal(
    cedarEval.statusMessage,
    'Safety information unavailable. Manual verification required.'
  );
  assert.equal(cedarEval.maxAllowedPercentInFinalProduct, null);

  // Oakmoss 10% at 2.84% in concentrate = 0.284% active in concentrate -> at 20% EDP = 0.0568% active in final product (<= 0.10% limit)
  const oakmossEval = safety.evaluations.find((e) => e.materialId === 3)!;
  assert.equal(oakmossEval.status, 'Within stored limit');
  assert.equal(oakmossEval.concentrationInFinalProduct, 0.0568);
});

test('Validation engine catches negative quantities and >100% unnormalized totals', () => {
  const badItems = [
    {
      id: '1',
      type: 'material' as const,
      materialId: 1,
      name: 'Bergamot FCF',
      quantityGrams: -2,
      percentage: 120,
      dilutionPercent: 100,
      solvent: 'Neat',
      activeMaterialPercent: 120,
      supplier: '',
      costPerGram: 0,
      notes: '',
    },
  ];
  const issues = validateFormula(badItems);
  assert.ok(issues.some((i) => i.severity === 'error'));
  assert.ok(issues.some((i) => i.field === 'percentage'));
});

test('Spider/Radar facet comparison computes target vs current scores, contributors, and alignment for Forest Study V5', () => {
  const forestFormula = SEED_FORMULAS[0];
  const v5Items = forestFormula.versions[2].items;

  const radar = computeFormulaFacetRadarComparison(
    v5Items,
    SEED_MATERIALS,
    SEED_ACCORDS,
    forestFormula.targetFacets
  );

  assert.equal(radar.axes.length, 8);
  assert.ok(radar.alignmentPercent >= 60 && radar.alignmentPercent <= 100);

  const greenAxis = radar.axes.find((a) => a.facet === 'Green')!;
  assert.equal(greenAxis.targetScore, 8);
  assert.ok(greenAxis.currentScore > 4, 'Expected substantial Green score in Forest Study V5');
  assert.ok(greenAxis.topContributors.length > 0);

  const woodyAxis = radar.axes.find((a) => a.facet === 'Woody')!;
  assert.equal(woodyAxis.targetScore, 6);
  assert.ok(woodyAxis.currentScore > 5, 'Expected strong Woody score from Iso E Super, Vetiver, and Cedarwood');

  // Verify V5A More Musk has a higher Musky facet score than V5
  const v5aItems = forestFormula.versions[3].items;
  const radarV5A = computeFormulaFacetRadarComparison(
    v5aItems,
    SEED_MATERIALS,
    SEED_ACCORDS,
    forestFormula.targetFacets
  );
  const muskyV5 = radar.axes.find((a) => a.facet === 'Musky')!.currentScore;
  const muskyV5A = radarV5A.axes.find((a) => a.facet === 'Musky')!.currentScore;
  assert.ok(
    muskyV5A >= muskyV5,
    `Expected V5A Musky score (${muskyV5A}) >= V5 Musky score (${muskyV5})`
  );
});

test('Spider/Radar facet comparison supports full 10-axis olfactory mode and material affinity lookup', () => {
  const bergamot = SEED_MATERIALS.find((m) => m.name === 'Bergamot FCF')!;
  assert.equal(getMaterialFacetAffinity(bergamot, 'Citrus'), 1);
  assert.ok(getMaterialFacetAffinity(bergamot, 'Green') > 0.7);

  const whiteFloral = SEED_FORMULAS[1];
  const radarAll = computeFormulaFacetRadarComparison(
    whiteFloral.versions[0].items,
    SEED_MATERIALS,
    SEED_ACCORDS,
    whiteFloral.targetFacets,
    { includeAllCoreFacets: true }
  );
  assert.ok(radarAll.axes.length >= 10);
});

test('Quick-access unit converter accurately converts between Grams (g), Ounces (oz), and Milliliters (mL)', () => {
  // 100g breakdown at default 0.88 g/mL density
  const breakdown100 = convertFormulaTotalMassBreakdown(
    100,
    DEFAULT_PERFUME_DENSITY_G_PER_ML
  );
  assert.equal(breakdown100.grams, 100);
  // 100 / 28.349523125 = 3.527396... -> 3.527 oz
  assert.equal(breakdown100.ounces, 3.527);
  // 100 / 0.88 = 113.6363... -> 113.64 mL
  assert.equal(breakdown100.milliliters, 113.64);
  assert.equal(breakdown100.formattedGrams, '100.000 g');
  assert.equal(breakdown100.formattedOunces, '3.527 oz');
  assert.equal(breakdown100.formattedMilliliters, '113.64 mL');

  // Round-trip: 2 oz -> grams -> oz
  const gramsFor2Oz = convertUnitToGrams(2, 'oz');
  assert.equal(gramsFor2Oz, Number((2 * GRAMS_PER_OUNCE).toFixed(3)));
  assert.equal(convertGramsToUnit(gramsFor2Oz, 'oz'), 2);

  // Round-trip: 50 mL at 0.85 g/mL -> 42.5 g -> 50 mL
  const gramsFor50Ml = convertUnitToGrams(50, 'ml', 0.85);
  assert.equal(gramsFor50Ml, 42.5);
  assert.equal(convertGramsToUnit(gramsFor50Ml, 'ml', 0.85, 2), 50);
});

test('scaleFormulaByUnitTarget scales entire formula proportionally to target Ounces (oz) or Milliliters (mL)', () => {
  const v5Items = SEED_FORMULAS[0].versions[2].items;

  // Scale to 2 oz (~56.699 g)
  const scaledOz = scaleFormulaByUnitTarget(v5Items, 2, 'oz', 0.88);
  assert.equal(scaledOz.targetGrams, 56.699);
  assert.equal(scaledOz.breakdown.ounces, 2);
  const bergamotOz = scaledOz.scaledItems.find((i) => i.name === 'Bergamot FCF')!;
  // Bergamot is 8% of 56.699 g = 4.536 g
  assert.equal(bergamotOz.quantityGrams, 4.536);

  // Scale to 100 mL at 0.85 g/mL density (= 85.000 g)
  const scaledMl = scaleFormulaByUnitTarget(v5Items, 100, 'ml', 0.85);
  assert.equal(scaledMl.targetGrams, 85);
  assert.equal(scaledMl.breakdown.milliliters, 100);
  const bergamotMl = scaledMl.scaledItems.find((i) => i.name === 'Bergamot FCF')!;
  // 8% of 85g = 6.8g
  assert.equal(bergamotMl.quantityGrams, 6.8);
});

test('Real-time safety monitor aggregates cumulative concentrations across direct lines + nested accords and flags Safety Risk', () => {
  const v5Items = SEED_FORMULAS[0].versions[2].items;
  // Insert Wet Forest Floor Accord (accordId: 2, 20g) which contains Oakmoss 10% (25%), Violet Leaf 10% (25%), Vetiver (30%), Cedarwood (20%)
  const itemsWithAccord = [
    ...v5Items,
    {
      id: 'accord-forest-floor',
      type: 'accord' as const,
      accordId: 2,
      name: 'Wet Forest Floor Accord',
      quantityGrams: 20,
      percentage: 20,
      dilutionPercent: 100,
      solvent: 'Neat',
      activeMaterialPercent: 20,
      supplier: 'In-House Accord',
      costPerGram: 0.45,
      notes: 'Nested Accord',
    },
  ];

  const report = evaluateFormulaSafety(
    itemsWithAccord,
    SEED_ACCORDS,
    SEED_REGULATORY_LIMITS,
    'Category 4 (Fine Fragrance)',
    20
  );

  // Vetiver Haiti EO is present both directly (7g) and via Wet Forest Floor Accord (30% of 20g = 6g) -> 13g in 120g formula = 10.833% active in concentrate -> 2.1667% in final product (> 1.50% limit!)
  const vetiverEval = report.evaluations.find((e) => e.materialId === 8)!;
  assert.equal(vetiverEval.contributingSources.length, 2);
  assert.equal(vetiverEval.isSafetyRisk, true);
  assert.equal(vetiverEval.badgeLabel, 'Safety Risk');
  assert.ok(vetiverEval.concentrationInFinalProduct > 1.5);
  assert.ok(vetiverEval.sourceLineIds.includes('accord-forest-floor'));

  // Auto-capping Vetiver reduces its contributing lines below the IFRA threshold
  const cappedItems = autoCapMaterialToIfraLimit(
    itemsWithAccord,
    SEED_ACCORDS,
    SEED_REGULATORY_LIMITS,
    8,
    'Category 4 (Fine Fragrance)',
    20
  );
  const cappedReport = evaluateFormulaSafety(
    cappedItems,
    SEED_ACCORDS,
    SEED_REGULATORY_LIMITS,
    'Category 4 (Fine Fragrance)',
    20
  );
  const cappedVetiver = cappedReport.evaluations.find((e) => e.materialId === 8)!;
  assert.equal(cappedVetiver.isSafetyRisk, false);
  assert.ok(cappedVetiver.concentrationInFinalProduct <= 1.5);
});

test('Safety monitor resolves category-specific IFRA thresholds from categoryLimitsTable (Cat 1, Cat 2, Cat 5A, etc.)', () => {
  const bergamotLimit = SEED_REGULATORY_LIMITS.find((r) => r.materialId === 1)!;
  assert.equal(resolveCategoryThresholdPercent(bergamotLimit, 'Cat 4'), 4.5);
  assert.equal(
    resolveCategoryThresholdPercent(bergamotLimit, 'Category 5A (Body Lotions & Creams)'),
    1.2
  );
  assert.equal(
    resolveCategoryThresholdPercent(bergamotLimit, 'Category 1 (Lip Products & Balms)'),
    0.15
  );

  // In Forest Study V5 at 20% conc., Bergamot FCF is 1.60% in final product: safe in Cat 4 (4.5%), but Safety Risk in Cat 5A (1.2%)
  const v5Items = SEED_FORMULAS[0].versions[2].items;
  const cat5AReport = evaluateFormulaSafety(
    v5Items,
    SEED_ACCORDS,
    SEED_REGULATORY_LIMITS,
    'Category 5A (Body Lotions & Creams)',
    20
  );
  const bergamotCat5A = cat5AReport.evaluations.find((e) => e.materialId === 1)!;
  assert.equal(bergamotCat5A.isSafetyRisk, true);
  assert.equal(bergamotCat5A.badgeLabel, 'Safety Risk');
  assert.equal(bergamotCat5A.maxAllowedPercentInFinalProduct, 1.2);
});
test('Improvement Insight engine detects under-target deficits and identifies high-affinity material additions', () => {
  const v5Items = SEED_FORMULAS[0].versions[2].items;
  // Set an intentional deficit: Floral target 9 (Hedione only provides ~5 in current formula)
  const targets = {
    Green: 7,
    Woody: 6,
    Floral: 9,
    Citrus: 4,
  };

  const radar = computeFormulaFacetRadarComparison(
    v5Items,
    SEED_MATERIALS,
    SEED_ACCORDS,
    targets,
    { includeAllCoreFacets: true, tolerance: 1.0 }
  );

  const floralAxis = radar.axes.find((a) => a.facet === 'Floral');
  assert.ok(floralAxis, 'Floral axis should be evaluated');
  assert.ok(floralAxis.delta < -1.0, 'Floral should be flagged as under-target deficit');

  // Hedione in SEED_MATERIALS should have high affinity to Floral facet
  const hedione = SEED_MATERIALS.find((m) => m.name === 'Hedione')!;
  assert.ok(hedione, 'Hedione should exist in SEED_MATERIALS');
  const floralAffinity = getMaterialFacetAffinity(hedione, 'Floral');
  assert.ok(floralAffinity >= 0.7, 'Hedione should have high Floral affinity');

  // Ambroxan in SEED_MATERIALS should have high affinity to Amber facet
  const ambroxan = SEED_MATERIALS.find((m) => m.name === 'Ambroxan')!;
  assert.ok(ambroxan, 'Ambroxan should exist in SEED_MATERIALS');
  const amberAffinity = getMaterialFacetAffinity(ambroxan, 'Amber');
  assert.ok(amberAffinity >= 0.7, 'Ambroxan should have high Amber affinity');
});

test('Dual regulatory engine evaluates both IFRA 51st Amendment and EU Cosmetics Regulation (EC 1223/2009)', () => {
  const v5Items = SEED_FORMULAS[0].versions[1].items;
  const report = evaluateFormulaSafety(
    v5Items,
    SEED_ACCORDS,
    SEED_REGULATORY_LIMITS,
    'Category 4 (Fine Fragrance)',
    20 // 20% finished product concentration
  );

  // Checks both IFRA and EU compliance
  assert.strictEqual(typeof report.overallCompliant, 'boolean', 'report has overallCompliant (IFRA)');
  assert.strictEqual(typeof report.euOverallCompliant, 'boolean', 'report has euOverallCompliant (EU)');
  assert.strictEqual(typeof report.euViolationCount, 'number', 'report tracks EU violation count');
  assert.strictEqual(typeof report.euAllergenDeclarationCount, 'number', 'report tracks EU declarable allergens count');

  // Verify at least one material has EU cosmetic limit evaluation
  const oakmossEval = report.evaluations.find((ev) => ev.materialName.includes('Oakmoss'));
  assert.ok(oakmossEval, 'Oakmoss should be evaluated in safety report');
  assert.ok(oakmossEval.euCosmeticLimitPercent !== null, 'Oakmoss should have EU Cosmetic limit');
  assert.ok(oakmossEval.euComplianceStatus, 'Oakmoss should have EU compliance status');
});


