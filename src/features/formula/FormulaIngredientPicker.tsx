import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import type { AccordDefinition, RawMaterial } from '../../domain/types';
import {
  type FormulaPickerSourceMode,
  resolveFormulaPickerDefaultSource,
} from '../../domain/formula-engine';

interface FormulaIngredientPickerProps {
  materials: RawMaterial[];
  accords: AccordDefinition[];
  addMaterialId: number;
  addAccordId: number;
  addQuantityGrams: string;
  showExpandedAccords: boolean;
  onSelectMaterialId: (id: number) => void;
  onSelectAccordId: (id: number) => void;
  onChangeQuantityGrams: (val: string) => void;
  onAddMaterialLine: () => void;
  onInsertAccordLine: () => void;
  onToggleExpandedAccords: () => void;
}

/**
 * Compact Formula Lab Ingredient Picker (`Current Workbench`, `My Shelf`, `Entire Catalog`).
 * Gracefully defaults to `My Shelf` when `Current Workbench` is empty.
 */
export const FormulaIngredientPicker: React.FC<FormulaIngredientPickerProps> = ({
  materials,
  accords,
  addMaterialId,
  addAccordId,
  addQuantityGrams,
  showExpandedAccords,
  onSelectMaterialId,
  onSelectAccordId,
  onChangeQuantityGrams,
  onAddMaterialLine,
  onInsertAccordLine,
  onToggleExpandedAccords,
}) => {
  const defaultSource = resolveFormulaPickerDefaultSource(materials);
  const [pickerSource, setPickerSource] =
    useState<FormulaPickerSourceMode>(defaultSource);

  const workbenchMaterials = materials.filter((m) => Boolean(m.isOnWorkbench));
  const shelfMaterials = materials.filter(
    (m) => Boolean(m.isOnShelf) || Boolean(m.isOnWorkbench)
  );

  // If user's Workbench becomes empty while on 'workbench', gracefully fall back to 'shelf'
  useEffect(() => {
    if (
      pickerSource === 'workbench' &&
      workbenchMaterials.length === 0 &&
      shelfMaterials.length > 0
    ) {
      setPickerSource('shelf');
    }
  }, [pickerSource, workbenchMaterials.length, shelfMaterials.length]);

  const displayedMaterials =
    pickerSource === 'workbench'
      ? workbenchMaterials
      : pickerSource === 'shelf'
      ? shelfMaterials
      : materials;

  useEffect(() => {
    if (
      displayedMaterials.length > 0 &&
      !displayedMaterials.some((m) => m.id === Number(addMaterialId))
    ) {
      onSelectMaterialId(displayedMaterials[0].id);
    }
  }, [pickerSource, displayedMaterials, addMaterialId, onSelectMaterialId]);

  return (
    <div
      data-testid="formula-add-ingredient-bar"
      className="p-3.5 sm:p-4 bg-[#0B0E14]/90 border-t border-slate-800 flex flex-col gap-3 w-full max-w-full"
    >
      {/* Compact Ingredient Picker Source Switch: Current Workbench | My Shelf | Entire Catalog */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium">
            Ingredient Picker Source:
          </span>
          <div
            role="group"
            aria-label="Formula Ingredient Picker Source"
            className="inline-flex items-center gap-1 p-0.5 bg-[#111621] border border-slate-800 rounded-md"
          >
            <button
              type="button"
              data-testid="picker-source-workbench"
              onClick={() => setPickerSource('workbench')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                pickerSource === 'workbench'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Current Workbench</span>
              <span className="font-mono-tabular text-[10px] opacity-85">
                ({workbenchMaterials.length})
              </span>
            </button>
            <button
              type="button"
              data-testid="picker-source-shelf"
              onClick={() => setPickerSource('shelf')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                pickerSource === 'shelf'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>My Shelf</span>
              <span className="font-mono-tabular text-[10px] opacity-85">
                ({shelfMaterials.length})
              </span>
            </button>
            <button
              type="button"
              data-testid="picker-source-catalog"
              onClick={() => setPickerSource('catalog')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                pickerSource === 'catalog'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Entire Catalog</span>
              <span className="font-mono-tabular text-[10px] opacity-85">
                ({materials.length})
              </span>
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showExpandedAccords}
            onChange={onToggleExpandedAccords}
            className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
          />
          <span>Expand Nested Accords</span>
        </label>
      </div>

      {/* Material & Accord Selection Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto min-w-0 flex-1">
          <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 min-w-0">
            <select
              aria-label="Select Raw Material to Add"
              value={addMaterialId}
              onChange={(e) => onSelectMaterialId(Number(e.target.value))}
              className="flex-1 min-w-0 bg-[#111621] border border-slate-800 rounded-md px-3 py-2 sm:py-1.5 text-xs text-white truncate max-w-full"
            >
              {displayedMaterials.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  className="bg-[#111622] text-slate-100"
                >
                  {m.name} ({m.primaryFamily} · {m.volatility})
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                step="0.1"
                min="0.01"
                aria-label="Grams to add"
                value={addQuantityGrams}
                onChange={(e) => onChangeQuantityGrams(e.target.value)}
                className="w-20 bg-[#111621] border border-slate-800 rounded-md px-2.5 py-2 sm:py-1.5 text-xs font-mono-tabular text-white"
              />
              <span className="text-xs text-slate-400">g</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onAddMaterialLine}
            className="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Add Raw Material</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto min-w-0">
          <select
            aria-label="Select Accord to Insert"
            value={addAccordId}
            onChange={(e) => onSelectAccordId(Number(e.target.value))}
            className="w-full sm:w-auto flex-1 min-w-0 bg-[#111621] border border-slate-800 rounded-md px-3 py-2 sm:py-1.5 text-xs text-white truncate max-w-full"
          >
            {accords.map((a) => (
              <option key={a.id} value={a.id}>
                Accord: {a.name} ({a.category})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onInsertAccordLine}
            className="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Insert Accord Block</span>
          </button>
        </div>
      </div>
    </div>
  );
};
