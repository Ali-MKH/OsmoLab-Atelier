import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MaterialsAndInventoryView as BaseMaterialCatalogView,
  type MaterialsAndInventoryViewProps,
} from '../../components/MaterialsAndInventoryView';
import {
  fetchCatalogApi,
  type CatalogQueryParams,
  type LoadState,
} from '../../api/client';
import type { PyramidUiCode, RawMaterial, UserShelfItem } from '../../domain/types';

export { MaterialFilters, type MaterialFiltersProps } from './MaterialFilters';
export { PyramidBadge } from './PyramidBadge';
export {
  ShelfFilterBar,
  ShelfItemActionButtons,
  type PaletteCatalogTab,
} from './ShelfControls';

export interface AutonomousMaterialCatalogViewProps
  extends MaterialsAndInventoryViewProps {
  getAuthHeaders?: () => Promise<Record<string, string>>;
  userShelf?: UserShelfItem[];
}

export interface ServerCatalogQueryState {
  q: string;
  family: string;
  origin: string;
  pyramidCode: PyramidUiCode | 'ALL';
}

const CATALOG_PAGE_LIMIT = 50;

function deduplicateMaterialsById(rows: RawMaterial[]): RawMaterial[] {
  const seen = new Set<number>();
  const out: RawMaterial[] = [];
  for (const row of rows) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
}

function isSameCatalogQuery(
  a: ServerCatalogQueryState,
  b: ServerCatalogQueryState
): boolean {
  return (
    a.q === b.q &&
    a.family === b.family &&
    a.origin === b.origin &&
    a.pyramidCode === b.pyramidCode
  );
}

/**
 * Autonomous, server-driven MaterialCatalogView:
 * - Owns q, family, origin, pyramidCode, limit=50, offset, total, hasMore, loadState, and error.
 * - Initial page loads limit=50&offset=0.
 * - Debounces search/filter queries (~250ms), passes a real AbortSignal, and ignores stale responses.
 * - Lazy/infinite scroll increments offset += 50 with a query-stability guard and ref-based append lock, deduplicating by material ID.
 * - Overlays Shelf/Workbench metadata onto visible Catalog rows by material ID only (never appends unrelated shelf items to Catalog results).
 */
export const AutonomousMaterialCatalogView: React.FC<
  AutonomousMaterialCatalogViewProps
> = ({ getAuthHeaders, userShelf, ...props }) => {
  const [queryState, setQueryState] = useState<ServerCatalogQueryState>({
    q: '',
    family: 'All',
    origin: 'All',
    pyramidCode: 'ALL',
  });
  const [debouncedQuery, setDebouncedQuery] = useState<ServerCatalogQueryState>(queryState);
  const [catalogSlice, setCatalogSlice] = useState<RawMaterial[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoadMoreError, setCatalogLoadMoreError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef<number>(0);
  const appendRequestInFlightRef = useRef<boolean>(false);
  const getAuthHeadersRef = useRef(getAuthHeaders);
  getAuthHeadersRef.current = getAuthHeaders;

  // Debounce query changes by 250ms
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryState);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [queryState]);

  const executeCatalogFetch = useCallback(
    async (
      activeQuery: ServerCatalogQueryState,
      targetOffset: number,
      append: boolean
    ) => {
      if (append && appendRequestInFlightRef.current) {
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const seq = ++requestSeqRef.current;

      if (append) {
        appendRequestInFlightRef.current = true;
        setIsLoadingMore(true);
        setCatalogLoadMoreError(null);
      } else {
        appendRequestInFlightRef.current = false;
        setIsLoadingMore(false);
        setLoadState('loading');
        setCatalogError(null);
        setCatalogLoadMoreError(null);
      }

      try {
        const headers = getAuthHeadersRef.current
          ? await getAuthHeadersRef.current()
          : {};
        if (controller.signal.aborted || seq !== requestSeqRef.current) {
          return;
        }

        const params: CatalogQueryParams = {
          q: activeQuery.q,
          family: activeQuery.family,
          origin: activeQuery.origin,
          pyramidCode: activeQuery.pyramidCode,
          limit: CATALOG_PAGE_LIMIT,
          offset: targetOffset,
        };

        const res = await fetchCatalogApi(params, headers, controller.signal);
        if (controller.signal.aborted || seq !== requestSeqRef.current) {
          return;
        }

        const items = Array.isArray(res.items) ? res.items : [];
        setCatalogSlice((prev) =>
          append ? deduplicateMaterialsById([...prev, ...items]) : deduplicateMaterialsById(items)
        );
        setTotalCount(typeof res.total === 'number' ? res.total : items.length);
        setOffset(targetOffset);
        setHasMore(Boolean(res.hasMore));
        setLoadState('ready');
        setCatalogLoadMoreError(null);
      } catch (err: unknown) {
        if (
          controller.signal.aborted ||
          (err instanceof Error && err.name === 'AbortError') ||
          seq !== requestSeqRef.current
        ) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Failed to load catalog slice from server.';
        if (append) {
          setCatalogLoadMoreError(message);
        } else {
          setCatalogError(message);
          setLoadState('error');
        }
      } finally {
        if (seq === requestSeqRef.current) {
          appendRequestInFlightRef.current = false;
          setIsLoadingMore(false);
        }
      }
    },
    []
  );

  // Trigger server fetch whenever debouncedQuery changes (resets to offset = 0)
  useEffect(() => {
    void executeCatalogFetch(debouncedQuery, 0, false);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      appendRequestInFlightRef.current = false;
    };
  }, [debouncedQuery, executeCatalogFetch]);

  const handleCatalogQueryChange = useCallback(
    (partial: Partial<ServerCatalogQueryState>) => {
      setQueryState((prev) => {
        const next: ServerCatalogQueryState = {
          q: partial.q !== undefined ? partial.q : prev.q,
          family: partial.family !== undefined ? partial.family : prev.family,
          origin: partial.origin !== undefined ? partial.origin : prev.origin,
          pyramidCode:
            partial.pyramidCode !== undefined ? partial.pyramidCode : prev.pyramidCode,
        };
        if (isSameCatalogQuery(next, prev)) {
          return prev;
        }
        return next;
      });
    },
    []
  );

  const handleLoadMore = useCallback(() => {
    if (
      loadState === 'loading' ||
      isLoadingMore ||
      appendRequestInFlightRef.current ||
      !hasMore ||
      !isSameCatalogQuery(queryState, debouncedQuery)
    ) {
      return;
    }
    const nextOffset = offset + CATALOG_PAGE_LIMIT;
    void executeCatalogFetch(debouncedQuery, nextOffset, true);
  }, [
    loadState,
    isLoadingMore,
    hasMore,
    queryState,
    debouncedQuery,
    offset,
    executeCatalogFetch,
  ]);

  // Overlay user shelf/workbench metadata onto visible Catalog rows by material ID only.
  // Never append unrelated shelf rows into the current Catalog query results.
  const overlaidCatalogMaterials = useMemo(() => {
    const shelfById = new Map<number, UserShelfItem>();
    for (const item of userShelf || []) {
      shelfById.set(item.materialId, item);
    }
    const localPropsById = new Map<number, RawMaterial>();
    for (const m of props.materials) {
      localPropsById.set(m.id, m);
    }

    return catalogSlice.map((catalogRow) => {
      const shelfRow = shelfById.get(catalogRow.id);
      const propRow = localPropsById.get(catalogRow.id);
      if (!shelfRow && !propRow) {
        return {
          ...catalogRow,
          isOnShelf: false,
          isOnWorkbench: false,
          favorite: false,
        };
      }
      const isOnShelf = shelfRow ? true : Boolean(propRow?.isOnShelf);
      return {
        ...catalogRow,
        isOnShelf,
        isOnWorkbench: shelfRow
          ? Boolean(shelfRow.isOnWorkbench)
          : Boolean(propRow?.isOnWorkbench),
        favorite: shelfRow
          ? Boolean(shelfRow.favorite)
          : Boolean(propRow?.favorite),
        supplier: shelfRow?.supplierName || propRow?.supplier || catalogRow.supplier,
        supplierProductName:
          shelfRow?.supplierProductName ??
          propRow?.supplierProductName ??
          catalogRow.supplierProductName,
        workingDilutionPct:
          shelfRow?.workingDilutionPct ??
          propRow?.workingDilutionPct ??
          catalogRow.workingDilutionPct,
        personalNotes:
          shelfRow?.personalNotes ?? propRow?.personalNotes ?? catalogRow.personalNotes,
        pyramidOverrideCode:
          shelfRow?.pyramidOverrideCode ??
          propRow?.pyramidOverrideCode ??
          catalogRow.pyramidOverrideCode,
      };
    });
  }, [catalogSlice, userShelf, props.materials]);

  return (
    <BaseMaterialCatalogView
      {...props}
      materials={overlaidCatalogMaterials}
      shelfMaterials={props.materials}
      catalogTotalCount={totalCount}
      catalogHasMore={hasMore}
      isLoadingMoreCatalog={isLoadingMore}
      catalogLoadState={loadState}
      catalogError={catalogError}
      catalogLoadMoreError={catalogLoadMoreError}
      onLoadMoreCatalog={handleLoadMore}
      onRetryCatalog={() => void executeCatalogFetch(debouncedQuery, 0, false)}
      onCatalogQueryChange={handleCatalogQueryChange}
    />
  );
};

export const MaterialCatalogView = AutonomousMaterialCatalogView;
export type MaterialCatalogViewProps = AutonomousMaterialCatalogViewProps;
