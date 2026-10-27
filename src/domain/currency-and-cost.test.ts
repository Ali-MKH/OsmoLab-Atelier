import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CURRENCY_SETTINGS,
  buildTopMaterialsCostDistribution,
  calculateRealTimeBatchCost,
  convertFromUsd,
  formatCurrencyAmount,
  getExchangeRateForCurrency,
  resolveIngredientUnitCost,
  CurrencySettings,
} from './currency-and-cost';
import { FormulaLineItem } from './types';

const SAMPLE_ITEMS: FormulaLineItem[] = [
  {
    id: 'line-1',
    type: 'material',
    materialId: 101,
    name: 'Bergamot FCF',
    quantityGrams: 80,
    percentage: 80,
    dilutionPercent: 100,
    solvent: 'Neat',
    activeMaterialPercent: 80,
    supplier: 'Capua 1880',
    costPerGram: 0.42,
    notes: '',
  },
  {
    id: 'line-2',
    type: 'material',
    materialId: 102,
    name: 'Oakmoss Absolute 10%',
    quantityGrams: 20,
    percentage: 20,
    dilutionPercent: 10,
    solvent: 'Ethanol',
    activeMaterialPercent: 2,
    supplier: 'Robertet',
    costPerGram: 1.2,
    notes: '',
  },
];

test('resolveIngredientUnitCost resolves line cost and supplier accurately', () => {
  const resolved = resolveIngredientUnitCost(SAMPLE_ITEMS[0], []);
  assert.equal(resolved.unitCostPerGramUsd, 0.42);
  assert.equal(resolved.supplier, 'Capua 1880');
});

test('calculateRealTimeBatchCost computes accurate batch cost and cost shares', () => {
  // 100g batch: 80g Bergamot @ $0.42 ($33.60) + 20g Oakmoss @ $1.20 ($24.00) = $57.60
  const summary100 = calculateRealTimeBatchCost({
    items: SAMPLE_ITEMS,
    targetBatchGrams: 100,
    finalProductConcentrationPercent: 20,
    carrierCostPerGramUsd: 0.015,
    bottleSizeMl: 50,
  });

  assert.equal(summary100.totalBatchCostUsd, 57.6);
  assert.equal(summary100.costPerGramUsd, 0.576);
  assert.equal(summary100.costPer100gUsd, 57.6);
  assert.equal(summary100.costPerKgUsd, 576);
});

test('currency conversion and IRR / Toman formatting work deterministically', () => {
  const irrSettings: CurrencySettings = {
    ...DEFAULT_CURRENCY_SETTINGS,
    activeCurrency: 'IRR',
    rateMode: 'manual',
    usdToIrrRate: 850000,
    showTomanHelper: true,
  };

  assert.equal(getExchangeRateForCurrency(irrSettings, 'IRR'), 850000);
  assert.equal(convertFromUsd(10, irrSettings, 'IRR'), 8500000);

  const formattedPlain = formatCurrencyAmount(10, irrSettings);
  assert.equal(formattedPlain, '8,500,000 IRR');

  const formattedWithToman = formatCurrencyAmount(10, irrSettings, {
    includeTomanHint: true,
  });
  assert.equal(formattedWithToman, '8,500,000 IRR (850,000 Toman)');
});

test('buildTopMaterialsCostDistribution ranks Top 5 materials and aggregates remaining items', () => {
  const sevenItems: FormulaLineItem[] = [
    { id: '1', type: 'material', name: 'Oud Assafi', quantityGrams: 5, percentage: 5, dilutionPercent: 100, solvent: 'Neat', activeMaterialPercent: 5, supplier: 'Firmenich', costPerGram: 10, notes: '' }, // $50
    { id: '2', type: 'material', name: 'Orris Butter', quantityGrams: 10, percentage: 10, dilutionPercent: 100, solvent: 'Neat', activeMaterialPercent: 10, supplier: 'Robertet', costPerGram: 3, notes: '' }, // $30
    { id: '3', type: 'material', name: 'Rose Otto', quantityGrams: 5, percentage: 5, dilutionPercent: 100, solvent: 'Neat', activeMaterialPercent: 5, supplier: 'Enio Bonchev', costPerGram: 4, notes: '' }, // $20
    { id: '4', type: 'material', name: 'Sandalwood Album', quantityGrams: 10, percentage: 10, dilutionPercent: 100, solvent: 'Neat', activeMaterialPercent: 10, supplier: 'IFF', costPerGram: 1.5, notes: '' }, // $15
    { id: '5', type: 'material', name: 'Ambroxan', quantityGrams: 20, percentage: 20, dilutionPercent: 100, solvent: 'Neat', activeMaterialPercent: 20, supplier: 'Kao', costPerGram: 0.5, notes: '' }, // $10
    { id: '6', type: 'material', name: 'Iso E Super', quantityGrams: 30, percentage: 30, dilutionPercent: 100, solvent: 'Neat', activeMaterialPercent: 30, supplier: 'IFF', costPerGram: 0.2, notes: '' }, // $6
    { id: '7', type: 'material', name: 'Bergamot FCF', quantityGrams: 20, percentage: 20, dilutionPercent: 100, solvent: 'Neat', activeMaterialPercent: 20, supplier: 'Capua', costPerGram: 0.2, notes: '' }, // $4
  ];

  // Total weight = 100g, Total cost = 50 + 30 + 20 + 15 + 10 + 6 + 4 = $135.00
  // Top 5 cost = 50 + 30 + 20 + 15 + 10 = $125.00, Remaining 2 cost = $10.00
  const summary = calculateRealTimeBatchCost({
    items: sevenItems,
    targetBatchGrams: 100,
  });

  const dist = buildTopMaterialsCostDistribution(summary, 5);
  assert.equal(dist.topItems.length, 5);
  assert.equal(dist.topItems[0].rank, 1);
  assert.equal(dist.topItems[0].name, 'Oud Assafi');
  assert.equal(dist.topItems[0].lineTotalCostUsd, 50);
  assert.equal(dist.topItems[0].relativeToMaxPercent, 100);
  assert.equal(dist.topItems[1].name, 'Orris Butter');
  assert.equal(dist.topItems[1].relativeToMaxPercent, 60);
  assert.equal(dist.topItems[4].name, 'Ambroxan');
  assert.equal(dist.topItemsTotalCostUsd, 125);
  assert.equal(dist.remainingCount, 2);
  assert.equal(dist.remainingCostUsd, 10);
  assert.equal(
    Math.round(dist.topItemsTotalSharePercent + dist.remainingSharePercent),
    100
  );
});
