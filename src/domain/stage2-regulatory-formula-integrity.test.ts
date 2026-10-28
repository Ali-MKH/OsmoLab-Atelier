import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setPersistenceModeOverride } from '../db/index.ts';
import {
  evaluateFormulaSafety,
  resolveIfraCategoryRule,
  resolveCategoryThresholdPercent,
  resolveProductExposureType,
  formatVerificationStatusLabel,
} from './safety-engine.ts';
import { expandNestedAccords } from './formula-engine.ts';
import {
  AccordDefinition,
  FormulaLineItem,
  MaterialConstituent,
  MaterialRegulatoryLimit,
  MaterialRegulatoryRecord,
} from './types.ts';
import { loadGlobalCatalogV11 } from '../db/catalog-v1-1.ts';
import {
  fetchFullWorkspace,
  saveFormulaAndVersionInDb,
  createAccordInDb,
  updateAccordAndCreateVersion,
  addExperimentEntryInDb,
  addEvaluationInDb,
  FormulaIntegrityError,
} from '../db/workspace-repo.ts';

setPersistenceModeOverride('memory');

function makeLineItem(
  partial: Partial<FormulaLineItem> & {
    id: string;
    type: 'material' | 'accord';
    name: string;
    quantityGrams: number;
  }
): FormulaLineItem {
  const dilutionPercent = partial.dilutionPercent ?? 100;
  return {
    id: partial.id,
    type: partial.type,
    materialId: partial.materialId,
    accordId: partial.accordId,
    accordVersionId: partial.accordVersionId ?? null,
    accordVersionLabel: partial.accordVersionLabel,
    name: partial.name,
    quantityGrams: partial.quantityGrams,
    percentage: partial.percentage ?? partial.quantityGrams,
    dilutionPercent,
    solvent: partial.solvent ?? 'Neat',
    activeMaterialPercent:
      partial.activeMaterialPercent ?? (partial.quantityGrams * dilutionPercent) / 100,
    supplier: partial.supplier ?? 'Atelier Reference',
    costPerGram: partial.costPerGram ?? 0.35,
    notes: partial.notes ?? '',
  };
}

describe('Stage 2 — Regulatory Evidence Model & Safety Engine Semantics', () => {
  it('1. Material with LOOKUP_REQUIRED produces INDETERMINATE, never COMPLIANT', () => {
    const items: FormulaLineItem[] = [
      makeLineItem({
        id: 'line-1',
        type: 'material',
        materialId: 901,
        name: 'Unverified Botanical Absolute',
        quantityGrams: 10,
      }),
    ];
    const limits: MaterialRegulatoryLimit[] = [
      {
        id: 1,
        materialId: 901,
        ifraCategory: 'Category 4 (Fine Fragrance)',
        maxAllowedPercent: null,
        allergens: 'LOOKUP_REQUIRED',
        restrictions: 'LOOKUP_REQUIRED',
        sourceDocument: 'Pending Supplier SDS',
        documentVersion: 'Unverified',
        effectiveDate: '',
        isDemoData: false,
        verificationStatus: 'LOOKUP_REQUIRED',
      },
    ];

    const report = evaluateFormulaSafety(
      items,
      [],
      limits,
      'Category 4 (Fine Fragrance)',
      20
    );

    assert.equal(report.complianceState, 'INDETERMINATE');
    assert.equal(report.ifraComplianceState, 'INDETERMINATE');
    assert.equal(report.euComplianceState, 'INDETERMINATE');
    assert.equal(report.overallCompliant, false);
    assert.equal(report.indeterminateCount, 1);
    assert.equal(report.evaluations[0].ifraComplianceState, 'INDETERMINATE');
  });

  it('2. Material with Cat 4 limit queried for Cat 2 without Cat 2 record produces INDETERMINATE, not Cat 4 fallback', () => {
    const cat4OnlyLimit: MaterialRegulatoryLimit = {
      id: 2,
      materialId: 101,
      ifraCategory: 'Category 4 (Fine Fragrance)',
      maxAllowedPercent: 0.4,
      allergens: 'Limonene, Linalool',
      restrictions: 'Cat 4 limit only',
      sourceDocument: 'IFRA 51st Amendment',
      documentVersion: '51st Amendment',
      effectiveDate: '2023-06-30',
      isDemoData: false,
      verificationStatus: 'PARTIALLY_VERIFIED',
      categoryLimitsTable: [
        {
          category: 'Cat 4',
          categoryName: 'Fine Fragrance',
          maxAllowedPercent: 0.4,
          description: 'Hydroalcoholic fine fragrance',
        },
      ],
    };

    // Querying Cat 4 succeeds
    const cat4Rule = resolveIfraCategoryRule(cat4OnlyLimit, 'Category 4 (Fine Fragrance)');
    assert.equal(cat4Rule.missingCategoryRecord, false);
    assert.equal(cat4Rule.maxAllowedPercent, 0.4);

    // Querying Cat 2 without a Cat 2 record must NOT fall back to 0.4%
    const cat2Pct = resolveCategoryThresholdPercent(
      cat4OnlyLimit,
      'Category 2 (Deodorant / Antiperspirant)'
    );
    assert.equal(cat2Pct, null);

    const items: FormulaLineItem[] = [
      makeLineItem({
        id: 'line-cat2',
        type: 'material',
        materialId: 101,
        name: 'Cat4Only Citrus Oil',
        quantityGrams: 1.0,
      }),
    ];

    const report = evaluateFormulaSafety(
      items,
      [],
      [cat4OnlyLimit],
      'Category 2 (Deodorant / Antiperspirant)',
      20
    );

    assert.equal(report.ifraComplianceState, 'INDETERMINATE');
    assert.equal(report.complianceState, 'INDETERMINATE');
    assert.equal(report.evaluations[0].maxAllowedPercentInFinalProduct, null);
    assert.equal(report.evaluations[0].ifraComplianceState, 'INDETERMINATE');
  });

  it('3. Prohibited material (IFRA PROHIBITION or EU Annex II) produces NON_COMPLIANT', () => {
    const items: FormulaLineItem[] = [
      makeLineItem({
        id: 'line-prohibited',
        type: 'material',
        materialId: 666,
        name: 'Atranol-Rich Raw Moss',
        quantityGrams: 0.5,
        dilutionPercent: 10,
        solvent: 'Ethanol',
      }),
    ];
    const records: MaterialRegulatoryRecord[] = [
      {
        id: 10,
        materialId: 666,
        jurisdiction: 'GLOBAL',
        authority: 'IFRA',
        ruleType: 'PROHIBITION',
        status: 'PROHIBITED',
        standardOrAnnex: 'IFRA Prohibition Standard',
        referenceNumber: 'IFRA-PROH-1',
        productCategory: 'Cat 4',
        maxFinishedProductPct: 0,
        maxReadyForUsePct: null,
        labelThresholdLeaveOnPct: null,
        labelThresholdRinseOffPct: null,
        conditionText: 'Prohibited due to severe sensitization',
        summary: 'Prohibited by IFRA Standard',
        sourceUrl: 'https://ifrafragrance.org/safe-use/library',
        sourceDocument: 'IFRA Prohibition Standard',
        sourceVersion: 'IFRA_51',
        verifiedAt: '2026-03-29',
        verificationStatus: 'VERIFIED_OFFICIAL',
      },
      {
        id: 11,
        materialId: 666,
        jurisdiction: 'EU',
        authority: 'EU_COSMETICS',
        ruleType: 'PROHIBITION',
        status: 'PROHIBITED',
        standardOrAnnex: 'Annex II',
        referenceNumber: '1380',
        productCategory: null,
        maxFinishedProductPct: null,
        maxReadyForUsePct: 0,
        labelThresholdLeaveOnPct: null,
        labelThresholdRinseOffPct: null,
        conditionText: 'Prohibited in cosmetic products',
        summary: 'Prohibited under EU Regulation 1223/2009 Annex II',
        sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2009/1223/oj',
        sourceDocument: 'EU Regulation 1223/2009 Annex II',
        sourceVersion: 'EC_1223_2009',
        verifiedAt: '2026-03-29',
        verificationStatus: 'VERIFIED_OFFICIAL',
      },
    ];

    const report = evaluateFormulaSafety(
      items,
      [],
      [],
      'Category 4 (Fine Fragrance)',
      20,
      { regulatoryRecords: records }
    );

    assert.equal(report.complianceState, 'NON_COMPLIANT');
    assert.equal(report.ifraComplianceState, 'NON_COMPLIANT');
    assert.equal(report.euComplianceState, 'NON_COMPLIANT');
    assert.equal(report.evaluations[0].status, 'Prohibited');
    assert.equal(report.evaluations[0].euComplianceStatus, 'Prohibited (EU Annex II)');
  });

  it('4. Specification rule is surfaced as a specification requirement, not an ordinary max-use percentage pass', () => {
    const items: FormulaLineItem[] = [
      makeLineItem({
        id: 'line-spec',
        type: 'material',
        materialId: 505,
        name: 'Pinene-Rich Conifer Oil',
        quantityGrams: 5,
      }),
    ];
    const records: MaterialRegulatoryRecord[] = [
      {
        id: 20,
        materialId: 505,
        jurisdiction: 'GLOBAL',
        authority: 'IFRA',
        ruleType: 'SPECIFICATION',
        status: 'SPECIFICATION',
        standardOrAnnex: 'IFRA Specification Standard',
        referenceNumber: 'IFRA-SPEC-505',
        productCategory: 'Cat 4',
        maxFinishedProductPct: null,
        maxReadyForUsePct: null,
        labelThresholdLeaveOnPct: null,
        labelThresholdRinseOffPct: null,
        conditionText: 'Peroxide value must be < 20 mmol/L prior to compounding',
        summary: 'Peroxide value must be < 20 mmol/L prior to compounding',
        sourceUrl: 'https://ifrafragrance.org/safe-use/library',
        sourceDocument: 'IFRA 51st Specification Standard',
        sourceVersion: 'IFRA_51',
        verifiedAt: '2026-03-29',
        verificationStatus: 'VERIFIED_OFFICIAL',
      },
      {
        id: 21,
        materialId: 505,
        jurisdiction: 'EU',
        authority: 'EU_COSMETICS',
        ruleType: 'MAX_USE',
        status: 'RESTRICTED',
        standardOrAnnex: 'Annex III',
        referenceNumber: '',
        productCategory: null,
        maxFinishedProductPct: null,
        maxReadyForUsePct: 100,
        labelThresholdLeaveOnPct: null,
        labelThresholdRinseOffPct: null,
        conditionText: 'Peroxide value < 20 mmol/L',
        summary: 'No Annex III max-use cap',
        sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2009/1223/oj',
        sourceDocument: 'EU Regulation 1223/2009',
        sourceVersion: 'EC_1223_2009',
        verifiedAt: '2026-03-29',
        verificationStatus: 'VERIFIED_OFFICIAL',
      },
    ];

    const report = evaluateFormulaSafety(
      items,
      [],
      [],
      'Category 4 (Fine Fragrance)',
      20,
      { regulatoryRecords: records }
    );

    const ev = report.evaluations[0];
    assert.equal(ev.status, 'Specification required');
    assert.equal(ev.ifraRuleType, 'SPECIFICATION');
    assert.match(ev.statusMessage, /Peroxide value must be < 20 mmol\/L/);
  });

  it('5. Leave-on vs rinse-off EU allergen thresholds use 0.001% vs 0.01% and ambiguous exposure produces INDETERMINATE', () => {
    assert.equal(resolveProductExposureType('Category 4 (Fine Fragrance)'), 'LEAVE_ON');
    assert.equal(resolveProductExposureType('Category 9 (Bar Soap / Shower Gel)'), 'RINSE_OFF');
    assert.equal(resolveProductExposureType('Custom Category', 'Ambiguous Product'), 'AMBIGUOUS');

    const items: FormulaLineItem[] = [
      makeLineItem({
        id: 'line-linalool',
        type: 'material',
        materialId: 300,
        name: 'Pure Linalool',
        quantityGrams: 0.025, // out of 100g concentrate -> 0.025% in oil -> at 20% conc = 0.005% in final product
      }),
      makeLineItem({
        id: 'line-carrier',
        type: 'material',
        materialId: 301,
        name: 'Iso E Super',
        quantityGrams: 99.975,
      }),
    ];

    const constituents: MaterialConstituent[] = [
      {
        id: 1,
        materialId: 300,
        constituentName: 'Linalool',
        constituentCas: '78-70-6',
        typicalPct: 100,
        minPct: null,
        maxPct: null,
        labelThresholdLeaveOnPct: 0.001,
        labelThresholdRinseOffPct: 0.01,
        sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2023/1545/oj',
        sourceDocument: 'EU 2023/1545',
        verificationStatus: 'VERIFIED_OFFICIAL',
      },
    ];

    const limits: MaterialRegulatoryLimit[] = [
      {
        id: 300,
        materialId: 300,
        ifraCategory: 'Category 4 (Fine Fragrance)',
        maxAllowedPercent: 100,
        euCosmeticLimitPercent: 100,
        euAllergenDeclarable: true,
        euLabelThresholdLeaveOnPct: 0.001,
        euLabelThresholdRinseOffPct: 0.01,
        allergens: 'Linalool',
        restrictions: 'Declarable allergen',
        sourceDocument: 'EU 2023/1545',
        documentVersion: '2023/1545',
        effectiveDate: '2023-07-26',
        isDemoData: false,
        verificationStatus: 'VERIFIED_OFFICIAL',
        categoryLimitsTable: [
          { category: 'Cat 4', categoryName: 'Fine Fragrance', maxAllowedPercent: 100, description: 'Leave-on' },
          { category: 'Cat 9', categoryName: 'Shower Gel', maxAllowedPercent: 100, description: 'Rinse-off' },
        ],
      },
      {
        id: 301,
        materialId: 301,
        ifraCategory: 'Category 4 (Fine Fragrance)',
        maxAllowedPercent: 21.4,
        euCosmeticLimitPercent: 100,
        allergens: 'None',
        restrictions: 'Cat 4 21.4%',
        sourceDocument: 'IFRA 51',
        documentVersion: '51',
        effectiveDate: '2023-06-30',
        isDemoData: false,
        verificationStatus: 'VERIFIED_OFFICIAL',
        categoryLimitsTable: [
          { category: 'Cat 4', categoryName: 'Fine Fragrance', maxAllowedPercent: 21.4, description: '' },
          { category: 'Cat 9', categoryName: 'Shower Gel', maxAllowedPercent: 25.0, description: '' },
        ],
      },
    ];

    // 0.005% in final product:
    // - Exceeds leave-on threshold (0.001%) -> declarable
    const leaveOnReport = evaluateFormulaSafety(
      items,
      [],
      limits,
      'Category 4 (Fine Fragrance)',
      20,
      { constituents }
    );
    assert.equal(leaveOnReport.exposureType, 'LEAVE_ON');
    assert.equal(leaveOnReport.aggregatedAllergens[0].applicableThresholdPct, 0.001);
    assert.equal(leaveOnReport.aggregatedAllergens[0].requiresDeclaration, true);
    assert.equal(leaveOnReport.euAllergenDeclarationCount, 1);

    // - Below rinse-off threshold (0.01%) -> not declarable
    const rinseOffReport = evaluateFormulaSafety(
      items,
      [],
      limits,
      'Category 9 (Bar Soap / Shower Gel)',
      20,
      { constituents, intendedProduct: 'Rinse-off Shower Gel' }
    );
    assert.equal(rinseOffReport.exposureType, 'RINSE_OFF');
    assert.equal(rinseOffReport.aggregatedAllergens[0].applicableThresholdPct, 0.01);
    assert.equal(rinseOffReport.aggregatedAllergens[0].requiresDeclaration, false);
    assert.equal(rinseOffReport.euAllergenDeclarationCount, 0);

    // - Ambiguous exposure -> INDETERMINATE
    const indeterminateExposureReport = evaluateFormulaSafety(
      items,
      [],
      limits,
      'Ambiguous Category',
      20,
      { constituents, intendedProduct: 'Ambiguous Format' }
    );
    assert.equal(indeterminateExposureReport.exposureType, 'AMBIGUOUS');
    assert.equal(indeterminateExposureReport.aggregatedAllergens[0].declarationStatus, 'INDETERMINATE');
  });

  it('6 & 7. Constituent allergen aggregation across two materials and a nested accord triggers declaration when combined constituent exceeds threshold', () => {
    const accords: AccordDefinition[] = [
      {
        id: 50,
        name: 'Neroli Breeze Accord',
        category: 'Citrus',
        description: 'Pinned accord',
        objective: 'Fresh citrus floral',
        usageSuggestions: 'Top note',
        notes: '',
        isEducational: false,
        olfactoryProfile: {},
        activeVersionId: 502,
        activeVersionLabel: 'V2',
        items: [
          { materialId: 199, materialName: 'Filler Base', percentage: 100, dilutionPercent: 100 },
        ],
        versions: [
          {
            id: 501,
            accordId: 50,
            versionId: '501',
            versionLabel: 'V1',
            versionNotes: 'Original V1 with Petitgrain',
            createdAt: '2026-01-01',
            items: [
              { materialId: 103, materialName: 'Petitgrain EO', percentage: 100, dilutionPercent: 100 },
            ],
          },
          {
            id: 502,
            accordId: 50,
            versionId: '502',
            versionLabel: 'V2',
            versionNotes: 'Modified V2 without Petitgrain',
            createdAt: '2026-01-02',
            items: [
              { materialId: 199, materialName: 'Filler Base', percentage: 100, dilutionPercent: 100 },
            ],
          },
        ],
      },
    ];

    const items: FormulaLineItem[] = [
      makeLineItem({
        id: 'm-101',
        type: 'material',
        materialId: 101,
        name: 'Bergamot EO',
        quantityGrams: 0.045,
      }),
      makeLineItem({
        id: 'm-102',
        type: 'material',
        materialId: 102,
        name: 'Lavender EO',
        quantityGrams: 0.04,
      }),
      makeLineItem({
        id: 'a-50',
        type: 'accord',
        accordId: 50,
        accordVersionId: 501,
        accordVersionLabel: 'V1',
        name: 'Neroli Breeze Accord (V1)',
        quantityGrams: 0.035,
      }),
      makeLineItem({
        id: 'm-199',
        type: 'material',
        materialId: 199,
        name: 'Filler Base',
        quantityGrams: 99.88,
      }),
    ];

    const constituents: MaterialConstituent[] = [
      {
        id: 1,
        materialId: 101,
        constituentName: 'Linalool',
        constituentCas: '78-70-6',
        typicalPct: 10,
        minPct: null,
        maxPct: null,
        labelThresholdLeaveOnPct: 0.001,
        labelThresholdRinseOffPct: 0.01,
        sourceUrl: '',
        sourceDocument: 'CoA',
        verificationStatus: 'VERIFIED_OFFICIAL',
      },
      {
        id: 2,
        materialId: 102,
        constituentName: 'Linalool',
        constituentCas: '78-70-6',
        typicalPct: 10,
        minPct: null,
        maxPct: null,
        labelThresholdLeaveOnPct: 0.001,
        labelThresholdRinseOffPct: 0.01,
        sourceUrl: '',
        sourceDocument: 'CoA',
        verificationStatus: 'VERIFIED_OFFICIAL',
      },
      {
        id: 3,
        materialId: 103,
        constituentName: 'Linalool',
        constituentCas: '78-70-6',
        typicalPct: 10,
        minPct: null,
        maxPct: null,
        labelThresholdLeaveOnPct: 0.001,
        labelThresholdRinseOffPct: 0.01,
        sourceUrl: '',
        sourceDocument: 'CoA',
        verificationStatus: 'VERIFIED_OFFICIAL',
      },
    ];

    const limits: MaterialRegulatoryLimit[] = [101, 102, 103, 199].map((id) => ({
      id,
      materialId: id,
      ifraCategory: 'Category 4 (Fine Fragrance)',
      maxAllowedPercent: 100,
      euCosmeticLimitPercent: 100,
      allergens: 'Linalool',
      restrictions: 'None',
      sourceDocument: 'IFRA 51',
      documentVersion: '51',
      effectiveDate: '2023-06-30',
      isDemoData: false,
      verificationStatus: 'VERIFIED_OFFICIAL',
    }));

    const report = evaluateFormulaSafety(
      items,
      accords,
      limits,
      'Category 4 (Fine Fragrance)',
      10,
      { constituents }
    );

    const linaloolAgg = report.aggregatedAllergens.find(
      (c) => c.constituentName === 'Linalool'
    );
    assert.ok(linaloolAgg, 'Linalool constituent aggregation must exist');
    assert.equal(linaloolAgg!.sources.length, 3);
    // 0.00045 + 0.00040 + 0.00035 = 0.0012%
    assert.ok(Math.abs(linaloolAgg!.totalFinalProductPct - 0.0012) < 1e-6);
    assert.equal(linaloolAgg!.requiresDeclaration, true);
    assert.equal(report.euAllergenDeclarationCount, 1);
  });

  it('8. Constituent with typicalPct = null produces INDETERMINATE when needed for threshold evaluation', () => {
    const items: FormulaLineItem[] = [
      makeLineItem({
        id: 'm-unknown-pct',
        type: 'material',
        materialId: 777,
        name: 'Wild Lavender Extract',
        quantityGrams: 10,
      }),
    ];
    const constituents: MaterialConstituent[] = [
      {
        id: 99,
        materialId: 777,
        constituentName: 'Geraniol',
        constituentCas: '106-24-1',
        typicalPct: null, // Unquantified constituent percentage
        minPct: null,
        maxPct: null,
        labelThresholdLeaveOnPct: 0.001,
        labelThresholdRinseOffPct: 0.01,
        sourceUrl: '',
        sourceDocument: 'Incomplete SDS',
        verificationStatus: 'LOOKUP_REQUIRED',
      },
    ];
    const limits: MaterialRegulatoryLimit[] = [
      {
        id: 777,
        materialId: 777,
        ifraCategory: 'Category 4 (Fine Fragrance)',
        maxAllowedPercent: 50,
        euCosmeticLimitPercent: 100,
        allergens: 'Geraniol',
        restrictions: 'Max 50%',
        sourceDocument: 'IFRA 51',
        documentVersion: '51',
        effectiveDate: '2023-06-30',
        isDemoData: false,
        verificationStatus: 'PARTIALLY_VERIFIED',
      },
    ];

    const report = evaluateFormulaSafety(
      items,
      [],
      limits,
      'Category 4 (Fine Fragrance)',
      20,
      { constituents }
    );

    const geraniolAgg = report.aggregatedAllergens.find(
      (c) => c.constituentName === 'Geraniol'
    );
    assert.ok(geraniolAgg);
    assert.equal(geraniolAgg!.hasMissingPercentage, true);
    assert.equal(geraniolAgg!.declarationStatus, 'INDETERMINATE');
    assert.equal(report.euComplianceState, 'INDETERMINATE');
    assert.equal(report.complianceState, 'INDETERMINATE');
  });

  it('9 & 10. Demo records are never labeled verified and verification status labels are explicit', () => {
    assert.equal(
      formatVerificationStatusLabel('DEMO'),
      'Educational demonstration data — not verified for compliance'
    );
    assert.equal(formatVerificationStatusLabel('PARTIALLY_VERIFIED'), 'Partially verified');
    assert.equal(
      formatVerificationStatusLabel('VERIFIED_OFFICIAL'),
      'Official source verified'
    );
    assert.equal(formatVerificationStatusLabel('LOOKUP_REQUIRED'), 'Lookup required');
    assert.equal(
      formatVerificationStatusLabel('USER_ENTERED_UNVERIFIED'),
      'User-entered, unverified'
    );

    const catalog = loadGlobalCatalogV11();
    assert.equal(catalog.materials.length, 815);
    assert.ok(catalog.regulatoryRecords.length >= 815);
    assert.ok(catalog.constituents.length > 0);

    // Every material is classified as LOOKUP_REQUIRED (777), PARTIALLY_VERIFIED (21), or DEMO (17)
    const lookupMaterials = catalog.regulatoryLimits.filter(
      (l) => l.verificationStatus === 'LOOKUP_REQUIRED'
    );
    const csvVerifiedMaterials = catalog.regulatoryLimits.filter(
      (l) => l.verificationStatus === 'PARTIALLY_VERIFIED'
    );
    const demoMaterials = catalog.regulatoryLimits.filter(
      (l) => l.verificationStatus === 'DEMO'
    );
    assert.equal(csvVerifiedMaterials.length, 21);
    assert.equal(demoMaterials.length, 17);
    assert.equal(
      lookupMaterials.length + csvVerifiedMaterials.length + demoMaterials.length,
      815
    );
  });
});

describe('Stage 2 — Formula & Accord Version Persistence & Integrity Rules', () => {
  const testUid = 'stage2-integrity-test-user';

  beforeEach(() => {
    setPersistenceModeOverride('memory');
  });

  it('11. formula_version_items persists and reloads identically to FormulaVersion.items', async () => {
    const wsBefore = await fetchFullWorkspace(testUid, 'stage2@atelier.local');
    const baseFormula = wsBefore.formulas[0];
    assert.ok(baseFormula);

    const saved = await saveFormulaAndVersionInDb(
      testUid,
      {
        id: baseFormula.id,
        name: baseFormula.name,
        intendedProduct: baseFormula.intendedProduct,
        ifraCategory: baseFormula.ifraCategory,
        finalProductConcentration: 20,
      },
      {
        versionLabel: 'V6-DraftTest',
        parentVersionId: baseFormula.versions[0].id,
        status: 'Draft',
        versionNotes: 'Testing normalized formula_version_items persistence',
        maturationDays: 14,
        items: [
          makeLineItem({
            id: 'norm-item-1',
            type: 'material',
            materialId: 1,
            name: 'Bergamot EO FCF',
            quantityGrams: 12.5,
          }),
          makeLineItem({
            id: 'norm-item-2',
            type: 'material',
            materialId: 7,
            name: 'Iso E Super',
            quantityGrams: 37.5,
          }),
        ],
      }
    );

    const wsAfter = await fetchFullWorkspace(testUid, 'stage2@atelier.local');
    const reloadedFormula = wsAfter.formulas.find((f) => f.id === saved.formulaId)!;
    const reloadedVersion = reloadedFormula.versions.find((v) => v.versionLabel === 'V6-DraftTest')!;
    assert.ok(reloadedVersion);
    assert.equal(reloadedVersion.items.length, 2);
    assert.ok(reloadedVersion.normalizedItems);
    assert.equal(reloadedVersion.normalizedItems!.length, 2);
    assert.equal(reloadedVersion.items[0].materialId, 1);
    assert.equal(reloadedVersion.items[0].quantityGrams, 12.5);
    assert.equal(reloadedVersion.items[1].materialId, 7);
    assert.equal(reloadedVersion.items[1].quantityGrams, 37.5);
  });

  it('12. Committed formula version is immutable and cannot be overwritten in-place', async () => {
    const ws = await fetchFullWorkspace(testUid, 'stage2@atelier.local');
    const formula = ws.formulas[0];
    const committedVersion = formula.versions.find((v) => v.status === 'Committed')!;
    assert.ok(committedVersion, 'Seeded formula must have a Committed version');

    await assert.rejects(
      async () => {
        await saveFormulaAndVersionInDb(
          testUid,
          { id: formula.id, name: formula.name },
          {
            versionLabel: committedVersion.versionLabel,
            status: 'Committed',
            versionNotes: 'Attempting to mutate a committed version',
            maturationDays: 14,
            items: committedVersion.items,
          }
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof FormulaIntegrityError);
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /Committed and immutable/);
        return true;
      }
    );
  });

  it('13. Duplicate (formula_id, version_label) is rejected when creating a new version branch', async () => {
    const ws = await fetchFullWorkspace(testUid, 'stage2@atelier.local');
    const formula = ws.formulas[0];
    const existingLabel = formula.versions[0].versionLabel;

    await assert.rejects(
      async () => {
        await saveFormulaAndVersionInDb(
          testUid,
          { id: formula.id, name: formula.name },
          {
            versionLabel: existingLabel,
            status: 'Draft',
            versionNotes: 'Duplicate version label test',
            maturationDays: 7,
            items: formula.versions[0].items,
          }
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof FormulaIntegrityError);
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  it('14. Invalid parentVersionId from another formula is rejected', async () => {
    const ws = await fetchFullWorkspace(testUid, 'stage2@atelier.local');
    const formula1 = ws.formulas[0];
    const formula2 = ws.formulas[1];
    assert.ok(formula1 && formula2 && formula1.id !== formula2.id);
    const foreignParentVersionId = formula2.versions[0].id;

    await assert.rejects(
      async () => {
        await saveFormulaAndVersionInDb(
          testUid,
          { id: formula1.id, name: formula1.name },
          {
            versionLabel: 'V-ForeignParent',
            parentVersionId: foreignParentVersionId,
            status: 'Draft',
            versionNotes: 'Should fail cross-formula parent check',
            maturationDays: 7,
            items: formula1.versions[0].items,
          }
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof FormulaIntegrityError);
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /belong to formula/);
        return true;
      }
    );
  });

  it('15. Accord edit creates a new accord version and does not alter an existing formula version pinned to an earlier accord version', async () => {
    const accordRes = await createAccordInDb(testUid, {
      name: 'Ambergris Marine Base',
      category: 'Amber',
      description: 'Versioned accord test',
      objective: 'Mineral marine base',
      usageSuggestions: 'Base accord',
      notes: '',
      isEducational: false,
      olfactoryProfile: {},
      activeVersionLabel: 'V1',
      items: [
        {
          materialId: 10,
          materialName: 'Ambroxan',
          percentage: 60,
          dilutionPercent: 100,
        },
        {
          materialId: 7,
          materialName: 'Iso E Super',
          percentage: 40,
          dilutionPercent: 100,
        },
      ],
    });

    const ws1 = await fetchFullWorkspace(testUid, 'stage2@atelier.local');
    const createdAccord = ws1.accords.find((a) => a.id === accordRes.id)!;
    assert.ok(createdAccord);
    const v1Snapshot = createdAccord.versions![0];
    assert.equal(v1Snapshot.versionLabel, 'V1');

    // Save a formula version that uses this accord (it will pin to V1)
    const formula = ws1.formulas[0];
    await saveFormulaAndVersionInDb(
      testUid,
      { id: formula.id, name: formula.name },
      {
        versionLabel: 'V7-PinnedAccord',
        status: 'Committed',
        versionNotes: 'Formula version pinned to Ambergris Marine Base V1',
        maturationDays: 14,
        items: [
          makeLineItem({
            id: 'pinned-accord-line',
            type: 'accord',
            accordId: createdAccord.id,
            name: createdAccord.name,
            quantityGrams: 10,
          }),
        ],
      }
    );

    // Now edit the Accord to create V2 (where Ambroxan is 20% and Iso E Super is 80%)
    await updateAccordAndCreateVersion(testUid, createdAccord.id, {
      versionLabel: 'V2',
      versionNotes: 'Reduced Ambroxan to 20% in V2',
      items: [
        {
          materialId: 10,
          materialName: 'Ambroxan',
          percentage: 20,
          dilutionPercent: 100,
        },
        {
          materialId: 7,
          materialName: 'Iso E Super',
          percentage: 80,
          dilutionPercent: 100,
        },
      ],
    });

    // Reload workspace and verify V7-PinnedAccord still expands using V1 (60% Ambroxan = 6g), NOT V2 (20% = 2g)!
    const ws2 = await fetchFullWorkspace(testUid, 'stage2@atelier.local');
    const updatedAccord = ws2.accords.find((a) => a.id === createdAccord.id)!;
    assert.equal(updatedAccord.activeVersionLabel, 'V2');
    assert.equal(updatedAccord.versions!.length, 2);

    const savedFormula = ws2.formulas.find((f) => f.id === formula.id)!;
    const pinnedVersion = savedFormula.versions.find((v) => v.versionLabel === 'V7-PinnedAccord')!;
    assert.equal(pinnedVersion.items[0].accordVersionId, v1Snapshot.id);
    assert.equal(pinnedVersion.items[0].accordVersionLabel, 'V1');

    const expanded = expandNestedAccords(pinnedVersion.items, ws2.accords);
    const ambroxanLine = expanded.find((item) => item.materialId === 10)!;
    assert.ok(ambroxanLine);
    assert.equal(ambroxanLine.quantityGrams, 6); // 60% of 10g from V1, unaffected by V2's 20%
  });

  it('16. Experiments, evaluations, and usage reviews link to formulaVersionId', async () => {
    const ws1 = await fetchFullWorkspace(testUid, 'stage2@atelier.local');
    const formula = ws1.formulas[0];
    const targetVersion = formula.versions[0];

    await addExperimentEntryInDb(testUid, {
      formulaId: formula.id,
      formulaVersionId: targetVersion.id,
      formulaVersionLabel: targetVersion.versionLabel,
      stageLabel: 'Day 7',
      observation: 'EXP-STAGE2-VER: Version-linked maceration check',
      recordedAt: '2026-03-31',
    });

    await addEvaluationInDb(testUid, {
      formulaId: formula.id,
      formulaVersionId: targetVersion.id,
      formulaVersionLabel: targetVersion.versionLabel,
      checkpoint: '1 hour',
      overallScore: 8.5,
      scores: { opening: 8, heart: 8, drydown: 9, diffusion: 8, longevity: 8 },
      evaluatedFacets: { Citrus: 7, Woody: 8 },
      openingNotes: 'Crisp Bergamot',
      heartNotes: 'Linked to concrete formulaVersionId',
      drydownNotes: 'Clean cedar',
      voiceTranscript: '',
      voiceDurationSeconds: 0,
    });

    const ws2 = await fetchFullWorkspace(testUid, 'stage2@atelier.local');
    const exp = ws2.experiments.find((e) =>
      e.observation.includes('EXP-STAGE2-VER')
    )!;
    assert.ok(exp);
    assert.equal(exp.formulaVersionId, targetVersion.id);

    const ev = ws2.evaluations.find(
      (e) => e.heartNotes === 'Linked to concrete formulaVersionId'
    )!;
    assert.ok(ev);
    assert.equal(ev.formulaVersionId, targetVersion.id);

    assert.ok(ws2.usageReviews.every((r) => typeof r.formulaVersionId === 'number'));
  });
});
