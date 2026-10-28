import React, { useState, useEffect } from 'react';
import {
  AccordDefinition,
  AccordItem,
  AccordVersionSnapshot,
  Formula,
  MaterialRegulatoryLimit,
  MaterialUsageReview,
  RawMaterial,
  ScentMemoryRecord,
  VolatilityTier,
} from '../domain/types';
import { OLFACTORY_WHEEL_FAMILIES } from '../domain/seed-data';
import { normalizeMaterialSynonyms } from '../domain/navigation-state';
import { PyramidStepIcon, getVolatilityBadgeConfig } from './PyramidStepIcon';
import { DualRegulatorySlider } from './DualRegulatorySlider';
import { resolveEffectiveMaterialPyramidMetadata } from '../domain/formula-engine';
import { ShelfFilterBar } from '../features/catalog/ShelfControls';
import { MaterialFilters } from '../features/catalog/MaterialFilters';
import { PyramidBadge } from '../features/catalog/PyramidBadge';
import { RegulatoryDossier } from '../features/regulatory/RegulatoryDossier';
import {
  Plus,
  Search,
  FlaskConical,
  PackageCheck,
  AlertTriangle,
  BookOpen,
  Sparkles,
  Layers,
  History,
  Check,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Scale,
  Shield,
  AlertOctagon,
  HelpCircle,
  CheckCircle2,
  Database,
  X,
  ShoppingCart,
  ArrowLeft,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';

interface MaterialsAndInventoryViewProps {
  mode: 'materials' | 'accords';
  materials: RawMaterial[];
  selectedMaterialId: number;
  regulatoryLimits: MaterialRegulatoryLimit[];
  scentMemories: ScentMemoryRecord[];
  usageReviews: MaterialUsageReview[];
  onToggleWorkbenchMaterial?: (id: number) => void;
  onUpdateMaterialNotes?: (id: number, notes: string) => void;
  onAddToShelf?: (
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
  ) => void;
  onUpdateShelfItem?: (
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
  ) => void;
  onRemoveFromShelf?: (materialId: number) => void;
  accords: AccordDefinition[];
  formulas: Formula[];
  educationalPromptsEnabled: boolean;
  onSelectMaterial: (id: number) => void;
  onCreateMaterial: (
    payload: Omit<RawMaterial, 'id'> & {
      maxAllowedPercent?: number | null;
      ifraSource?: string;
    }
  ) => Promise<void>;
  onCreateAccord: (payload: Omit<AccordDefinition, 'id'>) => Promise<void>;
  onUpdateAccord?: (accord: AccordDefinition) => void;
  onDeleteAccord?: (accordId: number) => void;
  onInsertAccordIntoActiveFormula: (
    accord: AccordDefinition,
    dosageGrams?: number,
    targetFormulaId?: number,
    newFormulaName?: string
  ) => void;
  onInsertMaterialIntoFormula?: (
    material: RawMaterial,
    dosageGrams: number,
    dilutionPercent: number,
    targetFormulaId?: number,
    newFormulaName?: string
  ) => void;
  onSaveScentMemory: (
    payload: Omit<ScentMemoryRecord, 'id' | 'lastReviewedAt'>
  ) => Promise<void>;
  onOpenFormula: (formulaId: number, versionLabel?: string) => void;
}

export const MaterialsAndInventoryView: React.FC<MaterialsAndInventoryViewProps> = ({
  mode,
  materials,
  selectedMaterialId,
  regulatoryLimits,
  scentMemories,
  usageReviews,
  accords,
  formulas,
  educationalPromptsEnabled,
  onSelectMaterial,
  onCreateMaterial,
  onCreateAccord,
  onUpdateAccord,
  onDeleteAccord,
  onInsertAccordIntoActiveFormula,
  onInsertMaterialIntoFormula,
  onSaveScentMemory,
  onOpenFormula,
  onToggleWorkbenchMaterial,
  onUpdateMaterialNotes,
  onAddToShelf,
  onUpdateShelfItem,
  onRemoveFromShelf,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState('All');
  const [originFilter, setOriginFilter] = useState('All');
  const [pyramidFilter, setPyramidFilter] = useState('All');
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showAddAccordModal, setShowAddAccordModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [materialSubTab, setMaterialSubTabState] = useState<
    'profile' | 'regulatory' | 'memory'
  >(() => {
    try {
      const saved = sessionStorage.getItem('osmolab_material_subtab');
      if (saved === 'profile' || saved === 'regulatory' || saved === 'memory') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'profile';
  });

  const setMaterialSubTab = (tab: 'profile' | 'regulatory' | 'memory') => {
    setMaterialSubTabState(tab);
    try {
      sessionStorage.setItem('osmolab_material_subtab', tab);
    } catch {
      // ignore
    }
  };

  // Palette View Mode: 'workbench' (Active bench subset) | 'shelf' (All user-owned materials) | 'catalog' (All 815+ library materials)
  const [paletteViewTab, setPaletteViewTabState] = useState<
    'workbench' | 'shelf' | 'catalog'
  >(() => {
    try {
      const saved = sessionStorage.getItem('osmolab_palette_tab');
      if (saved === 'workbench') return 'workbench';
      if (saved === 'shelf') return 'shelf';
      if (saved === 'catalog') return 'catalog';
    } catch {
      // ignore
    }
    return 'catalog';
  });

  const setPaletteViewTab = (tab: 'workbench' | 'shelf' | 'catalog') => {
    setPaletteViewTabState(tab);
    try {
      sessionStorage.setItem('osmolab_palette_tab', tab);
    } catch {
      // ignore
    }
  };

  const [profileDetailMaterial, setProfileDetailMaterial] = useState<RawMaterial | null>(null);
  const [modalProfileTab, setModalProfileTab] = useState<'overview' | 'regulatory'>('overview');
  const [personalNotesDraft, setPersonalNotesDraft] = useState<Record<number, string>>({});
  const [shelfMetaDraft, setShelfMetaDraft] = useState<
    Record<
      number,
      {
        supplierName: string;
        supplierProductName: string;
        workingDilutionPct: string;
        pyramidOverrideCode?: RawMaterial['pyramidOverrideCode'];
      }
    >
  >({});

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  };

  const isMaterialOnShelf = (mat: RawMaterial): boolean => {
    if (mat.isOnShelf !== undefined) return Boolean(mat.isOnShelf);
    return mat.isOnWorkbench !== false;
  };

  const isMaterialOnWorkbench = (mat: RawMaterial): boolean => {
    return isMaterialOnShelf(mat) && Boolean(mat.isOnWorkbench);
  };

  const handleToggleShelf = (matOrId: RawMaterial | number) => {
    const mat =
      typeof matOrId === 'number'
        ? materials.find((m) => m.id === matOrId)
        : matOrId;
    if (!mat) return;
    const currentlyOnShelf = isMaterialOnShelf(mat);
    if (currentlyOnShelf) {
      onRemoveFromShelf?.(mat.id);
      triggerToast(`Removed ${mat.name} from My Shelf (and cleared Workbench pin)`);
    } else {
      onAddToShelf?.(mat.id, {
        supplierName: mat.supplier || '',
        supplierProductName: mat.supplierProductName || '',
        workingDilutionPct: mat.workingDilutionPct ?? mat.recommendedDilution ?? 100,
        personalNotes: mat.personalNotes || '',
        isOnWorkbench: false,
      });
      triggerToast(`Added ${mat.name} to My Shelf`);
    }
  };

  const handleToggleWorkbench = (matId: number) => {
    const targetMat = materials.find((m) => m.id === matId);
    if (!targetMat) return;
    const onShelf = isMaterialOnShelf(targetMat);
    const onWorkbench = isMaterialOnWorkbench(targetMat);

    if (!onShelf) {
      // Pinning to Workbench requires the material to be on My Shelf first
      onAddToShelf?.(matId, {
        supplierName: targetMat.supplier || '',
        supplierProductName: targetMat.supplierProductName || '',
        workingDilutionPct:
          targetMat.workingDilutionPct ?? targetMat.recommendedDilution ?? 100,
        personalNotes: targetMat.personalNotes || '',
        isOnWorkbench: true,
      });
      setToastMsg(`Added ${targetMat.name} to My Shelf and pinned to Current Workbench`);
    } else if (onWorkbench) {
      // Removing from Workbench keeps the material on My Shelf
      if (onUpdateShelfItem) {
        onUpdateShelfItem(matId, { isOnWorkbench: false });
      } else if (onToggleWorkbenchMaterial) {
        onToggleWorkbenchMaterial(matId);
      }
      setToastMsg(`Unpinned ${targetMat.name} from Current Workbench (kept on My Shelf)`);
    } else {
      if (onUpdateShelfItem) {
        onUpdateShelfItem(matId, { isOnWorkbench: true });
      } else if (onToggleWorkbenchMaterial) {
        onToggleWorkbenchMaterial(matId);
      }
      setToastMsg(`Pinned ${targetMat.name} to Current Workbench`);
    }
    setTimeout(() => setToastMsg(null), 2200);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddMaterialModal(false);
        setShowAddAccordModal(false);
        setTargetFormulaModal(null);
        setProfileDetailMaterial(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Interactive Target Formula Modal for Accords and Palette Materials
  const [targetFormulaModal, setTargetFormulaModal] = useState<{
    isOpen: boolean;
    itemType: 'accord' | 'material';
    accord?: AccordDefinition;
    material?: RawMaterial;
    dosageGrams: number;
    dilutionPercent: number;
    selectedFormulaId: number | 'new';
    newFormulaName: string;
  } | null>(null);

  const openTargetFormulaModalForAccord = (acc: AccordDefinition, defaultGrams = 10) => {
    setTargetFormulaModal({
      isOpen: true,
      itemType: 'accord',
      accord: acc,
      dosageGrams: defaultGrams,
      dilutionPercent: 100,
      selectedFormulaId: formulas[0]?.id ?? 'new',
      newFormulaName: `${acc.name} Study V1`,
    });
  };

  const openTargetFormulaModalForMaterial = (mat: RawMaterial, defaultGrams = 2) => {
    setTargetFormulaModal({
      isOpen: true,
      itemType: 'material',
      material: mat,
      dosageGrams: defaultGrams,
      dilutionPercent: mat.recommendedDilution || 100,
      selectedFormulaId: formulas[0]?.id ?? 'new',
      newFormulaName: `${mat.name} Study V1`,
    });
  };

  const renderTargetFormulaModal = () => {
    if (!targetFormulaModal || !targetFormulaModal.isOpen) return null;
    const isAccord = targetFormulaModal.itemType === 'accord';
    const itemName = isAccord
      ? targetFormulaModal.accord?.name
      : targetFormulaModal.material?.name;
    const targetFormula = formulas.find(
      (f) => f.id === targetFormulaModal.selectedFormulaId
    );

    const handleConfirm = (e: React.FormEvent) => {
      e.preventDefault();
      if (isAccord && targetFormulaModal.accord) {
        onInsertAccordIntoActiveFormula(
          targetFormulaModal.accord,
          targetFormulaModal.dosageGrams,
          typeof targetFormulaModal.selectedFormulaId === 'number'
            ? targetFormulaModal.selectedFormulaId
            : undefined,
          targetFormulaModal.selectedFormulaId === 'new'
            ? targetFormulaModal.newFormulaName
            : undefined
        );
        setToastMsg(
          `Added ${targetFormulaModal.dosageGrams}g of ${itemName} to ${
            targetFormulaModal.selectedFormulaId === 'new'
              ? targetFormulaModal.newFormulaName
              : targetFormula?.name || 'formula'
          }`
        );
      } else if (!isAccord && targetFormulaModal.material && onInsertMaterialIntoFormula) {
        onInsertMaterialIntoFormula(
          targetFormulaModal.material,
          targetFormulaModal.dosageGrams,
          targetFormulaModal.dilutionPercent,
          typeof targetFormulaModal.selectedFormulaId === 'number'
            ? targetFormulaModal.selectedFormulaId
            : undefined,
          targetFormulaModal.selectedFormulaId === 'new'
            ? targetFormulaModal.newFormulaName
            : undefined
        );
        setToastMsg(
          `Added ${targetFormulaModal.dosageGrams}g of ${itemName} to ${
            targetFormulaModal.selectedFormulaId === 'new'
              ? targetFormulaModal.newFormulaName
              : targetFormula?.name || 'formula'
          }`
        );
      }
      setTargetFormulaModal(null);
      setTimeout(() => setToastMsg(null), 3000);
    };

    return (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
        onClick={() => setTargetFormulaModal(null)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="target-formula-title"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-xl bg-[#111621] border border-slate-700 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden text-xs my-auto"
        >
          {/* Sticky Header with Close Button */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800 shrink-0 sticky top-0 bg-[#111621] z-10">
            <div>
              <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-emerald-400 font-semibold block">
                Formula Insertion Target
              </span>
              <h3 id="target-formula-title" className="text-base font-semibold text-white mt-0.5">
                {isAccord
                  ? `Insert "${itemName}" Accord into Formula (${targetFormulaModal.dosageGrams}g)`
                  : `Add "${itemName}" to Formula (${targetFormulaModal.dosageGrams}g)`}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Select which formula will receive this {isAccord ? 'accord base' : 'raw material note'}, or start a brand new formula project.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTargetFormulaModal(null)}
              aria-label="Close"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleConfirm} className="flex flex-col flex-1 overflow-hidden">
            {/* Scrollable Form Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain space-y-4">
              {/* Target Formula Picker */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  1. Choose Destination Formula
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {formulas.map((f) => {
                    const isSelected = targetFormulaModal.selectedFormulaId === f.id;
                    const activeVer =
                      f.versions.find((v) => v.versionLabel === f.activeVersionLabel) ||
                      f.versions[0];
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setTargetFormulaModal((prev) =>
                            prev ? { ...prev, selectedFormulaId: f.id } : null
                          )
                        }
                        className={`w-full p-2.5 rounded-lg border text-left transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-950/30 border-emerald-500/60 text-white'
                            : 'bg-[#0B0E14] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{f.name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono-tabular">
                              {f.activeVersionLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {f.projectName} · {f.intendedProduct} · {activeVer?.items.length || 0} notes
                          </div>
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-emerald-400 bg-emerald-500 text-black'
                              : 'border-slate-700'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                        </span>
                      </button>
                    );
                  })}

                  {/* Create New Formula Option */}
                  <button
                    type="button"
                    onClick={() =>
                      setTargetFormulaModal((prev) =>
                        prev ? { ...prev, selectedFormulaId: 'new' } : null
                      )
                    }
                    className={`w-full p-2.5 rounded-lg border text-left transition-colors flex items-center justify-between ${
                      targetFormulaModal.selectedFormulaId === 'new'
                        ? 'bg-emerald-950/30 border-emerald-500/60 text-white'
                        : 'bg-[#0B0E14] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <span>+ Create Brand New Formula</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Start a fresh study centered around {itemName}
                      </div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        targetFormulaModal.selectedFormulaId === 'new'
                          ? 'border-emerald-400 bg-emerald-500'
                          : 'border-slate-700'
                      }`}
                    >
                      {targetFormulaModal.selectedFormulaId === 'new' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-black" />
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* New Formula Name input (only when 'new' is chosen) */}
              {targetFormulaModal.selectedFormulaId === 'new' && (
                <div className="p-3 rounded-lg bg-[#0B0E14] border border-emerald-900/50 space-y-2">
                  <label className="block text-slate-300 font-medium">New Formula Title</label>
                  <input
                    type="text"
                    required
                    value={targetFormulaModal.newFormulaName}
                    onChange={(e) =>
                      setTargetFormulaModal((prev) =>
                        prev ? { ...prev, newFormulaName: e.target.value } : null
                      )
                    }
                    placeholder="e.g. Amber Rose Study V1"
                    className="w-full bg-[#111621] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Dosage and Dilution Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1">Dosage (Grams)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.01}
                      step={0.1}
                      required
                      value={targetFormulaModal.dosageGrams}
                      onChange={(e) =>
                        setTargetFormulaModal((prev) =>
                          prev ? { ...prev, dosageGrams: Number(e.target.value) } : null
                        )
                      }
                      className="w-full bg-[#0B0E14] border border-slate-800 rounded px-3 py-1.5 font-mono-tabular text-white"
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    {[2, 5, 10, 15, 20].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() =>
                          setTargetFormulaModal((prev) =>
                            prev ? { ...prev, dosageGrams: g } : null
                          )
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular border ${
                          targetFormulaModal.dosageGrams === g
                            ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500'
                            : 'bg-[#0B0E14] text-slate-400 border-slate-800'
                        }`}
                      >
                        {g}g
                      </button>
                    ))}
                  </div>
                </div>

                {!isAccord && (
                  <div>
                    <label className="block text-slate-400 mb-1">Dilution Conc. (%)</label>
                    <input
                      type="number"
                      min={0.1}
                      max={100}
                      step={0.5}
                      value={targetFormulaModal.dilutionPercent}
                      onChange={(e) =>
                        setTargetFormulaModal((prev) =>
                          prev ? { ...prev, dilutionPercent: Number(e.target.value) } : null
                        )
                      }
                      className="w-full bg-[#0B0E14] border border-slate-800 rounded px-3 py-1.5 font-mono-tabular text-white"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      100% = Neat concentrate
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 shrink-0 sticky bottom-0 bg-[#111621] z-10">
              <button
                type="button"
                onClick={() => setTargetFormulaModal(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>Add to Formula ({targetFormulaModal.dosageGrams}g) →</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderMaterialProfileModal = () => {
    if (!profileDetailMaterial) return null;
    const mat = profileDetailMaterial;
    const isOnShelf = isMaterialOnShelf(mat);
    const isOnWorkbench = isMaterialOnWorkbench(mat);
    const regLimit = regulatoryLimits.find((r) => r.materialId === mat.id);
    const badgeConfig = getVolatilityBadgeConfig(mat.volatility);
    const facetDotColor = getFacetColor(mat.primaryFamily);
    const impactScore = mat.impactRating || mat.intensity || 6;
    const noteDraft =
      personalNotesDraft[mat.id] !== undefined
        ? personalNotesDraft[mat.id]
        : mat.personalNotes || '';

    return (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
        onClick={() => setProfileDetailMaterial(null)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-profile-title"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-2xl bg-[#111621] border border-slate-700/80 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden text-xs my-auto"
        >
          {/* Header synced with active theme */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-800 shrink-0 sticky top-0 bg-[#111621] z-20">
            <button
              type="button"
              onClick={() => setProfileDetailMaterial(null)}
              className="flex items-center gap-1.5 text-slate-200 hover:text-white transition-colors text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Material profile</span>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleToggleShelf(mat.id)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  isOnShelf
                    ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 hover:bg-rose-950/40 hover:border-rose-500/40 hover:text-rose-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {isOnShelf ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>On My Shelf</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add to My Shelf</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleToggleWorkbench(mat.id)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  isOnWorkbench
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-rose-950/40 hover:border-rose-500/40 hover:text-rose-300'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow-sm'
                }`}
              >
                {isOnWorkbench ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>On My Workbench</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Pin to Workbench</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setProfileDetailMaterial(null)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Content Body matching user screenshot */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain space-y-6">
            {/* Title & CAS row */}
            <div>
              <h2 id="material-profile-title" className="text-2xl font-bold text-white tracking-tight">
                {mat.name}
              </h2>
              <div className="text-xs text-slate-400 font-mono-tabular mt-1 flex items-center gap-2">
                <span>{mat.casNumber}</span>
                <span>·</span>
                <span className="capitalize">{mat.naturalOrSynthetic.toLowerCase()}</span>
              </div>
            </div>

            {/* Volatility Tier Badge with Pyramid Icon & Modal Sub-Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-mono-tabular text-xs font-semibold uppercase tracking-wider border ${badgeConfig.bgClass}`}
              >
                <PyramidStepIcon volatility={mat.volatility} size="sm" />
                <span>▲ {badgeConfig.label}</span>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B0E14] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalProfileTab('overview')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    modalProfileTab === 'overview'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Overview & Notes
                </button>
                <button
                  type="button"
                  onClick={() => setModalProfileTab('regulatory')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    modalProfileTab === 'regulatory'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Regulatory & IFRA
                </button>
              </div>
            </div>

            {modalProfileTab === 'overview' ? (
              <>
                {/* Also Called */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Also called
                  </span>
                  <p className="text-sm text-slate-200">
                    {normalizeMaterialSynonyms(mat.alsoCalled, mat.aliases).join(', ') ||
                      'No common synonyms recorded.'}
                  </p>
                </div>

                {/* Scent Families with Colored Circular Dots */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Scent families
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-200 bg-[#0B0E14] border border-slate-800 rounded-full px-3 py-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: facetDotColor }}
                      />
                      <span className="font-medium">{mat.primaryFamily}</span>
                    </div>
                    {mat.facets
                      .filter((f) => f.toLowerCase() !== mat.primaryFamily.toLowerCase())
                      .map((facet) => (
                        <div
                          key={facet}
                          className="flex items-center gap-1.5 text-xs text-slate-300 bg-[#0B0E14] border border-slate-800/80 rounded-full px-3 py-1"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: getFacetColor(facet) }}
                          />
                          <span>{facet}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Character: Impact Dots + Substantivity */}
                <div className="space-y-2.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Character
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Impact</span>
                        <span className="font-mono-tabular font-semibold text-white">
                          {impactScore}/10
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-400">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <span
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i < impactScore ? 'bg-emerald-400' : 'bg-slate-700/60'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Substantivity</span>
                        <span className="font-mono-tabular font-semibold text-white">
                          ~{mat.substantivityHours}h on strip
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Tenacity on smelling blotter at room temperature.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Description
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed bg-[#0B0E14] border border-slate-800 rounded-xl p-4">
                    {mat.descriptiveNotes}
                  </p>
                </div>

                {/* My Notes (Editable Personal Organ Note) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      My notes
                    </span>
                    <span className="text-[10px] text-slate-500">Personal organ observations</span>
                  </div>
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={noteDraft}
                      onChange={(e) =>
                        setPersonalNotesDraft((prev) => ({ ...prev, [mat.id]: e.target.value }))
                      }
                      placeholder="Record your sensory evaluation, dilution preferences, shelf location, or pairing ideas..."
                      className="w-full bg-[#0B0E14] border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (onUpdateMaterialNotes) {
                          onUpdateMaterialNotes(mat.id, noteDraft);
                        }
                        setProfileDetailMaterial((prev) =>
                          prev ? { ...prev, personalNotes: noteDraft } : null
                        );
                        setToastMsg(`Saved personal note for ${mat.name}`);
                        setTimeout(() => setToastMsg(null), 2500);
                      }}
                      className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Regulatory Brief Check (IFRA 51st & EU Cosmetics Regulation)
                </span>
                <DualRegulatorySlider
                  materialName={mat.name}
                  currentPercent={null}
                  ifraLimitPercent={regLimit?.maxAllowedPercent ?? null}
                  euLimitPercent={regLimit?.euCosmeticLimitPercent ?? mat.euCosmeticLimitPercent ?? null}
                  ifraCategory="Cat 4 (Fine Fragrance)"
                  euRegulationReference="EU Cosmetics Reg. (EC 1223/2009 Annex III)"
                  isEuAllergen={Boolean(regLimit?.euAllergenDeclarable || mat.euAllergenDeclarable)}
                  leaveOnThresholdPct={regLimit?.euLabelThresholdLeaveOnPct ?? 0.001}
                  rinseOffThresholdPct={regLimit?.euLabelThresholdRinseOffPct ?? 0.01}
                  verificationStatus={
                    regLimit?.verificationStatus ||
                    (regLimit?.maxAllowedPercent === null || regLimit?.maxAllowedPercent === undefined
                      ? 'LOOKUP_REQUIRED'
                      : regLimit?.isDemoData
                      ? 'DEMO'
                      : 'PARTIALLY_VERIFIED')
                  }
                  sourceDocument={regLimit?.sourceDocument}
                  sourceUrl={regLimit?.regulatorySources}
                />
              </div>
            )}
          </div>

          {/* Sticky Modal Footer */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-t border-slate-800 shrink-0 sticky bottom-0 bg-[#111621] z-20">
            <button
              type="button"
              onClick={() => setProfileDetailMaterial(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                setProfileDetailMaterial(null);
                openTargetFormulaModalForMaterial(mat, 2);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Formula</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // New Material form state
  const [matName, setMatName] = useState('');
  const [matCas, setMatCas] = useState('');
  const [matOrigin, setMatOrigin] = useState<'Natural' | 'Synthetic' | 'Base'>('Synthetic');
  const [matFamily, setMatFamily] = useState('Green');
  const [matVolatility, setMatVolatility] = useState<VolatilityTier>('Heart');
  const [matSupplier, setMatSupplier] = useState('Firmenich');
  const [matNotes, setMatNotes] = useState('');
  const [matIfraMax, setMatIfraMax] = useState('');
  const [matIfraSource, setMatIfraSource] = useState('');

  // Dedicated Accord Builder state (starts empty so users have 100% control over composition)
  const [accName, setAccName] = useState('');
  const [accCategory, setAccCategory] = useState('Floral');
  const [accDescription, setAccDescription] = useState('');
  const [accObjective, setAccObjective] = useState('');
  const [accDraftItems, setAccDraftItems] = useState<
    Array<{ materialId: number; materialName: string; percentage: number; dilutionPercent: number }>
  >([]);

  // Search-and-select dropdown state for Dedicated Accord Builder
  const [builderSearchQuery, setBuilderSearchQuery] = useState('');
  const [builderTierFilter, setBuilderTierFilter] = useState<'All' | 'Top' | 'Heart' | 'Base'>('All');
  const [isBuilderDropdownOpen, setIsBuilderDropdownOpen] = useState(false);

  // Accord Version History & Compact View state
  const [accordsViewMode, setAccordsViewModeState] = useState<'cards' | 'compact'>(() => {
    try {
      const saved = sessionStorage.getItem('osmolab_accords_view_mode');
      if (saved === 'cards' || saved === 'compact') return saved;
    } catch {
      // ignore
    }
    return 'cards';
  });

  const setAccordsViewMode = (nextMode: 'cards' | 'compact') => {
    setAccordsViewModeState(nextMode);
    try {
      sessionStorage.setItem('osmolab_accords_view_mode', nextMode);
    } catch {
      // ignore
    }
  };
  const [selectedHistoryAccordId, setSelectedHistoryAccordId] = useState<number>(
    accords[0]?.id || 1
  );
  const [editingAccordId, setEditingAccordId] = useState<number | null>(null);
  const [accordVersionNoteDraft, setAccordVersionNoteDraft] = useState('');

  // Per-card custom search-and-select note picker & insert dosage state
  const [cardOpenDropdownId, setCardOpenDropdownId] = useState<number | null>(null);
  const [cardSearchQuery, setCardSearchQuery] = useState<Record<number, string>>({});
  const [cardInsertDosage, setCardInsertDosage] = useState<Record<number, number>>({});

  const selectedMaterial =
    materials.find((m) => m.id === selectedMaterialId) || materials[0];

  const selectedLimit = regulatoryLimits.find(
    (r) => r.materialId === selectedMaterial?.id
  );

  const selectedMemory = scentMemories.find(
    (mem) => mem.materialId === selectedMaterial?.id
  );

  // Compute all formulas where this material is used
  const materialUsageList = formulas.flatMap((f) =>
    f.versions.flatMap((v) => {
      const found = v.items.find(
        (i) =>
          i.materialId === selectedMaterial?.id ||
          i.name.toLowerCase() === selectedMaterial?.name.toLowerCase()
      );
      if (!found) return [];
      const review = usageReviews.find(
        (r) =>
          r.materialId === selectedMaterial?.id &&
          r.versionLabel === v.versionLabel
      );
      return [
        {
          formulaId: f.id,
          formulaName: f.name,
          versionLabel: v.versionLabel,
          percentage: found.percentage,
          effectiveness: review?.effectivenessScore ?? 8,
          observation:
            review?.observation ||
            v.versionNotes ||
            'Integrated cleanly into structural backbone.',
        },
      ];
    })
  );

  const handleCreateMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName.trim()) return;
    await onCreateMaterial({
      name: matName.trim(),
      aliases: '',
      casNumber: matCas.trim() || 'Unknown / Not Provided',
      inciName: matName.trim(),
      naturalOrSynthetic: matOrigin,
      supplier: matSupplier.trim(),
      supplierProductCode: '',
      manufacturer: matSupplier.trim(),
      primaryFamily: matFamily,
      facets: [matFamily, 'Transparent'],
      intensity: 7,
      substantivityHours: 24,
      diffusion: 7,
      volatility: matVolatility,
      descriptiveNotes: matNotes.trim() || 'Added to personal perfumery organ.',
      texture: 'Smooth',
      temperatureImpression: 'Neutral',
      personalNotes: '',
      purity: '98% min',
      density: 0.95,
      recommendedDilution: 100,
      storageInfo: 'Cool, dark cabinet (15–20°C)',
      shelfLifeMonths: 24,
      flashPointCelsius: 95,
      educationalObserve: ['Evaluate on blotter at 0m, 30m, 4h, and 24h'],
      complements: ['Bergamot FCF', 'Hedione', 'Iso E Super'],
      contrasts: ['Ambroxan'],
      maxAllowedPercent: matIfraMax.trim() ? parseFloat(matIfraMax) : null,
      ifraSource: matIfraSource.trim() || 'Unknown / Not Provided',
    });
    setShowAddMaterialModal(false);
    setMatName('');
    setMatCas('');
    setMatNotes('');
    setToastMsg(`Added ${matName} to Raw Material Encyclopedia`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const normalizeAccordItemsTo100 = <T extends { percentage: number }>(items: T[]): T[] => {
    if (items.length === 0) return [];
    if (items.length === 1) {
      return [{ ...items[0], percentage: 100 }];
    }
    const sanitized = items.map((it) => Math.max(0, Number(it.percentage) || 0));
    const total = sanitized.reduce((sum, val) => sum + val, 0);
    const rawNormalized = sanitized.map((val) =>
      total > 0 ? (val / total) * 100 : 100 / items.length
    );
    const rounded = rawNormalized.map((val) => Math.round(val * 10) / 10);
    const sumExceptLast = rounded
      .slice(0, rounded.length - 1)
      .reduce((sum, val) => sum + val, 0);
    const exactLast = Math.max(0, Number((100 - sumExceptLast).toFixed(1)));
    return items.map((it, idx) => ({
      ...it,
      percentage: idx === items.length - 1 ? exactLast : rounded[idx],
    }));
  };

  const handleCreateAccordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      setToastMsg('Please enter a name for your accord.');
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }
    if (accDraftItems.length === 0) {
      setToastMsg('Please add at least one ingredient from the search-and-select dropdown.');
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }
    const normalizedItems = normalizeAccordItemsTo100(accDraftItems);

    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    await onCreateAccord({
      name: accName.trim(),
      category: accCategory,
      description: accDescription.trim() || `Custom ${accCategory} structural accord.`,
      objective: accObjective.trim() || 'Reusable sub-formula block for fragrance composition.',
      usageSuggestions: 'Use at 5–20% in concentrate',
      notes: 'Created in Accord Studio',
      isEducational: false,
      items: normalizedItems,
      olfactoryProfile: { [accCategory]: 8 },
      activeVersionLabel: 'V1',
      versions: [
        {
          versionId: `acc-${Date.now()}-v1`,
          versionLabel: 'V1',
          createdAt: nowStamp,
          versionNotes:
            accObjective.trim() ||
            accDescription.trim() ||
            'Initial accord composition saved from Builder.',
          items: normalizedItems.map((it) => ({ ...it })),
        },
      ],
    });
    setShowAddAccordModal(false);
    const savedName = accName.trim();
    setAccName('');
    setAccDescription('');
    setAccObjective('');
    setAccDraftItems([]);
    setEditingAccordId(null);
    setBuilderSearchQuery('');
    setIsBuilderDropdownOpen(false);
    setToastMsg(`Saved accord "${savedName}" (V1) with ${normalizedItems.length} ingredients`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 1. ACCORDS & BASES MODE
  if (mode === 'accords') {
    const getAccordVersions = (acc: AccordDefinition): AccordVersionSnapshot[] => {
      if (acc.versions && acc.versions.length > 0) {
        return acc.versions;
      }
      return [
        {
          versionId: `acc-${acc.id}-v1`,
          versionLabel: acc.activeVersionLabel || 'V1',
          createdAt: '2026-10-20 10:00',
          versionNotes: acc.objective || 'Initial baseline composition',
          items: acc.items.map((it) => ({ ...it })),
        },
      ];
    };

    const activeHistoryAccord =
      accords.find((a) => a.id === selectedHistoryAccordId) || accords[0] || null;
    const activeHistoryVersions = activeHistoryAccord
      ? getAccordVersions(activeHistoryAccord)
      : [];

    const handleAddBuilderMaterial = (matObj: RawMaterial) => {
      const alreadyExists = accDraftItems.some((it) => it.materialId === matObj.id);
      if (alreadyExists) {
        setToastMsg(`${matObj.name} is already in your accord ingredient list`);
        setTimeout(() => setToastMsg(null), 2500);
        return;
      }
      const nextCount = accDraftItems.length + 1;
      const defaultShare = nextCount === 1 ? 100 : 25;
      setAccDraftItems((prev) => [
        ...prev,
        {
          materialId: matObj.id,
          materialName: matObj.name,
          percentage: defaultShare,
          dilutionPercent: matObj.recommendedDilution || 100,
        },
      ]);
      setBuilderSearchQuery('');
      setToastMsg(`Added ${matObj.name} to accord builder`);
      setTimeout(() => setToastMsg(null), 2200);
    };

    const getActiveFormulasUsingAccord = (acc: AccordDefinition): Formula[] => {
      return formulas.filter((f) => {
        if (f.status === 'Archived') return false;
        const activeVer =
          f.versions.find((v) => v.versionLabel === f.activeVersionLabel) ||
          f.versions[f.versions.length - 1];
        if (!activeVer) return false;
        return activeVer.items.some(
          (item) =>
            item.accordId === acc.id ||
            item.parentAccordId === acc.id ||
            (item.type === 'accord' &&
              item.name.trim().toLowerCase() === acc.name.trim().toLowerCase())
        );
      });
    };

    const handleNormalizeBuilderDraft = () => {
      if (accDraftItems.length === 0) return;
      setAccDraftItems((prev) => normalizeAccordItemsTo100(prev));
      setToastMsg('Normalized builder ingredient ratios to 100.0%');
      setTimeout(() => setToastMsg(null), 2200);
    };

    const handleLoadAccordIntoBuilder = (acc: AccordDefinition) => {
      setSelectedHistoryAccordId(acc.id);
      setEditingAccordId(acc.id);
      setAccName(acc.name);
      setAccCategory(acc.category || 'Floral');
      setAccDescription(acc.description || '');
      setAccObjective(acc.objective || '');
      setAccDraftItems(
        acc.items.map((it) => ({
          materialId: it.materialId,
          materialName: it.materialName,
          percentage: Number(it.percentage) || 10,
          dilutionPercent: Number(it.dilutionPercent) || 100,
        }))
      );
      setToastMsg(
        `Loaded "${acc.name}" (${acc.activeVersionLabel || 'V1'}) into Builder & Version History`
      );
      setTimeout(() => setToastMsg(null), 2800);
    };

    const handleCommitAccordVersion = (
      targetAcc: AccordDefinition,
      sourceItems: AccordItem[],
      customNote?: string
    ) => {
      if (!onUpdateAccord || sourceItems.length === 0) return;
      const normalizedItems = normalizeAccordItemsTo100(sourceItems);
      const existingVersions = getAccordVersions(targetAcc);
      const nextVersionNum = existingVersions.length + 1;
      const nextLabel = `V${nextVersionNum}`;
      const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const noteText =
        (customNote ?? accordVersionNoteDraft).trim() ||
        `Iteration ${nextLabel} (${normalizedItems.length} notes balanced to 100%)`;

      const newSnapshot: AccordVersionSnapshot = {
        versionId: `acc-${targetAcc.id}-v${nextVersionNum}-${Date.now()}`,
        versionLabel: nextLabel,
        createdAt: nowStamp,
        versionNotes: noteText,
        items: normalizedItems.map((it) => ({ ...it })),
      };

      onUpdateAccord({
        ...targetAcc,
        name: editingAccordId === targetAcc.id && accName.trim() ? accName.trim() : targetAcc.name,
        category:
          editingAccordId === targetAcc.id && accCategory ? accCategory : targetAcc.category,
        description:
          editingAccordId === targetAcc.id && accDescription.trim()
            ? accDescription.trim()
            : targetAcc.description,
        objective:
          editingAccordId === targetAcc.id && accObjective.trim()
            ? accObjective.trim()
            : targetAcc.objective,
        items: normalizedItems,
        activeVersionLabel: nextLabel,
        versions: [...existingVersions, newSnapshot],
      });

      if (editingAccordId === targetAcc.id) {
        setAccDraftItems(normalizedItems.map((it) => ({ ...it })));
      }
      setAccordVersionNoteDraft('');
      setToastMsg(`Saved version ${nextLabel} for "${targetAcc.name}"`);
      setTimeout(() => setToastMsg(null), 2800);
    };

    const handleRevertAccordToVersion = (
      targetAcc: AccordDefinition,
      snap: AccordVersionSnapshot
    ) => {
      if (!onUpdateAccord) return;
      const existingVersions = getAccordVersions(targetAcc);
      const revertedItems = snap.items.map((it) => ({ ...it }));
      onUpdateAccord({
        ...targetAcc,
        items: revertedItems,
        activeVersionLabel: snap.versionLabel,
        versions: existingVersions,
      });
      if (editingAccordId === targetAcc.id) {
        setAccDraftItems(revertedItems.map((it) => ({ ...it })));
      }
      setToastMsg(`Reverted "${targetAcc.name}" to ${snap.versionLabel}`);
      setTimeout(() => setToastMsg(null), 2800);
    };

    const handleLoadVersionIntoBuilderForm = (
      targetAcc: AccordDefinition,
      snap: AccordVersionSnapshot
    ) => {
      setSelectedHistoryAccordId(targetAcc.id);
      setEditingAccordId(targetAcc.id);
      setAccName(targetAcc.name);
      setAccCategory(targetAcc.category || 'Floral');
      setAccDescription(targetAcc.description || '');
      setAccObjective(targetAcc.objective || '');
      setAccDraftItems(
        snap.items.map((it) => ({
          materialId: it.materialId,
          materialName: it.materialName,
          percentage: Number(it.percentage) || 10,
          dilutionPercent: Number(it.dilutionPercent) || 100,
        }))
      );
      setToastMsg(
        `Loaded ${snap.versionLabel} of "${targetAcc.name}" into Builder form`
      );
      setTimeout(() => setToastMsg(null), 2500);
    };

    const handleUpdateCardItem = (
      acc: AccordDefinition,
      itemIdx: number,
      changes: Partial<{
        materialId: number;
        materialName: string;
        percentage: number;
        dilutionPercent: number;
      }>
    ) => {
      if (!onUpdateAccord) return;
      const nextItems = acc.items.map((it, idx) =>
        idx === itemIdx ? { ...it, ...changes } : it
      );
      onUpdateAccord({ ...acc, items: nextItems });
    };

    const handleRemoveCardItem = (acc: AccordDefinition, itemIdx: number) => {
      if (!onUpdateAccord) return;
      const nextItems = acc.items.filter((_, idx) => idx !== itemIdx);
      onUpdateAccord({ ...acc, items: nextItems });
      setToastMsg(`Removed ingredient from ${acc.name}`);
      setTimeout(() => setToastMsg(null), 2500);
    };

    const handleAddCardMaterialDirect = (acc: AccordDefinition, matObj: RawMaterial) => {
      if (!onUpdateAccord) return;
      const nextItems = [
        ...acc.items,
        {
          materialId: matObj.id,
          materialName: matObj.name,
          percentage: 15,
          dilutionPercent: matObj.recommendedDilution || 100,
        },
      ];
      onUpdateAccord({ ...acc, items: nextItems });
      setCardOpenDropdownId(null);
      setCardSearchQuery((prev) => ({ ...prev, [acc.id]: '' }));
      setToastMsg(`Added ${matObj.name} to ${acc.name}`);
      setTimeout(() => setToastMsg(null), 2500);
    };

    const handleNormalizeCard = (acc: AccordDefinition) => {
      if (!onUpdateAccord || acc.items.length === 0) return;
      const nextItems = normalizeAccordItemsTo100(acc.items);
      onUpdateAccord({ ...acc, items: nextItems });
      setToastMsg(`Normalized ${acc.name} ratios to 100.0%`);
      setTimeout(() => setToastMsg(null), 2500);
    };

    const builderFilteredMaterials = materials.filter((m) => {
      const q = builderSearchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.primaryFamily.toLowerCase().includes(q) ||
        m.volatility.toLowerCase().includes(q) ||
        m.descriptiveNotes.toLowerCase().includes(q);
      const matchTier =
        builderTierFilter === 'All' ||
        (builderTierFilter === 'Top' && m.volatility.includes('Top')) ||
        (builderTierFilter === 'Heart' && m.volatility.includes('Heart')) ||
        (builderTierFilter === 'Base' && m.volatility.includes('Base'));
      return matchQuery && matchTier;
    });

    const draftTotalPct = accDraftItems.reduce(
      (sum, it) => sum + (Number(it.percentage) || 0),
      0
    );

    const getVolatilityBadgeClass = (vol: string) => {
      if (vol.includes('Top')) {
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      }
      if (vol.includes('Heart')) {
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      }
      return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    };

    const editingTargetAccord = editingAccordId
      ? accords.find((a) => a.id === editingAccordId) || null
      : null;

    return (
      <div className="space-y-8">
        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-lg bg-emerald-950 border border-emerald-600 px-4 py-2.5 text-xs text-emerald-200 shadow-xl">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Studio Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/70 pb-4">
          <div>
            <h1 className="text-2xl font-sans font-semibold text-white">
              Accords & Fragrance Bases Studio
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-normal">
              Build reusable fragrance bases, track accord version history, and blend saved accords directly into active formulas.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
            <span className="px-3 py-1.5 rounded-lg bg-[#111621] border border-slate-800/80 font-mono-tabular">
              {accords.length} Saved Accords
            </span>
          </div>
        </div>

        {/* Main 2-Column Layout: Dedicated Accord Builder + Version History (Left) | Saved Accords Library (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Dedicated Form for Naming, Building, and Tracking Accord Versions */}
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleCreateAccordSubmit}
              noValidate
              data-testid="dedicated-accord-builder-form"
              className="rounded-xl bg-[#111621] border border-slate-800/80 p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800/70 pb-4">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-emerald-400 block">
                    {editingTargetAccord
                      ? `Editing Saved Accord · ${
                          editingTargetAccord.activeVersionLabel || 'V1'
                        }`
                      : 'Step-by-Step Builder'}
                  </span>
                  <h2 className="text-base font-normal text-white mt-0.5">
                    {editingTargetAccord
                      ? `Customize "${editingTargetAccord.name}"`
                      : 'Build a New Custom Accord'}
                  </h2>
                </div>
                {(accDraftItems.length > 0 || editingTargetAccord) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccName('');
                      setAccDescription('');
                      setAccObjective('');
                      setAccDraftItems([]);
                      setEditingAccordId(null);
                      setBuilderSearchQuery('');
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    New Blank Form
                  </button>
                )}
              </div>

              {/* 1. Naming & Family */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="accord-builder-name"
                    className="block text-xs text-slate-300 mb-1.5 font-normal"
                  >
                    1. Accord Name *
                  </label>
                  <input
                    id="accord-builder-name"
                    data-testid="accord-name-input"
                    type="text"
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="e.g., Velvet Ambergris Base, Crisp Fig Leaf..."
                    className="w-full bg-[#0B0E14] border border-slate-800 focus:border-emerald-500/70 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="accord-builder-family"
                    className="block text-xs text-slate-300 mb-1.5 font-normal"
                  >
                    Olfactory Family
                  </label>
                  <select
                    id="accord-builder-family"
                    data-testid="accord-family-select"
                    value={accCategory}
                    onChange={(e) => setAccCategory(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-slate-800 focus:border-emerald-500/70 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    {OLFACTORY_WHEEL_FAMILIES.map((f) => (
                      <option
                        key={f.id}
                        value={f.name}
                        className="bg-[#111622] text-slate-100"
                      >
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Scent Profile & Objective */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="accord-builder-desc"
                    className="block text-xs text-slate-400 mb-1 font-normal"
                  >
                    Scent Impression (Optional)
                  </label>
                  <input
                    id="accord-builder-desc"
                    type="text"
                    value={accDescription}
                    onChange={(e) => setAccDescription(e.target.value)}
                    placeholder="Luminous, velvety, green-lactonic..."
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="accord-builder-objective"
                    className="block text-xs text-slate-400 mb-1 font-normal"
                  >
                    Role in Formula (Optional)
                  </label>
                  <input
                    id="accord-builder-objective"
                    type="text"
                    value={accObjective}
                    onChange={(e) => setAccObjective(e.target.value)}
                    placeholder="Heart bridge or diffusive base..."
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 2. Search-and-Select Ingredient Dropdown */}
              <div className="pt-2 border-t border-slate-800/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="accord-ingredient-search"
                    className="text-xs text-slate-300 font-normal"
                  >
                    2. Add Ingredients (Search & Select Note)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {materials.length} notes available
                  </span>
                </div>

                {/* Volatility Tier Filter Chips for Dropdown */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['All', 'Top', 'Heart', 'Base'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => {
                        setBuilderTierFilter(tier);
                        setIsBuilderDropdownOpen(true);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-normal transition-colors border ${
                        builderTierFilter === tier
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-[#0B0E14] text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {tier === 'All' ? 'All Notes' : `${tier} Notes`}
                    </button>
                  ))}
                </div>

                {/* Custom Search-and-Select Dropdown Input & High-Contrast List */}
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="accord-ingredient-search"
                        data-testid="accord-ingredient-search-input"
                        type="text"
                        value={builderSearchQuery}
                        onFocus={() => setIsBuilderDropdownOpen(true)}
                        onChange={(e) => {
                          setBuilderSearchQuery(e.target.value);
                          setIsBuilderDropdownOpen(true);
                        }}
                        placeholder="Search by note name, family, or tier..."
                        className="w-full bg-[#0B0E14] border border-slate-700/90 focus:border-emerald-500 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      data-testid="accord-ingredient-dropdown-toggle"
                      onClick={() => setIsBuilderDropdownOpen((prev) => !prev)}
                      className="px-3 py-2 rounded-lg bg-[#0B0E14] hover:bg-slate-800 border border-slate-700/90 text-xs text-slate-200 whitespace-nowrap transition-colors"
                    >
                      {isBuilderDropdownOpen ? 'Hide List ▲' : 'Browse Notes ▼'}
                    </button>
                  </div>

                  {/* High-Contrast Custom Dropdown Menu (Readable in both Dark & Day themes) */}
                  {isBuilderDropdownOpen && (
                    <div
                      data-testid="accord-ingredient-dropdown-list"
                      className="mt-1.5 rounded-xl bg-[#0B0E14] border border-slate-700 shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-800/70 z-30"
                    >
                      {builderFilteredMaterials.length === 0 ? (
                        <div className="px-4 py-4 text-xs text-slate-400 text-center">
                          No matching notes found for "{builderSearchQuery}".
                        </div>
                      ) : (
                        builderFilteredMaterials.map((m) => {
                          const isAdded = accDraftItems.some((it) => it.materialId === m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              data-testid={`accord-select-option-${m.id}`}
                              onClick={() => handleAddBuilderMaterial(m)}
                              className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                                isAdded
                                  ? 'bg-emerald-950/25 text-emerald-300'
                                  : 'hover:bg-slate-800/80 text-slate-100'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-normal text-white truncate">
                                    {m.name}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] border ${getVolatilityBadgeClass(
                                      m.volatility
                                    )}`}
                                  >
                                    {m.volatility.replace(' Note', '')}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {m.primaryFamily} · {m.naturalOrSynthetic}
                                </p>
                              </div>
                              <span
                                className={`px-2.5 py-1 rounded-md text-[11px] shrink-0 border ${
                                  isAdded
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-[#111621] text-emerald-400 border-slate-700'
                                }`}
                              >
                                {isAdded ? 'Added ✓' : '+ Select'}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Selected Accord Ingredients List & Proportions */}
              <div className="pt-3 border-t border-slate-800/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-300">
                    <span>3. Accord Composition</span>
                    <span className="ml-2 text-slate-400 font-mono-tabular">
                      ({accDraftItems.length} notes · Total:{' '}
                      <span
                        className={
                          Math.abs(draftTotalPct - 100) <= 0.5 && accDraftItems.length > 0
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
                        {draftTotalPct.toFixed(1)}%
                      </span>
                      )
                    </span>
                  </div>
                  {accDraftItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleNormalizeBuilderDraft}
                      className="px-2.5 py-1 rounded bg-[#0B0E14] hover:bg-slate-800 text-emerald-400 border border-slate-800 text-[11px] font-normal transition-colors"
                    >
                      Normalize to 100%
                    </button>
                  )}
                </div>

                {accDraftItems.length === 0 ? (
                  <div
                    data-testid="accord-builder-empty-state"
                    className="rounded-xl bg-[#0B0E14] border border-dashed border-slate-800 p-5 text-center space-y-2"
                  >
                    <p className="text-xs text-slate-300 font-normal">
                      Your accord ingredient list is currently empty.
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Search or click <span className="text-slate-200">Browse Notes ▼</span> above to choose the exact raw materials you want in this accord.
                    </p>
                  </div>
                ) : (
                  <div
                    data-testid="accord-builder-ingredients-list"
                    className="space-y-2 max-h-72 overflow-y-auto pr-1"
                  >
                    {accDraftItems.map((draftItem, idx) => {
                      const matMeta = materials.find((m) => m.id === draftItem.materialId);
                      const relShare =
                        draftTotalPct > 0
                          ? Math.min(100, (Number(draftItem.percentage) / draftTotalPct) * 100)
                          : 0;
                      return (
                        <div
                          key={`${draftItem.materialId}-${idx}`}
                          data-testid={`accord-draft-row-${idx}`}
                          className="rounded-lg bg-[#0B0E14] border border-slate-800/90 px-3 py-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white font-normal truncate">
                                  {draftItem.materialName}
                                </span>
                                {matMeta && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] border ${getVolatilityBadgeClass(
                                      matMeta.volatility
                                    )}`}
                                  >
                                    {matMeta.volatility.replace(' Note', '')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Percentage Input */}
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="any"
                                aria-label={`${draftItem.materialName} percentage`}
                                value={draftItem.percentage}
                                onChange={(e) =>
                                  setAccDraftItems((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx
                                        ? {
                                            ...row,
                                            percentage: Math.max(
                                              0,
                                              Math.min(100, Number(e.target.value))
                                            ),
                                          }
                                        : row
                                    )
                                  )
                                }
                                className="w-16 bg-[#111621] border border-slate-700 rounded px-2 py-1 text-right font-mono-tabular text-emerald-400 text-xs"
                              />
                              <span className="text-slate-400 text-[11px]">%</span>
                            </div>

                            {/* Dilution Input */}
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-slate-400 text-[10px]">@</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="any"
                                aria-label={`${draftItem.materialName} dilution`}
                                value={draftItem.dilutionPercent}
                                onChange={(e) =>
                                  setAccDraftItems((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx
                                        ? {
                                            ...row,
                                            dilutionPercent: Math.min(
                                              100,
                                              Math.max(0.1, Number(e.target.value))
                                            ),
                                          }
                                        : row
                                    )
                                  )
                                }
                                className="w-14 bg-[#111621] border border-slate-700 rounded px-1.5 py-1 text-right font-mono-tabular text-slate-200 text-[11px]"
                              />
                              <span className="text-slate-400 text-[10px]">%</span>
                            </div>

                            {/* Remove Ingredient Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setAccDraftItems((prev) =>
                                  prev.filter((_, rIdx) => rIdx !== idx)
                                )
                              }
                              title="Remove ingredient"
                              className="px-1.5 py-0.5 text-slate-400 hover:text-rose-400 transition-colors text-sm"
                            >
                              ×
                            </button>
                          </div>

                          {/* Minimal flat proportion bar */}
                          <div className="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500/70 rounded-full transition-all"
                              style={{ width: `${relShare}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit / Save Iteration Actions */}
              <div className="pt-3 border-t border-slate-800/70 space-y-2">
                {editingTargetAccord && accDraftItems.length > 0 && (
                  <button
                    type="button"
                    data-testid="save-accord-iteration-btn"
                    onClick={() =>
                      handleCommitAccordVersion(
                        editingTargetAccord,
                        accDraftItems,
                        accordVersionNoteDraft
                      )
                    }
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-normal bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>
                      Save as New Version (V
                      {getAccordVersions(editingTargetAccord).length + 1}) of "
                      {editingTargetAccord.name}"
                    </span>
                  </button>
                )}

                <button
                  type="submit"
                  data-testid="save-new-accord-btn"
                  disabled={!accName.trim() || accDraftItems.length === 0}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-normal transition-colors flex items-center justify-center gap-2 ${
                    accName.trim() && accDraftItems.length > 0
                      ? editingTargetAccord
                        ? 'bg-[#0B0E14] hover:bg-slate-800 text-emerald-400 border border-slate-700 cursor-pointer'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                      : 'bg-slate-800/70 text-slate-400 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {editingTargetAccord ? 'Save as Separate New Accord' : 'Save Accord to Library'}
                    {accDraftItems.length > 0
                      ? ` (${accDraftItems.length} ${
                          accDraftItems.length === 1 ? 'Note' : 'Notes'
                        })`
                      : ''}
                  </span>
                </button>
              </div>

              {/* 4. ACCORD VERSION HISTORY SECTION (Inside Form) */}
              <div
                data-testid="accord-version-history-section"
                className="pt-5 border-t border-slate-800/80 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <h3 className="text-sm font-normal text-white">
                        4. Accord Version History
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Track iterations and revert any saved accord to an earlier version
                      </p>
                    </div>
                  </div>
                </div>

                {/* Saved Accord Selector for History */}
                <div>
                  <label
                    htmlFor="accord-history-selector"
                    className="block text-[11px] text-slate-400 mb-1 font-normal"
                  >
                    Inspect Saved Accord History
                  </label>
                  <select
                    id="accord-history-selector"
                    data-testid="accord-history-select"
                    value={activeHistoryAccord?.id || ''}
                    onChange={(e) => {
                      const nextId = Number(e.target.value);
                      setSelectedHistoryAccordId(nextId);
                    }}
                    className="w-full bg-[#0B0E14] border border-slate-800 focus:border-emerald-500/70 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {accords.map((a) => (
                      <option
                        key={a.id}
                        value={a.id}
                        className="bg-[#111622] text-slate-100"
                      >
                        {a.name} ({a.category} · Active: {a.activeVersionLabel || 'V1'})
                      </option>
                    ))}
                  </select>
                </div>

                {activeHistoryAccord && (
                  <>
                    {/* Quick Snapshot Commit Bar for Selected Accord */}
                    <div className="rounded-lg bg-[#0B0E14] border border-slate-800/90 p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300">
                          Record New Iteration (V{activeHistoryVersions.length + 1})
                        </span>
                        <span className="text-slate-400 font-mono-tabular">
                          Current: {activeHistoryAccord.activeVersionLabel || 'V1'}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          data-testid="accord-version-note-input"
                          value={accordVersionNoteDraft}
                          onChange={(e) => setAccordVersionNoteDraft(e.target.value)}
                          placeholder="Version note (e.g., Softened galbanum to 5%)..."
                          className="flex-1 bg-[#111621] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
                        />
                        <button
                          type="button"
                          data-testid="commit-accord-version-btn"
                          onClick={() =>
                            handleCommitAccordVersion(
                              activeHistoryAccord,
                              editingAccordId === activeHistoryAccord.id &&
                                accDraftItems.length > 0
                                ? accDraftItems
                                : activeHistoryAccord.items,
                              accordVersionNoteDraft
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-normal whitespace-nowrap transition-colors shrink-0"
                        >
                          + Save V{activeHistoryVersions.length + 1}
                        </button>
                      </div>
                    </div>

                    {/* Timeline of Versions */}
                    <div
                      data-testid="accord-version-timeline"
                      className="space-y-2.5 max-h-64 overflow-y-auto pr-1"
                    >
                      {activeHistoryVersions
                        .slice()
                        .reverse()
                        .map((snap) => {
                          const isCurrent =
                            (activeHistoryAccord.activeVersionLabel || 'V1') ===
                            snap.versionLabel;
                          return (
                            <div
                              key={snap.versionId}
                              data-testid={`accord-version-row-${snap.versionLabel}`}
                              className={`rounded-lg border p-3 space-y-2 transition-colors ${
                                isCurrent
                                  ? 'bg-emerald-950/15 border-emerald-500/40'
                                  : 'bg-[#0B0E14] border-slate-800/80'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-[11px] font-mono-tabular bg-[#111621] border border-slate-700 text-emerald-400">
                                    {snap.versionLabel}
                                  </span>
                                  {isCurrent && (
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      Active Version
                                    </span>
                                  )}
                                  <span className="text-[11px] text-slate-400 font-mono-tabular">
                                    {snap.createdAt}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    data-testid={`load-accord-version-${snap.versionLabel}`}
                                    onClick={() =>
                                      handleLoadVersionIntoBuilderForm(
                                        activeHistoryAccord,
                                        snap
                                      )
                                    }
                                    className="px-2 py-1 rounded bg-[#111621] hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] transition-colors"
                                  >
                                    Load in Form
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`revert-accord-version-${snap.versionLabel}`}
                                    onClick={() =>
                                      handleRevertAccordToVersion(activeHistoryAccord, snap)
                                    }
                                    className={`px-2.5 py-1 rounded text-[11px] transition-colors border ${
                                      isCurrent
                                        ? 'bg-[#111621] text-slate-400 border-slate-800 hover:text-white'
                                        : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                                    }`}
                                  >
                                    {isCurrent
                                      ? 'Restore Snapshot'
                                      : `Revert to ${snap.versionLabel}`}
                                  </button>
                                </div>
                              </div>

                              <p className="text-xs text-slate-300 font-normal leading-relaxed">
                                {snap.versionNotes}
                              </p>

                              {/* Snapshot Ingredient Breakdown Pills */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {snap.items.map((it, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded bg-[#111621] border border-slate-800 text-[11px] text-slate-300 font-mono-tabular"
                                  >
                                    {it.materialName}{' '}
                                    <span className="text-emerald-400">{it.percentage}%</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            </form>
          </div>

          {/* RIGHT COLUMN: Saved Accords & Classical Bases Library (Cards vs Compact View) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-normal text-slate-200">
                  Saved Accords & Classical Bases ({accords.length})
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Switch between Detailed Cards for inline ratio editing or Compact View for quick scanning
                </p>
              </div>

              {/* View Mode Switcher: Detailed Cards vs Compact View */}
              <div
                data-testid="accords-view-mode-switcher"
                className="flex items-center gap-1 p-1 rounded-lg bg-[#111621] border border-slate-800"
              >
                <button
                  type="button"
                  data-testid="accords-view-cards"
                  onClick={() => setAccordsViewMode('cards')}
                  className={`px-3 py-1.5 rounded-md text-xs font-normal transition-colors ${
                    accordsViewMode === 'cards'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Detailed Cards
                </button>
                <button
                  type="button"
                  data-testid="accords-view-compact"
                  onClick={() => setAccordsViewMode('compact')}
                  className={`px-3 py-1.5 rounded-md text-xs font-normal transition-colors ${
                    accordsViewMode === 'compact'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Compact View
                </button>
              </div>
            </div>

            {accordsViewMode === 'compact' ? (
              /* COMPACT VIEW FOR ACCORDS */
              <div
                data-testid="accords-compact-list"
                className="space-y-3"
              >
                {accords.map((acc) => {
                  const totalPct = acc.items.reduce(
                    (s, it) => s + (Number(it.percentage) || 0),
                    0
                  );
                  const isNormalized = Math.abs(totalPct - 100) <= 0.5;
                  const insertGrams = cardInsertDosage[acc.id] ?? 10;
                  const verCount = getAccordVersions(acc).length;
                  const usedByActiveFormulas = getActiveFormulasUsingAccord(acc);
                  const usageCount = usedByActiveFormulas.length;

                  return (
                    <div
                      key={acc.id}
                      data-testid={`accord-compact-row-${acc.id}`}
                      className="rounded-xl bg-[#111621] border border-slate-800/80 px-5 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:border-slate-700/80 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-normal text-white">
                            {acc.name}
                          </h3>
                          <span className="px-2 py-0.5 rounded bg-[#0B0E14] border border-slate-800 text-[11px] text-slate-300">
                            {acc.category}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono-tabular text-emerald-300">
                            {acc.activeVersionLabel || 'V1'} ({verCount} rev)
                          </span>
                          <span
                            data-testid={`accord-usage-badge-${acc.id}`}
                            title={
                              usageCount > 0
                                ? `Used in active formulas: ${usedByActiveFormulas
                                    .map((f) => f.name)
                                    .join(', ')}`
                                : 'Not currently used in any active formula'
                            }
                            className={`px-2 py-0.5 rounded text-[11px] font-mono-tabular border ${
                              usageCount > 0
                                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                                : 'bg-[#0B0E14] border-slate-800 text-slate-400'
                            }`}
                          >
                            Usage: {usageCount} active {usageCount === 1 ? 'formula' : 'formulas'}
                          </span>
                          <span
                            className={`text-[11px] font-mono-tabular ${
                              isNormalized ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            Total: {totalPct.toFixed(1)}%
                          </span>
                        </div>

                        {/* Compact Inline Ingredient Pills */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {acc.items.map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-md bg-[#0B0E14] border border-slate-800/90 text-xs text-slate-200 font-normal"
                            >
                              {item.materialName}{' '}
                              <span className="font-mono-tabular text-emerald-400">
                                {item.percentage}%
                              </span>
                              {item.dilutionPercent < 100 && (
                                <span className="text-[10px] text-slate-400 ml-1">
                                  @{item.dilutionPercent}%
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Compact Row Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => handleLoadAccordIntoBuilder(acc)}
                          className="px-3 py-1.5 rounded-lg bg-[#0B0E14] hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-normal transition-colors"
                        >
                          History & Edit
                        </button>
                        <div className="flex items-center gap-1">
                          {[5, 10, 15].map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() =>
                                setCardInsertDosage((prev) => ({
                                  ...prev,
                                  [acc.id]: g,
                                }))
                              }
                              className={`px-2 py-1 rounded text-[11px] font-mono-tabular border transition-colors ${
                                insertGrams === g
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-[#0B0E14] text-slate-400 border-slate-800 hover:text-slate-200'
                              }`}
                            >
                              {g}g
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => openTargetFormulaModalForAccord(acc, insertGrams)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-normal rounded-lg transition-colors whitespace-nowrap"
                        >
                          Insert into Formula
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* DETAILED CARDS VIEW FOR ACCORDS */
              <div className="grid grid-cols-1 gap-6">
                {accords.map((acc) => {
                  const totalPct = acc.items.reduce(
                    (s, it) => s + (Number(it.percentage) || 0),
                    0
                  );
                  const isNormalized = Math.abs(totalPct - 100) <= 0.5;
                  const insertGrams = cardInsertDosage[acc.id] ?? 10;
                  const isCardPickerOpen = cardOpenDropdownId === acc.id;
                  const cardQuery = (cardSearchQuery[acc.id] || '').trim().toLowerCase();
                  const cardFilteredMaterials = materials.filter(
                    (m) =>
                      !cardQuery ||
                      m.name.toLowerCase().includes(cardQuery) ||
                      m.primaryFamily.toLowerCase().includes(cardQuery) ||
                      m.volatility.toLowerCase().includes(cardQuery)
                  );
                  const verCount = getAccordVersions(acc).length;
                  const usedByActiveFormulas = getActiveFormulasUsingAccord(acc);
                  const usageCount = usedByActiveFormulas.length;

                  return (
                    <div
                      key={acc.id}
                      data-testid={`accord-card-${acc.id}`}
                      className="rounded-xl bg-[#111621] border border-slate-800/70 p-6 flex flex-col justify-between space-y-5"
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-[#0B0E14] border border-slate-800 text-slate-300">
                              {acc.category} · {acc.isEducational ? 'Classical Base' : 'Custom Accord'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-tabular">
                              {acc.activeVersionLabel || 'V1'} ({verCount} rev)
                            </span>
                            <span
                              data-testid={`accord-usage-badge-${acc.id}`}
                              title={
                                usageCount > 0
                                  ? `Used in active formulas: ${usedByActiveFormulas
                                      .map((f) => f.name)
                                      .join(', ')}`
                                  : 'Not currently used in any active formula'
                              }
                              className={`px-2.5 py-0.5 rounded-md font-mono-tabular border ${
                                usageCount > 0
                                  ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                                  : 'bg-[#0B0E14] border-slate-800 text-slate-400'
                              }`}
                            >
                              Usage: {usageCount} active {usageCount === 1 ? 'formula' : 'formulas'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono-tabular">
                              {acc.items.length} Notes · Total:{' '}
                              <span
                                className={
                                  isNormalized ? 'text-emerald-400' : 'text-amber-400'
                                }
                              >
                                {totalPct.toFixed(1)}%
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleLoadAccordIntoBuilder(acc)}
                              className="text-emerald-400 hover:text-emerald-300 transition-colors text-[11px]"
                            >
                              History & Load in Form
                            </button>
                            {onDeleteAccord && (
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteAccord(acc.id);
                                  setToastMsg(`Deleted accord "${acc.name}"`);
                                  setTimeout(() => setToastMsg(null), 2500);
                                }}
                                title="Delete Accord"
                                className="text-slate-400 hover:text-rose-400 transition-colors text-[11px]"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        <h3 className="text-lg font-normal text-white mt-2">{acc.name}</h3>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed font-normal">
                          {acc.description}
                        </p>
                        {acc.objective && (
                          <p className="text-[11px] text-slate-400 mt-1 font-normal">
                            <span className="text-slate-300">Objective:</span> {acc.objective}
                          </p>
                        )}

                        {/* Interactive Ingredient Ratio List */}
                        <div className="mt-5 pt-4 border-t border-slate-800/70 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-slate-300 font-normal">
                              Accord Ingredients & Proportions
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleCommitAccordVersion(
                                    acc,
                                    acc.items,
                                    `Snapshot saved from card (${acc.items.length} notes)`
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-[#0B0E14] hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-normal transition-colors"
                              >
                                + Save Version (V{verCount + 1})
                              </button>
                              <button
                                type="button"
                                onClick={() => handleNormalizeCard(acc)}
                                className="px-2.5 py-1 rounded bg-[#0B0E14] hover:bg-slate-800 text-emerald-400 border border-slate-800 text-[11px] font-normal transition-colors"
                              >
                                Normalize to 100%
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {acc.items.map((item, idx) => {
                              const matMeta = materials.find((m) => m.id === item.materialId);
                              return (
                                <div
                                  key={idx}
                                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-[#0B0E14] border border-slate-800/80 rounded-lg px-3 py-2 text-xs"
                                >
                                  {/* Readable Material Label & Tier Badge */}
                                  <div className="flex items-center gap-2 min-w-[140px] flex-1">
                                    <span className="text-slate-100 font-normal truncate">
                                      {item.materialName}
                                    </span>
                                    {matMeta && (
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] border shrink-0 ${getVolatilityBadgeClass(
                                          matMeta.volatility
                                        )}`}
                                      >
                                        {matMeta.volatility.replace(' Note', '')}
                                      </span>
                                    )}
                                  </div>

                                  {/* Editable Percentage Input */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step="any"
                                      aria-label={`${item.materialName} percentage`}
                                      value={item.percentage}
                                      onChange={(e) =>
                                        handleUpdateCardItem(acc, idx, {
                                          percentage: Math.max(
                                            0,
                                            Math.min(100, Number(e.target.value))
                                          ),
                                        })
                                      }
                                      className="w-16 bg-[#111621] border border-slate-800 rounded px-2 py-1 text-right font-mono-tabular text-emerald-400 text-xs"
                                    />
                                    <span className="text-slate-400 text-[11px]">%</span>
                                  </div>

                                  {/* Editable Dilution Input */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-slate-400 text-[10px]">@</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step="any"
                                      aria-label={`${item.materialName} dilution`}
                                      value={item.dilutionPercent}
                                      onChange={(e) =>
                                        handleUpdateCardItem(acc, idx, {
                                          dilutionPercent: Math.min(
                                            100,
                                            Math.max(0.1, Number(e.target.value))
                                          ),
                                        })
                                      }
                                      className="w-14 bg-[#111621] border border-slate-800 rounded px-1.5 py-1 text-right font-mono-tabular text-slate-300 text-[11px]"
                                    />
                                    <span className="text-slate-400 text-[10px]">% conc</span>
                                  </div>

                                  {/* Remove Line Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCardItem(acc, idx)}
                                    title="Remove ingredient from accord"
                                    className="px-1.5 py-0.5 text-slate-400 hover:text-rose-400 transition-colors"
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Custom High-Contrast Search-and-Select Note Adder Inside Card */}
                          <div className="pt-1 relative">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type="text"
                                  aria-label={`Search note to add to ${acc.name}`}
                                  value={cardSearchQuery[acc.id] || ''}
                                  onFocus={() => setCardOpenDropdownId(acc.id)}
                                  onChange={(e) => {
                                    setCardSearchQuery((prev) => ({
                                      ...prev,
                                      [acc.id]: e.target.value,
                                    }));
                                    setCardOpenDropdownId(acc.id);
                                  }}
                                  placeholder="+ Search & select a note to add to this accord..."
                                  className="w-full bg-[#0B0E14] border border-slate-800 focus:border-emerald-500/70 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setCardOpenDropdownId((prev) =>
                                    prev === acc.id ? null : acc.id
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-[#0B0E14] hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-normal whitespace-nowrap transition-colors"
                              >
                                {isCardPickerOpen ? 'Close ▲' : 'Select Note ▼'}
                              </button>
                            </div>

                            {isCardPickerOpen && (
                              <div className="mt-1.5 rounded-xl bg-[#0B0E14] border border-slate-700 shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-800/70 z-20">
                                {cardFilteredMaterials.map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleAddCardMaterialDirect(acc, m)}
                                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800/80 flex items-center justify-between gap-2 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-xs text-white font-normal truncate">
                                        {m.name}
                                      </span>
                                      <span className="text-[11px] text-slate-400 truncate">
                                        ({m.primaryFamily} · {m.volatility.replace(' Note', '')})
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-emerald-400 shrink-0">
                                      + Add
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Dosage Picker + Insert into Active Formula */}
                      <div className="pt-4 border-t border-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>Dose in Formula:</span>
                          <div className="flex items-center gap-1">
                            {[2, 5, 10, 15, 20].map((g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() =>
                                  setCardInsertDosage((prev) => ({
                                    ...prev,
                                    [acc.id]: g,
                                  }))
                                }
                                className={`px-2 py-1 rounded text-[11px] font-mono-tabular border transition-colors ${
                                  insertGrams === g
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-[#0B0E14] text-slate-400 border-slate-800 hover:text-slate-200'
                                }`}
                              >
                                {g}g
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openTargetFormulaModalForAccord(acc, insertGrams)}
                          className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-normal rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center justify-center"
                        >
                          Insert into Formula
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {renderTargetFormulaModal()}
      </div>
    );
  }

  // Helper for facet badge color
  const getFacetColor = (family: string): string => {
    const famLower = family.toLowerCase();
    if (famLower.includes('citrus')) return '#F59E0B'; // amber/yellow
    if (famLower.includes('floral')) return '#EC4899'; // pink
    if (famLower.includes('woody') || famLower.includes('wood')) return '#8B5CF6'; // purple
    if (famLower.includes('amber')) return '#EA580C'; // orange
    if (famLower.includes('green')) return '#10B981'; // emerald
    if (famLower.includes('aromatic') || famLower.includes('herbal')) return '#06B6D4'; // cyan
    if (famLower.includes('musk')) return '#64748B'; // slate
    if (famLower.includes('spic')) return '#DC2626'; // red
    if (famLower.includes('water') || famLower.includes('marine')) return '#0284C7'; // sky
    return '#10B981';
  };

  // 2. RAW MATERIALS PALETTE: MY WORKBENCH vs MY SHELF vs CATALOG LIBRARY
  const filteredMaterials = materials.filter((m) => {
    const isOnShelf = isMaterialOnShelf(m);
    const isOnWorkbench = isMaterialOnWorkbench(m);
    if (paletteViewTab === 'workbench' && !isOnWorkbench) {
      return false;
    }
    if (paletteViewTab === 'shelf' && !isOnShelf) {
      return false;
    }
    const matchFam =
      familyFilter === 'All' ||
      m.primaryFamily.toLowerCase() === familyFilter.toLowerCase();
    const matchOrig =
      originFilter === 'All' ||
      m.naturalOrSynthetic.toLowerCase() === originFilter.toLowerCase();
    const pyramidMeta = resolveEffectiveMaterialPyramidMetadata(m);
    const matchPyramid =
      pyramidFilter === 'All' || pyramidMeta.uiCode === pyramidFilter;
    const q = searchQuery.toLowerCase().trim();
    const synonyms = normalizeMaterialSynonyms(m.alsoCalled, m.aliases);
    const matchQ =
      !q ||
      m.name.toLowerCase().includes(q) ||
      synonyms.some((a) => a.toLowerCase().includes(q)) ||
      (m.aliases && m.aliases.toLowerCase().includes(q)) ||
      (m.inciName && m.inciName.toLowerCase().includes(q)) ||
      m.casNumber.toLowerCase().includes(q) ||
      m.primaryFamily.toLowerCase().includes(q) ||
      m.facets.some((f) => f.toLowerCase().includes(q));
    return matchFam && matchOrig && matchPyramid && matchQ;
  });

  const workbenchCount = materials.filter((m) => isMaterialOnWorkbench(m)).length;
  const shelfCount = materials.filter((m) => isMaterialOnShelf(m)).length;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-lg bg-emerald-950 border border-emerald-600 px-4 py-2.5 text-xs text-emerald-200 shadow-xl">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-sans font-semibold text-white">
            Perfumery Materials Organ &amp; Bench
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse the master ingredient catalog, manage your personal shelf &amp; workbench, and inspect volatility tiers and IFRA limits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
          {selectedMaterial && (
            <button
              type="button"
              onClick={() => openTargetFormulaModalForMaterial(selectedMaterial, 2)}
              className="px-3.5 py-2 bg-[#111621] hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Add to Formula</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAddMaterialModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Raw Material
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Searchable Raw Material Organ List */}
        <div className="lg:col-span-5 rounded-lg bg-[#111621] border border-slate-800 p-4 space-y-3.5 min-w-0 overflow-hidden">
          {/* Segmented Palette Switch: Catalog | My Shelf (+ Workbench filter chip) */}
          <ShelfFilterBar
            activeTab={paletteViewTab}
            workbenchOnlyInShelf={paletteViewTab === 'workbench'}
            catalogCount={materials.length}
            shelfCount={shelfCount}
            workbenchCount={workbenchCount}
            onSelectTab={(nextTab) => {
              setPaletteViewTab(nextTab);
            }}
            onToggleWorkbenchOnlyInShelf={(nextWorkbenchOnly) => {
              setPaletteViewTab(nextWorkbenchOnly ? 'workbench' : 'shelf');
            }}
          />

          {/* Search & Multi-Facet Filters */}
          <MaterialFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            familyFilter={familyFilter}
            onFamilyChange={setFamilyFilter}
            originFilter={originFilter}
            onOriginChange={setOriginFilter}
            pyramidFilter={pyramidFilter}
            onPyramidChange={setPyramidFilter}
          />

          {/* Compact Materials List */}
          <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredMaterials.length === 0 ? (
              <div className="p-8 text-center bg-[#0B0E14] border border-slate-800 rounded-lg text-slate-400 text-xs">
                {paletteViewTab === 'workbench' || paletteViewTab === 'shelf' ? (
                  <div className="space-y-2">
                    <p className="text-slate-300 font-medium">
                      {paletteViewTab === 'workbench'
                        ? 'My Workbench is currently empty.'
                        : 'My Shelf is currently empty.'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Switch to &quot;Catalog&quot; to browse the 815-material dictionary and add materials to your Shelf or Workbench.
                    </p>
                    <button
                      type="button"
                      onClick={() => setPaletteViewTab('catalog')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition-colors"
                    >
                      Browse Catalog →
                    </button>
                  </div>
                ) : (
                  <p>No materials matching &quot;{searchQuery}&quot;</p>
                )}
              </div>
            ) : (
              filteredMaterials.map((mat) => {
                const isSelected = mat.id === selectedMaterial?.id;
                const isOnShelf = isMaterialOnShelf(mat);
                const isOnWorkbench = isMaterialOnWorkbench(mat);
                const facetDotColor = getFacetColor(mat.primaryFamily);

                return (
                  <div
                    key={mat.id}
                    onClick={() => {
                      onSelectMaterial(mat.id);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setProfileDetailMaterial(mat);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onSelectMaterial(mat.id);
                        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                          setProfileDetailMaterial(mat);
                        }
                      }
                    }}
                    data-testid={`material-row-${mat.id}`}
                    className={`w-full text-left p-2.5 min-h-[44px] rounded-lg border transition-colors duration-150 cursor-pointer flex items-center justify-between gap-2 min-w-0 ${
                      isSelected
                        ? 'bg-slate-800/90 border-emerald-500/70 text-white shadow-sm ring-1 ring-emerald-500/30'
                        : 'bg-[#0B0E14] border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Left Glyph: Facet circular color dot */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: facetDotColor }}
                        title={`${mat.primaryFamily} family`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-white truncate">
                            {mat.name}
                          </span>
                          {isOnWorkbench ? (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 text-[10px] font-medium shrink-0">
                              My Workbench
                            </span>
                          ) : isOnShelf ? (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-600/50 text-cyan-300 text-[10px] font-medium shrink-0">
                              My Shelf
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-medium shrink-0">
                              Catalog Only
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate mt-0.5 font-mono-tabular">
                          <span>{mat.primaryFamily}</span>
                          <span>·</span>
                          <span>CAS {mat.casNumber}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Shelf + Workbench buttons + Pyramid step visual icon */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        data-testid={`toggle-shelf-${mat.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleShelf(mat.id);
                        }}
                        title={isOnShelf ? 'Remove from My Shelf' : 'Add to My Shelf'}
                        className={`px-1.5 py-1 rounded border text-[10px] transition-colors flex items-center gap-1 ${
                          isOnShelf
                            ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 hover:bg-rose-950/50 hover:border-rose-500/50 hover:text-rose-300'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-cyan-600 hover:text-white hover:border-cyan-500'
                        }`}
                      >
                        {isOnShelf ? 'Shelf ✓' : '+ Shelf'}
                      </button>

                      <button
                        type="button"
                        data-testid={`toggle-workbench-${mat.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleWorkbench(mat.id);
                        }}
                        title={isOnWorkbench ? 'Unpin from My Workbench' : 'Pin to My Workbench'}
                        className={`p-1.5 rounded-md border text-xs transition-colors flex items-center gap-1 ${
                          isOnWorkbench
                            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-rose-950/50 hover:border-rose-500/50 hover:text-rose-300'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-500'
                        }`}
                      >
                        {isOnWorkbench ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="hidden xl:inline text-[10px]">My Workbench</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden xl:inline text-[10px]">+ My Workbench</span>
                          </>
                        )}
                      </button>

                      {/* Visual Perfume Pyramid Step Icon */}
                      <div
                        title={`Application step in perfume pyramid: ${mat.volatility}`}
                        className="p-1 rounded bg-[#111621] border border-slate-800 shrink-0"
                      >
                        <PyramidStepIcon
                          volatility={mat.volatility}
                          material={mat}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Comprehensive Material Dossier */}
        {selectedMaterial && (
          <div className="lg:col-span-7 space-y-5 min-w-0">
            {/* 1. Identity & Olfactory Profile */}
            <div className="rounded-lg bg-[#111621] border border-slate-800 p-4 sm:p-6 min-w-0 overflow-hidden">
              <div className="flex flex-col 2xl:flex-row 2xl:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-400 font-mono-tabular flex items-center gap-2 flex-wrap">
                    <span>{selectedMaterial.primaryFamily} Family</span>
                    <span>·</span>
                    <span>{selectedMaterial.naturalOrSynthetic}</span>
                    <span>·</span>
                    <span>CAS {selectedMaterial.casNumber}</span>
                    {selectedMaterial.scope === 'USER' && (
                      <>
                        <span>·</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-600/50 text-amber-300 text-[10px]">
                          Custom User Material
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-sans font-semibold text-white break-words">
                      {selectedMaterial.name}
                    </h2>
                    <PyramidBadge material={selectedMaterial} size="sm" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1 break-words">
                    Aliases: {normalizeMaterialSynonyms(selectedMaterial.alsoCalled, selectedMaterial.aliases).join(', ') || 'None'} · INCI: {selectedMaterial.inciName}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full 2xl:w-auto">
                  <button
                    type="button"
                    data-testid="dossier-toggle-shelf"
                    onClick={() => handleToggleShelf(selectedMaterial.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      isMaterialOnShelf(selectedMaterial)
                        ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 hover:bg-rose-950/40 hover:border-rose-500/40 hover:text-rose-300'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-cyan-600 hover:text-white hover:border-cyan-500'
                    }`}
                  >
                    {isMaterialOnShelf(selectedMaterial) ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>On My Shelf</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>Add to My Shelf</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    data-testid="dossier-toggle-workbench"
                    onClick={() => handleToggleWorkbench(selectedMaterial.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      isMaterialOnWorkbench(selectedMaterial)
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-rose-950/40 hover:border-rose-500/40 hover:text-rose-300'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-500'
                    }`}
                  >
                    {isMaterialOnWorkbench(selectedMaterial) ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>On My Workbench</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>Add to My Workbench</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileDetailMaterial(selectedMaterial)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    <span>View Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openTargetFormulaModalForMaterial(selectedMaterial, 2)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-normal transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Add to Formula</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed mt-4">
                {selectedMaterial.descriptiveNotes}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
                <div className="min-w-0">
                  <span className="text-slate-400 block text-[11px]">Facets</span>
                  <span className="text-white font-medium break-words">
                    {selectedMaterial.facets.join(' · ')}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400 block text-[11px]">Intensity &amp; Diffusion</span>
                  <span className="text-white font-mono-tabular">
                    {selectedMaterial.intensity}/10 · Diff {selectedMaterial.diffusion}/10
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400 block text-[11px]">Texture &amp; Temp</span>
                  <span className="text-white break-words">
                    {selectedMaterial.texture} ({selectedMaterial.temperatureImpression})
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400 block text-[11px]">Density &amp; Flash Pt</span>
                  <span className="text-white font-mono-tabular">
                    {selectedMaterial.density} g/cm³ ·{' '}
                    {selectedMaterial.flashPointCelsius
                      ? `${selectedMaterial.flashPointCelsius}°C`
                      : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Dossier Sub-Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1.5 bg-[#0B0E14] border border-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setMaterialSubTab('profile')}
                className={`px-3 py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 min-w-0 ${
                  materialSubTab === 'profile'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Profile &amp; Study Notes</span>
              </button>
              <button
                type="button"
                onClick={() => setMaterialSubTab('regulatory')}
                className={`px-3 py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 min-w-0 ${
                  materialSubTab === 'regulatory'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Regulatory Compliance (IFRA 51)</span>
              </button>
              <button
                type="button"
                onClick={() => setMaterialSubTab('memory')}
                className={`px-3 py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 min-w-0 ${
                  materialSubTab === 'memory'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Sensory Memory Profile</span>
              </button>
            </div>

            {/* TAB 1: PROFILE & STUDY NOTES */}
            {materialSubTab === 'profile' && (
              <div className="space-y-5">
                {/* My Shelf Personal Organ Settings */}
                <div
                  data-testid="my-shelf-settings-card"
                  className="rounded-lg bg-[#111621] border border-slate-800 p-4 sm:p-5 space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-white">
                        My Shelf &amp; Personal Organ Metadata
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Record your supplier, commercial product name, working dilution %, and personal study notes for {selectedMaterial.name}.
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                        isMaterialOnShelf(selectedMaterial)
                          ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {isMaterialOnShelf(selectedMaterial) ? 'Saved on My Shelf' : 'Not on My Shelf'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Supplier Name
                      </label>
                      <input
                        type="text"
                        aria-label="Shelf Supplier Name"
                        value={
                          shelfMetaDraft[selectedMaterial.id]?.supplierName ??
                          selectedMaterial.supplier ??
                          ''
                        }
                        onChange={(e) =>
                          setShelfMetaDraft((prev) => ({
                            ...prev,
                            [selectedMaterial.id]: {
                              supplierName: e.target.value,
                              supplierProductName:
                                prev[selectedMaterial.id]?.supplierProductName ??
                                selectedMaterial.supplierProductName ??
                                '',
                              workingDilutionPct:
                                prev[selectedMaterial.id]?.workingDilutionPct ??
                                String(selectedMaterial.workingDilutionPct ?? selectedMaterial.recommendedDilution ?? 100),
                              pyramidOverrideCode:
                                prev[selectedMaterial.id]?.pyramidOverrideCode !== undefined
                                  ? prev[selectedMaterial.id]?.pyramidOverrideCode
                                  : selectedMaterial.pyramidOverrideCode,
                            },
                          }))
                        }
                        placeholder="e.g. Pell Wall, Fraterworks, IFF"
                        className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Supplier Product Name
                      </label>
                      <input
                        type="text"
                        aria-label="Shelf Supplier Product Name"
                        value={
                          shelfMetaDraft[selectedMaterial.id]?.supplierProductName ??
                          selectedMaterial.supplierProductName ??
                          ''
                        }
                        onChange={(e) =>
                          setShelfMetaDraft((prev) => ({
                            ...prev,
                            [selectedMaterial.id]: {
                              supplierName:
                                prev[selectedMaterial.id]?.supplierName ??
                                selectedMaterial.supplier ??
                                '',
                              supplierProductName: e.target.value,
                              workingDilutionPct:
                                prev[selectedMaterial.id]?.workingDilutionPct ??
                                String(selectedMaterial.workingDilutionPct ?? selectedMaterial.recommendedDilution ?? 100),
                              pyramidOverrideCode:
                                prev[selectedMaterial.id]?.pyramidOverrideCode !== undefined
                                  ? prev[selectedMaterial.id]?.pyramidOverrideCode
                                  : selectedMaterial.pyramidOverrideCode,
                            },
                          }))
                        }
                        placeholder="e.g. Bergamot Reggio FCF"
                        className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Working Dilution (%)
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.1"
                        aria-label="Shelf Working Dilution Percent"
                        value={
                          shelfMetaDraft[selectedMaterial.id]?.workingDilutionPct ??
                          String(selectedMaterial.workingDilutionPct ?? selectedMaterial.recommendedDilution ?? 100)
                        }
                        onChange={(e) =>
                          setShelfMetaDraft((prev) => ({
                            ...prev,
                            [selectedMaterial.id]: {
                              supplierName:
                                prev[selectedMaterial.id]?.supplierName ??
                                selectedMaterial.supplier ??
                                '',
                              supplierProductName:
                                prev[selectedMaterial.id]?.supplierProductName ??
                                selectedMaterial.supplierProductName ??
                                '',
                              workingDilutionPct: e.target.value,
                              pyramidOverrideCode:
                                prev[selectedMaterial.id]?.pyramidOverrideCode !== undefined
                                  ? prev[selectedMaterial.id]?.pyramidOverrideCode
                                  : selectedMaterial.pyramidOverrideCode,
                            },
                          }))
                        }
                        className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Pyramid Tier Override
                      </label>
                      <select
                        aria-label="Shelf Pyramid Tier Override"
                        value={
                          (shelfMetaDraft[selectedMaterial.id]?.pyramidOverrideCode !== undefined
                            ? shelfMetaDraft[selectedMaterial.id]?.pyramidOverrideCode
                            : selectedMaterial.pyramidOverrideCode) || ''
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          const code = raw ? (raw as RawMaterial['pyramidOverrideCode']) : null;
                          setShelfMetaDraft((prev) => ({
                            ...prev,
                            [selectedMaterial.id]: {
                              supplierName:
                                prev[selectedMaterial.id]?.supplierName ??
                                selectedMaterial.supplier ??
                                '',
                              supplierProductName:
                                prev[selectedMaterial.id]?.supplierProductName ??
                                selectedMaterial.supplierProductName ??
                                '',
                              workingDilutionPct:
                                prev[selectedMaterial.id]?.workingDilutionPct ??
                                String(selectedMaterial.workingDilutionPct ?? selectedMaterial.recommendedDilution ?? 100),
                              pyramidOverrideCode: code,
                            },
                          }));
                        }}
                        className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Catalog Default ({selectedMaterial.pyramidUiCode || selectedMaterial.volatility})</option>
                        <option value="T">T — Top Note</option>
                        <option value="TH">TH — Top-Heart Bridge</option>
                        <option value="H">H — Heart Note</option>
                        <option value="HB">HB — Heart-Base Bridge</option>
                        <option value="B">B — Base Note</option>
                        <option value="THB">THB — Full Span (Top-Heart-Base)</option>
                        <option value="NONE">NONE — Functional Carrier / Solvent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Personal Organ Notes
                    </label>
                    <textarea
                      rows={2}
                      aria-label="Shelf Personal Notes"
                      value={
                        personalNotesDraft[selectedMaterial.id] !== undefined
                          ? personalNotesDraft[selectedMaterial.id]
                          : selectedMaterial.personalNotes || ''
                      }
                      onChange={(e) =>
                        setPersonalNotesDraft((prev) => ({
                          ...prev,
                          [selectedMaterial.id]: e.target.value,
                        }))
                      }
                      placeholder="Your personal evaluation, blotter longevity, batch impressions..."
                      className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      data-testid="save-shelf-metadata-btn"
                      onClick={() => {
                        const draft = shelfMetaDraft[selectedMaterial.id];
                        const notes =
                          personalNotesDraft[selectedMaterial.id] !== undefined
                            ? personalNotesDraft[selectedMaterial.id]
                            : selectedMaterial.personalNotes || '';
                        const payload = {
                          supplierName: draft?.supplierName ?? selectedMaterial.supplier ?? '',
                          supplierProductName:
                            draft?.supplierProductName ?? selectedMaterial.supplierProductName ?? '',
                          workingDilutionPct: draft?.workingDilutionPct
                            ? Number(draft.workingDilutionPct)
                            : selectedMaterial.workingDilutionPct ?? selectedMaterial.recommendedDilution ?? 100,
                          personalNotes: notes,
                          pyramidOverrideCode:
                            draft?.pyramidOverrideCode !== undefined
                              ? draft.pyramidOverrideCode
                              : selectedMaterial.pyramidOverrideCode ?? null,
                        };
                        if (isMaterialOnShelf(selectedMaterial)) {
                          if (onUpdateShelfItem) {
                            void onUpdateShelfItem(selectedMaterial.id, payload);
                          }
                          triggerToast(`Updated My Shelf settings for "${selectedMaterial.name}"`);
                        } else {
                          if (onAddToShelf) {
                            void onAddToShelf(selectedMaterial.id, {
                              ...payload,
                              isOnWorkbench: false,
                            });
                          }
                          triggerToast(`Added "${selectedMaterial.name}" to My Shelf`);
                        }
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors"
                    >
                      {isMaterialOnShelf(selectedMaterial)
                        ? 'Save My Shelf Settings'
                        : 'Add & Save to My Shelf'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {educationalPromptsEnabled && (
                    <div className="rounded-lg bg-[#111621] border border-slate-800 p-5">
                      <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-2.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        Things to Observe (Perfumery School Study)
                      </h3>
                      <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
                        {selectedMaterial.educationalObserve.map((obs, i) => (
                          <li key={i} className="leading-relaxed">
                            {obs}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="rounded-lg bg-[#111621] border border-slate-800 p-5">
                    <h3 className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Potential Complements &amp; Structural Contrasts
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">
                          Harmonious Complements (Synergy &amp; Bridging):
                        </span>
                        <span className="text-emerald-300 font-medium">
                          {selectedMaterial.complements.join(' · ') || 'Hedione · Bergamot FCF'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-slate-400 block text-[11px]">
                          Creative Contrasts (Tension &amp; Counterpoint):
                        </span>
                        <span className="text-amber-300 font-medium">
                          {selectedMaterial.contrasts.join(' · ') || 'Vetiver Haiti EO'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Regulatory Summary Snippet */}
                <div className="rounded-lg bg-[#111621] border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">Authoritative IFRA Status: </span>
                    <span className="text-slate-300">
                      {selectedLimit?.amendmentStatus || 'IFRA 51st Amendment'} ·{' '}
                    </span>
                    {selectedLimit?.maxAllowedPercent !== null && selectedLimit?.maxAllowedPercent !== undefined ? (
                      <span className="text-emerald-400 font-mono-tabular font-medium">
                        Cat 4 Finished Product Limit: {selectedLimit.maxAllowedPercent}%
                      </span>
                    ) : (
                      <span
                        data-testid="lookup-required-badge"
                        className="px-2 py-0.5 rounded bg-slate-700/90 border border-slate-500 text-slate-100 text-[10px] font-mono-tabular font-semibold"
                      >
                        LOOKUP_REQUIRED
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500">· ScenTree CC BY-NC 4.0</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMaterialSubTab('regulatory')}
                    className="text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap shrink-0 flex items-center gap-1"
                  >
                    View Regulatory Brief Check →
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: DEDICATED REGULATORY COMPLIANCE SUB-VIEW */}
            {materialSubTab === 'regulatory' && (
              <div className="space-y-5">
                {/* 1. Substance Identification & IFRA 51 Amendment Header */}
                <div className="rounded-lg bg-[#111621] border border-slate-800 p-5 space-y-4 overflow-hidden">
                  <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-mono-tabular font-medium ${
                            selectedLimit?.maxAllowedPercent === null
                              ? 'text-slate-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {selectedLimit?.amendmentStatus || 'IFRA 51st Amendment (2023)'}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono-tabular font-medium ${
                            selectedLimit?.restrictionType === 'RESTRICTION'
                              ? 'bg-amber-950/60 border border-amber-700/60 text-amber-300'
                              : selectedLimit?.restrictionType === 'SPECIFICATION'
                              ? 'bg-blue-950/60 border border-blue-700/60 text-blue-300'
                              : selectedLimit?.restrictionType === 'PROHIBITION'
                              ? 'bg-rose-600 border border-rose-400 text-white font-bold'
                              : selectedLimit?.maxAllowedPercent === null
                              ? 'bg-slate-700/90 border border-slate-500 text-slate-100 font-semibold'
                              : 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-300'
                          }`}
                        >
                          {selectedLimit?.maxAllowedPercent === null
                            ? 'LOOKUP_REQUIRED'
                            : selectedLimit?.restrictionType || 'CONFORMS'}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mt-1 break-words">
                        Regulatory Compliance Dossier: {selectedMaterial.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 break-words">
                        CAS: {selectedMaterial.casNumber} · EC/EINECS: {selectedLimit?.ecNumber || 'Listed'} · INCI: {selectedMaterial.inciName} · Attribution: ScenTree CC BY-NC 4.0
                      </p>
                    </div>

                    <div className="text-left xl:text-right text-xs font-mono-tabular text-slate-300 shrink-0">
                      <div>IFRA Cat 4 (Finished Consumer Product %):</div>
                      <div className="text-lg font-bold text-emerald-400 mt-0.5">
                        {selectedLimit && selectedLimit.maxAllowedPercent !== null ? (
                          `${selectedLimit.maxAllowedPercent.toFixed(2)}%`
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-700/90 border border-slate-500 text-slate-100 text-xs font-semibold">
                            LOOKUP_REQUIRED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {selectedLimit?.effectiveDate ? `Effective: ${selectedLimit.effectiveDate}` : 'Source: Official Dossier'}
                      </div>
                    </div>
                  </div>

                  {/* Dual Regulatory Reference View: IFRA 51 + EU Cosmetics Regulation (EC 1223/2009) */}
                  <DualRegulatorySlider
                    materialName={selectedMaterial.name}
                    currentPercent={null}
                    ifraLimitPercent={selectedLimit?.maxAllowedPercent ?? null}
                    euLimitPercent={selectedLimit?.euCosmeticLimitPercent ?? selectedMaterial.euCosmeticLimitPercent ?? null}
                    ifraCategory="Cat 4 (Fine Fragrance)"
                    euRegulationReference="EU Cosmetics Reg. (EC 1223/2009 Annex III)"
                    isEuAllergen={Boolean(selectedLimit?.euAllergenDeclarable || selectedMaterial.euAllergenDeclarable)}
                    leaveOnThresholdPct={selectedLimit?.euLabelThresholdLeaveOnPct ?? 0.001}
                    rinseOffThresholdPct={selectedLimit?.euLabelThresholdRinseOffPct ?? 0.01}
                    verificationStatus={
                      selectedLimit?.verificationStatus ||
                      (selectedLimit?.maxAllowedPercent === null || selectedLimit?.maxAllowedPercent === undefined
                        ? 'LOOKUP_REQUIRED'
                        : selectedLimit?.isDemoData
                        ? 'DEMO'
                        : 'PARTIALLY_VERIFIED')
                    }
                    sourceDocument={selectedLimit?.sourceDocument}
                    sourceUrl={selectedLimit?.regulatorySources}
                    className="p-3.5 bg-[#0B0E14] border border-slate-800 rounded-lg"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded bg-[#0B0E14] border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">
                        Primary Toxicological Hazard / Rationale:
                      </span>
                      <p className="text-slate-200 leading-relaxed">
                        {selectedLimit?.primaryHazard || 'Skin Sensitization & Phototoxic Evaluation'}
                      </p>
                    </div>
                    <div className="p-3 rounded bg-[#0B0E14] border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">
                        Specific IFRA Restriction / Specification:
                      </span>
                      <p className="text-slate-200 leading-relaxed">
                        {selectedLimit?.restrictions || 'No quantitative restriction recorded in Category 4.'}
                      </p>
                    </div>
                  </div>

                  {(selectedLimit?.isDemoData || selectedLimit?.verificationStatus === 'DEMO') ? (
                    <div className="p-3 rounded bg-amber-950/30 border border-amber-800/60 flex items-start gap-2 text-xs text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Educational demonstration data — not verified for compliance.</strong> Always confirm commercial lots against official supplier Certificate of Analysis (CoA), SDS, and IFRA Conformity Certificate.
                      </span>
                    </div>
                  ) : selectedLimit?.verificationStatus === 'PARTIALLY_VERIFIED' ? (
                    <div className="p-3 rounded bg-sky-950/30 border border-sky-800/60 flex items-start gap-2 text-xs text-sky-200">
                      <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Partially verified:</strong> Sourced from {selectedLimit.sourceDocument}. Confirm all category-specific rules and commercial lot CoA before dermal compounding.
                      </span>
                    </div>
                  ) : selectedLimit?.verificationStatus === 'VERIFIED_OFFICIAL' ? (
                    <div className="p-3 rounded bg-emerald-950/30 border border-emerald-800/60 flex items-start gap-2 text-xs text-emerald-200">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Official source verified:</strong> {selectedLimit.sourceDocument}.
                      </span>
                    </div>
                  ) : selectedLimit?.verificationStatus === 'USER_ENTERED_UNVERIFIED' ? (
                    <div className="p-3 rounded bg-amber-950/30 border border-amber-800/60 flex items-start gap-2 text-xs text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>User-entered, unverified:</strong> Custom regulatory override not verified against an official IFRA or EU Cosmetics dossier.
                      </span>
                    </div>
                  ) : null}

                  {selectedLimit?.maxAllowedPercent === null && (
                    <div className="p-4 rounded bg-slate-900/90 border border-slate-600 flex items-start gap-3 text-xs text-slate-200">
                      <AlertOctagon className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-700 border border-slate-500 text-slate-100 font-mono-tabular text-[10px]">
                            LOOKUP_REQUIRED
                          </span>
                          <span>Safety information unavailable. Manual verification required.</span>
                        </div>
                        <p className="leading-relaxed text-slate-300">
                          No quantitative limits, allergen profile, or IFRA certificate of conformity have been recorded in the local database for {selectedMaterial.name}. Unlisted materials are never inferred as safe — verify official supplier SDS before dermal compounding.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* On-demand Canonical Regulatory Dossier (/api/catalog/:materialId/regulatory) */}
                <RegulatoryDossier
                  materialId={selectedMaterial.id}
                  materialName={selectedMaterial.name}
                />
              </div>
            )}

            {/* TAB 3: PERSONAL SENSORY MEMORY */}
            {materialSubTab === 'memory' && (
              <div className="rounded-lg bg-[#111621] border border-slate-800 p-5 space-y-4 text-xs">
                <h3 className="font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  My Personal Sensory Memory & Perception Profile
                </h3>
                {selectedMemory ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded bg-[#0B0E14] border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Personal Descriptors</span>
                        <span className="text-white font-medium mt-0.5 block">
                          {selectedMemory.myPerception.join(' · ')}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-[#0B0E14] border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Associated Memory</span>
                        <span className="text-slate-200 mt-0.5 block">
                          {selectedMemory.associatedMemories.join(' · ')}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-[#0B0E14] border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">Emotional Tone</span>
                        <span className="text-emerald-300 mt-0.5 block">
                          {selectedMemory.emotions.join(' · ')}
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-between gap-2 font-mono-tabular text-[11px]">
                      <span>Olfactory Intensity: {selectedMemory.strengthScore}/10</span>
                      <span>Familiarity: {selectedMemory.familiarityScore}/10</span>
                      <span>Blind Smell Confidence: {selectedMemory.blindConfidenceScore}/10</span>
                      <span>
                        Trials: {selectedMemory.recognitionCorrect} / {selectedMemory.recognitionTrials} (
                        {selectedMemory.recognitionTrials > 0
                          ? Math.round(
                              (selectedMemory.recognitionCorrect / selectedMemory.recognitionTrials) * 100
                            )
                          : 0}
                        %)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 py-4 text-center">
                    <p className="text-slate-400">
                      No personal sensory memory recorded yet for {selectedMaterial.name}.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onSaveScentMemory({
                          materialId: selectedMaterial.id,
                          myPerception: selectedMaterial.facets,
                          associatedMemories: ['Studio blotter study'],
                          emotions: ['Focused', 'Curious'],
                          mentalImages: selectedMaterial.descriptiveNotes,
                          places: 'Perfumery School Organ',
                          colors: '#10B981',
                          textures: selectedMaterial.texture,
                          temperature: selectedMaterial.temperatureImpression,
                          strengthScore: selectedMaterial.intensity,
                          familiarityScore: 7,
                          blindConfidenceScore: 6,
                          recognitionTrials: 1,
                          recognitionCorrect: 1,
                        })
                      }
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
                    >
                      Initialize Personal Sensory Profile
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Raw Material Modal */}
      {showAddMaterialModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
          onClick={() => setShowAddMaterialModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-raw-material-title"
        >
          <form
            onSubmit={handleCreateMaterialSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl bg-[#111621] border border-slate-700 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden text-xs my-auto"
          >
            {/* Sticky Header with Close Button */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0 sticky top-0 bg-[#111621] z-10">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block">
                  Encyclopedia Catalog
                </span>
                <h3 id="add-raw-material-title" className="text-base font-semibold text-white">
                  Add Raw Material to Encyclopedia
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMaterialModal(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Material Name *</label>
                  <input
                    type="text"
                    required
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    placeholder="e.g., Frankincense Carterii EO"
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">CAS Number</label>
                  <input
                    type="text"
                    value={matCas}
                    onChange={(e) => setMatCas(e.target.value)}
                    placeholder="e.g., 8016-36-2 or Unknown"
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-2 font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Natural / Synthetic</label>
                  <select
                    value={matOrigin}
                    onChange={(e) =>
                      setMatOrigin(e.target.value as 'Natural' | 'Synthetic' | 'Base')
                    }
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Natural">Natural</option>
                    <option value="Synthetic">Synthetic</option>
                    <option value="Base">Base</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Primary Family</label>
                  <select
                    value={matFamily}
                    onChange={(e) => setMatFamily(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {OLFACTORY_WHEEL_FAMILIES.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Volatility Tier</label>
                  <select
                    value={matVolatility}
                    onChange={(e) => setMatVolatility(e.target.value as VolatilityTier)}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Top">Top</option>
                    <option value="Top-Heart">Top-Heart</option>
                    <option value="Heart">Heart</option>
                    <option value="Heart-Base">Heart-Base</option>
                    <option value="Base">Base</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={matSupplier}
                    onChange={(e) => setMatSupplier(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    IFRA Cat 4 Max % (Leave blank if unknown)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={matIfraMax}
                    onChange={(e) => setMatIfraMax(e.target.value)}
                    placeholder="Unknown / Not Provided"
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-2 font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">IFRA Document Source</label>
                  <input
                    type="text"
                    value={matIfraSource}
                    onChange={(e) => setMatIfraSource(e.target.value)}
                    placeholder="e.g., Supplier SDS 2026"
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Sensory & Descriptive Notes</label>
                <textarea
                  rows={2}
                  value={matNotes}
                  onChange={(e) => setMatNotes(e.target.value)}
                  placeholder="Describe odor profile, texture, and evaporation behavior..."
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 shrink-0 sticky bottom-0 bg-[#111621] z-10">
              <button
                type="button"
                onClick={() => setShowAddMaterialModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md shadow transition-colors"
              >
                Save Raw Material
              </button>
            </div>
          </form>
        </div>
      )}
      {renderMaterialProfileModal()}
      {renderTargetFormulaModal()}
    </div>
  );
};

export const MaterialCatalogView = MaterialsAndInventoryView;
export type MaterialCatalogViewProps = MaterialsAndInventoryViewProps;

