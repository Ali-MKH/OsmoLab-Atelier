import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MaterialCatalogView as BaseMaterialCatalogView,
  MaterialCatalogViewProps,
} from '../../components/MaterialsAndInventoryView';
import {
  fetchCatalogApi,
  fetchCatalogMaterialDetailApi,
} from '../../api/client';
import type { RawMaterial, MaterialRegulatoryLimit } from '../../domain/types';

export type { MaterialCatalogViewProps };

const AutonomousMaterialCatalogView: React.FC<MaterialCatalogViewProps> = (props) => {
  const [catalogMaterials, setCatalogMaterials] = useState<RawMaterial[]>([]);
  const [catalogLimits, setCatalogLimits] = useState<MaterialRegulatoryLimit[]>([]);
  const fetchedDetailIds = useRef<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initial bounded fetch: 50 catalog materials
  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetchCatalogApi({ limit: 50, offset: 0 })
      .then((res) => {
        if (!isCurrent) return;
        if (Array.isArray(res.items)) {
          setCatalogMaterials(res.items);
        }
        if (Array.isArray(res.regulatoryLimits)) {
          setCatalogLimits(res.regulatoryLimits);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Failed to load initial catalog page:', err);
        }
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, []);

  // Lazy-load material detail when selectedMaterialId changes
  useEffect(() => {
    const selId = props.selectedMaterialId;
    if (!selId || selId <= 0 || fetchedDetailIds.current.has(selId)) return;

    fetchedDetailIds.current.add(selId);
    fetchCatalogMaterialDetailApi(selId)
      .then((res) => {
        if (res.material) {
          setCatalogMaterials((prev) => {
            const idx = prev.findIndex((m) => m.id === selId);
            if (idx >= 0) {
              return prev.map((m, i) => (i === idx ? { ...m, ...res.material } : m));
            }
            return [...prev, res.material];
          });
        }
        if (res.regulatoryLimit) {
          setCatalogLimits((prev) => {
            const idx = prev.findIndex((l) => l.materialId === selId);
            if (idx >= 0) {
              return prev.map((l, i) => (i === idx ? res.regulatoryLimit! : l));
            }
            return [...prev, res.regulatoryLimit!];
          });
        }
      })
      .catch((err) => {
        console.warn(`Failed to lazy-load detail for material #${selId}:`, err);
      });
  }, [props.selectedMaterialId]);

  // Overlay user shelf/workbench state locally on catalog materials
  const mergedMaterials = useMemo(() => {
    const shelfMap = new Map<number, RawMaterial>();
    for (const m of props.materials) {
      shelfMap.set(m.id, m);
    }

    const seenIds = new Set<number>();
    const result: RawMaterial[] = [];

    for (const catMat of catalogMaterials) {
      seenIds.add(catMat.id);
      const shelfItem = shelfMap.get(catMat.id);
      if (shelfItem) {
        result.push({
          ...catMat,
          ...shelfItem,
          isOnShelf: true,
          isOnWorkbench: Boolean(shelfItem.isOnWorkbench),
        });
      } else {
        result.push(catMat);
      }
    }

    // Append any shelf materials not present in the current catalog slice
    for (const shelfMat of props.materials) {
      if (!seenIds.has(shelfMat.id)) {
        seenIds.add(shelfMat.id);
        result.push(shelfMat);
      }
    }

    return result;
  }, [catalogMaterials, props.materials]);

  // Merge regulatory limits
  const mergedLimits = useMemo(() => {
    const limitMap = new Map<number, MaterialRegulatoryLimit>();
    for (const lim of catalogLimits) {
      limitMap.set(lim.materialId, lim);
    }
    for (const lim of props.regulatoryLimits) {
      limitMap.set(lim.materialId, lim);
    }
    return Array.from(limitMap.values());
  }, [catalogLimits, props.regulatoryLimits]);

  // Wrapped shelf action handlers that immediately reflect local updates
  const handleAddToShelf = useCallback(
    (
      materialId: number,
      payload?: {
        supplierName?: string | null;
        supplierProductName?: string | null;
        workingDilutionPct?: number | null;
        personalNotes?: string | null;
        isOnWorkbench?: boolean;
        pyramidOverrideCode?: RawMaterial['pyramidOverrideCode'];
        favorite?: boolean;
      }
    ) => {
      setCatalogMaterials((prev) =>
        prev.map((m) =>
          m.id === materialId
            ? {
                ...m,
                isOnShelf: true,
                isOnWorkbench: payload?.isOnWorkbench ?? m.isOnWorkbench ?? false,
                supplier: payload?.supplierName ?? m.supplier,
                workingDilutionPct:
                  payload?.workingDilutionPct ?? m.workingDilutionPct ?? m.recommendedDilution,
                personalNotes: payload?.personalNotes ?? m.personalNotes,
                pyramidOverrideCode:
                  payload?.pyramidOverrideCode !== undefined
                    ? payload.pyramidOverrideCode
                    : m.pyramidOverrideCode,
                favorite: payload?.favorite ?? m.favorite,
              }
            : m
        )
      );
      props.onAddToShelf?.(materialId, payload);
    },
    [props.onAddToShelf]
  );

  const handleUpdateShelfItem = useCallback(
    (
      materialId: number,
      payload: {
        supplierName?: string | null;
        supplierProductName?: string | null;
        workingDilutionPct?: number | null;
        personalNotes?: string | null;
        isOnWorkbench?: boolean;
        pyramidOverrideCode?: RawMaterial['pyramidOverrideCode'];
        favorite?: boolean;
      }
    ) => {
      setCatalogMaterials((prev) =>
        prev.map((m) =>
          m.id === materialId
            ? {
                ...m,
                isOnShelf: m.isOnShelf || Boolean(payload.isOnWorkbench),
                isOnWorkbench:
                  payload.isOnWorkbench !== undefined ? payload.isOnWorkbench : m.isOnWorkbench,
                supplier:
                  payload.supplierName !== undefined && payload.supplierName !== null
                    ? payload.supplierName
                    : m.supplier,
                workingDilutionPct:
                  payload.workingDilutionPct !== undefined
                    ? payload.workingDilutionPct
                    : m.workingDilutionPct,
                personalNotes:
                  payload.personalNotes !== undefined && payload.personalNotes !== null
                    ? payload.personalNotes
                    : m.personalNotes,
                pyramidOverrideCode:
                  payload.pyramidOverrideCode !== undefined
                    ? payload.pyramidOverrideCode
                    : m.pyramidOverrideCode,
                favorite: payload.favorite !== undefined ? payload.favorite : m.favorite,
              }
            : m
        )
      );
      props.onUpdateShelfItem?.(materialId, payload);
    },
    [props.onUpdateShelfItem]
  );

  const handleRemoveFromShelf = useCallback(
    (materialId: number) => {
      setCatalogMaterials((prev) =>
        prev.map((m) =>
          m.id === materialId ? { ...m, isOnShelf: false, isOnWorkbench: false } : m
        )
      );
      props.onRemoveFromShelf?.(materialId);
    },
    [props.onRemoveFromShelf]
  );

  return (
    <BaseMaterialCatalogView
      {...props}
      materials={mergedMaterials}
      regulatoryLimits={mergedLimits}
      onAddToShelf={handleAddToShelf}
      onUpdateShelfItem={handleUpdateShelfItem}
      onRemoveFromShelf={handleRemoveFromShelf}
    />
  );
};

export const MaterialCatalogView: React.FC<MaterialCatalogViewProps> = (props) => {
  if (props.mode === 'accords') {
    return <BaseMaterialCatalogView {...props} />;
  }
  return <AutonomousMaterialCatalogView {...props} />;
};
