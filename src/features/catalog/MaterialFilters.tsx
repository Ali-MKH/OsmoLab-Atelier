import React from 'react';
import { Search } from 'lucide-react';
import { OLFACTORY_WHEEL_FAMILIES } from '../../domain/seed-data';

interface MaterialFiltersProps {
  searchQuery: string;
  familyFilter: string;
  originFilter: string;
  pyramidFilter?: string;
  onSearchChange: (q: string) => void;
  onFamilyChange: (family: string) => void;
  onOriginChange: (origin: string) => void;
  onPyramidChange?: (pyramid: string) => void;
}

export const MaterialFilters: React.FC<MaterialFiltersProps> = ({
  searchQuery,
  familyFilter,
  originFilter,
  pyramidFilter = 'All',
  onSearchChange,
  onFamilyChange,
  onOriginChange,
  onPyramidChange,
}) => {
  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name, scientific, CAS, facet..."
          aria-label="Search raw materials"
          className="w-full bg-[#0B0E14] border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
        />
      </div>

      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs">
        <select
          aria-label="Filter by Olfactory Family"
          value={familyFilter}
          onChange={(e) => onFamilyChange(e.target.value)}
          className="flex-1 min-w-0 bg-[#0B0E14] border border-slate-800 rounded px-2 py-1 text-slate-300"
        >
          <option value="All">All Families</option>
          {OLFACTORY_WHEEL_FAMILIES.map((f) => (
            <option key={f.id} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by Natural or Synthetic"
          value={originFilter}
          onChange={(e) => onOriginChange(e.target.value)}
          className="min-w-0 bg-[#0B0E14] border border-slate-800 rounded px-2 py-1 text-slate-300"
        >
          <option value="All">All Origins</option>
          <option value="Natural">Natural</option>
          <option value="Synthetic">Synthetic</option>
        </select>
        {onPyramidChange && (
          <select
            aria-label="Filter by Pyramid Tier"
            value={pyramidFilter}
            onChange={(e) => onPyramidChange(e.target.value)}
            className="min-w-0 bg-[#0B0E14] border border-slate-800 rounded px-2 py-1 text-slate-300"
          >
            <option value="All">All Tiers</option>
            <option value="T">T (Top)</option>
            <option value="TH">TH (Top-Heart)</option>
            <option value="H">H (Heart)</option>
            <option value="HB">HB (Heart-Base)</option>
            <option value="B">B (Base)</option>
            <option value="THB">THB (Full Span)</option>
            <option value="NONE">NONE (Solvent)</option>
          </select>
        )}
      </div>
    </div>
  );
};
