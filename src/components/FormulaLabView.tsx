import React, { useState, useMemo, useEffect } from 'react';
import {
  AccordDefinition,
  Formula,
  FormulaLineItem,
  FormulaStatus,
  MaterialRegulatoryLimit,
  RawMaterial,
  SensoryEvaluation,
} from '../domain/types';
import {
  calculateFormulaMetrics,
  normalizeFormulaTo100,
  scaleFormulaToBatch,
  expandNestedAccords,
  compareFormulaVersions,
  validateFormula,
  roundDecimal,
  computeFormulaFacetRadarComparison,
  FormulaMassUnit,
  DEFAULT_PERFUME_DENSITY_G_PER_ML,
  PERFUME_DENSITY_PRESETS,
  convertGramsToUnit,
  convertFormulaTotalMassBreakdown,
  scaleFormulaByUnitTarget,
} from '../domain/formula-engine';
import { FormulaFacetRadarChart } from './FormulaFacetRadarChart';
import { DualRegulatorySlider } from './DualRegulatorySlider';
import { FormulaIngredientPicker } from '../features/formula/FormulaIngredientPicker';
import {
  evaluateFormulaSafety,
  autoCapMaterialToIfraLimit,
  IFRA_CATEGORY_OPTIONS,
  MaterialSafetyEvaluation,
  FormulaSafetyReport,
} from '../domain/safety-engine';
import {
  CurrencyCode,
  CurrencySettings,
  DEFAULT_CURRENCY_SETTINGS,
  SUPPORTED_CURRENCIES,
  buildTopMaterialsCostDistribution,
  calculateRealTimeBatchCost,
  formatCurrencyAmount,
  getExchangeRateForCurrency,
} from '../domain/currency-and-cost';
import {
  Plus,
  Trash2,
  GitBranch,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Download,
  Sparkles,
  Check,
  Layers,
  Star,
  ArrowLeftRight,
  FileSpreadsheet,
  Calculator,
  Coins,
  FileText,
  X,
} from 'lucide-react';
import { generateFormulaPDF } from '../domain/pdf-export';

interface FormulaLabViewProps {
  mode: 'lab' | 'library';
  formulas: Formula[];
  activeFormula: Formula | null;
  activeVersionLabel: string | null;
  materials: RawMaterial[];
  accords: AccordDefinition[];
  regulatoryLimits: MaterialRegulatoryLimit[];
  evaluations: SensoryEvaluation[];
  educationalPromptsEnabled: boolean;
  safetyEnabled: boolean;
  currencySettings?: CurrencySettings;
  onUpdateCurrencySettings?: (next: CurrencySettings) => void;
  onSyncLiveExchangeRates?: (irrProfile?: 'market' | 'nima' | 'official') => Promise<void>;
  isSyncingRates?: boolean;
  onOpenSettings?: () => void;
  onSelectFormula: (formulaId: number, versionLabel?: string) => void;
  onSaveFormulaVersion: (
    formula: Partial<Formula> & { id?: number; name: string },
    version: {
      versionLabel: string;
      parentVersionId?: number | null;
      status: 'Draft' | 'Committed';
      versionNotes: string;
      maturationDays: number;
      items: FormulaLineItem[];
    }
  ) => Promise<void>;
  onOpenMentor: () => void;
  onInspectMaterial: (materialId: number) => void;
  onAddToShelf?: (materialId: number) => void;
}

const FORMULA_STATUSES: FormulaStatus[] = [
  'Idea',
  'Draft',
  'Testing',
  'Aging',
  'Evaluation',
  'Revision',
  'Final',
  'Archived',
];

const BATCH_SCALE_PRESETS = [10, 25, 50, 100, 250, 500, 1000];

export const FormulaLabView: React.FC<FormulaLabViewProps> = ({
  mode,
  formulas,
  activeFormula,
  activeVersionLabel,
  materials,
  accords,
  regulatoryLimits,
  evaluations,
  safetyEnabled,
  currencySettings = DEFAULT_CURRENCY_SETTINGS,
  onUpdateCurrencySettings,
  onSyncLiveExchangeRates,
  isSyncingRates = false,
  onOpenSettings,
  onSelectFormula,
  onSaveFormulaVersion,
  onOpenMentor,
  onInspectMaterial,
  onAddToShelf,
}) => {
  // Library state
  const [libraryViewStyle, setLibraryViewStyle] = useState<'cards' | 'table'>('cards');
  const [libraryFilterStatus, setLibraryFilterStatus] = useState<string>('All');
  const [librarySearch, setLibrarySearch] = useState('');
  const [showNewFormulaModal, setShowNewFormulaModal] = useState(false);
  const [newFormulaName, setNewFormulaName] = useState('');
  const [newFormulaProject, setNewFormulaProject] = useState('');
  const [newFormulaIntendedProduct, setNewFormulaIntendedProduct] = useState('');
  const [newFormulaIfraCategory, setNewFormulaIfraCategory] = useState('');
  const [newFormulaFinalConc, setNewFormulaFinalConc] = useState('');
  const [newFormulaBrief, setNewFormulaBrief] = useState('');
  const [newFormulaError, setNewFormulaError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewFormulaModal(false);
        setShowBranchModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Active version lookup
  const currentVersion = useMemo(() => {
    if (!activeFormula || !Array.isArray(activeFormula.versions)) return undefined;
    return (
      activeFormula.versions.find((v) => v.versionLabel === activeVersionLabel) ||
      activeFormula.versions[activeFormula.versions.length - 1] ||
      activeFormula.versions[0]
    );
  }, [activeFormula, activeVersionLabel]);

  // Working items in editor
  const [workingItems, setWorkingItems] = useState<FormulaLineItem[]>(
    currentVersion?.items || []
  );
  const [lastSyncedVersionId, setLastSyncedVersionId] = useState<string>(
    `${activeFormula?.id ?? 'none'}-${currentVersion?.versionLabel ?? 'none'}`
  );

  const syncKey = `${activeFormula?.id ?? 'none'}-${currentVersion?.versionLabel ?? 'none'}`;
  if (syncKey !== lastSyncedVersionId) {
    setWorkingItems(currentVersion?.items || []);
    setLastSyncedVersionId(syncKey);
  }

  // Lab UI panels (persisted across tab navigation)
  const [activeBottomPanel, setActiveBottomPanelState] = useState<
    'comparison' | 'safety' | 'brief' | 'export'
  >(() => {
    try {
      const saved = sessionStorage.getItem('osmolab_lab_bottom_panel');
      if (
        saved === 'comparison' ||
        saved === 'safety' ||
        saved === 'brief' ||
        saved === 'export'
      ) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'comparison';
  });

  const setActiveBottomPanel = (
    nextPanel: 'comparison' | 'safety' | 'brief' | 'export'
  ) => {
    setActiveBottomPanelState(nextPanel);
    try {
      sessionStorage.setItem('osmolab_lab_bottom_panel', nextPanel);
    } catch {
      // ignore
    }
  };
  const [requestedBatchGrams, setRequestedBatchGrams] = useState<number>(100);
  const [showExpandedAccords, setShowExpandedAccords] = useState<boolean>(false);
  const [showCostCalculator, setShowCostCalculator] = useState<boolean>(true);
  const [bottleSizeMl, setBottleSizeMl] = useState<number>(50);
  const [carrierCostPerGramUsd, setCarrierCostPerGramUsd] = useState<number>(0.015);

  // Quick-Access Formula Mass Unit Converter state (Grams 'g' | Ounces 'oz' | Milliliters 'ml')
  const [activeMassUnit, setActiveMassUnit] = useState<FormulaMassUnit>('g');
  const [perfumeDensityGPerMl, setPerfumeDensityGPerMl] = useState<number>(
    DEFAULT_PERFUME_DENSITY_G_PER_ML
  );
  const [unitTargetDraft, setUnitTargetDraft] = useState<string>('');

  // Add ingredient bar
  const [addMaterialId, setAddMaterialId] = useState<number>(materials[0]?.id || 1);
  const [addAccordId, setAddAccordId] = useState<number>(accords[0]?.id || 1);
  const [addQuantityGrams, setAddQuantityGrams] = useState<string>('2.0');

  // Version Save / Branch Modal
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchVersionLabel, setBranchVersionLabel] = useState(
    `${currentVersion?.versionLabel || 'V1'}B`
  );
  const [branchNotes, setBranchNotes] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Comparison state
  const [compareV1Label, setCompareV1Label] = useState<string>(
    activeFormula && activeFormula.versions.length > 1
      ? activeFormula.versions[1]?.versionLabel || activeFormula.versions[0]?.versionLabel || 'V1'
      : activeFormula?.versions[0]?.versionLabel || 'V1'
  );
  const [compareV2Label, setCompareV2Label] = useState<string>(
    currentVersion?.versionLabel || 'V1'
  );

  // Target brief & target scent facets editing state
  const [briefText, setBriefText] = useState(activeFormula?.targetBrief || '');
  const [briefAtmosphere, setBriefAtmosphere] = useState(activeFormula?.targetAtmosphere || '');
  const [briefTexture, setBriefTexture] = useState(activeFormula?.targetTexture || '');
  const [briefDrydown, setBriefDrydown] = useState(activeFormula?.targetDrydown || '');
  const [formulaStatus, setFormulaStatus] = useState<FormulaStatus>(
    activeFormula?.status || 'Draft'
  );
  const [finalConc, setFinalConc] = useState<number | null>(
    typeof activeFormula?.finalProductConcentration === 'number' &&
      activeFormula.finalProductConcentration > 0
      ? activeFormula.finalProductConcentration
      : null
  );
  const [selectedIfraCategory, setSelectedIfraCategory] = useState<string>(
    activeFormula?.ifraCategory || ''
  );
  const [localRegulatoryLimits, setLocalRegulatoryLimits] =
    useState<MaterialRegulatoryLimit[]>(regulatoryLimits);
  const [showImportLimitModal, setShowImportLimitModal] = useState<boolean>(false);
  const [limitOverrideMaterialId, setLimitOverrideMaterialId] = useState<number>(
    materials[0]?.id || 1
  );
  const [limitOverrideMaxPct, setLimitOverrideMaxPct] = useState<string>('0.50');
  const [limitOverrideSource, setLimitOverrideSource] = useState<string>(
    'User-Entered Regulatory Dossier Override'
  );
  const [workingTargetFacets, setWorkingTargetFacets] = useState<Record<string, number>>(
    activeFormula?.targetFacets || {}
  );
  const [includeAllCoreFacets, setIncludeAllCoreFacets] = useState<boolean>(false);
  const [lastSyncedFormulaId, setLastSyncedFormulaId] = useState<number | null>(
    activeFormula?.id ?? null
  );

  if ((activeFormula?.id ?? null) !== lastSyncedFormulaId) {
    setLastSyncedFormulaId(activeFormula?.id ?? null);
    setBriefText(activeFormula?.targetBrief || '');
    setBriefAtmosphere(activeFormula?.targetAtmosphere || '');
    setBriefTexture(activeFormula?.targetTexture || '');
    setBriefDrydown(activeFormula?.targetDrydown || '');
    setFormulaStatus(activeFormula?.status || 'Draft');
    setFinalConc(
      typeof activeFormula?.finalProductConcentration === 'number' &&
        activeFormula.finalProductConcentration > 0
        ? activeFormula.finalProductConcentration
        : null
    );
    setSelectedIfraCategory(activeFormula?.ifraCategory || '');
    setWorkingTargetFacets(activeFormula?.targetFacets || {});
  }

  const radarComparison = useMemo(
    () =>
      computeFormulaFacetRadarComparison(
        workingItems,
        materials,
        accords,
        workingTargetFacets,
        { includeAllCoreFacets }
      ),
    [workingItems, materials, accords, workingTargetFacets, includeAllCoreFacets]
  );

  const displayItems = useMemo(() => {
    return showExpandedAccords
      ? expandNestedAccords(workingItems, accords)
      : workingItems;
  }, [workingItems, showExpandedAccords, accords]);

  const metrics = useMemo(
    () => calculateFormulaMetrics(displayItems),
    [displayItems]
  );

  // Effective batch weight for real-time cost estimator (tracks formula total weight when edited)
  const effectiveBatchWeightGrams =
    metrics.totalWeightGrams > 0 ? metrics.totalWeightGrams : requestedBatchGrams;

  // Deterministic total formula mass conversion across Grams (g), Ounces (oz), and Milliliters (mL)
  const massBreakdown = useMemo(
    () =>
      convertFormulaTotalMassBreakdown(
        metrics.totalWeightGrams,
        perfumeDensityGPerMl
      ),
    [metrics.totalWeightGrams, perfumeDensityGPerMl]
  );

  const activeUnitDisplayValue = useMemo(() => {
    if (activeMassUnit === 'oz') return massBreakdown.ounces.toFixed(3);
    if (activeMassUnit === 'ml') return massBreakdown.milliliters.toFixed(2);
    return massBreakdown.grams.toFixed(3);
  }, [activeMassUnit, massBreakdown]);

  const activeUnitLabel =
    activeMassUnit === 'oz' ? 'oz' : activeMassUnit === 'ml' ? 'mL' : 'g';

  const hasValidSafetyContext = Boolean(
    selectedIfraCategory.trim() &&
      finalConc !== null &&
      Number.isFinite(finalConc) &&
      finalConc > 0
  );

  const realTimeCostSummary = useMemo(
    () =>
      calculateRealTimeBatchCost({
        items: displayItems,
        materials,
        targetBatchGrams: effectiveBatchWeightGrams,
        finalProductConcentrationPercent: finalConc ?? 0,
        carrierCostPerGramUsd,
        bottleSizeMl,
      }),
    [
      displayItems,
      materials,
      effectiveBatchWeightGrams,
      finalConc,
      carrierCostPerGramUsd,
      bottleSizeMl,
    ]
  );

  const topCostDistribution = useMemo(
    () => buildTopMaterialsCostDistribution(realTimeCostSummary, 5),
    [realTimeCostSummary]
  );

  // Merge prop regulatoryLimits with any user-imported / overridden regulatory limits
  const effectiveRegulatoryLimits = useMemo(() => {
    const map = new Map<number, MaterialRegulatoryLimit>();
    for (const r of regulatoryLimits) {
      map.set(r.materialId, r);
    }
    for (const r of localRegulatoryLimits) {
      map.set(r.materialId, r);
    }
    return Array.from(map.values());
  }, [regulatoryLimits, localRegulatoryLimits]);

  const safetyReport = useMemo<FormulaSafetyReport>(() => {
    if (!hasValidSafetyContext || finalConc === null) {
      return {
        ifraCategory: selectedIfraCategory || '',
        normalizedCategoryCode: null,
        intendedProduct: activeFormula?.intendedProduct || '',
        exposureType: 'AMBIGUOUS',
        finalProductConcentrationPercent: finalConc ?? 0,
        evaluations: [],
        byLineId: {},
        complianceState: 'INDETERMINATE',
        ifraComplianceState: 'INDETERMINATE',
        euComplianceState: 'INDETERMINATE',
        overallCompliant: false,
        violationCount: 0,
        missingDataCount: workingItems.length,
        hasMissingData: true,
        cumulativeMultiSourceCount: 0,
        safetyRiskEvaluations: [],
        indeterminateCount: workingItems.length,
        demoOrUnverifiedCount: 0,
        disclaimer:
          'Regulatory context incomplete — select an IFRA Category and provide Finished-Product Concentration (%) to evaluate formula compliance.',
        euOverallCompliant: false,
        euViolationCount: 0,
        euAllergenDeclarationCount: 0,
        aggregatedAllergens: [],
      };
    }
    return evaluateFormulaSafety(
      workingItems,
      accords,
      effectiveRegulatoryLimits,
      selectedIfraCategory,
      finalConc,
      {
        intendedProduct: activeFormula?.intendedProduct || '',
      }
    );
  }, [
    hasValidSafetyContext,
    workingItems,
    accords,
    effectiveRegulatoryLimits,
    selectedIfraCategory,
    finalConc,
    activeFormula?.intendedProduct,
  ]);

  const safetyByMaterialId = useMemo(() => {
    const map = new Map<number, MaterialSafetyEvaluation>();
    for (const ev of safetyReport.evaluations) {
      map.set(ev.materialId, ev);
    }
    return map;
  }, [safetyReport]);

  const handleAutoCapMaterial = (materialId: number) => {
    if (!hasValidSafetyContext || finalConc === null) return;
    setWorkingItems((prev) =>
      autoCapMaterialToIfraLimit(
        prev,
        accords,
        effectiveRegulatoryLimits,
        materialId,
        selectedIfraCategory,
        finalConc
      )
    );
    const matName =
      materials.find((m) => m.id === materialId)?.name || 'Material';
    setSaveToast(
      `Auto-capped ${matName} within ${selectedIfraCategory} threshold`
    );
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleApplyRegulatoryLimitOverride = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMax = parseFloat(limitOverrideMaxPct);
    if (Number.isNaN(parsedMax) || parsedMax < 0) return;

    setLocalRegulatoryLimits((prev) => {
      const existing =
        prev.find((r) => r.materialId === limitOverrideMaterialId) ||
        regulatoryLimits.find((r) => r.materialId === limitOverrideMaterialId);
      const updatedRecord: MaterialRegulatoryLimit = existing
        ? {
            ...existing,
            ifraCategory: selectedIfraCategory,
            maxAllowedPercent: parsedMax,
            sourceDocument: limitOverrideSource.trim() || existing.sourceDocument,
            documentVersion: 'Imported Regulatory Override',
            effectiveDate: new Date().toISOString().slice(0, 10),
            verificationStatus: 'USER_ENTERED_UNVERIFIED',
            categoryLimitsTable: Array.isArray(existing.categoryLimitsTable)
              ? existing.categoryLimitsTable.map((row) => ({
                  ...row,
                  maxAllowedPercent: parsedMax,
                }))
              : [],
          }
        : {
            id: Date.now(),
            materialId: limitOverrideMaterialId,
            ifraCategory: selectedIfraCategory,
            maxAllowedPercent: parsedMax,
            allergens: 'Imported regulatory limit',
            restrictions: `Max ${parsedMax}% in ${selectedIfraCategory}`,
            sourceDocument:
              limitOverrideSource.trim() || 'User-entered override',
            documentVersion: 'User-entered (unverified)',
            effectiveDate: new Date().toISOString().slice(0, 10),
            isDemoData: false,
            verificationStatus: 'USER_ENTERED_UNVERIFIED',
          };

      const filtered = prev.filter(
        (r) => r.materialId !== limitOverrideMaterialId
      );
      return [...filtered, updatedRecord];
    });
    setShowImportLimitModal(false);
    const matName =
      materials.find((m) => m.id === limitOverrideMaterialId)?.name || 'Material';
    setSaveToast(
      `Updated imported regulatory threshold for ${matName} to ${parsedMax}%`
    );
    setTimeout(() => setSaveToast(null), 3500);
  };

  const validationIssues = useMemo(
    () => validateFormula(workingItems),
    [workingItems]
  );

  const handleQuantityChange = (lineId: string, newGramsStr: string) => {
    const val = parseFloat(newGramsStr);
    const safeVal = Number.isNaN(val) ? 0 : val;
    setWorkingItems((prev) =>
      prev.map((item) =>
        item.id === lineId ? { ...item, quantityGrams: safeVal } : item
      )
    );
  };

  const handleDilutionChange = (lineId: string, newDilution: number) => {
    setWorkingItems((prev) =>
      prev.map((item) =>
        item.id === lineId
          ? {
              ...item,
              dilutionPercent: newDilution,
              solvent: newDilution === 100 ? 'Neat' : item.solvent === 'Neat' ? 'Ethanol' : item.solvent,
            }
          : item
      )
    );
  };

  const [altSwapOpenLineId, setAltSwapOpenLineId] = useState<string | null>(null);

  const handleDeleteLine = (lineId: string) => {
    setWorkingItems((prev) => prev.filter((item) => item.id !== lineId));
  };

  const handleSwapMaterialForLine = (lineId: string, replacementMat: RawMaterial) => {
    setWorkingItems((prev) =>
      prev.map((item) => {
        if (item.id !== lineId) return item;
        const dilution = replacementMat.recommendedDilution || 100;
        return {
          ...item,
          materialId: replacementMat.id,
          name: replacementMat.name,
          dilutionPercent: dilution,
          solvent: dilution < 100 ? 'Ethanol' : 'Neat',
          activeMaterialPercent: roundDecimal(item.quantityGrams * (dilution / 100), 3),
          supplier: replacementMat.supplier,
          costPerGram: replacementMat.costPerGram ?? item.costPerGram,
        };
      })
    );
    setAltSwapOpenLineId(null);
    setSaveToast(`Swapped ingredient to owned My Workbench alternative: ${replacementMat.name}`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleAddMaterialLine = () => {
    const mat = materials.find((m) => m.id === Number(addMaterialId));
    if (!mat) return;
    const qty = Math.max(0.01, parseFloat(addQuantityGrams) || 1.0);
    const dilution = mat.recommendedDilution || 100;
    const newItem: FormulaLineItem = {
      id: `line-${Date.now()}`,
      type: 'material',
      materialId: mat.id,
      name: mat.name,
      quantityGrams: qty,
      percentage: qty,
      dilutionPercent: dilution,
      solvent: dilution < 100 ? 'Ethanol' : 'Neat',
      activeMaterialPercent: roundDecimal(qty * (dilution / 100), 3),
      supplier: mat.supplier,
      costPerGram: mat.costPerGram ?? 0.45,
      notes: '',
    };
    setWorkingItems((prev) => [...prev, newItem]);
  };

  const handleInsertAccordLine = () => {
    const acc = accords.find((a) => a.id === Number(addAccordId));
    if (!acc) return;
    const qty = Math.max(0.01, parseFloat(addQuantityGrams) || 5.0);
    const newItem: FormulaLineItem = {
      id: `accord-line-${Date.now()}`,
      type: 'accord',
      accordId: acc.id,
      name: acc.name,
      quantityGrams: qty,
      percentage: qty,
      dilutionPercent: 100,
      solvent: 'Neat',
      activeMaterialPercent: qty,
      supplier: 'In-House Accord',
      costPerGram: 0.5,
      notes: `Nested Accord (${acc.items.length} components)`,
    };
    setWorkingItems((prev) => [...prev, newItem]);
  };

  const handleNormalize = () => {
    setWorkingItems((prev) => normalizeFormulaTo100(prev));
    setRequestedBatchGrams(100);
    setUnitTargetDraft('');
  };

  const handleScaleBatch = (targetGrams: number) => {
    setRequestedBatchGrams(targetGrams);
    setWorkingItems((prev) => scaleFormulaToBatch(prev, targetGrams));
    setUnitTargetDraft('');
  };

  const handleSwitchMassUnit = (nextUnit: FormulaMassUnit) => {
    setActiveMassUnit(nextUnit);
    setUnitTargetDraft('');
  };

  const handleScaleByUnitAmount = (
    targetAmount: number,
    unit: FormulaMassUnit = activeMassUnit,
    density: number = perfumeDensityGPerMl
  ) => {
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) return;
    const result = scaleFormulaByUnitTarget(
      workingItems,
      targetAmount,
      unit,
      density
    );
    if (result.targetGrams > 0) {
      setRequestedBatchGrams(result.targetGrams);
      setWorkingItems(result.scaledItems);
      setUnitTargetDraft('');
    }
  };

  const handleQuickSaveVersion = async (asNewBranch: boolean = false) => {
    if (!activeFormula || !currentVersion) return;
    const labelToSave = asNewBranch
      ? branchVersionLabel.trim() || `${currentVersion.versionLabel}-Rev`
      : currentVersion.status === 'Committed'
      ? `V${activeFormula.versions.length + 1}`
      : currentVersion.versionLabel;

    await onSaveFormulaVersion(
      {
        ...activeFormula,
        status: formulaStatus,
        ifraCategory: selectedIfraCategory,
        finalProductConcentration:
          finalConc !== null ? finalConc : activeFormula.finalProductConcentration,
        targetBrief: briefText,
        targetAtmosphere: briefAtmosphere,
        targetTexture: briefTexture,
        targetDrydown: briefDrydown,
        targetFacets: workingTargetFacets,
      },
      {
        versionLabel: labelToSave,
        parentVersionId: currentVersion?.id || null,
        status: 'Committed',
        versionNotes:
          branchNotes ||
          `Saved ${labelToSave} with ${workingItems.length} ingredients (${metrics.totalWeightGrams} g)`,
        maturationDays: currentVersion?.maturationDays || 14,
        items: metrics.items,
      }
    );

    setShowBranchModal(false);
    setBranchNotes('');
    setSaveToast(`Saved immutable version ${labelToSave} to PostgreSQL`);
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleCreateNewFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newFormulaName.trim();
    const trimmedProduct = newFormulaIntendedProduct.trim();
    const trimmedCategory = newFormulaIfraCategory.trim();
    const parsedConc = Number(newFormulaFinalConc);
    if (
      !trimmedName ||
      !trimmedProduct ||
      !trimmedCategory ||
      newFormulaFinalConc.trim() === '' ||
      !Number.isFinite(parsedConc) ||
      parsedConc <= 0 ||
      parsedConc > 100
    ) {
      setNewFormulaError(
        'Formula Name, Intended Product, IFRA Category, and a valid Finished-Product Concentration (0–100%) are required.'
      );
      return;
    }
    setNewFormulaError(null);
    await onSaveFormulaVersion(
      {
        name: trimmedName,
        projectName: newFormulaProject.trim(),
        status: 'Draft',
        intendedProduct: trimmedProduct,
        ifraCategory: trimmedCategory,
        finalProductConcentration: parsedConc,
        targetBrief: newFormulaBrief.trim(),
        targetFamilies: [],
        targetFacets: {},
      },
      {
        versionLabel: 'V1',
        parentVersionId: null,
        status: 'Draft',
        versionNotes: 'Initial V1 creation',
        maturationDays: 14,
        items: [],
      }
    );
    setShowNewFormulaModal(false);
    setNewFormulaName('');
    setNewFormulaProject('');
    setNewFormulaIntendedProduct('');
    setNewFormulaIfraCategory('');
    setNewFormulaFinalConc('');
    setNewFormulaBrief('');
  };

  const renderNewFormulaModal = () => (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
      onClick={() => {
        setShowNewFormulaModal(false);
        setNewFormulaError(null);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-formula-title"
    >
      <form
        noValidate
        onSubmit={handleCreateNewFormula}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-[#111621] border border-slate-700 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden text-xs my-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0 sticky top-0 bg-[#111621] z-10">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block">
              Formula Workspace
            </span>
            <h3 id="create-formula-title" className="text-base font-semibold text-white">
              Create New Fragrance Formula
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowNewFormulaModal(false);
              setNewFormulaError(null);
            }}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain space-y-4">
          {newFormulaError && (
            <div
              data-testid="new-formula-error"
              className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/60 text-rose-200 text-xs flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{newFormulaError}</span>
            </div>
          )}

          <div>
            <label htmlFor="new-formula-name" className="block text-xs text-slate-300 mb-1">
              Formula Name *
            </label>
            <input
              id="new-formula-name"
              data-testid="new-formula-name-input"
              type="text"
              required
              value={newFormulaName}
              onChange={(e) => setNewFormulaName(e.target.value)}
              placeholder="e.g., Coastal Cypress Study"
              className="w-full bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-formula-product" className="block text-xs text-slate-300 mb-1">
                Intended Product *
              </label>
              <input
                id="new-formula-product"
                data-testid="new-formula-intended-product-input"
                type="text"
                required
                value={newFormulaIntendedProduct}
                onChange={(e) => setNewFormulaIntendedProduct(e.target.value)}
                placeholder="e.g., Fine Fragrance Spray, Body Lotion"
                className="w-full bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="new-formula-conc" className="block text-xs text-slate-300 mb-1">
                Finished-Product Concentration (%) *
              </label>
              <input
                id="new-formula-conc"
                data-testid="new-formula-conc-input"
                type="number"
                min={0.01}
                max={100}
                step="any"
                required
                value={newFormulaFinalConc}
                onChange={(e) => setNewFormulaFinalConc(e.target.value)}
                placeholder="Enter % (0.01–100)"
                className="w-full bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-2 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-formula-ifra-category" className="block text-xs text-slate-300 mb-1">
              IFRA Category *
            </label>
            <select
              id="new-formula-ifra-category"
              data-testid="new-formula-ifra-category-select"
              required
              value={newFormulaIfraCategory}
              onChange={(e) => setNewFormulaIfraCategory(e.target.value)}
              className="w-full bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select IFRA Category...</option>
              {IFRA_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.value}>
                  {opt.value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="new-formula-project" className="block text-xs text-slate-300 mb-1">
              Project (Optional)
            </label>
            <input
              id="new-formula-project"
              type="text"
              value={newFormulaProject}
              onChange={(e) => setNewFormulaProject(e.target.value)}
              placeholder="e.g., Personal Study"
              className="w-full bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="new-formula-brief" className="block text-xs text-slate-300 mb-1">
              Olfactory Target Brief (Optional)
            </label>
            <textarea
              id="new-formula-brief"
              rows={3}
              value={newFormulaBrief}
              onChange={(e) => setNewFormulaBrief(e.target.value)}
              placeholder="Describe the atmosphere, texture, evolution, and desired drydown..."
              className="w-full bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 shrink-0 sticky bottom-0 bg-[#111621] z-10">
          <button
            type="button"
            onClick={() => {
              setShowNewFormulaModal(false);
              setNewFormulaError(null);
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="submit-new-formula-btn"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white rounded-md shadow transition-colors"
          >
            Create Formula V1
          </button>
        </div>
      </form>
    </div>
  );

  const handleExportCSV = () => {
    if (!activeFormula) return;
    const headers = [
      'Ingredient',
      'Percentage',
      'Concentration',
      'ActivePercent',
      'TargetWeight',
      'Unit',
      'Supplier',
      'Notes',
    ];
    const rows = metrics.items.map((item) => [
      `"${item.name.replace(/"/g, '""')}"`,
      item.normalizedPercentage.toFixed(3),
      `${item.dilutionPercent}% in ${item.solvent}`,
      item.activeMaterialPercentOfTotal.toFixed(3),
      item.quantityGrams.toFixed(3),
      'g',
      `"${item.supplier}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ]);

    const metadataComment = `# Formula: ${activeFormula.name} | Version: ${currentVersion?.versionLabel} | Status: ${activeFormula.status} | Batch Weight: ${metrics.totalWeightGrams} g\n`;
    const csvContent =
      metadataComment +
      headers.join(',') +
      '\n' +
      rows.map((r) => r.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeFormula.name.toLowerCase().replace(/\s+/g, '_')}_${
      currentVersion?.versionLabel || 'v1'
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveToast('Exported CSV with version metadata');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleExportPDF = () => {
    if (!activeFormula || !currentVersion) return;
    try {
      generateFormulaPDF({
        formula: activeFormula,
        version: currentVersion,
        materials,
        accords,
        evaluations,
      });
      setSaveToast(`Exported ${activeFormula.name} (${currentVersion.versionLabel}) PDF Dossier`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      setSaveToast('PDF generation failed. Please check browser permissions.');
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  // Version Comparison calculation
  const v1ForCompare =
    activeFormula?.versions.find((v) => v.versionLabel === compareV1Label) ||
    activeFormula?.versions[0];
  const v2ForCompare =
    activeFormula?.versions.find((v) => v.versionLabel === compareV2Label) ||
    currentVersion;

  const comparisonDiffs = useMemo(() => {
    if (!v1ForCompare || !v2ForCompare) return [];
    return compareFormulaVersions(v1ForCompare, v2ForCompare);
  }, [v1ForCompare, v2ForCompare]);

  // Library Mode Render
  if (mode === 'library') {
    const filteredFormulas = formulas.filter((f) => {
      const matchesStatus =
        libraryFilterStatus === 'All' || f.status === libraryFilterStatus;
      const matchesSearch =
        !librarySearch.trim() ||
        f.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
        f.projectName.toLowerCase().includes(librarySearch.toLowerCase()) ||
        f.tags.some((t) => t.toLowerCase().includes(librarySearch.toLowerCase()));
      return matchesStatus && matchesSearch;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-sans font-semibold text-white">
              Formula Library
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Version-controlled archive of fragrance compositions, experimental branches, and maturation trials.
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between w-full md:w-auto gap-2.5">
            <div className="grid grid-cols-2 sm:flex items-center gap-1 p-1 bg-[#111621] border border-slate-800 rounded-lg flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setLibraryViewStyle('cards')}
                className={`px-3 py-1.5 sm:py-1 text-xs font-medium rounded transition-colors text-center ${
                  libraryViewStyle === 'cards'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setLibraryViewStyle('table')}
                className={`px-3 py-1.5 sm:py-1 text-xs font-medium rounded transition-colors text-center ${
                  libraryViewStyle === 'table'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Compact Table
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowNewFormulaModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>New Formula</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#111621] border border-slate-800 rounded-lg">
            {['All', 'Draft', 'Testing', 'Aging', 'Evaluation', 'Final', 'Archived'].map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setLibraryFilterStatus(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    libraryFilterStatus === st
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>
          <input
            type="search"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Filter by formula name, project, or tag..."
            aria-label="Filter formulas"
            className="w-full md:w-72 bg-[#111621] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {filteredFormulas.length === 0 ? (
          <div className="rounded-lg bg-[#111621] border border-slate-800 p-12 text-center">
            <h3 className="text-base font-semibold text-white">
              Your fragrance library has no matching formulas.
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Create your first formula or start from an educational accord to begin formulating.
            </p>
            <button
              type="button"
              onClick={() => setShowNewFormulaModal(true)}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Create First Formula
            </button>
          </div>
        ) : libraryViewStyle === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredFormulas.map((f) => {
              const latestEval = evaluations.find((ev) => ev.formulaId === f.id);
              return (
                <div
                  key={f.id}
                  className="rounded-lg bg-[#111621] border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {f.projectName} · {f.status} · {f.activeVersionLabel}
                      </span>
                      {f.isFavorite && (
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-white mt-1.5">{f.name}</h2>
                    <p className="text-xs text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                      {f.description || f.targetBrief}
                    </p>
                    <div className="mt-3 text-[11px] text-slate-400">
                      <span>Dominant: {f.targetFamilies.join(' · ')}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="font-mono-tabular text-slate-400">
                      <span>{f.versions.length} Versions</span>
                      <span className="mx-1.5">·</span>
                      <span>
                        Score: {latestEval ? `${latestEval.overallScore}/10` : 'Pending'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectFormula(f.id, f.activeVersionLabel)}
                      className="text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap shrink-0"
                    >
                      Open in Lab →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-[#111621] border border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="py-3 px-4 font-medium">Formula Name</th>
                  <th className="py-3 px-4 font-medium">Project</th>
                  <th className="py-3 px-4 font-medium">Active Version</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Dominant Families</th>
                  <th className="py-3 px-4 font-medium text-right">Last Modified</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {filteredFormulas.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-white">{f.name}</td>
                    <td className="py-3 px-4 text-slate-300">{f.projectName}</td>
                    <td className="py-3 px-4 font-mono-tabular text-emerald-400">
                      {f.activeVersionLabel} ({f.versions.length} rev)
                    </td>
                    <td className="py-3 px-4 text-slate-300">{f.status}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {f.targetFamilies.join(' · ')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-400">
                      {f.updatedAt}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectFormula(f.id, f.activeVersionLabel)}
                        className="text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Open Lab
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showNewFormulaModal && renderNewFormulaModal()}
      </div>
    );
  }

  // Zero-Formula Empty State in Formula Lab mode
  if (!activeFormula) {
    return (
      <div className="space-y-6 w-full max-w-full min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-sans font-semibold text-white">
              Formula Lab Workbench
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Compose and normalize fragrance formulas, convert batch units, verify IFRA compliance, and compare version lineages.
            </p>
          </div>
          <button
            type="button"
            data-testid="lab-new-formula-btn"
            onClick={() => setShowNewFormulaModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Create First Formula</span>
          </button>
        </div>

        <div
          data-testid="formula-lab-empty-state"
          className="rounded-xl bg-[#111621] border border-slate-800 p-10 sm:p-14 text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
            <Scale className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-lg font-semibold text-white">
              No Active Formula Selected
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your formulation workspace starts clean with zero pre-loaded demo formulas. Create your first fragrance formula to begin composing with materials from My Shelf and the 815-material Catalog.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              data-testid="create-first-formula-cta"
              onClick={() => setShowNewFormulaModal(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Formula</span>
            </button>
          </div>
        </div>

        {showNewFormulaModal && renderNewFormulaModal()}
      </div>
    );
  }

  // Main Formula Lab View
  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {saveToast && (
        <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-lg bg-emerald-950 border border-emerald-600/70 px-4 py-2.5 text-xs font-medium text-emerald-200 shadow-lg">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Main Tab Title & One-Sentence Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-sans font-semibold text-white">
            Formula Lab Workbench
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Compose and normalize fragrance formulas, convert batch units, verify IFRA compliance, and compare version lineages.
          </p>
        </div>
        <button
          type="button"
          data-testid="lab-new-formula-btn"
          onClick={() => setShowNewFormulaModal(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span>New Formula</span>
        </button>
      </div>

      {/* Formula Selector & Version Control Bar */}
      <div className="rounded-lg bg-[#111621] border border-slate-800 p-3.5 sm:p-5 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Project: {activeFormula.projectName || 'Unspecified'}</span>
              <span aria-hidden="true">·</span>
              <span>Product: {activeFormula.intendedProduct || 'Not specified'}</span>
              <span aria-hidden="true">·</span>
              <span>IFRA: {selectedIfraCategory || 'Not specified'}</span>
              <span aria-hidden="true">·</span>
              <span>Conc: {finalConc !== null ? `${finalConc}%` : 'Not specified'}</span>
              <span aria-hidden="true">·</span>
              <span>Maturation Target: {currentVersion?.maturationDays || 14} Days</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Select Active Formula"
                value={activeFormula.id}
                onChange={(e) => onSelectFormula(Number(e.target.value))}
                className="bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-1.5 text-lg font-sans font-semibold text-white focus:outline-none focus:border-emerald-500"
              >
                {formulas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              {/* Version Selector */}
              <div className="flex items-center gap-1 p-1 bg-[#0B0E14] border border-slate-800 rounded-md overflow-x-auto max-w-full">
                {activeFormula.versions.map((ver) => (
                  <button
                    key={ver.id}
                    type="button"
                    onClick={() => onSelectFormula(activeFormula.id, ver.versionLabel)}
                    className={`px-2.5 py-1 text-xs font-mono-tabular rounded transition-colors whitespace-nowrap shrink-0 ${
                      ver.versionLabel === currentVersion?.versionLabel
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {ver.versionLabel}
                  </button>
                ))}
              </div>

              {/* Status Selector */}
              <select
                aria-label="Formula Status"
                value={formulaStatus}
                onChange={(e) => setFormulaStatus(e.target.value as FormulaStatus)}
                className="bg-[#0B0E14] border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200"
              >
                {FORMULA_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    Status: {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Actions — Crisp 2x2 Grid on Mobile, Flex Row on Tablet/Desktop */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => handleQuickSaveVersion(false)}
              className="justify-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Save New Version</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setBranchVersionLabel(`${currentVersion?.versionLabel || 'V5'}B-Trial`);
                setShowBranchModal(true);
              }}
              className="justify-center px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <GitBranch className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Branch Experiment</span>
            </button>
            <button
              type="button"
              onClick={onOpenMentor}
              className="justify-center px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Ask Olfactory Mentor</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="justify-center px-3 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Download Formatted PDF Formulation Dossier"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="justify-center px-3 py-2 bg-[#0B0E14] border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Quick-Access Formula Mass Unit Converter Bar (Grams / Ounces / Milliliters) */}
        <div
          data-testid="formula-top-unit-converter"
          className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-[#0B0E14]/70 rounded-lg p-3 border border-slate-800/70"
        >
          {/* Left: Instant Multi-Unit Switcher & Simultaneous Readout */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full xl:w-auto">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Scale className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Formula Total Mass Converter:</span>
            </span>

            <div
              role="group"
              aria-label="Formula Total Mass Unit Selector"
              className="grid grid-cols-1 sm:grid-cols-3 lg:flex items-center gap-1 p-1 bg-[#111621] border border-slate-800 rounded-md w-full sm:w-auto"
            >
              <button
                type="button"
                data-testid="unit-converter-btn-g"
                onClick={() => handleSwitchMassUnit('g')}
                className={`px-2.5 py-1.5 sm:py-1 text-xs font-mono-tabular rounded transition-colors whitespace-nowrap shrink-0 flex items-center justify-between sm:justify-center gap-1.5 ${
                  activeMassUnit === 'g'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>Grams:</span>
                <span>{massBreakdown.formattedGrams}</span>
              </button>

              <button
                type="button"
                data-testid="unit-converter-btn-oz"
                onClick={() => handleSwitchMassUnit('oz')}
                className={`px-2.5 py-1.5 sm:py-1 text-xs font-mono-tabular rounded transition-colors whitespace-nowrap shrink-0 flex items-center justify-between sm:justify-center gap-1.5 ${
                  activeMassUnit === 'oz'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>Ounces:</span>
                <span>{massBreakdown.formattedOunces}</span>
              </button>

              <button
                type="button"
                data-testid="unit-converter-btn-ml"
                onClick={() => handleSwitchMassUnit('ml')}
                className={`px-2.5 py-1.5 sm:py-1 text-xs font-mono-tabular rounded transition-colors whitespace-nowrap shrink-0 flex items-center justify-between sm:justify-center gap-1.5 ${
                  activeMassUnit === 'ml'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>Milliliters:</span>
                <span>{massBreakdown.formattedMilliliters}</span>
              </button>
            </div>
          </div>

          {/* Right: Target Amount Scaler in Active Unit + Specific Gravity (g/mL) Control */}
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 w-full xl:w-auto">
            {/* Direct Target Mass/Volume Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsed = parseFloat(
                  unitTargetDraft !== '' ? unitTargetDraft : activeUnitDisplayValue
                );
                if (!Number.isNaN(parsed) && parsed > 0) {
                  handleScaleByUnitAmount(parsed, activeMassUnit, perfumeDensityGPerMl);
                }
              }}
              className="flex items-center justify-between sm:justify-start gap-1.5 w-full sm:w-auto"
            >
              <label
                htmlFor="top-unit-converter-target-input"
                className="text-[11px] text-slate-400 whitespace-nowrap shrink-0"
              >
                Scale to ({activeUnitLabel}):
              </label>
              <input
                id="top-unit-converter-target-input"
                data-testid="unit-converter-target-input"
                type="number"
                step="any"
                min="0.01"
                value={unitTargetDraft !== '' ? unitTargetDraft : activeUnitDisplayValue}
                onChange={(e) => setUnitTargetDraft(e.target.value)}
                aria-label={`Target formula total in ${activeUnitLabel}`}
                className="w-24 flex-1 sm:flex-initial bg-[#111621] border border-slate-700 rounded px-2 py-1.5 sm:py-1 text-xs font-mono-tabular text-white text-right focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs font-mono-tabular text-emerald-400 shrink-0">
                {activeUnitLabel}
              </span>
              <button
                type="submit"
                data-testid="unit-converter-apply-scale-btn"
                className="px-3 py-1.5 sm:py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0"
              >
                Apply {activeUnitLabel}
              </button>
            </form>

            {/* Quick Unit-Aware Presets */}
            <div className="grid grid-cols-3 sm:flex items-center gap-1 w-full sm:w-auto">
              {(activeMassUnit === 'g'
                ? [
                    { label: '50 g', val: 50 },
                    { label: '100 g', val: 100 },
                    { label: '250 g', val: 250 },
                  ]
                : activeMassUnit === 'oz'
                ? [
                    { label: '1 oz', val: 1 },
                    { label: '1.7 oz', val: 1.7 },
                    { label: '3.4 oz', val: 3.4 },
                  ]
                : [
                    { label: '30 mL', val: 30 },
                    { label: '50 mL', val: 50 },
                    { label: '100 mL', val: 100 },
                  ]
              ).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    handleScaleByUnitAmount(
                      preset.val,
                      activeMassUnit,
                      perfumeDensityGPerMl
                    )
                  }
                  className="justify-center px-2 py-1.5 sm:py-1 bg-[#111621] border border-slate-800 hover:border-emerald-500/60 text-[11px] font-mono-tabular text-slate-300 hover:text-white rounded transition-colors flex items-center whitespace-nowrap shrink-0"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Density (g/mL) Selector for mL accuracy */}
            <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:pl-1 sm:border-l border-slate-800 w-full sm:w-auto min-w-0">
              <label
                htmlFor="top-unit-density-select"
                className="text-[11px] text-slate-400 whitespace-nowrap shrink-0"
              >
                Density:
              </label>
              <select
                id="top-unit-density-select"
                aria-label="Fragrance Specific Gravity Density (g/mL)"
                value={perfumeDensityGPerMl}
                onChange={(e) => {
                  const nextDensity = parseFloat(e.target.value);
                  if (!Number.isNaN(nextDensity) && nextDensity > 0) {
                    setPerfumeDensityGPerMl(nextDensity);
                  }
                }}
                className="flex-1 sm:flex-initial min-w-0 max-w-full truncate bg-[#111621] border border-slate-800 rounded px-2 py-1.5 sm:py-1 text-[11px] font-mono-tabular text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                {PERFUME_DENSITY_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.densityGPerMl}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Target Brief Summary Line */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
          <p className="text-slate-300 leading-relaxed">
            <strong className="text-slate-400 font-medium">Target Brief:</strong>{' '}
            {briefText || activeFormula.targetBrief}
          </p>
          <p className="font-mono-tabular text-slate-400 leading-relaxed lg:text-right">
            <strong className="text-slate-300 font-medium">Version Note:</strong>{' '}
            {currentVersion?.versionNotes || 'Committed formulation'}
          </p>
        </div>
      </div>

      {/* Deterministic Calculation Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div
          data-testid="kpi-total-formula-weight"
          className="p-3.5 rounded-lg bg-[#111621] border border-slate-800"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Formula Mass</span>
            <span className="font-mono-tabular text-emerald-400 uppercase">
              {activeUnitLabel}
            </span>
          </div>
          <div className="text-xl font-mono-tabular font-semibold text-white mt-0.5">
            {activeUnitDisplayValue}{' '}
            <span className="text-xs text-slate-400">{activeUnitLabel}</span>
          </div>
          <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5 truncate">
            {activeMassUnit === 'g' &&
              `${massBreakdown.formattedOunces} · ${massBreakdown.formattedMilliliters}`}
            {activeMassUnit === 'oz' &&
              `${massBreakdown.formattedGrams} · ${massBreakdown.formattedMilliliters}`}
            {activeMassUnit === 'ml' &&
              `${massBreakdown.formattedGrams} · ${massBreakdown.formattedOunces}`}
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-[#111621] border border-slate-800">
          <div className="text-[11px] text-slate-400">Normalized Sum</div>
          <div className="text-xl font-mono-tabular font-semibold text-emerald-400 mt-0.5">
            {metrics.totalNormalizedPercentage.toFixed(3)}{' '}
            <span className="text-xs text-slate-400">%</span>
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-[#111621] border border-slate-800">
          <div className="text-[11px] text-slate-400">Active Aromatic Mass</div>
          <div className="text-xl font-mono-tabular font-semibold text-white mt-0.5">
            {metrics.totalActiveMaterialGrams.toFixed(3)}{' '}
            <span className="text-xs text-slate-400">
              g ({metrics.totalActiveConcentrationPercent}%)
            </span>
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-[#111621] border border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Formula Cost ({currencySettings.activeCurrency})</span>
            <select
              aria-label="Quick Switch Formula Currency"
              value={currencySettings.activeCurrency}
              onChange={(e) =>
                onUpdateCurrencySettings?.({
                  ...currencySettings,
                  activeCurrency: e.target.value as CurrencyCode,
                })
              }
              className="bg-[#0B0E14] border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono-tabular text-emerald-400"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div
            className={`${
              currencySettings.activeCurrency === 'IRR' ? 'text-sm' : 'text-lg'
            } font-mono-tabular font-semibold text-white mt-1 leading-tight`}
          >
            {formatCurrencyAmount(
              realTimeCostSummary.totalBatchCostUsd,
              currencySettings
            )}
          </div>
          <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
            {formatCurrencyAmount(
              realTimeCostSummary.costPerGramUsd,
              currencySettings,
              { unitDecimals: true }
            )}
            /g
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-[#111621] border border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>IFRA Safety Status</span>
            {safetyReport.violationCount > 0 && (
              <span
                data-testid="safety-risk-badge"
                className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/60 text-[10px] font-semibold text-rose-300 uppercase tracking-wider"
              >
                Safety Risk
              </span>
            )}
          </div>
          <div
            className={`text-sm font-mono-tabular font-semibold mt-1 ${
              safetyReport.violationCount > 0
                ? 'text-rose-400'
                : safetyReport.hasMissingData
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}
          >
            {safetyReport.violationCount > 0
              ? `${safetyReport.violationCount} Limit Exceeded`
              : safetyReport.hasMissingData
              ? 'Manual Check Req.'
              : 'Within Limits'}
          </div>
        </div>
      </div>

      {/* Olfactory Facet Spider / Radar Chart — Target vs Current Formulation */}
      <FormulaFacetRadarChart
        formulaName={activeFormula.name}
        versionLabel={currentVersion?.versionLabel || 'V5'}
        radarResult={radarComparison}
        targetFacets={workingTargetFacets}
        includeAllCoreFacets={includeAllCoreFacets}
        onToggleIncludeAllCoreFacets={setIncludeAllCoreFacets}
        onUpdateTargetFacet={(facet, newScore) =>
          setWorkingTargetFacets((prev) => ({
            ...prev,
            [facet]: newScore,
          }))
        }
        onResetTargetFacets={() =>
          setWorkingTargetFacets(
            activeFormula.targetFacets || { Green: 7, Woody: 6, Citrus: 5, Musky: 5 }
          )
        }
      />

      {/* Real-Time Formula Cost & Multi-Currency Batch Valuation Calculator */}
      <div
        data-testid="formula-cost-calculator"
        className="rounded-lg bg-[#111621] border border-slate-800 p-3.5 sm:p-5 space-y-4 overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">
                Real-Time Formula Cost & Bottle Valuation Calculator
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Estimates total concentrate and flacon cost dynamically from ingredient weights. Supports USD, IRR (Rial / Toman), EUR, GBP, AED, and CHF.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Currency Segmented Selector */}
            <div className="grid grid-cols-6 sm:flex items-center gap-1 p-1 bg-[#0B0E14] border border-slate-800 rounded-md w-full sm:w-auto">
              {SUPPORTED_CURRENCIES.map((curr) => (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() =>
                    onUpdateCurrencySettings?.({
                      ...currencySettings,
                      activeCurrency: curr.code,
                    })
                  }
                  className={`px-2 py-1.5 sm:py-1 text-xs font-mono-tabular rounded transition-colors text-center whitespace-nowrap shrink-0 ${
                    currencySettings.activeCurrency === curr.code
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {curr.code}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {onSyncLiveExchangeRates && (
                <button
                  type="button"
                  disabled={isSyncingRates}
                  onClick={() => onSyncLiveExchangeRates('market')}
                  className="flex-1 sm:flex-initial justify-center px-3 py-1.5 bg-[#0B0E14] border border-slate-800 hover:border-emerald-500/60 text-xs text-emerald-400 rounded-md flex items-center whitespace-nowrap shrink-0 transition-colors"
                >
                  {isSyncingRates ? 'Syncing FX...' : 'Sync Live FX'}
                </button>
              )}

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex-1 sm:flex-initial justify-center px-3 py-1.5 bg-[#0B0E14] border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    1 USD ={' '}
                    {getExchangeRateForCurrency(
                      currencySettings,
                      currencySettings.activeCurrency === 'USD'
                        ? 'IRR'
                        : currencySettings.activeCurrency
                    ).toLocaleString('en-US')}{' '}
                    {currencySettings.activeCurrency === 'USD'
                      ? 'IRR'
                      : currencySettings.activeCurrency}{' '}
                    (Settings)
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCostCalculator((prev) => !prev)}
                className="w-full sm:w-auto justify-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-md flex items-center whitespace-nowrap shrink-0"
              >
                {showCostCalculator ? 'Compact View' : 'Expand Calculator'}
              </button>
            </div>
          </div>
        </div>

        {showCostCalculator && (
          <div className="space-y-4 text-xs">
            {/* Calculator Controls Row: Target Formula Weight, Finished Bottle Size, Carrier Cost */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#0B0E14] border border-slate-800 rounded-lg p-3.5">
              <div>
                <label
                  htmlFor="calc-batch-weight-input"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Target Formula Weight (g)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="calc-batch-weight-input"
                    type="number"
                    min={1}
                    step={5}
                    value={roundDecimal(effectiveBatchWeightGrams, 2)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isNaN(val) && val > 0) {
                        handleScaleBatch(val);
                      }
                    }}
                    className="w-full bg-[#111621] border border-slate-700 rounded px-2.5 py-1.5 font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-400 font-mono-tabular">g</span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="calc-bottle-size-select"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Finished Bottle Volume & Conc.
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    id="calc-bottle-size-select"
                    value={bottleSizeMl}
                    onChange={(e) => setBottleSizeMl(Number(e.target.value))}
                    className="w-full bg-[#111621] border border-slate-700 rounded px-2 py-1.5 font-mono-tabular text-white"
                  >
                    <option value={15}>15 ml Travel</option>
                    <option value={30}>30 ml Flacon</option>
                    <option value={50}>50 ml Standard</option>
                    <option value={100}>100 ml Atelier</option>
                  </select>
                  <span className="text-slate-400 font-mono-tabular whitespace-nowrap">
                    {finalConc !== null ? `@ ${finalConc}%` : '(Conc. Unset)'}
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="calc-carrier-cost-input"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Ethanol / Carrier Cost (USD/g)
                </label>
                <input
                  id="calc-carrier-cost-input"
                  type="number"
                  min={0}
                  step={0.005}
                  value={carrierCostPerGramUsd}
                  onChange={(e) =>
                    setCarrierCostPerGramUsd(
                      Math.max(0, parseFloat(e.target.value) || 0)
                    )
                  }
                  className="w-full bg-[#111621] border border-slate-700 rounded px-2.5 py-1.5 font-mono-tabular text-white"
                />
              </div>
            </div>

            {/* 4 Valuation Output Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400">
                  Total Concentrate Batch Price ({effectiveBatchWeightGrams.toFixed(1)} g)
                </div>
                <div className="text-base font-mono-tabular font-semibold text-emerald-400">
                  {formatCurrencyAmount(
                    realTimeCostSummary.totalBatchCostUsd,
                    currencySettings,
                    { includeTomanHint: true }
                  )}
                </div>
                {currencySettings.activeCurrency !== 'USD' && (
                  <div className="text-[11px] font-mono-tabular text-slate-400">
                    Base USD: ${realTimeCostSummary.totalBatchCostUsd.toFixed(2)}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400">
                  Unit Concentrate Cost (/g & /kg)
                </div>
                <div className="text-base font-mono-tabular font-semibold text-white">
                  {formatCurrencyAmount(
                    realTimeCostSummary.costPerGramUsd,
                    currencySettings,
                    { unitDecimals: true }
                  )}{' '}
                  <span className="text-xs text-slate-400">/ g</span>
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-400">
                  Per 1 kg:{' '}
                  {formatCurrencyAmount(
                    realTimeCostSummary.costPerKgUsd,
                    currencySettings
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400">
                  Finished {bottleSizeMl}ml Bottle Liquid Cost ({finalConc !== null ? `${finalConc}% Conc.` : 'Conc. Unset'})
                </div>
                <div className="text-base font-mono-tabular font-semibold text-white">
                  {formatCurrencyAmount(
                    realTimeCostSummary.totalLiquidCostPerBottleUsd,
                    currencySettings,
                    { includeTomanHint: true }
                  )}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-400">
                  {realTimeCostSummary.concentrateGramsPerBottle}g oil +{' '}
                  {realTimeCostSummary.carrierGramsPerBottle}g ethanol (~
                  {realTimeCostSummary.estimatedBottlesFromBatch} bottles yield)
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400">
                  Top Cost Driver in Formula
                </div>
                {realTimeCostSummary.topCostDrivers[0] ? (
                  <>
                    <div className="text-sm font-semibold text-white truncate">
                      {realTimeCostSummary.topCostDrivers[0].name}
                    </div>
                    <div className="text-[11px] font-mono-tabular text-amber-400">
                      {realTimeCostSummary.topCostDrivers[0].costSharePercent.toFixed(1)}%
                      of batch cost (
                      {formatCurrencyAmount(
                        realTimeCostSummary.topCostDrivers[0].lineTotalCostUsd,
                        currencySettings
                      )}
                      )
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-400">No ingredients</div>
                )}
              </div>
            </div>

            {/* Top 5 Most Expensive Raw Materials — Cost Distribution Breakdown Chart */}
            <div
              data-testid="top5-cost-breakdown-chart"
              className="pt-4 border-t border-slate-800/80 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-white">
                    Top 5 Most Expensive Raw Materials — Cost Distribution
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Proportional batch cost concentration across the highest-value materials for{' '}
                    <span className="font-mono-tabular text-slate-300">
                      {effectiveBatchWeightGrams.toFixed(1)} g
                    </span>{' '}
                    batch ({currencySettings.activeCurrency})
                  </p>
                </div>
                {topCostDistribution.topItems.length > 0 && (
                  <div className="text-[11px] font-mono-tabular text-slate-300 shrink-0">
                    Top {topCostDistribution.topItems.length} share:{' '}
                    <span className="text-amber-400 font-semibold">
                      {topCostDistribution.topItemsTotalSharePercent.toFixed(1)}%
                    </span>{' '}
                    ({formatCurrencyAmount(topCostDistribution.topItemsTotalCostUsd, currencySettings)})
                    {topCostDistribution.remainingCount > 0 && (
                      <>
                        {' · '}Remaining {topCostDistribution.remainingCount}:{' '}
                        <span className="text-slate-400">
                          {topCostDistribution.remainingSharePercent.toFixed(1)}%
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {topCostDistribution.topItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  Add raw materials to the formula to visualize top cost drivers.
                </div>
              ) : (
                <>
                  {/* Stacked 100% Cost Concentration Bar */}
                  <div className="space-y-1.5">
                    <div
                      className="h-2.5 w-full rounded-md bg-[#0B0E14] border border-slate-800 overflow-hidden flex"
                      role="img"
                      aria-label="Stacked cost distribution bar for top 5 raw materials"
                    >
                      {topCostDistribution.topItems.map((slice, idx) => {
                        const segmentColors = [
                          'bg-amber-500',
                          'bg-amber-400/85',
                          'bg-teal-400/85',
                          'bg-sky-400/85',
                          'bg-indigo-400/85',
                        ];
                        const colorClass = segmentColors[idx] || 'bg-amber-500';
                        return (
                          <div
                            key={slice.lineId}
                            style={{ width: `${Math.max(slice.costSharePercent, 1.5)}%` }}
                            className={`${colorClass} h-full border-r border-[#0B0E14] last:border-r-0 transition-opacity hover:opacity-90`}
                            title={`#${slice.rank} ${slice.name}: ${slice.costSharePercent.toFixed(1)}% (${formatCurrencyAmount(slice.lineTotalCostUsd, currencySettings)})`}
                          />
                        );
                      })}
                      {topCostDistribution.remainingCount > 0 &&
                        topCostDistribution.remainingSharePercent > 0 && (
                          <div
                            style={{
                              width: `${Math.max(topCostDistribution.remainingSharePercent, 1.5)}%`,
                            }}
                            className="bg-slate-700 h-full"
                            title={`Remaining ${topCostDistribution.remainingCount} materials: ${topCostDistribution.remainingSharePercent.toFixed(1)}% (${formatCurrencyAmount(topCostDistribution.remainingCostUsd, currencySettings)})`}
                          />
                        )}
                    </div>

                    {/* Compact Legend */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                      {topCostDistribution.topItems.map((slice, idx) => {
                        const textColors = [
                          'text-amber-400',
                          'text-amber-300',
                          'text-teal-300',
                          'text-sky-300',
                          'text-indigo-300',
                        ];
                        return (
                          <span key={slice.lineId} className="font-mono-tabular">
                            <span className={`font-semibold ${textColors[idx] || 'text-amber-400'}`}>
                              0{slice.rank}.
                            </span>{' '}
                            <span className="text-slate-300">{slice.name}</span>{' '}
                            <span>({slice.costSharePercent.toFixed(1)}%)</span>
                          </span>
                        );
                      })}
                      {topCostDistribution.remainingCount > 0 && (
                        <span className="font-mono-tabular text-slate-400">
                          Other ({topCostDistribution.remainingCount} items ·{' '}
                          {topCostDistribution.remainingSharePercent.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ranked 1-5 Horizontal Breakdown Rows */}
                  <div className="divide-y divide-slate-800/70 border-t border-slate-800/70">
                    {topCostDistribution.topItems.map((slice, idx) => {
                      const barColors = [
                        'bg-amber-500/85',
                        'bg-amber-400/75',
                        'bg-teal-400/75',
                        'bg-sky-400/75',
                        'bg-indigo-400/75',
                      ];
                      const barColor = barColors[idx] || 'bg-amber-500/80';

                      return (
                        <div
                          key={slice.lineId}
                          data-testid={`top-cost-driver-row-${slice.rank}`}
                          className="py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 hover:bg-slate-900/40 transition-colors"
                        >
                          {/* Left: Rank + Material Name + Lot/Weight metadata */}
                          <div className="min-w-0 md:w-80 shrink-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono-tabular text-slate-400 font-semibold shrink-0">
                                0{slice.rank}.
                              </span>
                              {slice.materialId ? (
                                <button
                                  type="button"
                                  onClick={() => onInspectMaterial(slice.materialId!)}
                                  className="font-medium text-white hover:text-amber-300 transition-colors truncate text-left"
                                >
                                  {slice.name}
                                </button>
                              ) : (
                                <span className="font-medium text-white truncate">
                                  {slice.name}
                                </span>
                              )}
                            </div>
                            <div className="pl-6 text-[11px] font-mono-tabular text-slate-400 truncate">
                              <span>{slice.batchWeightGrams.toFixed(2)} g</span>
                              <span aria-hidden="true"> · </span>
                              <span>
                                {formatCurrencyAmount(
                                  slice.unitCostPerGramUsd,
                                  currencySettings,
                                  { unitDecimals: true }
                                )}
                                /g
                              </span>
                            </div>
                          </div>

                          {/* Middle: Proportional Horizontal Cost Bar */}
                          <div className="flex-1 flex items-center gap-3">
                            <div className="flex-1 h-2 rounded bg-[#0B0E14] border border-slate-800/90 overflow-hidden">
                              <div
                                className={`h-full ${barColor} rounded-r`}
                                style={{
                                  width: `${Math.max(slice.relativeToMaxPercent, 2)}%`,
                                }}
                              />
                            </div>
                            <span className="w-14 text-right font-mono-tabular text-xs font-semibold text-amber-300 shrink-0">
                              {slice.costSharePercent.toFixed(1)}%
                            </span>
                          </div>

                          {/* Right: Formatted Line Total Cost in Active Currency */}
                          <div className="md:w-56 text-right font-mono-tabular shrink-0">
                            <div className="text-xs font-semibold text-white whitespace-nowrap">
                              {formatCurrencyAmount(
                                slice.lineTotalCostUsd,
                                currencySettings
                              )}
                            </div>
                            {currencySettings.activeCurrency !== 'USD' && (
                              <div className="text-[10px] text-slate-400 whitespace-nowrap">
                                {currencySettings.activeCurrency === 'IRR' &&
                                  currencySettings.showTomanHelper && (
                                    <>
                                      {Math.round(
                                        (slice.lineTotalCostUsd *
                                          currencySettings.usdToIrrRate) /
                                          10
                                      ).toLocaleString('en-US')}{' '}
                                      Toman ·{' '}
                                    </>
                                  )}
                                ${slice.lineTotalCostUsd.toFixed(2)} USD
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Validation Alerts */}
      {validationIssues.length > 0 && (
        <div className="rounded-lg bg-amber-950/40 border border-amber-700/60 p-3.5 space-y-1">
          {validationIssues.map((iss, idx) => (
            <div key={idx} className="text-xs text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{iss.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Real-Time IFRA Cumulative Safety Monitor */}
      {safetyEnabled && (
        <div
          data-testid="realtime-safety-monitor"
          className={`rounded-lg border p-3.5 sm:p-4 space-y-4 transition-colors overflow-hidden ${
            safetyReport.violationCount > 0
              ? 'bg-rose-950/25 border-rose-500/60'
              : 'bg-[#111621] border-slate-800'
          }`}
        >
          {/* Header & Interactive Controls */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck
                  className={`w-4 h-4 shrink-0 ${
                    safetyReport.violationCount > 0
                      ? 'text-rose-400'
                      : !hasValidSafetyContext || safetyReport.complianceState === 'INDETERMINATE'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                />
                <h2 className="text-sm font-semibold text-white">
                  Real-Time IFRA Cumulative Safety Monitor
                </h2>
                {!hasValidSafetyContext ? (
                  <span
                    data-testid="safety-indeterminate-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/50 text-amber-300 text-[11px] font-mono-tabular font-semibold uppercase"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>INDETERMINATE · Regulatory Context Required</span>
                  </span>
                ) : safetyReport.violationCount > 0 ? (
                  <span
                    data-testid="safety-risk-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-semibold tracking-wide uppercase shadow-sm"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>Safety Risk · {safetyReport.violationCount} Exceeded</span>
                  </span>
                ) : safetyReport.complianceState === 'INDETERMINATE' ? (
                  <span
                    data-testid="safety-indeterminate-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-amber-300 text-[11px] font-mono-tabular font-semibold"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>INDETERMINATE · Lookup / Verification Required</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono-tabular font-medium">
                    <Check className="w-3 h-3 shrink-0" />
                    <span>Within IFRA Category Thresholds</span>
                  </span>
                )}
                {safetyReport.cumulativeMultiSourceCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-[#0B0E14] border border-slate-700 text-[11px] font-mono-tabular text-amber-300">
                    {safetyReport.cumulativeMultiSourceCount} Multi-Source (Direct + Accord)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Continuously aggregates cumulative active concentrations across direct formula lines and nested accords against imported regulatory limits.
              </p>
            </div>

            {/* Category Selector, Final Product Concentration & Regulatory Limit Import */}
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full xl:w-auto text-xs">
              <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-[#0B0E14] border border-slate-800 rounded-md px-2.5 py-1.5 sm:py-1">
                <label
                  htmlFor="safety-monitor-ifra-category"
                  className="text-[11px] text-slate-400 whitespace-nowrap"
                >
                  IFRA Category:
                </label>
                <select
                  id="safety-monitor-ifra-category"
                  data-testid="safety-monitor-category-select"
                  aria-label="IFRA Category Threshold"
                  value={selectedIfraCategory}
                  onChange={(e) => setSelectedIfraCategory(e.target.value)}
                  className="bg-transparent font-mono-tabular text-xs text-white focus:outline-none"
                >
                  <option value="" className="bg-[#111621] text-slate-400">
                    Select IFRA Category...
                  </option>
                  {IFRA_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.value} className="bg-[#111621] text-white">
                      {opt.shortLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-[#0B0E14] border border-slate-800 rounded-md px-2.5 py-1.5 sm:py-1">
                <label
                  htmlFor="safety-monitor-final-conc"
                  className="text-[11px] text-slate-400 whitespace-nowrap"
                >
                  Finished Conc:
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="safety-monitor-final-conc"
                    data-testid="safety-monitor-conc-input"
                    type="number"
                    min={0.01}
                    max={100}
                    step="any"
                    placeholder="—"
                    value={finalConc ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) {
                        setFinalConc(null);
                        return;
                      }
                      const num = Number(raw);
                      setFinalConc(
                        Number.isFinite(num) && num > 0 ? Math.min(100, num) : null
                      );
                    }}
                    className="w-14 bg-[#111621] border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono-tabular text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="font-mono-tabular text-slate-400">%</span>
                </div>
              </div>

              <button
                type="button"
                data-testid="safety-monitor-import-limit-btn"
                onClick={() => setShowImportLimitModal((prev) => !prev)}
                className="w-full sm:w-auto justify-center px-3 py-1.5 bg-[#0B0E14] border border-slate-800 hover:border-emerald-500/60 text-slate-200 hover:text-white rounded-md text-xs font-medium flex items-center transition-colors whitespace-nowrap shrink-0"
              >
                Import / Edit Limit
              </button>
            </div>
          </div>

          {!hasValidSafetyContext && (
            <div
              data-testid="safety-missing-context-banner"
              className="rounded-lg bg-slate-900/90 border border-amber-500/50 p-3.5 flex items-start gap-2.5 text-xs text-amber-200"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">
                  Safety Status: INDETERMINATE — Missing Regulatory Context
                </div>
                <p className="text-slate-300 mt-0.5 leading-relaxed">
                  Select an explicit IFRA Category and enter the Finished-Product Concentration (%) above to evaluate compliance. Safety is never calculated against assumed defaults.
                </p>
              </div>
            </div>
          )}

          {/* Inline Regulatory Limit Import / Override Drawer */}
          {showImportLimitModal && (
            <form
              onSubmit={handleApplyRegulatoryLimitOverride}
              data-testid="import-regulatory-limit-form"
              className="p-3.5 rounded-lg bg-[#0B0E14] border border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-xs"
            >
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Target Raw Material
                </label>
                <select
                  aria-label="Material for regulatory limit import"
                  value={limitOverrideMaterialId}
                  onChange={(e) => setLimitOverrideMaterialId(Number(e.target.value))}
                  className="w-full bg-[#111621] border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (CAS {m.casNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Max Allowed in Final Product (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  aria-label="Imported max allowed percent in final product"
                  value={limitOverrideMaxPct}
                  onChange={(e) => setLimitOverrideMaxPct(e.target.value)}
                  className="w-full bg-[#111621] border border-slate-700 rounded px-2.5 py-1.5 font-mono-tabular text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Regulatory Source / Dossier
                </label>
                <input
                  type="text"
                  value={limitOverrideSource}
                  onChange={(e) => setLimitOverrideSource(e.target.value)}
                  className="w-full bg-[#111621] border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  data-testid="apply-regulatory-limit-btn"
                  className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded transition-colors"
                >
                  Apply Limit
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportLimitModal(false)}
                  className="py-1.5 px-2.5 bg-slate-800 text-slate-300 rounded"
                >
                  Close
                </button>
              </div>
            </form>
          )}

          {/* Active Safety Risk Violations Alert Strip */}
          {safetyReport.safetyRiskEvaluations.length > 0 && (
            <div
              data-testid="safety-risk-alert-banner"
              className="rounded-lg bg-rose-950/50 border border-rose-500/70 p-3.5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    IFRA Regulatory Threshold Breach Detected in {selectedIfraCategory} (@ {finalConc}% Conc.)
                  </span>
                </div>
                <span className="text-[11px] font-mono-tabular text-rose-300">
                  Reduce offending material dosage or click Auto-Cap to comply
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {safetyReport.safetyRiskEvaluations.map((ev) => (
                  <div
                    key={ev.materialId}
                    data-testid={`safety-risk-card-${ev.materialId}`}
                    className="p-3 rounded-md bg-[#0B0E14]/90 border border-rose-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">
                          {ev.materialName}
                        </span>
                        <span
                          data-testid="safety-risk-badge"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-semibold uppercase tracking-wider"
                        >
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Safety Risk
                        </span>
                      </div>
                      <div className="text-[11px] font-mono-tabular text-rose-200">
                        Cumulative Final:{' '}
                        <strong>{ev.concentrationInFinalProduct.toFixed(4)}%</strong> vs
                        IFRA Limit:{' '}
                        <strong>{ev.maxAllowedPercentInFinalProduct?.toFixed(2)}%</strong>{' '}
                        (+{ev.excessPercentInFinalProduct.toFixed(4)}% over ·{' '}
                        {ev.utilizationPercentOfLimit?.toFixed(0)}% of max)
                      </div>
                      {ev.contributingSources.length > 1 && (
                        <div className="text-[10px] font-mono-tabular text-amber-300">
                          Cumulative sources: Direct ({ev.directActivePercentInConcentrate.toFixed(2)}% oil) + Accord ({ev.accordActivePercentInConcentrate.toFixed(2)}% oil)
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      data-testid={`auto-cap-material-${ev.materialId}`}
                      onClick={() => handleAutoCapMaterial(ev.materialId)}
                      className="w-full sm:w-auto justify-center px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-medium rounded flex items-center transition-colors whitespace-nowrap shrink-0"
                    >
                      Auto-Cap to Limit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Cumulative Concentration Progress Strip for Restricted Materials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {safetyReport.evaluations
              .slice()
              .sort((a, b) => {
                if (a.isSafetyRisk !== b.isSafetyRisk) return a.isSafetyRisk ? -1 : 1;
                return (
                  (b.utilizationPercentOfLimit ?? -1) -
                  (a.utilizationPercentOfLimit ?? -1)
                );
              })
              .slice(0, 8)
              .map((ev) => {
                const utilPct = ev.utilizationPercentOfLimit ?? 0;
                const barWidth = Math.min(100, Math.max(2, utilPct));
                return (
                  <div
                    key={ev.materialId}
                    data-testid={`safety-monitor-item-${ev.materialId}`}
                    className={`p-2.5 rounded-md bg-[#0B0E14] border text-xs space-y-1.5 ${
                      ev.isSafetyRisk
                        ? 'border-rose-500/70'
                        : ev.status === 'Approaching limit'
                        ? 'border-amber-500/50'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-medium text-white truncate">
                        {ev.materialName}
                      </span>
                      {ev.isSafetyRisk ? (
                        <span
                          data-testid="safety-risk-badge"
                          className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-semibold uppercase tracking-wider shrink-0"
                        >
                          Safety Risk
                        </span>
                      ) : ev.status === 'Approaching limit' ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-medium shrink-0">
                          Approaching
                        </span>
                      ) : ev.status === 'Safety information unavailable' ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px] font-medium shrink-0">
                          Unverified
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-mono-tabular shrink-0">
                          {utilPct.toFixed(0)}% of max
                        </span>
                      )}
                    </div>

                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          ev.isSafetyRisk
                            ? 'bg-rose-500'
                            : ev.status === 'Approaching limit'
                            ? 'bg-amber-400'
                            : ev.status === 'Safety information unavailable'
                            ? 'bg-slate-600'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${
                            ev.maxAllowedPercentInFinalProduct !== null ? barWidth : 15
                          }%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
                      <span>Final: {ev.concentrationInFinalProduct.toFixed(3)}%</span>
                      <span>
                        {ev.maxAllowedPercentInFinalProduct !== null
                          ? `Max: ${ev.maxAllowedPercentInFinalProduct.toFixed(2)}%`
                          : 'No stored limit'}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Batch Scaling & Normalization Controls */}
      <div className="rounded-lg bg-[#111621] border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5 mr-1">
            <Scale className="w-3.5 h-3.5 text-emerald-400" />
            Scale Batch:
          </span>
          {BATCH_SCALE_PRESETS.map((wt) => (
            <button
              key={wt}
              type="button"
              onClick={() => handleScaleBatch(wt)}
              className={`px-2.5 py-1 text-xs font-mono-tabular rounded transition-colors whitespace-nowrap shrink-0 ${
                Math.abs(metrics.totalWeightGrams - wt) < 0.05
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-[#0B0E14] border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {wt === 1000 ? '1 kg' : `${wt} g`}
            </button>
          ))}
          <button
            type="button"
            onClick={handleNormalize}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-emerald-300 rounded transition-colors whitespace-nowrap shrink-0"
          >
            Normalize to 100%
          </button>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setShowExpandedAccords((prev) => !prev)}
            className={`justify-center px-3 py-2 sm:py-1.5 text-xs font-medium rounded border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              showExpandedAccords
                ? 'bg-emerald-950/70 border-emerald-600 text-emerald-200'
                : 'bg-[#0B0E14] border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>{showExpandedAccords ? 'Showing Expanded Accords' : 'Expand Nested Accords'}</span>
          </button>
        </div>
      </div>

      {/* Formula Ingredient Editor Table */}
      <div className="rounded-lg bg-[#111621] border border-slate-800 overflow-hidden w-full max-w-full">
        <div className="overflow-x-auto w-full max-w-full overscroll-x-contain">
          <table className="w-full min-w-[740px] text-left border-collapse">
            <thead>
            <tr className="border-b border-slate-800 text-[11px] text-slate-400">
              <th className="py-2.5 px-2.5 xl:px-3 font-medium">#</th>
              <th className="py-2.5 px-2.5 xl:px-3 font-medium">Raw Material / Accord</th>
              <th className="py-2.5 px-2.5 xl:px-3 font-medium text-right whitespace-nowrap">
                Quantity (g{activeMassUnit !== 'g' ? ` · ${activeUnitLabel}` : ''})
              </th>
              <th className="py-2.5 px-2.5 xl:px-3 font-medium text-right whitespace-nowrap">Formula %</th>
              <th className="py-2.5 px-2.5 xl:px-3 font-medium text-right whitespace-nowrap">Dilution</th>
              <th className="py-2.5 px-2.5 xl:px-3 font-medium text-right whitespace-nowrap">Active Equiv %</th>
              <th className="py-2.5 px-2.5 xl:px-3 font-medium text-right whitespace-nowrap">
                Line Cost ({currencySettings.activeCurrency})
              </th>
              <th className="py-2.5 px-2.5 xl:px-3 font-medium whitespace-nowrap">Olfactory Role / Notes</th>
              <th className="py-2.5 px-2.5 font-medium text-right">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-xs">
            {metrics.items.length === 0 && (
              <tr data-testid="empty-formula-items-row">
                <td colSpan={9} className="py-6 px-4 text-center text-slate-400 text-xs">
                  No ingredients added yet — select a raw material from My Shelf or the Catalog below to begin composing.
                </td>
              </tr>
            )}
            {metrics.items.map((item, idx) => {
              const costLine = realTimeCostSummary.lines.find(
                (c) => c.lineId === item.id
              );
              const materialObj = item.materialId
                ? materials.find((m) => m.id === item.materialId)
                : undefined;
              const isMissingFromShelf = Boolean(
                materialObj &&
                  (materialObj.isOnShelf !== undefined
                    ? materialObj.isOnShelf === false
                    : materialObj.isOnWorkbench === false)
              );
              const ownedAlternatives = isMissingFromShelf
                ? materials.filter(
                    (m) =>
                      m.id !== materialObj!.id &&
                      (m.isOnShelf !== undefined ? m.isOnShelf : m.isOnWorkbench !== false) &&
                      (m.primaryFamily === materialObj!.primaryFamily ||
                        m.volatility === materialObj!.volatility)
                  )
                : [];
              const materialSafety = item.materialId
                ? safetyByMaterialId.get(item.materialId)
                : undefined;
              const accordRiskEvaluations =
                item.type === 'accord'
                  ? safetyReport.safetyRiskEvaluations.filter((ev) =>
                      ev.sourceLineIds.includes(item.id)
                    )
                  : [];
              const rowHasSafetyRisk =
                Boolean(materialSafety?.isSafetyRisk) ||
                accordRiskEvaluations.length > 0;
              const utilPct = materialSafety?.utilizationPercentOfLimit ?? null;

              return (
                <tr
                  key={item.id}
                  className={
                    rowHasSafetyRisk
                      ? 'bg-rose-950/20 hover:bg-rose-950/30'
                      : 'hover:bg-slate-800/30'
                  }
                >
                  <td className="py-2.5 px-2.5 xl:px-3 font-mono-tabular text-slate-500">
                    {String(idx + 1).padStart(2, '0')}
                  </td>
                  <td className="py-2.5 px-2.5 xl:px-3 min-w-[165px] max-w-[260px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.materialId ? (
                          <button
                            type="button"
                            onClick={() => onInspectMaterial(item.materialId!)}
                            className="font-semibold text-white hover:text-emerald-400 text-left transition-colors"
                          >
                            {item.name}
                          </button>
                        ) : (
                          <span className="font-semibold text-emerald-300">
                            [Accord] {item.name}
                          </span>
                        )}

                        {/* Catalog -> My Shelf -> Current Workbench -> Formula Check */}
                        {isMissingFromShelf && materialObj && (
                          <div className="inline-flex flex-wrap items-center gap-1 relative">
                            <span
                              data-testid="not-on-workbench-badge"
                              className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/60 text-amber-300 text-[10px] font-medium whitespace-nowrap"
                            >
                              Not on My Shelf
                            </span>
                            {onAddToShelf && (
                              <button
                                type="button"
                                data-testid={`add-to-shelf-from-formula-${materialObj.id}`}
                                onClick={() => onAddToShelf(materialObj.id)}
                                className="px-1.5 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-900/70 border border-cyan-600/60 text-cyan-300 text-[10px] font-medium whitespace-nowrap transition-colors"
                              >
                                + Add to My Shelf
                              </button>
                            )}
                            {ownedAlternatives.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setAltSwapOpenLineId((prev) =>
                                    prev === item.id ? null : item.id
                                  )
                                }
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-[10px] font-medium whitespace-nowrap transition-colors"
                              >
                                Find Owned Alt ({ownedAlternatives.length})
                              </button>
                            )}
                            {altSwapOpenLineId === item.id && ownedAlternatives.length > 0 && (
                              <div className="absolute left-0 top-full mt-1 z-30 w-64 rounded-lg bg-[#0B0E14] border border-slate-700 shadow-2xl p-2 space-y-1 text-[11px]">
                                <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                                  <span>Owned Alternatives on My Shelf</span>
                                  <button
                                    type="button"
                                    onClick={() => setAltSwapOpenLineId(null)}
                                    className="text-slate-400 hover:text-white"
                                  >
                                    ×
                                  </button>
                                </div>
                                {ownedAlternatives.slice(0, 5).map((alt) => (
                                  <button
                                    key={alt.id}
                                    type="button"
                                    onClick={() => handleSwapMaterialForLine(item.id, alt)}
                                    className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800/80 flex items-center justify-between gap-2 text-slate-200"
                                  >
                                    <span className="truncate font-medium">{alt.name}</span>
                                    <span className="text-[10px] text-emerald-400 shrink-0">
                                      Swap →
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {safetyEnabled &&
                          materialSafety &&
                          materialSafety.maxAllowedPercentInFinalProduct === null && (
                            <span
                              data-testid="lookup-required-badge"
                              className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-700/90 border border-slate-500 text-slate-200 text-[10px] font-mono-tabular font-semibold shrink-0"
                            >
                              LOOKUP_REQUIRED
                            </span>
                          )}

                        {safetyEnabled &&
                          !materialSafety?.isSafetyRisk &&
                          utilPct !== null &&
                          utilPct >= 50 && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono-tabular shrink-0 ${
                                utilPct > 80
                                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                                  : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                              }`}
                            >
                              {utilPct.toFixed(0)}% IFRA
                            </span>
                          )}
                      </div>

                      {/* Dedicated Safety Risk Badges on their own row, constrained to cell bounds */}
                      {safetyEnabled && materialSafety?.isSafetyRisk && (
                        <div className="w-full">
                          <span
                            data-testid="safety-risk-badge"
                            title={`Cumulative final concentration ${materialSafety.concentrationInFinalProduct.toFixed(4)}% exceeds IFRA ${selectedIfraCategory} limit of ${materialSafety.maxAllowedPercentInFinalProduct}%`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-semibold uppercase tracking-wider max-w-full"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span>Safety Risk (IFRA Limit Exceeded)</span>
                          </span>
                        </div>
                      )}

                      {safetyEnabled && accordRiskEvaluations.length > 0 && (
                        <div className="w-full">
                          <span
                            data-testid="safety-risk-badge"
                            title={`Accord contributes to IFRA threshold breach for: ${accordRiskEvaluations.map((e) => e.materialName).join(', ')}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-semibold uppercase tracking-wider max-w-full truncate"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">
                              Safety Risk ({accordRiskEvaluations.map((e) => e.materialName).join(', ')})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 xl:px-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Quantity in grams for ${item.name}`}
                        value={item.quantityGrams}
                        disabled={showExpandedAccords}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-20 text-right bg-[#0B0E14] border border-slate-800 rounded px-2 py-1 font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                      />
                      {activeMassUnit !== 'g' && (
                        <span className="text-[10px] font-mono-tabular text-emerald-400 whitespace-nowrap">
                          {convertGramsToUnit(
                            item.quantityGrams,
                            activeMassUnit,
                            perfumeDensityGPerMl,
                            activeMassUnit === 'ml' ? 2 : 3
                          ).toFixed(activeMassUnit === 'ml' ? 2 : 3)}{' '}
                          {activeUnitLabel}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 xl:px-3 text-right font-mono-tabular font-semibold text-emerald-400 whitespace-nowrap">
                    {item.normalizedPercentage.toFixed(3)}%
                  </td>
                  <td className="py-2.5 px-2.5 xl:px-3 text-right whitespace-nowrap">
                    <select
                      aria-label={`Dilution for ${item.name}`}
                      value={item.dilutionPercent}
                      disabled={showExpandedAccords}
                      onChange={(e) =>
                        handleDilutionChange(item.id, Number(e.target.value))
                      }
                      className="bg-[#0B0E14] border border-slate-800 rounded px-1.5 py-1 font-mono-tabular text-xs text-slate-200"
                    >
                      <option value={100}>100% Neat</option>
                      <option value={50}>50% Sol.</option>
                      <option value={20}>20% Sol.</option>
                      <option value={10}>10% in {item.solvent === 'Neat' ? 'Ethanol' : item.solvent}</option>
                      <option value={1}>1% Trace</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-2.5 xl:px-3 text-right font-mono-tabular text-slate-300 whitespace-nowrap">
                    <div>{item.activeMaterialPercentOfTotal.toFixed(3)}%</div>
                    {safetyEnabled && materialSafety && (
                      <div
                        className={`text-[10px] whitespace-nowrap ${
                          materialSafety.isSafetyRisk || (utilPct !== null && utilPct > 80)
                            ? 'text-rose-400 font-semibold'
                            : utilPct !== null && utilPct >= 50
                            ? 'text-amber-400'
                            : materialSafety.maxAllowedPercentInFinalProduct === null
                            ? 'text-slate-400'
                            : 'text-emerald-400/90'
                        }`}
                      >
                        Final: {materialSafety.concentrationInFinalProduct.toFixed(3)}%
                        {materialSafety.maxAllowedPercentInFinalProduct !== null
                          ? ` / ${materialSafety.maxAllowedPercentInFinalProduct.toFixed(2)}%`
                          : ' · LOOKUP_REQ'}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-2.5 xl:px-3 text-right font-mono-tabular whitespace-nowrap">
                    <div className="font-semibold text-white">
                      {formatCurrencyAmount(
                        costLine ? costLine.lineTotalCostUsd : item.lineCost,
                        currencySettings
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 whitespace-nowrap">
                      {costLine ? `${costLine.costSharePercent.toFixed(1)}% of formula` : ''}
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 xl:px-3 text-slate-400 max-w-[165px]">
                    {item.notes ? (
                      <div className="group relative flex items-center">
                        <span
                          tabIndex={0}
                          title={item.notes}
                          className="truncate block max-w-[155px] cursor-help border-b border-dotted border-slate-700 focus:outline-none"
                        >
                          {item.notes}
                        </span>
                        <div
                          role="tooltip"
                          className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-1.5 z-30 w-64 p-2.5 rounded-lg bg-[#0B0E14] border border-slate-700 text-[11px] text-slate-100 shadow-2xl whitespace-normal leading-relaxed"
                        >
                          {item.notes}
                        </div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2.5 px-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteLine(item.id)}
                      aria-label={`Remove ${item.name}`}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* Add Ingredient / Accord Row (Enforcing Catalog -> My Workbench -> Formula) — Stationary outside horizontal table scroll */}
        <div
          data-testid="formula-add-ingredient-bar"
          className="p-3.5 sm:p-4 bg-[#0B0E14]/90 border-t border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full max-w-full"
        >
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto min-w-0">
            <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 min-w-0">
              <select
                aria-label="Select Raw Material to Add"
                value={addMaterialId}
                onChange={(e) => setAddMaterialId(Number(e.target.value))}
                className="flex-1 min-w-0 bg-[#111621] border border-slate-800 rounded-md px-3 py-2 sm:py-1.5 text-xs text-white truncate max-w-full"
              >
                <optgroup label="Current Workbench (Pinned Bench Ingredients)">
                  {materials
                    .filter((m) => m.isOnWorkbench !== false)
                    .map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#111622] text-slate-100">
                        {m.name} ({m.primaryFamily} · {m.volatility})
                      </option>
                    ))}
                </optgroup>
                {materials.some(
                  (m) =>
                    (m.isOnShelf !== undefined ? m.isOnShelf : m.isOnWorkbench !== false) &&
                    m.isOnWorkbench === false
                ) && (
                  <optgroup label="My Shelf (Owned Ingredients)">
                    {materials
                      .filter(
                        (m) =>
                          (m.isOnShelf !== undefined ? m.isOnShelf : m.isOnWorkbench !== false) &&
                          m.isOnWorkbench === false
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#111622] text-cyan-200">
                          [My Shelf] {m.name} ({m.primaryFamily} · {m.volatility})
                        </option>
                      ))}
                  </optgroup>
                )}
                {materials.some((m) =>
                  m.isOnShelf !== undefined ? m.isOnShelf === false : m.isOnWorkbench === false
                ) && (
                  <optgroup label="Entire Catalog (Not on My Shelf)">
                    {materials
                      .filter((m) =>
                        m.isOnShelf !== undefined ? m.isOnShelf === false : m.isOnWorkbench === false
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#111622] text-amber-300">
                          [Not on My Shelf] {m.name} ({m.primaryFamily})
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  step="0.1"
                  min="0.01"
                  aria-label="Grams to add"
                  value={addQuantityGrams}
                  onChange={(e) => setAddQuantityGrams(e.target.value)}
                  className="w-20 bg-[#111621] border border-slate-800 rounded-md px-2.5 py-2 sm:py-1.5 text-xs font-mono-tabular text-white"
                />
                <span className="text-xs text-slate-400">g</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddMaterialLine}
              className="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Add Raw Material</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto min-w-0">
            <select
              aria-label="Select Nested Accord to Insert"
              value={addAccordId}
              onChange={(e) => setAddAccordId(Number(e.target.value))}
              className="w-full sm:w-auto sm:flex-1 min-w-0 bg-[#111621] border border-slate-800 rounded-md px-3 py-2 sm:py-1.5 text-xs text-white truncate max-w-full"
            >
              {accords.map((a) => (
                <option key={a.id} value={a.id} className="bg-[#111622] text-slate-100">
                  Accord: {a.name} ({a.category})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleInsertAccordLine}
              className="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Insert Nested Accord</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Analytical Sub-Panels: Version Comparison | Safety & IFRA Engine | Target Brief | Export */}
      <div className="rounded-lg bg-[#111621] border border-slate-800 p-3.5 sm:p-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-1.5 p-1 bg-[#0B0E14] border border-slate-800 rounded-lg w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setActiveBottomPanel('comparison')}
              className={`justify-center px-3 py-2 sm:py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeBottomPanel === 'comparison'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Formula Version Comparison</span>
            </button>
            {safetyEnabled && (
              <button
                type="button"
                onClick={() => setActiveBottomPanel('safety')}
                className={`justify-center px-3 py-2 sm:py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeBottomPanel === 'safety'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>IFRA Safety & Regulatory Engine</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveBottomPanel('brief')}
              className={`justify-center px-3 py-2 sm:py-1.5 text-xs font-medium rounded-md transition-colors flex items-center whitespace-nowrap shrink-0 ${
                activeBottomPanel === 'brief'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Target Brief & Architecture
            </button>
            <button
              type="button"
              onClick={() => setActiveBottomPanel('export')}
              className={`justify-center px-3 py-2 sm:py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeBottomPanel === 'export'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>Export & Worksheet</span>
            </button>
          </div>
        </div>

        {/* Sub-Panel 1: Version Comparison (Responsive Mobile Layout without Horizontal Clipping) */}
        {activeBottomPanel === 'comparison' && (
          <div className="space-y-4 w-full max-w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full max-w-full min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs w-full sm:w-auto min-w-0">
                <span className="text-slate-400 font-medium whitespace-nowrap">Compare Versions:</span>
                <div className="grid grid-cols-[1fr_auto_1fr] sm:inline-flex items-center gap-1.5 p-1.5 rounded-md bg-[#0B0E14] border border-slate-800 w-full sm:w-auto min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[10px] text-slate-400 font-mono uppercase px-1 shrink-0">Base</span>
                    <select
                      aria-label="Compare Base Version"
                      value={compareV1Label}
                      onChange={(e) => setCompareV1Label(e.target.value)}
                      className="w-full min-w-0 bg-[#111621] border border-slate-700 rounded px-2 py-1 font-mono-tabular text-white text-xs truncate"
                    >
                      {activeFormula.versions.map((v) => (
                        <option key={v.id} value={v.versionLabel} className="bg-[#111622] text-white">
                          {v.versionLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-slate-500 font-medium px-1 text-xs text-center shrink-0">vs</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[10px] text-emerald-400/90 font-mono uppercase px-1 shrink-0">Target</span>
                    <select
                      aria-label="Compare Target Version"
                      value={compareV2Label}
                      onChange={(e) => setCompareV2Label(e.target.value)}
                      className="w-full min-w-0 bg-[#111621] border border-emerald-600/60 rounded px-2 py-1 font-mono-tabular text-emerald-400 font-semibold text-xs truncate"
                    >
                      {activeFormula.versions.map((v) => (
                        <option key={v.id} value={v.versionLabel} className="bg-[#111622] text-emerald-400">
                          {v.versionLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <span className="text-[11px] sm:text-xs text-slate-400">
                Highlighting compositional percentage deltas across versions
              </span>
            </div>

            <div className="overflow-x-auto rounded border border-slate-800 w-full max-w-full">
              <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0B0E14] text-[10px] sm:text-[11px] text-slate-400">
                    <th className="py-2.5 px-2 sm:px-4 font-medium">
                      Ingredient
                    </th>
                    <th className="py-2.5 px-1.5 sm:px-4 font-medium text-right whitespace-nowrap">{compareV1Label}</th>
                    <th className="py-2.5 px-1.5 sm:px-4 font-medium text-right whitespace-nowrap">{compareV2Label}</th>
                    <th className="py-2.5 px-1.5 sm:px-4 font-medium text-right whitespace-nowrap">Change</th>
                    <th className="py-2.5 px-2 sm:px-4 font-medium whitespace-nowrap">
                      <span className="sm:hidden">Status</span>
                      <span className="hidden sm:inline">Modification Type</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {comparisonDiffs.map((diff) => (
                    <tr key={diff.name} className="hover:bg-slate-800/30">
                      <td className="py-2 px-2 sm:px-4 font-medium text-white break-words max-w-[125px] sm:max-w-none">
                        {diff.name}
                      </td>
                      <td className="py-2 px-1.5 sm:px-4 text-right font-mono-tabular text-slate-300 whitespace-nowrap">
                        {diff.v1Percent.toFixed(2)}%
                      </td>
                      <td className="py-2 px-1.5 sm:px-4 text-right font-mono-tabular text-white whitespace-nowrap">
                        {diff.v2Percent.toFixed(2)}%
                      </td>
                      <td
                        className={`py-2 px-1.5 sm:px-4 text-right font-mono-tabular font-semibold whitespace-nowrap ${
                          diff.deltaPercent > 0
                            ? 'text-emerald-400'
                            : diff.deltaPercent < 0
                            ? 'text-amber-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {diff.deltaPercent === 0
                          ? '—'
                          : `${diff.deltaPercent > 0 ? '+' : ''}${diff.deltaPercent.toFixed(2)}%`}
                      </td>
                      <td className="py-2 px-2 sm:px-4 text-slate-400 capitalize whitespace-nowrap">
                        {diff.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sub-Panel 2: Dedicated Dual Regulatory Engine (IFRA + EU Cosmetics Regulation) */}
        {activeBottomPanel === 'safety' && (
          <div className="space-y-4 w-full max-w-full min-w-0">
            {/* Header with Dual Compliance Summary */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0B0E14] border border-slate-800 rounded-lg p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white">
                    Dual Regulatory Compliance: IFRA &amp; EU Cosmetics Regulation (EC 1223/2009)
                  </span>
                  <span
                    data-testid="formula-overall-compliance-state"
                    className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular font-semibold ${
                      safetyReport.complianceState === 'COMPLIANT'
                        ? 'bg-emerald-950/60 border border-emerald-600/50 text-emerald-300'
                        : safetyReport.complianceState === 'NON_COMPLIANT'
                        ? 'bg-rose-950/60 border border-rose-600/50 text-rose-300'
                        : 'bg-amber-950/60 border border-amber-600/50 text-amber-300'
                    }`}
                  >
                    Overall: {safetyReport.complianceState}
                  </span>
                  <span
                    data-testid="formula-ifra-compliance-state"
                    className="px-2 py-0.5 rounded text-[10px] font-mono-tabular font-semibold bg-sky-950/60 border border-sky-600/50 text-sky-300"
                  >
                    IFRA ({selectedIfraCategory || 'Unselected'}): {safetyReport.ifraComplianceState} ({safetyReport.violationCount} Violations · {safetyReport.indeterminateCount} Indeterminate)
                  </span>
                  <span
                    data-testid="formula-eu-compliance-state"
                    className="px-2 py-0.5 rounded text-[10px] font-mono-tabular font-semibold bg-emerald-950/60 border border-emerald-600/50 text-emerald-300"
                  >
                    EU Annex II/III: {safetyReport.euComplianceState} ({safetyReport.euViolationCount} Violations)
                  </span>
                  {safetyReport.euAllergenDeclarationCount !== undefined && safetyReport.euAllergenDeclarationCount > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono-tabular bg-amber-950/60 border border-amber-600/50 text-amber-300">
                      {safetyReport.euAllergenDeclarationCount} EU Declarable Allergens
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {safetyReport.disclaimer} · Taxonomy &amp; Olfactory Reference: ScenTree CC BY-NC 4.0
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs shrink-0">
                <label className="text-slate-400">Finished Product Conc %:</label>
                <input
                  type="number"
                  min={0.01}
                  max={100}
                  step="any"
                  placeholder="—"
                  value={finalConc ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) {
                      setFinalConc(null);
                      return;
                    }
                    const num = Number(raw);
                    setFinalConc(
                      Number.isFinite(num) && num > 0 ? Math.min(100, num) : null
                    );
                  }}
                  className="w-16 bg-[#111621] border border-slate-800 rounded px-2 py-1 font-mono-tabular text-white text-right"
                />
              </div>
            </div>

            {/* Comprehensive Dual Regulatory Table */}
            <div className="overflow-x-auto rounded border border-slate-800 w-full max-w-full overscroll-x-contain">
              <table className="w-full min-w-[780px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0B0E14] text-[11px] text-slate-400">
                    <th className="py-2.5 px-3 sm:px-4 font-medium">Material</th>
                    <th className="py-2.5 px-3 sm:px-4 font-medium text-right">Active in Oil</th>
                    <th className="py-2.5 px-3 sm:px-4 font-medium text-right">
                      Finished Product {finalConc !== null ? `@ ${finalConc}%` : '(Conc. Unset)'}
                    </th>
                    <th className="py-2.5 px-3 sm:px-4 font-medium text-right">
                      IFRA Limit ({selectedIfraCategory || 'Unselected'})
                    </th>
                    <th className="py-2.5 px-3 sm:px-4 font-medium text-right">EU Annex III</th>
                    <th className="py-2.5 px-3 sm:px-4 font-medium min-w-[140px]">Dual Progress Slider</th>
                    <th className="py-2.5 px-3 sm:px-4 font-medium">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {!hasValidSafetyContext && (
                    <tr>
                      <td colSpan={7} className="py-6 px-4 text-center text-amber-300 text-xs">
                        INDETERMINATE — Select an IFRA Category and provide Finished-Product Concentration (%) to evaluate ingredient compliance.
                      </td>
                    </tr>
                  )}
                  {safetyReport.evaluations.map((ev) => {
                    const isLookupReq = ev.maxAllowedPercentInFinalProduct === null;
                    const utilPct = ev.utilizationPercentOfLimit ?? 0;
                    return (
                      <tr key={ev.materialId} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 sm:px-4 font-medium text-white">
                          <div>{ev.materialName}</div>
                          {ev.euAllergenDeclarable && (
                            <span className="text-[10px] text-amber-400 font-mono-tabular">
                              {ev.euApplicableLabelThresholdPct !== null
                                ? `EU Allergen Threshold (>${ev.euApplicableLabelThresholdPct}%)`
                                : 'EU Allergen Threshold: Exposure / Record Required'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 sm:px-4 text-right font-mono-tabular text-slate-300">
                          {ev.activePercentInConcentrate.toFixed(3)}%
                        </td>
                        <td className="py-2.5 px-3 sm:px-4 text-right font-mono-tabular text-white font-semibold">
                          {ev.concentrationInFinalProduct.toFixed(4)}%
                        </td>
                        <td className="py-2.5 px-3 sm:px-4 text-right font-mono-tabular text-slate-300">
                          {ev.maxAllowedPercentInFinalProduct !== null ? (
                            `${ev.maxAllowedPercentInFinalProduct.toFixed(2)}%`
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-slate-700/80 border border-slate-500 text-slate-200 text-[10px] font-semibold">
                              LOOKUP_REQUIRED
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 sm:px-4 text-right font-mono-tabular text-slate-300">
                          {ev.euCosmeticLimitPercent !== null && ev.euCosmeticLimitPercent !== undefined ? (
                            `${ev.euCosmeticLimitPercent.toFixed(2)}%`
                          ) : (
                            <span className="text-slate-400 text-[11px]">LOOKUP_REQUIRED</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 sm:px-4">
                          <DualRegulatorySlider
                            materialName={ev.materialName}
                            currentPercent={ev.concentrationInFinalProduct}
                            ifraLimitPercent={ev.maxAllowedPercentInFinalProduct}
                            euLimitPercent={ev.euCosmeticLimitPercent ?? null}
                            compact={true}
                          />
                        </td>
                        <td className="py-2.5 px-3 sm:px-4">
                          <div className="flex flex-col gap-0.5">
                            {isLookupReq ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-700/90 border border-slate-500 text-slate-200 text-[10px] font-mono-tabular font-semibold w-fit">
                                LOOKUP_REQUIRED
                              </span>
                            ) : (
                              <span
                                className={
                                  ev.status === 'Exceeds stored limit' || utilPct > 80
                                    ? 'text-rose-400 font-semibold'
                                    : utilPct >= 50
                                    ? 'text-amber-400 font-medium'
                                    : 'text-emerald-400 font-medium'
                                }
                              >
                                IFRA: {ev.status === 'Within stored limit' ? (utilPct >= 50 ? `Caution (${utilPct.toFixed(0)}%)` : 'Safe (<50%)') : ev.status}
                              </span>
                            )}
                            <span
                              className={
                                ev.euComplianceStatus === 'Exceeds EU limit' || ev.euComplianceStatus === 'Prohibited (EU Annex II)'
                                  ? 'text-rose-400 font-semibold text-[10px]'
                                  : ev.euComplianceStatus === 'EU limit unavailable'
                                  ? 'text-amber-300 text-[10px]'
                                  : 'text-slate-300 text-[10px]'
                              }
                            >
                              EU: {ev.euComplianceStatus || 'LOOKUP_REQUIRED'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Constituent-Level Allergen Aggregation Across Direct Materials & Nested Accords */}
            {safetyReport.aggregatedAllergens.length > 0 && (
              <div className="rounded border border-slate-800 bg-[#0B0E14] p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">
                    Constituent-Level Allergen Aggregation (Direct Materials + Nested Accords · Exposure: {safetyReport.exposureType})
                  </span>
                  <span className="text-[11px] font-mono-tabular text-slate-400">
                    Exposure Basis: {safetyReport.exposureType === 'RINSE_OFF' ? 'Rinse-Off' : safetyReport.exposureType === 'LEAVE_ON' ? 'Leave-On' : 'Indeterminate Exposure'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                        <th className="py-1.5 px-2 font-medium">Constituent</th>
                        <th className="py-1.5 px-2 font-medium">CAS</th>
                        <th className="py-1.5 px-2 font-medium">Contributing Sources</th>
                        <th className="py-1.5 px-2 font-medium text-right">Aggregated Finished %</th>
                        <th className="py-1.5 px-2 font-medium text-right">Threshold</th>
                        <th className="py-1.5 px-2 font-medium">Declaration Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {safetyReport.aggregatedAllergens.map((agg) => (
                        <tr key={agg.constituentKey}>
                          <td className="py-1.5 px-2 font-medium text-white">{agg.constituentName}</td>
                          <td className="py-1.5 px-2 font-mono-tabular text-slate-400">{agg.constituentCas || '—'}</td>
                          <td className="py-1.5 px-2 text-slate-300">
                            {agg.sources
                              .map((c) => `${c.materialName} (${c.typicalPctInMaterial !== null ? `${c.typicalPctInMaterial}%` : '?%'})`)
                              .join(', ')}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono-tabular text-white">
                            {agg.totalFinalProductPct.toFixed(5)}%
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono-tabular text-slate-400">
                            {agg.applicableThresholdPct !== null ? `${agg.applicableThresholdPct.toFixed(3)}%` : 'INDETERMINATE'}
                          </td>
                          <td className="py-1.5 px-2">
                            {agg.declarationStatus === 'INDETERMINATE' ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-700/80 border border-slate-500 text-slate-200 text-[10px] font-mono-tabular font-semibold">
                                INDETERMINATE
                              </span>
                            ) : agg.requiresDeclaration ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-600/50 text-amber-300 text-[10px] font-mono-tabular font-semibold">
                                DECLARABLE ON LABEL
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-[11px] font-medium">Below Threshold</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-Panel 3: Target Brief Editor */}
        {activeBottomPanel === 'brief' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">
                  Olfactory Vision & Target Brief
                </label>
                <textarea
                  rows={3}
                  value={briefText}
                  onChange={(e) => setBriefText(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-md p-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Desired Atmosphere</label>
                <input
                  type="text"
                  value={briefAtmosphere}
                  onChange={(e) => setBriefAtmosphere(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-md p-2 text-white"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Desired Texture</label>
                <input
                  type="text"
                  value={briefTexture}
                  onChange={(e) => setBriefTexture(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-md p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Desired Drydown</label>
                <input
                  type="text"
                  value={briefDrydown}
                  onChange={(e) => setBriefDrydown(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-md p-2 text-white"
                />
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleQuickSaveVersion(false)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium"
                >
                  Save Brief & Formula
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sub-Panel 4: Export & Worksheet */}
        {activeBottomPanel === 'export' && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded bg-[#0B0E14] border border-slate-800">
            <div>
              <h4 className="text-sm font-semibold text-white">
                Portable Formulation Export ({activeFormula.name} {currentVersion?.versionLabel})
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Includes Ingredient, Percentage, Concentration, Active Material %, Target Weight, Unit, Supplier, Notes, and Version Lineage metadata.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportPDF}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md flex items-center gap-1.5 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                Download Formatted PDF Dossier
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium rounded-md flex items-center gap-1.5 border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                Download Production CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify({ formula: activeFormula, currentVersion }, null, 2)],
                    { type: 'application/json' }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${activeFormula.name.toLowerCase().replace(/\s+/g, '_')}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md"
              >
                Download JSON Backup
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Branch Experiment Modal */}
      {showBranchModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
          onClick={() => setShowBranchModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="branch-modal-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-[#111621] border border-slate-700 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden text-xs my-auto"
          >
            {/* Sticky Header with Close Button */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0 sticky top-0 bg-[#111621] z-10">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block">
                  Branch Versioning
                </span>
                <h3 id="branch-modal-title" className="text-base font-semibold text-white">
                  Create Experimental Version Branch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain space-y-4">
              <p className="text-xs text-slate-400">
                Branching from <strong className="text-emerald-400">{currentVersion?.versionLabel}</strong> preserves historical versions immutably.
              </p>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  New Branch Version Label
                </label>
                <input
                  type="text"
                  value={branchVersionLabel}
                  onChange={(e) => setBranchVersionLabel(e.target.value)}
                  placeholder="e.g., V5B Less Moss"
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-2 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Experimental Hypothesis / Version Notes
                </label>
                <textarea
                  rows={3}
                  value={branchNotes}
                  onChange={(e) => setBranchNotes(e.target.value)}
                  placeholder="What sensory adjustment are you testing in this branch?"
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 shrink-0 sticky bottom-0 bg-[#111621] z-10">
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleQuickSaveVersion(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white rounded-md shadow transition-colors"
              >
                Commit Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewFormulaModal && renderNewFormulaModal()}
    </div>
  );
};
