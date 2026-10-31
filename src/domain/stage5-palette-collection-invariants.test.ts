import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  MaterialsAndInventoryView,
  MaterialsAndInventoryViewProps,
} from '../components/MaterialsAndInventoryView';
import { RawMaterial, AccordDefinition, Formula } from './types';
import { sanitizeFormula, sanitizeAccord } from '../api/client';

function createMockMaterial(id: number, name: string): RawMaterial {
  return {
    id,
    name,
    aliases: name,
    casNumber: '100-00-0',
    inciName: name,
    naturalOrSynthetic: 'Synthetic',
    supplier: 'Supplier',
    supplierProductCode: 'CODE-01',
    manufacturer: 'Manufacturer',
    primaryFamily: 'Citrus',
    facets: ['Citrus', 'Sparkling'],
    intensity: 5,
    substantivityHours: 24,
    diffusion: 5,
    volatility: 'Top',
    descriptiveNotes: 'Clean, radiant note',
    texture: 'Liquid',
    temperatureImpression: 'Cool',
    personalNotes: '',
    purity: '99%',
    density: 0.88,
    recommendedDilution: 100,
    storageInfo: 'Cool dark place',
    shelfLifeMonths: 24,
    flashPointCelsius: 65,
    educationalObserve: ['Evaporation profile'],
    complements: ['Hedione'],
    contrasts: ['Vetiver'],
    pyramidUiCode: 'T',
    pyramidConfidence: 'HIGH',
    pyramidHighlightTop: true,
    pyramidHighlightHeart: false,
    pyramidHighlightBase: false,
    isOnWorkbench: true,
  };
}

function createMockFormula(id: number, name: string): Formula {
  return {
    id,
    projectId: null,
    name,
    projectName: 'Test Project',
    status: 'Draft',
    description: '',
    intendedProduct: 'Fine Fragrance (EdP)',
    ifraCategory: 'Cat 4',
    finalProductConcentration: 18,
    targetBrief: '',
    targetFamilies: [],
    targetFacets: {},
    targetIntensity: 5,
    targetTexture: '',
    targetAtmosphere: '',
    targetTemperature: '',
    targetColor: '',
    targetMood: '',
    targetDiffusion: 5,
    targetEvolution: '',
    targetDrydown: '',
    materialsToAvoid: [],
    isFavorite: false,
    tags: [],
    createdAt: '2026-10-20',
    updatedAt: '2026-10-20',
    activeVersionLabel: 'V1',
    versions: [],
  };
}

const mockMaterial = createMockMaterial(1, 'Bergamot Oil FCF');

const baseProps: MaterialsAndInventoryViewProps = {
  mode: 'materials',
  materials: [mockMaterial],
  shelfMaterials: [mockMaterial],
  selectedMaterialId: 1,
  regulatoryLimits: [],
  scentMemories: [],
  usageReviews: [],
  accords: [],
  formulas: [],
  educationalPromptsEnabled: true,
  onSelectMaterial: () => {},
  onCreateMaterial: async () => {},
  onCreateAccord: async () => {},
  onInsertAccordIntoActiveFormula: () => {},
  onSaveScentMemory: async () => {},
  onOpenFormula: () => {},
};

describe('Stage 5 — Raw Materials Palette Collection Invariants & Non-Crashing Empty States', () => {
  it('1. Renders Raw Materials Palette with no accords ([]), without crashing', () => {
    const props: MaterialsAndInventoryViewProps = {
      ...baseProps,
      accords: [],
    };
    const html = renderToString(React.createElement(MaterialsAndInventoryView, props));
    assert.ok(html.length > 0);
    assert.ok(!html.includes('tab-error-boundary'));
  });

  it('2. Renders Raw Materials Palette with an Accord that has zero versions ([]), without crashing', () => {
    const accordWithZeroVersions: AccordDefinition = {
      id: 101,
      name: 'Ambre 83 Base',
      category: 'Amber',
      description: 'Classical rich amber base',
      objective: 'Warm drydown foundation',
      usageSuggestions: 'Use up to 5%',
      notes: 'Standard classical formulation',
      isEducational: true,
      olfactoryProfile: {},
      activeVersionLabel: 'V1',
      items: [
        {
          materialId: 1,
          materialName: 'Bergamot Oil FCF',
          percentage: 10,
          dilutionPercent: 100,
        },
      ],
      versions: [],
    };

    const props: MaterialsAndInventoryViewProps = {
      ...baseProps,
      accords: [accordWithZeroVersions],
    };
    const html = renderToString(React.createElement(MaterialsAndInventoryView, props));
    assert.ok(html.length > 0);
    assert.ok(!html.includes('tab-error-boundary'));

    // Also verify renders in mode="accords" without crashing
    const accordsModeHtml = renderToString(
      React.createElement(MaterialsAndInventoryView, {
        ...props,
        mode: 'accords',
      })
    );
    assert.ok(accordsModeHtml.length > 0);
    assert.ok(!accordsModeHtml.includes('tab-error-boundary'));
  });

  it('3. Renders Formula with zero versions ([]), without crashing', () => {
    const formulaWithZeroVersions = createMockFormula(201, 'Eau Sauvage Draft');

    const props: MaterialsAndInventoryViewProps = {
      ...baseProps,
      formulas: [formulaWithZeroVersions],
    };
    const html = renderToString(React.createElement(MaterialsAndInventoryView, props));
    assert.ok(html.length > 0);
    assert.ok(!html.includes('tab-error-boundary'));
  });

  it('4. Renders Formula Version with empty items ([]), without crashing', () => {
    const formulaWithEmptyItems: Formula = {
      ...createMockFormula(202, 'Blank Slate Formula'),
      versions: [
        {
          id: 501,
          formulaId: 202,
          versionLabel: 'V1',
          status: 'Draft',
          createdAt: '2026-10-20',
          parentVersionId: null,
          versionNotes: 'Initial blank version',
          maturationDays: 0,
          items: [],
        },
      ],
    };

    const props: MaterialsAndInventoryViewProps = {
      ...baseProps,
      formulas: [formulaWithEmptyItems],
    };
    const html = renderToString(React.createElement(MaterialsAndInventoryView, props));
    assert.ok(html.length > 0);
    assert.ok(!html.includes('tab-error-boundary'));
  });

  it('5. Renders cleanly with empty Shelf (materials: [], shelfMaterials: []), without crashing', () => {
    const props: MaterialsAndInventoryViewProps = {
      ...baseProps,
      materials: [],
      shelfMaterials: [],
      selectedMaterialId: null,
    };
    const html = renderToString(React.createElement(MaterialsAndInventoryView, props));
    assert.ok(html.length > 0);
    assert.ok(!html.includes('tab-error-boundary'));
  });

  it('6. Renders loading state during empty catalog response (catalogLoadState: loading, materials: []) without crashing', () => {
    const props: MaterialsAndInventoryViewProps = {
      ...baseProps,
      materials: [],
      shelfMaterials: [],
      catalogLoadState: 'loading',
      catalogTotalCount: 0,
      catalogTotal: 0,
      selectedMaterialId: null,
    };
    const html = renderToString(React.createElement(MaterialsAndInventoryView, props));
    assert.ok(html.length > 0);
    assert.ok(!html.includes('tab-error-boundary'));
  });

  it('7. Renders normal Catalog and Palette data cleanly after hydration', () => {
    const hydratedMaterials: RawMaterial[] = [
      mockMaterial,
      {
        ...createMockMaterial(2, 'Hedione (Kharismal)'),
        primaryFamily: 'Floral',
        facets: ['Jasmine', 'Transparent'],
        volatility: 'Heart',
        pyramidUiCode: 'H',
        pyramidHighlightTop: false,
        pyramidHighlightHeart: true,
        isOnWorkbench: false,
      },
      {
        ...createMockMaterial(3, 'Iso E Super'),
        primaryFamily: 'Woody',
        facets: ['Woody', 'Amber'],
        volatility: 'Base',
        pyramidUiCode: 'B',
        pyramidHighlightTop: false,
        pyramidHighlightHeart: false,
        pyramidHighlightBase: true,
        isOnWorkbench: true,
      },
    ];

    const hydratedAccord: AccordDefinition = {
      id: 102,
      name: 'Classical Amber Accord',
      category: 'Amber',
      description: 'Rich balsamic amber foundation',
      objective: 'Base warmth',
      usageSuggestions: '',
      notes: '',
      isEducational: true,
      olfactoryProfile: {},
      activeVersionLabel: 'V1',
      items: [
        {
          materialId: 3,
          materialName: 'Iso E Super',
          percentage: 40,
          dilutionPercent: 100,
        },
      ],
      versions: [
        {
          versionId: 'acc-102-v1',
          versionLabel: 'V1',
          createdAt: '2026-10-20',
          versionNotes: 'Baseline amber formula',
          items: [
            {
              materialId: 3,
              materialName: 'Iso E Super',
              percentage: 40,
              dilutionPercent: 100,
            },
          ],
        },
      ],
    };

    const hydratedFormula: Formula = {
      ...createMockFormula(301, 'Chypre Moderne'),
      versions: [
        {
          id: 601,
          formulaId: 301,
          versionLabel: 'V1',
          status: 'Draft',
          createdAt: '2026-10-20',
          parentVersionId: null,
          versionNotes: 'Initial balance',
          maturationDays: 14,
          items: [
            {
              id: 'item-1',
              materialId: 1,
              name: 'Bergamot Oil FCF',
              type: 'material',
              quantityGrams: 2.5,
              percentage: 25,
              dilutionPercent: 100,
              solvent: 'None',
              activeMaterialPercent: 100,
              supplier: 'Capua',
              costPerGram: 0.15,
              notes: '',
            },
          ],
        },
      ],
    };

    const props: MaterialsAndInventoryViewProps = {
      ...baseProps,
      materials: hydratedMaterials,
      shelfMaterials: hydratedMaterials,
      catalogTotalCount: 815,
      catalogTotal: 815,
      accords: [hydratedAccord],
      formulas: [hydratedFormula],
      selectedMaterialId: 1,
    };

    const html = renderToString(React.createElement(MaterialsAndInventoryView, props));
    assert.ok(html.includes('Bergamot Oil FCF'));
    assert.ok(!html.includes('tab-error-boundary'));
  });

  it('8. Enforces client-boundary sanitizers (sanitizeFormula and sanitizeAccord) guarantee array invariants', () => {
    // Malformed formula from external source with null/undefined fields
    const malformedFormula = {
      id: 999,
      projectId: null,
      name: 'Unsafe API Formula',
      projectName: 'Unsafe Project',
      intendedProduct: 'EdT',
      ifraCategory: 'Cat 4',
      finalProductConcentration: 10,
      status: 'Draft',
      description: '',
      targetBrief: '',
      targetFamilies: [],
      targetFacets: {},
      targetIntensity: 5,
      targetTexture: '',
      targetAtmosphere: '',
      targetTemperature: '',
      targetColor: '',
      targetMood: '',
      targetDiffusion: 5,
      targetEvolution: '',
      targetDrydown: '',
      notes: '',
      createdAt: '2026-10-20',
      updatedAt: '2026-10-20',
      activeVersionLabel: 'V1',
      versions: null as any,
    } as unknown as Formula;

    const sanitizedFormula = sanitizeFormula(malformedFormula);
    assert.ok(Array.isArray(sanitizedFormula.versions));
    assert.equal(sanitizedFormula.versions.length, 0);

    // Formula with version containing null items
    const formulaWithNullItems = {
      ...malformedFormula,
      versions: [
        {
          id: 1,
          formulaId: 999,
          versionLabel: 'V1',
          status: 'Draft',
          createdAt: '2026-10-20',
          parentVersionId: null,
          versionNotes: 'Bad version',
          maturationDays: 0,
          items: null as any,
          normalizedItems: null as any,
        },
      ],
    } as unknown as Formula;

    const sanitizedWithItems = sanitizeFormula(formulaWithNullItems);
    assert.ok(Array.isArray(sanitizedWithItems.versions[0].items));
    assert.equal(sanitizedWithItems.versions[0].items.length, 0);
    assert.ok(Array.isArray(sanitizedWithItems.versions[0].normalizedItems));

    // Malformed accord with null items and versions
    const malformedAccord = {
      id: 888,
      name: 'Unsafe API Accord',
      category: 'Floral',
      description: '',
      objective: '',
      usageSuggestions: '',
      notes: '',
      isEducational: false,
      olfactoryProfile: {},
      activeVersionLabel: 'V1',
      items: null as any,
      versions: null as any,
    } as unknown as AccordDefinition;

    const sanitizedAccord = sanitizeAccord(malformedAccord);
    assert.ok(Array.isArray(sanitizedAccord.items));
    assert.equal(sanitizedAccord.items.length, 0);
    assert.ok(Array.isArray(sanitizedAccord.versions));
    assert.equal(sanitizedAccord.versions.length, 0);
  });
});
