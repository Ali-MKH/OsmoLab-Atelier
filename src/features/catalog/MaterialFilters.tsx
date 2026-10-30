import React from 'react';
import { Filter, Layers, Search, X } from 'lucide-react';
import { OLFACTORY_WHEEL_FAMILIES } from '../../domain/olfactory-wheel-families';
import type { PyramidUiCode } from '../../domain/types';

export interface MaterialFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  familyFilter: string;
  onFamilyChange: (val: string) => void;
  originFilter: string;
  onOriginChange: (val: string) => void;
  pyramidFilter: PyramidUiCode | 'ALL';
  onPyramidChange: (val: PyramidUiCode | 'ALL') => void;
  totalMatchingCount: number;
  totalCatalogCount?: number;
}

const PYRAMID_FILTER_OPTIONS: Array<{ value: PyramidUiCode | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Pyramid Positions' },
  { value: 'T', label: 'T — Top' },
  { value: 'TH', label: 'TH — Top–Heart' },
  { value: 'H', label: 'H — Heart' },
  { value: 'HB', label: 'HB — Heart–Base' },
  { value: 'B', label: 'B — Base' },
  { value: 'TB', label: 'TB — Top–Base' },
  { value: 'THB', label: 'THB — Full Span' },
  { value: 'NONE', label: 'NONE — Carrier / Solvent' },
];

export const MaterialFilters: React.FC<MaterialFiltersProps> = ({
  search,
  onSearchChange,
  familyFilter,
  onFamilyChange,
  originFilter,
  onOriginChange,
  pyramidFilter,
  onPyramidChange,
  totalMatchingCount,
  totalCatalogCount,
}) => {
  const hasActiveFilters =
    search.trim().length > 0 ||
    familyFilter !== 'All' ||
    originFilter !== 'All' ||
    pyramidFilter !== 'ALL';

  const handleClearFilters = () => {
    onSearchChange('');
    onFamilyChange('All');
    onOriginChange('All');
    onPyramidChange('ALL');
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 bg-slate-900/70 border border-slate-800/80 rounded-xl p-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          data-testid="catalog-search-input"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by material name, CAS, INCI, alias, or odor descriptor..."
          className="w-full min-h-[44px] bg-slate-950/90 border border-slate-800 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <select
          aria-label="Filter by olfactory family"
          data-testid="catalog-family-filter"
          value={familyFilter}
          onChange={(e) => onFamilyChange(e.target.value)}
          className="min-h-[44px] bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
        >
          <option value="All">All Families</option>
          {OLFACTORY_WHEEL_FAMILIES.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <select
        aria-label="Filter by material origin"
        data-testid="catalog-origin-filter"
        value={originFilter}
        onChange={(e) => onOriginChange(e.target.value)}
        className="min-h-[44px] bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
      >
        <option value="All">All Origins</option>
        <option value="Natural">Natural</option>
        <option value="Synthetic">Synthetic</option>
        <option value="Isolate">Isolate</option>
        <option value="Base">Base</option>
      </select>

      <div className="flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
        <select
          aria-label="Filter by pyramid position"
          data-testid="catalog-pyramid-filter"
          value={pyramidFilter}
          onChange={(e) => onPyramidChange(e.target.value as PyramidUiCode | 'ALL')}
          className="min-h-[44px] bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
        >
          {PYRAMID_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClearFilters}
          className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-[11px] font-medium text-slate-300 transition-colors"
        >
          Reset
        </button>
      )}

      <span className="text-[11px] font-mono text-slate-400 ml-auto px-2">
        {totalMatchingCount}
        {typeof totalCatalogCount === 'number' && totalCatalogCount > totalMatchingCount
          ? ` / ${totalCatalogCount}`
          : ''}{' '}
        materials
      </span>
    </div>
  );
};
