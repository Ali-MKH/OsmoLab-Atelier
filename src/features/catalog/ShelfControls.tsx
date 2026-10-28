import React from 'react';
import { Check, Plus } from 'lucide-react';

export type PaletteCatalogTab = 'catalog' | 'shelf' | 'workbench';

interface ShelfFilterBarProps {
  activeTab: PaletteCatalogTab;
  workbenchOnlyInShelf: boolean;
  catalogCount: number;
  shelfCount: number;
  workbenchCount: number;
  onSelectTab: (tab: PaletteCatalogTab) => void;
  onToggleWorkbenchOnlyInShelf: (next: boolean) => void;
}

/**
 * Simple Catalog | My Shelf switcher with a lightweight `[✓ Workbench only]` filter chip
 * as specified in Stage 3 Part A.
 */
export const ShelfFilterBar: React.FC<ShelfFilterBarProps> = ({
  activeTab,
  workbenchOnlyInShelf,
  catalogCount,
  shelfCount,
  workbenchCount,
  onSelectTab,
  onToggleWorkbenchOnlyInShelf,
}) => {
  const isCatalogActive = activeTab === 'catalog';
  const isShelfActive = activeTab === 'shelf' || activeTab === 'workbench';
  const isWorkbenchChipChecked =
    activeTab === 'workbench' || (activeTab === 'shelf' && workbenchOnlyInShelf);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 p-1 bg-[#0B0E14] border border-slate-800 rounded-lg">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => {
              onToggleWorkbenchOnlyInShelf(false);
              onSelectTab('catalog');
            }}
            data-testid="palette-tab-catalog"
            className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 min-w-0 ${
              isCatalogActive
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="truncate">Catalog</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-semibold shrink-0 ${
                isCatalogActive
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {catalogCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleWorkbenchOnlyInShelf(false);
              onSelectTab('shelf');
            }}
            data-testid="palette-tab-shelf"
            className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 min-w-0 ${
              isShelfActive && !isWorkbenchChipChecked
                ? 'bg-emerald-600 text-white shadow-sm'
                : isShelfActive
                ? 'bg-slate-800 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="truncate">My Shelf</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-semibold shrink-0 ${
                isShelfActive && !isWorkbenchChipChecked
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {shelfCount}
            </span>
          </button>
        </div>

        {/* Lightweight [✓ Workbench only] filter chip */}
        <button
          type="button"
          data-testid="palette-tab-workbench"
          onClick={() => {
            if (isWorkbenchChipChecked) {
              onToggleWorkbenchOnlyInShelf(false);
              onSelectTab('shelf');
            } else {
              onToggleWorkbenchOnlyInShelf(true);
              onSelectTab('workbench');
            }
          }}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 border ${
            isWorkbenchChipChecked
              ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300 shadow-xs'
              : 'bg-[#111621] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
          title="Filter My Shelf to show only materials pinned to your Current Workbench"
        >
          <span
            className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center border ${
              isWorkbenchChipChecked
                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                : 'border-slate-600 bg-transparent'
            }`}
          >
            {isWorkbenchChipChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </span>
          <span>Workbench only</span>
          <span className="px-1 py-0.2 rounded bg-slate-800/90 text-[10px] font-mono-tabular text-slate-300">
            {workbenchCount}
          </span>
        </button>
      </div>
    </div>
  );
};

interface ShelfItemActionButtonsProps {
  materialId: number;
  isOnShelf: boolean;
  isOnWorkbench: boolean;
  onToggleShelf: (materialId: number) => void;
  onToggleWorkbench: (materialId: number) => void;
}

export const ShelfItemActionButtons: React.FC<ShelfItemActionButtonsProps> = ({
  materialId,
  isOnShelf,
  isOnWorkbench,
  onToggleShelf,
  onToggleWorkbench,
}) => {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        data-testid={`toggle-shelf-${materialId}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleShelf(materialId);
        }}
        title={isOnShelf ? 'Remove from My Shelf' : 'Add to My Shelf'}
        className={`px-2 py-1 rounded border text-[10px] font-medium transition-colors flex items-center gap-1 ${
          isOnShelf
            ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 hover:bg-rose-950/50 hover:border-rose-500/50 hover:text-rose-300'
            : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-cyan-600 hover:text-white hover:border-cyan-500'
        }`}
      >
        {isOnShelf ? 'On Shelf ✓' : '+ Add to My Shelf'}
      </button>

      {isOnShelf && (
        <button
          type="button"
          data-testid={`toggle-workbench-${materialId}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleWorkbench(materialId);
          }}
          title={
            isOnWorkbench
              ? 'Remove from Workbench'
              : 'Pin to Workbench'
          }
          className={`px-2 py-1 rounded border text-[10px] font-medium transition-colors flex items-center gap-1 ${
            isOnWorkbench
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-rose-950/50 hover:border-rose-500/50 hover:text-rose-300'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-500'
          }`}
        >
          {isOnWorkbench ? (
            <>
              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline">Workbench</span>
            </>
          ) : (
            <>
              <Plus className="w-3 h-3 shrink-0" />
              <span className="hidden xl:inline">Pin</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
