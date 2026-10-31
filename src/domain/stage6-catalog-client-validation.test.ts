import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  validateCatalogResponse,
  validateRegulatoryDossierResponse,
  fetchCatalogApi,
  StandardizedClientError,
  CatalogListResponse,
} from '../api/client';
import { MaterialsAndInventoryView } from '../components/MaterialsAndInventoryView';
import { queryCatalogMaterials } from '../db/workspace-repo';
import type { RawMaterial, UserShelfItem } from './types';

function createSampleMaterial(id: number, name = `Material ${id}`): RawMaterial {
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
    primaryFamily: 'Woody',
    facets: ['Woody', 'Amber'],
    intensity: 6,
    substantivityHours: 48,
    diffusion: 6,
    volatility: 'Base',
    descriptiveNotes: 'Deep woody amber',
    texture: 'Viscous',
    temperatureImpression: 'Warm',
    personalNotes: '',
    purity: '99%',
    density: 0.95,
    recommendedDilution: 100,
    storageInfo: 'Ambient',
    shelfLifeMonths: 24,
    flashPointCelsius: 90,
    educationalObserve: [],
    complements: [],
    contrasts: [],
    pyramidUiCode: 'B',
    pyramidConfidence: 'HIGH',
    pyramidHighlightTop: false,
    pyramidHighlightHeart: false,
    pyramidHighlightBase: true,
    isOnWorkbench: false,
  };
}

describe('Stage 6 — Raw Materials Catalog & Response Validation Contracts', () => {
  it('1. HTTP 200 with HTML or non-JSON text throws INVALID_JSON_RESPONSE with status 502', async () => {
    // Mock global fetch returning HTML with 200 OK
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response('<!DOCTYPE html><html><body>OsmoLab Preview</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });

      await assert.rejects(
        async () => {
          await fetchCatalogApi({ limit: 50, offset: 0 });
        },
        (err: any) => {
          assert.equal(err.code, 'INVALID_JSON_RESPONSE');
          assert.equal(err.statusCode, 502);
          assert.ok(err.message.includes('Invalid JSON received'));
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('2. Malformed catalog JSON (missing items, non-array items, invalid item fields, invalid total) throws MALFORMED_CATALOG_RESPONSE', () => {
    // Missing items
    assert.throws(
      () => validateCatalogResponse({ total: 10, limit: 50, offset: 0, hasMore: false }),
      (err: any) => {
        assert.equal(err.code, 'MALFORMED_CATALOG_RESPONSE');
        assert.equal(err.statusCode, 502);
        return true;
      }
    );

    // Non-array items
    assert.throws(
      () => validateCatalogResponse({ items: 'not-an-array', total: 0, limit: 50, offset: 0, hasMore: false }),
      (err: any) => {
        assert.equal(err.code, 'MALFORMED_CATALOG_RESPONSE');
        return true;
      }
    );

    // Item with non-positive or non-integer id
    assert.throws(
      () =>
        validateCatalogResponse({
          items: [{ id: -1, name: 'Test', primaryFamily: 'Citrus', volatility: 'Top', casNumber: '100-00-0' }],
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false,
        }),
      (err: any) => {
        assert.equal(err.code, 'MALFORMED_CATALOG_RESPONSE');
        assert.ok(err.message.includes('invalid id'));
        return true;
      }
    );

    // Item with empty name
    assert.throws(
      () =>
        validateCatalogResponse({
          items: [{ id: 1, name: '', primaryFamily: 'Citrus', volatility: 'Top', casNumber: '100-00-0' }],
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false,
        }),
      (err: any) => {
        assert.equal(err.code, 'MALFORMED_CATALOG_RESPONSE');
        assert.ok(err.message.includes('invalid name'));
        return true;
      }
    );

    // Negative total
    assert.throws(
      () =>
        validateCatalogResponse({
          items: [],
          total: -5,
          limit: 50,
          offset: 0,
          hasMore: false,
        }),
      (err: any) => {
        assert.equal(err.code, 'MALFORMED_CATALOG_RESPONSE');
        return true;
      }
    );

    // Items count exceeding limit
    const items = Array.from({ length: 60 }).map((_, i) => createSampleMaterial(i + 1));
    assert.throws(
      () =>
        validateCatalogResponse({
          items,
          total: 60,
          limit: 50,
          offset: 0,
          hasMore: false,
        }),
      (err: any) => {
        assert.equal(err.code, 'MALFORMED_CATALOG_RESPONSE');
        assert.ok(err.message.includes('exceeding limit'));
        return true;
      }
    );
  });

  it('3. Valid first page catalog response passes validation with correct pagination metadata', () => {
    const raw = {
      items: [createSampleMaterial(1, 'Bergamot FCF')],
      total: 815,
      limit: 50,
      offset: 0,
      hasMore: true,
    };

    const validated = validateCatalogResponse(raw, 50, 0);
    assert.equal(validated.total, 815);
    assert.equal(validated.items.length, 1);
    assert.equal(validated.items[0].name, 'Bergamot FCF');
    assert.equal(validated.hasMore, true);
  });

  it('4. Valid filtered query with 0 matches passes validation', () => {
    const raw = {
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false,
    };

    const validated = validateCatalogResponse(raw, 50, 0);
    assert.equal(validated.total, 0);
    assert.equal(validated.items.length, 0);
    assert.equal(validated.hasMore, false);
  });

  const baseProps = {
    mode: 'materials' as const,
    materials: [] as RawMaterial[],
    shelfMaterials: [] as RawMaterial[],
    selectedMaterialId: null,
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

  it('5. Initial failure renders "Catalog unavailable" error banner with retry button', () => {
    const html = renderToString(
      React.createElement(MaterialsAndInventoryView, {
        ...baseProps,
        catalogLoadState: 'error',
        catalogError: 'Failed to load catalog: network error',
        onRetryCatalog: () => {},
      })
    );

    assert.ok(html.includes('catalog-error-state'));
    assert.ok(html.includes('Catalog unavailable'));
    assert.ok(html.includes('Retry Catalog Load'));
  });

  it('6. Append failure renders retry button while preserving existing rows', () => {
    const html = renderToString(
      React.createElement(MaterialsAndInventoryView, {
        ...baseProps,
        materials: [createSampleMaterial(1, 'Existing Loaded Material')],
        catalogTotalCount: 815,
        catalogHasMore: true,
        catalogLoadState: 'ready',
        catalogLoadMoreError: 'Failed to append next page (504 Gateway Timeout)',
        onLoadMoreCatalog: () => {},
      })
    );

    assert.ok(html.includes('Existing Loaded Material'));
    assert.ok(html.includes('catalog-load-more-error'));
    assert.ok(html.includes('catalog-load-more-retry-btn'));
  });

  it('7. Empty unfiltered catalog displays "Raw materials catalog is empty or uninitialized" rather than "No materials match current filters"', () => {
    const html = renderToString(
      React.createElement(MaterialsAndInventoryView, {
        ...baseProps,
        catalogLoadState: 'ready',
        catalogTotalCount: 0,
      })
    );

    assert.ok(html.includes('Raw materials catalog is empty or uninitialized'));
    assert.ok(!html.includes('No materials match current filters'));
  });

  it('8. Shelf and Workbench query options in queryCatalogMaterials filter correctly by userUid in memory mode', async () => {
    const uid = 'test-perfumer-stage6';
    const email = `${uid}@perfumery.studio`;

    // Query shelfOnly for a user with starter organ items
    const shelfRes = await queryCatalogMaterials({
      uid,
      email,
      shelfOnly: true,
      limit: 50,
      offset: 0,
    });

    assert.ok(shelfRes.total > 0);
    assert.ok(shelfRes.items.every((m) => m.isOnShelf));

    // Workbench only
    const benchRes = await queryCatalogMaterials({
      uid,
      email,
      workbenchOnly: true,
      limit: 50,
      offset: 0,
    });

    assert.ok(benchRes.items.every((m) => m.isOnWorkbench));
  });

  it('9. Shelf pagination loop handles > 100 items without truncation', async () => {
    // Verify that multi-page retrieval can accumulate all items when repository returns pages of 100
    const mockPagedFetch = async (params: { limit?: number; offset?: number }) => {
      const limit = params.limit ?? 100;
      const offset = params.offset ?? 0;
      const total = 145; // More than the 100-item single page cap
      const pageCount = Math.min(limit, Math.max(0, total - offset));
      const items = Array.from({ length: pageCount }).map((_, i) =>
        createSampleMaterial(offset + i + 1, `Shelf Mat ${offset + i + 1}`)
      );
      return {
        items,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      } as CatalogListResponse;
    };

    // Simulate App.tsx pagination loop
    const allMaterials: RawMaterial[] = [];
    let currentOffset = 0;
    const pageSize = 100;
    let hasMorePages = true;

    while (hasMorePages) {
      const pageRes = await mockPagedFetch({ limit: pageSize, offset: currentOffset });
      allMaterials.push(...pageRes.items);
      currentOffset += pageRes.items.length;
      hasMorePages = pageRes.hasMore && allMaterials.length < pageRes.total && pageRes.items.length > 0;
    }

    assert.equal(allMaterials.length, 145);
    assert.equal(allMaterials[0].id, 1);
    assert.equal(allMaterials[144].id, 145);
  });

  it('10. Regulatory dossier validator rejects malformed entries in regulatoryRecords and constituents', () => {
    // Malformed record (missing authority)
    assert.throws(
      () =>
        validateRegulatoryDossierResponse({
          materialId: 1,
          regulatoryLimit: null,
          regulatoryRecords: [{ id: 1, authority: '' }],
          constituents: [],
        }),
      (err: any) => {
        assert.equal(err.code, 'MALFORMED_REGULATORY_DOSSIER');
        assert.ok(err.message.includes('missing authority'));
        return true;
      }
    );

    // Malformed constituent (missing constituentName)
    assert.throws(
      () =>
        validateRegulatoryDossierResponse({
          materialId: 1,
          regulatoryLimit: null,
          regulatoryRecords: [],
          constituents: [{ id: 1, constituentName: '' }],
        }),
      (err: any) => {
        assert.equal(err.code, 'MALFORMED_REGULATORY_DOSSIER');
        assert.ok(err.message.includes('missing constituentName'));
        return true;
      }
    );

    // Malformed regulatoryLimit (not an object)
    assert.throws(
      () =>
        validateRegulatoryDossierResponse({
          materialId: 1,
          regulatoryLimit: 'not-an-object',
          regulatoryRecords: [],
          constituents: [],
        }),
      (err: any) => {
        assert.equal(err.code, 'MALFORMED_REGULATORY_DOSSIER');
        assert.ok(err.message.includes('regulatoryLimit'));
        return true;
      }
    );

    // Valid dossier with clean records passes
    const validDossier = validateRegulatoryDossierResponse({
      materialId: 1,
      regulatoryLimit: null,
      regulatoryRecords: [
        {
          id: 1,
          materialId: 1,
          authority: 'IFRA',
          jurisdiction: 'GLOBAL',
          ruleType: 'MAX_USE',
          status: 'RESTRICTED',
          standardOrAnnex: 'IFRA_51',
          referenceNumber: 'STD-01',
          productCategory: 'Cat 4',
          maxFinishedProductPct: 5.0,
          maxReadyForUsePct: null,
          labelThresholdLeaveOnPct: null,
          labelThresholdRinseOffPct: null,
          conditionText: '',
          summary: 'Max 5.0% in Cat 4',
          sourceUrl: '',
          sourceDocument: 'IFRA 51',
          sourceVersion: '51',
          verifiedAt: '2026-01-01',
          verificationStatus: 'PARTIALLY_VERIFIED',
        },
      ],
      constituents: [
        {
          id: 1,
          materialId: 1,
          constituentName: 'Linalool',
          casNumber: '78-70-6',
          typicalPct: 10,
          minPct: 8,
          maxPct: 12,
          isAllergen: true,
          ifraStandardStatus: null,
          euCosmeticsStatus: null,
          sourceUrl: '',
          sourceDocument: '',
          verificationStatus: 'PARTIALLY_VERIFIED',
        },
      ],
    });

    assert.equal(validDossier.materialId, 1);
    assert.equal(validDossier.regulatoryRecords.length, 1);
    assert.equal(validDossier.constituents.length, 1);
  });
});
