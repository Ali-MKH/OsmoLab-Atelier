import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Formula,
  RawMaterial,
  AccordDefinition,
  VolatilityTier,
  FormulaLineItem,
} from '../domain/types';
import { AppLanguage, t, getDir, computeUniformIsoscelesTrapezoids } from '../domain/i18n';
import { resolveEffectiveMaterialPyramidMetadata } from '../domain/formula-engine';
import { VerticalVolumeControl } from './VerticalVolumeControl';
import {
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Clock,
  FlaskConical,
  Check,
  ChevronRight,
  TrendingUp,
  Search,
  MoveDown,
  GripVertical,
  Trash2,
  Sliders,
  Filter,
  Download,
  Plus,
  X,
} from 'lucide-react';

export type PyramidTierId = 'top' | 'top-heart' | 'heart' | 'heart-base' | 'base';

export interface PyramidTierDef {
  id: PyramidTierId;
  label: string;
  frenchTerm: string;
  evaporationTime: string;
  volatilityRange: string;
  typicalWeightPct: number;
  description: string;
  olfactoryRole: string;
  molecularProfile: string;
  classicalBenchmark: {
    modernEdp: number;
    cologne: number;
    chypre: number;
    amber: number;
  };
  bridgePrinciple?: string;
  keyMolecules: string[];
  themeColor: 'amber' | 'emerald' | 'blue' | 'purple' | 'slate';
  bgGradient: string;
  borderColor: string;
  accentTextColor: string;
  relativeWidth: string; // Proportional width for visual hierarchy
}

export const PYRAMID_TIERS: PyramidTierDef[] = [
  {
    id: 'top',
    label: 'Top Notes',
    frenchTerm: 'Notes de Tête',
    evaporationTime: '0 – 2 Hours',
    volatilityRange: 'High Volatility (Vapor Pressure > 0.1 mmHg)',
    typicalWeightPct: 20,
    description:
      'The initial olfactory impact that greets the nose upon spraying. High-energy, volatile molecules with sparkling, radiant projection.',
    olfactoryRole: 'First impression, aperture opening, radiance, and freshness',
    molecularProfile: 'Monoterpenes, aliphatic aldehydes, low-molecular esters, light green ethers',
    classicalBenchmark: { modernEdp: 20, cologne: 50, chypre: 15, amber: 10 },
    keyMolecules: ['Bergamot FCF', 'Cis-3-Hexenol 10%', 'Lemon Oil', 'Grapefruit EO', 'Pink Pepper'],
    themeColor: 'amber',
    bgGradient: 'from-amber-500/20 via-amber-600/10 to-transparent',
    borderColor: 'border-amber-500/40 hover:border-amber-400',
    accentTextColor: 'text-amber-400',
    relativeWidth: 'w-[64%]',
  },
  {
    id: 'top-heart',
    label: 'Top-to-Heart Bridge',
    frenchTerm: 'Passerelle Tête-Cœur',
    evaporationTime: '1 – 4 Hours',
    volatilityRange: 'Medium-High Volatility',
    typicalWeightPct: 15,
    description:
      'The critical blending corridor that anchors fugitive top-note citrus and green molecules before they collapse into an empty void.',
    olfactoryRole: 'Seamless transition, prevents a hollow drop-off, introduces floral-herbal warmth',
    molecularProfile: 'Monoterpenols, cyclic ethers, spicy terpenes, leafy absolute fractions',
    classicalBenchmark: { modernEdp: 15, cologne: 20, chypre: 10, amber: 10 },
    bridgePrinciple:
      'Linalool, Petitgrain, and Violet Leaf contain shared structural motifs that soften sharp citrus terpenes while blooming smoothly into jasmine, rose, or tea accords.',
    keyMolecules: ['Violet Leaf Absolute 10%', 'Galbanum Oil 10%', 'Linalool', 'Petitgrain', 'Terpinyl Acetate'],
    themeColor: 'emerald',
    bgGradient: 'from-emerald-500/20 via-emerald-600/10 to-transparent',
    borderColor: 'border-emerald-500/40 hover:border-emerald-400',
    accentTextColor: 'text-emerald-400',
    relativeWidth: 'w-[73%]',
  },
  {
    id: 'heart',
    label: 'Heart Notes',
    frenchTerm: 'Notes de Cœur',
    evaporationTime: '2 – 12 Hours',
    volatilityRange: 'Medium Volatility (Vapor Pressure 0.001 – 0.1 mmHg)',
    typicalWeightPct: 25,
    description:
      'The conceptual soul and thematic core of the fragrance. Provides diffusive body, floral volume, spicy warmth, or fruity opulence.',
    olfactoryRole: 'Main theme expression, identity, harmony, and diffusion',
    molecularProfile: 'Sesquiterpenols, aromatic esters, floral ketones, damascones, ionones',
    classicalBenchmark: { modernEdp: 25, cologne: 15, chypre: 25, amber: 20 },
    keyMolecules: ['Hedione', 'Rose Absolute', 'Jasmine Sambac', 'Eugenol', 'Alpha-Ionone'],
    themeColor: 'blue',
    bgGradient: 'from-blue-500/20 via-blue-600/10 to-transparent',
    borderColor: 'border-blue-500/40 hover:border-blue-400',
    accentTextColor: 'text-blue-400',
    relativeWidth: 'w-[82%]',
  },
  {
    id: 'heart-base',
    label: 'Heart-to-Base Bridge',
    frenchTerm: 'Passerelle Cœur-Fond',
    evaporationTime: '6 – 24 Hours',
    volatilityRange: 'Medium-Low Volatility',
    typicalWeightPct: 20,
    description:
      'The master structural pivot that locks the diffusive petals of the heart into deep resins, dry woods, and substantive musks.',
    olfactoryRole: 'Weightless expansion, transparency, spatial aura, prevents heavy muddiness',
    molecularProfile: 'High-diffusion synthetics, macrocyclic ketones, velvety woody-ambergris carriers',
    classicalBenchmark: { modernEdp: 20, cologne: 10, chypre: 25, amber: 25 },
    bridgePrinciple:
      'Iso E Super and Cashmeran form an invisible scaffolding that cushions floral transparency into dry cedarwood and vetiver, preventing base notes from dragging the formula down.',
    keyMolecules: ['Iso E Super', 'Cashmeran', 'Coumarin', 'Methyl Ionone', 'Cedrol'],
    themeColor: 'purple',
    bgGradient: 'from-purple-500/20 via-purple-600/10 to-transparent',
    borderColor: 'border-purple-500/40 hover:border-purple-400',
    accentTextColor: 'text-purple-400',
    relativeWidth: 'w-[91%]',
  },
  {
    id: 'base',
    label: 'Base Notes',
    frenchTerm: 'Notes de Fond',
    evaporationTime: '12 – 72+ Hours',
    volatilityRange: 'Low Volatility (Vapor Pressure < 0.001 mmHg)',
    typicalWeightPct: 20,
    description:
      'The enduring foundation and substantive sillage. Large molecular weight molecules that cling tenaciously to skin and fabrics.',
    olfactoryRole: 'Tenacity, fixation, warmth, sensual skin-affinity, and memory imprint',
    molecularProfile: 'Heavy sesquiterpenes, macrocyclic musks, crystalline ambers, moss acids, resinoids',
    classicalBenchmark: { modernEdp: 20, cologne: 5, chypre: 25, amber: 35 },
    keyMolecules: ['Virginia Cedarwood EO', 'Vetiver Haiti EO', 'Oakmoss Absolute 10%', 'Ambroxan', 'Helvetolide'],
    themeColor: 'slate',
    bgGradient: 'from-slate-500/20 via-slate-600/10 to-transparent',
    borderColor: 'border-slate-500/40 hover:border-slate-300',
    accentTextColor: 'text-slate-300',
    relativeWidth: 'w-[100%]',
  },
];

interface OlfactoryPyramidViewProps {
  activeFormula?: Formula | null;
  formulas: Formula[];
  materials: RawMaterial[];
  accords: AccordDefinition[];
  lang?: AppLanguage;
  onSelectMaterial: (id: number) => void;
  onOpenFormulaLab: () => void;
  onUpdateFormulaItems?: (items: FormulaLineItem[]) => void;
}

export const OlfactoryPyramidView: React.FC<OlfactoryPyramidViewProps> = ({
  activeFormula,
  materials,
  lang = 'en',
  onSelectMaterial,
  onOpenFormulaLab,
  onUpdateFormulaItems,
}) => {
  const [selectedTierId, setSelectedTierId] = useState<PyramidTierId>('heart-base');
  const [selectedBenchmark, setSelectedBenchmark] = useState<
    'modernEdp' | 'cologne' | 'chypre' | 'amber'
  >('modernEdp');
  const [dragOverTierId, setDragOverTierId] = useState<PyramidTierId | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [materialWorkbenchTierFilter, setMaterialWorkbenchTierFilter] = useState<'all' | PyramidTierId>('all');
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [modalTierId, setModalTierId] = useState<PyramidTierId | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [customItemTiers, setCustomItemTiers] = useState<Record<string, PyramidTierId>>({});

  const currentVersion =
    activeFormula?.versions?.find(
      (v) => v.versionLabel === activeFormula.activeVersionLabel
    ) || activeFormula?.versions?.[0] || null;

  // Categorize raw materials into the 5 pyramid tiers using v1.1 pyramid metadata + user Shelf override
  const getMaterialPyramidTier = (mat: RawMaterial): PyramidTierId => {
    const lowerName = mat.name.toLowerCase();
    if (customItemTiers[lowerName]) {
      return customItemTiers[lowerName];
    }
    const resolved = resolveEffectiveMaterialPyramidMetadata(mat);
    if (resolved.tierId === 'none') {
      return 'base';
    }
    return resolved.tierId;
  };

  // Resolve tier for a specific formula line item (honoring explicit formula-context tier tags or user Shelf overrides)
  const getFormulaItemTier = (item: FormulaLineItem): PyramidTierId => {
    const lowerName = item.name.toLowerCase();
    if (customItemTiers[lowerName]) {
      return customItemTiers[lowerName];
    }
    const tagMatch = item.notes?.match(/\[tier:(top|top-heart|heart|heart-base|base)\]/i);
    const formulaTierOverride = tagMatch ? tagMatch[1].toLowerCase() : null;
    const mat = materials.find(
      (m) => m.id === item.materialId || m.name.toLowerCase() === lowerName
    );
    if (mat) {
      const resolved = resolveEffectiveMaterialPyramidMetadata(mat, formulaTierOverride);
      return resolved.tierId === 'none' ? 'base' : resolved.tierId;
    }
    return (formulaTierOverride as PyramidTierId) || 'heart';
  };

  // Compute active formula weight distribution across the 5 tiers
  const formulaTierBreakdown = useMemo(() => {
    const totals: Record<
      PyramidTierId,
      { weightGrams: number; activeGrams: number; items: FormulaLineItem[] }
    > = {
      top: { weightGrams: 0, activeGrams: 0, items: [] },
      'top-heart': { weightGrams: 0, activeGrams: 0, items: [] },
      heart: { weightGrams: 0, activeGrams: 0, items: [] },
      'heart-base': { weightGrams: 0, activeGrams: 0, items: [] },
      base: { weightGrams: 0, activeGrams: 0, items: [] },
    };

    let totalFormulaWeight = 0;

    for (const item of currentVersion?.items || []) {
      totalFormulaWeight += item.quantityGrams;
      const tierId = getFormulaItemTier(item);
      totals[tierId].weightGrams += item.quantityGrams;
      totals[tierId].activeGrams += item.activeMaterialPercent;
      totals[tierId].items.push(item);
    }

    const safeTotal = totalFormulaWeight > 0 ? totalFormulaWeight : 100;
    return {
      totalWeight: totalFormulaWeight,
      percentages: {
        top: (totals.top.weightGrams / safeTotal) * 100,
        'top-heart': (totals['top-heart'].weightGrams / safeTotal) * 100,
        heart: (totals.heart.weightGrams / safeTotal) * 100,
        'heart-base': (totals['heart-base'].weightGrams / safeTotal) * 100,
        base: (totals.base.weightGrams / safeTotal) * 100,
      },
      details: totals,
    };
  }, [currentVersion, materials, customItemTiers]);

  // Compute Bridge Cohesion Score (0 - 100)
  const bridgeCohesionAnalysis = useMemo(() => {
    const topHeartPct = formulaTierBreakdown.percentages['top-heart'];
    const heartBasePct = formulaTierBreakdown.percentages['heart-base'];

    let score = 50;
    const insights: string[] = [];

    // Evaluate Top-to-Heart Bridge
    if (topHeartPct >= 5 && topHeartPct <= 20) {
      score += 25;
      insights.push(
        lang === 'fa'
          ? `پل آغازین به میانی در وضعیت متناسب ${topHeartPct.toFixed(1)}٪ قرار دارد و گذار آرام مرکبات به گل‌ها را تضمین می‌کند.`
          : `Top-to-Heart Bridge is well-proportioned at ${topHeartPct.toFixed(1)}%, ensuring smooth citrus-to-floral transition.`
      );
    } else if (topHeartPct < 5) {
      score -= 15;
      insights.push(
        lang === 'fa'
          ? `پل آغازین به میانی اندک است (${topHeartPct.toFixed(1)}٪). روی لایه خالی کلیک کنید تا ماده پیونددهنده اضافه شود.`
          : `Top-to-Heart Bridge is low (${topHeartPct.toFixed(1)}%). Click the empty tier to assign a bridging material from your formula.`
      );
    } else {
      score += 10;
      insights.push(
        lang === 'fa'
          ? `پل آغازین به میانی برجسته است (${topHeartPct.toFixed(1)}٪) و دهانه‌ای باز و عمیق به عطر می‌بخشد.`
          : `Top-to-Heart Bridge is rich (${topHeartPct.toFixed(1)}%), giving an elongated, complex opening.`
      );
    }

    // Evaluate Heart-to-Base Bridge
    if (heartBasePct >= 12 && heartBasePct <= 35) {
      score += 25;
      insights.push(
        lang === 'fa'
          ? `پل میانی به پایه با سهم ${heartBasePct.toFixed(1)}٪ استحکام ساختاری ایده‌آلی دارد و پخش بالشتکی ایجاد می‌کند.`
          : `Heart-to-Base Bridge is structurally robust at ${heartBasePct.toFixed(1)}%, providing spatial diffusion across drydown.`
      );
    } else if (heartBasePct < 10) {
      score -= 20;
      insights.push(
        lang === 'fa'
          ? `پل میانی به پایه نازک است (${heartBasePct.toFixed(1)}٪). فرمول ممکن است بین گل‌های قلب و چوب‌های سنگین احساس خالی بودن کند.`
          : `Heart-to-Base Bridge is thin (${heartBasePct.toFixed(1)}%). Formula risks feeling hollow between heart florals and heavy woods.`
      );
    } else {
      score += 15;
      insights.push(
        lang === 'fa'
          ? `پل میانی به پایه بسیار قوی است (${heartBasePct.toFixed(1)}٪) و هاله‌ای شفاف و فوق‌العاده مدرن (Super-Iso E style) می‌سازد.`
          : `Heart-to-Base Bridge is dominant (${heartBasePct.toFixed(1)}%), producing a modern diffusive halo (super-monomolecular style).`
      );
    }

    return {
      score: Math.min(100, Math.max(10, score)),
      insights,
    };
  }, [formulaTierBreakdown, lang]);

  const selectedTier =
    PYRAMID_TIERS.find((t) => t.id === selectedTierId) || PYRAMID_TIERS[3];

  // Filtered materials workbench for drag-and-drop
  const filteredWorkbenchMaterials = useMemo(() => {
    return materials.filter((m) => {
      const tier = getMaterialPyramidTier(m);
      if (materialWorkbenchTierFilter !== 'all' && tier !== materialWorkbenchTierFilter) {
        return false;
      }
      if (!materialSearchQuery) return true;
      const q = materialSearchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.primaryFamily.toLowerCase().includes(q) ||
        m.descriptiveNotes.toLowerCase().includes(q)
      );
    });
  }, [materials, materialWorkbenchTierFilter, materialSearchQuery, customItemTiers]);

  // Assign an existing material from the current formula into a specific Pyramid Tier
  const handleAssignFormulaMaterialToTier = (
    item: FormulaLineItem,
    targetTierId: PyramidTierId
  ) => {
    const lowerName = item.name.toLowerCase();
    setCustomItemTiers((prev) => ({
      ...prev,
      [lowerName]: targetTierId,
    }));

    if (onUpdateFormulaItems && currentVersion) {
      const updated = currentVersion.items.map((it) => {
        if (it.id === item.id || it.name.toLowerCase() === lowerName) {
          const cleanNotes = (it.notes || '').replace(
            /\s*\[tier:(top|top-heart|heart|heart-base|base)\]/gi,
            ''
          );
          return {
            ...it,
            notes: `${cleanNotes} [tier:${targetTierId}]`.trim(),
          };
        }
        return it;
      });
      onUpdateFormulaItems(updated);
    }

    const targetDef = PYRAMID_TIERS.find((t) => t.id === targetTierId);
    setSelectedTierId(targetTierId);
    setModalTierId(null);
    showToast(
      lang === 'fa'
        ? `${item.name} به لایه ${targetDef?.label || targetTierId} اختصاص یافت`
        : `Assigned ${item.name} (${item.percentage.toFixed(1)}%) to ${targetDef?.label || targetTierId}`
    );
  };

  // Add a raw material from the Organ Library into a specific Pyramid Tier
  const handleAddOrganMaterialToTier = (
    mat: RawMaterial,
    targetTierId: PyramidTierId
  ) => {
    const lowerName = mat.name.toLowerCase();
    setCustomItemTiers((prev) => ({
      ...prev,
      [lowerName]: targetTierId,
    }));

    const currentItems = [...(currentVersion?.items || [])];
    const existingIdx = currentItems.findIndex(
      (i) => i.materialId === mat.id || i.name.toLowerCase() === lowerName
    );

    if (existingIdx >= 0) {
      handleAssignFormulaMaterialToTier(currentItems[existingIdx], targetTierId);
      return;
    }

    const defaultWeight = 2.0; // 2.0g
    const newItem: FormulaLineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'material',
      materialId: mat.id,
      name: mat.name,
      quantityGrams: defaultWeight,
      percentage: 0,
      dilutionPercent: mat.recommendedDilution || 100,
      solvent: 'Ethanol (Perfumer Grade)',
      activeMaterialPercent:
        defaultWeight * ((mat.recommendedDilution || 100) / 100),
      supplier: mat.supplier || 'Atelier Stock',
      costPerGram: mat.costPerGram ?? 0.85,
      notes: `Added to ${targetTierId} [tier:${targetTierId}]`,
    };

    const updated = [...currentItems, newItem];
    const totalGrams = updated.reduce((s, it) => s + it.quantityGrams, 0);
    const normalized = updated.map((it) => ({
      ...it,
      percentage: totalGrams > 0 ? (it.quantityGrams / totalGrams) * 100 : 0,
    }));

    if (onUpdateFormulaItems) {
      onUpdateFormulaItems(normalized);
    }

    const targetDef = PYRAMID_TIERS.find((t) => t.id === targetTierId);
    setSelectedTierId(targetTierId);
    setModalTierId(null);
    showToast(
      lang === 'fa'
        ? `${mat.name} با موفقیت به لایه ${targetDef?.label || targetTierId} افزوده شد`
        : `Added ${mat.name} to ${targetDef?.label || targetTierId}`
    );
  };

  // Handle clicking on a Pyramid Tier (opens Material Picker Modal automatically if tier is empty)
  const handleTierClick = (tierId: PyramidTierId) => {
    setSelectedTierId(tierId);
    if (formulaTierBreakdown.details[tierId].items.length === 0) {
      setModalTierId(tierId);
      setModalSearchQuery('');
    }
  };

  // Handle Drag Start
  const handleDragStart = (
    e: React.DragEvent,
    item: { materialId: number; name: string; tier: PyramidTierId }
  ) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  // Handle Drop into a Tier
  const handleDropOnTier = (e: React.DragEvent, targetTierId: PyramidTierId) => {
    e.preventDefault();
    setDragOverTierId(null);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const droppedItem = JSON.parse(dataStr) as {
        materialId: number;
        name: string;
        tier?: PyramidTierId;
      };

      const mat = materials.find((m) => m.id === droppedItem.materialId);
      if (!mat) return;

      handleAddOrganMaterialToTier(mat, targetTierId);
    } catch (err) {
      console.warn('Error handling drop on tier:', err);
    }
  };

  // Adjust material percentage via Vertical Volume Fader
  const handleUpdateItemPercentage = (itemId: string, newPercentage: number) => {
    if (!onUpdateFormulaItems || !currentVersion) return;
    const items = [...currentVersion.items];
    const itemIndex = items.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) return;

    const currentTotalGrams = items.reduce((sum, it) => sum + it.quantityGrams, 0) || 100;
    const newGrams = Number(((newPercentage / 100) * currentTotalGrams).toFixed(2));
    const targetGrams = Math.max(0.1, newGrams);

    const updatedItems = items.map((it, idx) => {
      if (idx === itemIndex) {
        return {
          ...it,
          quantityGrams: targetGrams,
          percentage: newPercentage,
          activeMaterialPercent: targetGrams * (it.dilutionPercent / 100),
        };
      }
      return it;
    });

    const totalG = updatedItems.reduce((s, it) => s + it.quantityGrams, 0);
    const normalized = updatedItems.map((it) => ({
      ...it,
      percentage: totalG > 0 ? (it.quantityGrams / totalG) * 100 : 0,
    }));

    onUpdateFormulaItems(normalized);
  };

  // Remove material from active formula
  const handleRemoveItem = (itemId: string, itemName: string) => {
    if (!onUpdateFormulaItems || !currentVersion) return;
    const filtered = currentVersion.items.filter((i) => i.id !== itemId);
    const totalG = filtered.reduce((s, it) => s + it.quantityGrams, 0);
    const normalized = filtered.map((it) => ({
      ...it,
      percentage: totalG > 0 ? (it.quantityGrams / totalG) * 100 : 0,
    }));
    onUpdateFormulaItems(normalized);
    showToast(
      lang === 'fa'
        ? `${itemName} از فرمول حذف شد`
        : `Removed ${itemName} from active formula`
    );
  };

  const showToast = (msg: string) => {
    setAddedToast(msg);
    setTimeout(() => setAddedToast(null), 3200);
  };

  // High-Resolution Studio PNG Exporter (2400 x 1500 Retina Canvas with External Schematic Labels)
  const handleExportToPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Studio Obsidian Canvas & Subtle Grid
    ctx.fillStyle = '#090D14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.lineWidth = 1;
    for (let x = 60; x < canvas.width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 60; y < canvas.height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Outer Architectural Frame
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 44, canvas.width - 88, canvas.height - 88);

    // 2. Header Banner
    ctx.fillStyle = '#10B981';
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillText('OSMOLAB FORMULATION ATELIER · ARCHITECTURAL VOLATILITY DOSSIER', 84, 102);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(
      `${activeFormula?.name || 'Formula'} (${currentVersion?.versionLabel || 'V1'}) — Olfactory Pyramid`,
      84,
      158
    );

    ctx.fillStyle = '#94A3B8';
    ctx.font = '400 22px sans-serif';
    ctx.fillText(
      `Product: ${activeFormula?.intendedProduct || 'Fine Fragrance'} · IFRA: ${activeFormula?.ifraCategory || 'Category 4'} · Total Batch Weight: ${formulaTierBreakdown.totalWeight.toFixed(2)} g`,
      84,
      198
    );

    // Cohesion Score Badge on Top Right
    ctx.fillStyle = '#111622';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.fillRect(1940, 80, 370, 120);
    ctx.strokeRect(1940, 80, 370, 120);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText('BRIDGE COHESION INDEX', 1970, 118);

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 44px "JetBrains Mono", monospace';
    ctx.fillText(`${bridgeCohesionAnalysis.score} / 100`, 1970, 174);

    // Divider Line
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(84, 230);
    ctx.lineTo(canvas.width - 84, 230);
    ctx.stroke();

    // 3. Draw Clean Collinear Isosceles Trapezoid 5-Tier Pyramid Schematic (Left: X=80..1160) with Uniform Slope k = 0.45
    const pyrCenterX = 620;
    const totalFormulaWeight = formulaTierBreakdown.totalWeight;
    const exportTrapezoids = computeUniformIsoscelesTrapezoids(
      pyrCenterX,
      280,
      64,
      196,
      20,
      0.45
    );
    const tierVisualStyles: Array<{
      fillTop: string;
      fillBot: string;
      stroke: string;
      accent: string;
    }> = [
      {
        fillTop: 'rgba(217, 119, 6, 0.92)',
        fillBot: 'rgba(180, 83, 9, 0.78)',
        stroke: '#F59E0B',
        accent: '#FDE68A',
      },
      {
        fillTop: 'rgba(5, 150, 105, 0.92)',
        fillBot: 'rgba(4, 120, 87, 0.78)',
        stroke: '#10B981',
        accent: '#A7F3D0',
      },
      {
        fillTop: 'rgba(37, 99, 235, 0.92)',
        fillBot: 'rgba(29, 78, 216, 0.78)',
        stroke: '#3B82F6',
        accent: '#BFDBFE',
      },
      {
        fillTop: 'rgba(124, 58, 237, 0.92)',
        fillBot: 'rgba(109, 40, 217, 0.78)',
        stroke: '#8B5CF6',
        accent: '#DDD6FE',
      },
      {
        fillTop: 'rgba(71, 85, 105, 0.94)',
        fillBot: 'rgba(30, 41, 59, 0.88)',
        stroke: '#94A3B8',
        accent: '#E2E8F0',
      },
    ];
    const tierSlices = exportTrapezoids.map((trap, idx) => ({
      ...trap,
      ...tierVisualStyles[idx],
    }));

    // Subtle Outer Collinear Isosceles Trapezoid Guide Frame
    const topTrap = exportTrapezoids[0];
    const botTrap = exportTrapezoids[exportTrapezoids.length - 1];
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(topTrap.topLeftX, topTrap.topY);
    ctx.lineTo(topTrap.topRightX, topTrap.topY);
    ctx.lineTo(botTrap.botRightX, botTrap.botY);
    ctx.lineTo(botTrap.botLeftX, botTrap.botY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    tierSlices.forEach((slice) => {
      const tierWeight = formulaTierBreakdown.details[slice.id].weightGrams;
      const influencePct =
        totalFormulaWeight > 0 ? (tierWeight / totalFormulaWeight) * 100 : 0;
      const grad = ctx.createLinearGradient(0, slice.topY, 0, slice.botY);
      grad.addColorStop(0, slice.fillTop);
      grad.addColorStop(1, slice.fillBot);

      ctx.beginPath();
      ctx.moveTo(slice.topLeftX, slice.topY);
      ctx.lineTo(slice.topRightX, slice.topY);
      ctx.lineTo(slice.botRightX, slice.botY);
      ctx.lineTo(slice.botLeftX, slice.botY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = slice.stroke;
      ctx.stroke();

      // 3D Center Facet Ridge Line
      ctx.beginPath();
      ctx.moveTo(pyrCenterX, slice.topY);
      ctx.lineTo(pyrCenterX, slice.botY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Clean Schematic Emblem inside Isosceles Trapezoid Slice
      const midY = slice.midY;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px "JetBrains Mono", monospace';
      ctx.fillText(`TIER ${slice.roman}`, pyrCenterX, midY - 6);

      ctx.fillStyle = slice.accent;
      ctx.font = 'bold 26px "JetBrains Mono", monospace';
      ctx.fillText(`${influencePct.toFixed(1)}%`, pyrCenterX, midY + 26);

      // Horizontal Leader Line to External Schedule Card on Right
      const rightEdgeX = pyrCenterX + (slice.topHalfW + slice.botHalfW) / 2;
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = slice.stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rightEdgeX + 8, (slice.topY + slice.botY) / 2);
      ctx.lineTo(1230, (slice.topY + slice.botY) / 2);
      ctx.stroke();
      ctx.restore();
    });

    // 4. Right Side: Large, Ultra-Readable External Tier Callout Cards (X=1240..2310)
    ctx.textAlign = 'left';
    let cardY = 280;
    PYRAMID_TIERS.forEach((tier, idx) => {
      const grams = formulaTierBreakdown.details[tier.id].weightGrams;
      const influencePct =
        totalFormulaWeight > 0 ? (grams / totalFormulaWeight) * 100 : 0;
      const benchPct = tier.classicalBenchmark[selectedBenchmark];
      const diff = influencePct - benchPct;
      const items = formulaTierBreakdown.details[tier.id].items;
      const roman = ['I', 'II', 'III', 'IV', 'V'][idx];

      ctx.fillStyle = '#111622';
      ctx.strokeStyle = tierSlices[idx].stroke;
      ctx.lineWidth = 2.5;
      ctx.fillRect(1240, cardY, 1070, 195);
      ctx.strokeRect(1240, cardY, 1070, 195);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(
        `${roman}. ${tier.label} (${tier.frenchTerm}) — Influence: ${influencePct.toFixed(1)}% (${grams.toFixed(1)} g)`,
        1272,
        cardY + 46
      );

      ctx.fillStyle = '#10B981';
      ctx.font = '600 19px "JetBrains Mono", monospace';
      const diffStr = diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
      ctx.fillText(
        `Benchmark (${selectedBenchmark}): ${benchPct}% (${diffStr}) · Evaporation Window: ${tier.evaporationTime}`,
        1272,
        cardY + 82
      );

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '500 21px sans-serif';
      if (items.length === 0) {
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('Empty Tier — No materials currently assigned to this tier.', 1272, cardY + 126);
      } else {
        const line1 = items
          .slice(0, 3)
          .map((i) => `• ${i.name}: ${i.percentage.toFixed(1)}% (${i.quantityGrams.toFixed(1)}g)`)
          .join('   ');
        ctx.fillText(line1, 1272, cardY + 126);
        if (items.length > 3) {
          const line2 = items
            .slice(3, 6)
            .map((i) => `• ${i.name}: ${i.percentage.toFixed(1)}% (${i.quantityGrams.toFixed(1)}g)`)
            .join('   ');
          ctx.fillText(line2, 1272, cardY + 162);
        }
      }

      cardY += 216;
    });

    // Footer Signature
    ctx.fillStyle = '#64748B';
    ctx.font = '500 18px "JetBrains Mono", monospace';
    ctx.fillText(
      `Generated by OsmoLab Formulation Atelier · ${new Date().toISOString().slice(0, 10)}`,
      84,
      1435
    );

    // Trigger PNG Download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const safeName = (activeFormula?.name || 'formula').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    link.download = `osmolab-pyramid-${safeName}-${currentVersion?.versionLabel || 'v1'}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(t('exportedPngToast', lang));
  };

  const isRtl = lang === 'fa';

  // Minimal Flat Isosceles Trapezoid SVG Pyramid Geometry with White Space Between Tiers (viewBox="0 0 540 228")
  const baseTrapezoids = computeUniformIsoscelesTrapezoids(185, 14, 24, 32, 10, 0.58);
  const svgTierThemeMeta = [
    {
      gradId: 'pyrGradTop',
      strokeColor: '#F59E0B',
      accentHex: '#F59E0B',
      borderAccentClass: '',
      badgeBgClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      barColorClass: 'bg-amber-400',
    },
    {
      gradId: 'pyrGradTopHeart',
      strokeColor: '#10B981',
      accentHex: '#10B981',
      borderAccentClass: '',
      badgeBgClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      barColorClass: 'bg-emerald-400',
    },
    {
      gradId: 'pyrGradHeart',
      strokeColor: '#3B82F6',
      accentHex: '#3B82F6',
      borderAccentClass: '',
      badgeBgClass: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      barColorClass: 'bg-blue-400',
    },
    {
      gradId: 'pyrGradHeartBase',
      strokeColor: '#8B5CF6',
      accentHex: '#8B5CF6',
      borderAccentClass: '',
      badgeBgClass: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      barColorClass: 'bg-purple-400',
    },
    {
      gradId: 'pyrGradBase',
      strokeColor: '#64748B',
      accentHex: '#64748B',
      borderAccentClass: '',
      badgeBgClass: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
      barColorClass: 'bg-slate-400',
    },
  ];
  const svgPyramidGeometry = baseTrapezoids.map((trap, idx) => ({
    ...trap,
    ...svgTierThemeMeta[idx],
  }));

  const modalTargetTierDef = modalTierId
    ? PYRAMID_TIERS.find((tDef) => tDef.id === modalTierId)
    : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalTierId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-8 w-full max-w-full min-w-0 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-lg bg-emerald-950 border border-emerald-500 px-4 py-2.5 text-xs text-emerald-200 shadow-2xl animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{addedToast}</span>
        </div>
      )}

      {/* Popover / Modal for Adding or Assigning Material to a Tier */}
      {modalTierId && modalTargetTierDef && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
          onClick={() => setModalTierId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${t('addMaterialModalTitle', lang)} — ${modalTargetTierDef.label}`}
            data-testid="tier-material-picker-modal"
            className="w-full max-w-lg rounded-xl bg-[#111621] border border-slate-700 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B0E14] shrink-0 sticky top-0 z-10">
              <div>
                <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-emerald-400 font-semibold">
                  {modalTargetTierDef.frenchTerm} · {modalTargetTierDef.evaporationTime}
                </div>
                <h3 className="text-base font-semibold text-white mt-0.5">
                  {t('addMaterialModalTitle', lang)}: <span className="text-emerald-400">{modalTargetTierDef.label}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalTierId(null)}
                aria-label="Close modal"
                data-testid="close-tier-modal-btn"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Filter */}
            <div className="p-4 border-b border-slate-800/80 bg-[#111621] shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder={
                    lang === 'fa'
                      ? 'جستجوی ماده از فرمول فعلی یا کتابخانه...'
                      : 'Filter materials from current formula or organ library...'
                  }
                  className="w-full bg-[#0B0E14] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Modal Content Lists */}
            <div className="p-4 overflow-y-auto flex-1 overscroll-contain space-y-5">
              {/* Section 1: Available Materials from Current Formula */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
                    {t('fromCurrentFormulaSection', lang)} ({activeFormula?.name || 'Formula'})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {(currentVersion?.items || []).length} {lang === 'fa' ? 'ماده' : 'items'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {(currentVersion?.items || [])
                    .filter((item) =>
                      !modalSearchQuery
                        ? true
                        : item.name.toLowerCase().includes(modalSearchQuery.toLowerCase())
                    )
                    .map((item) => {
                      const currentItemTierId = getFormulaItemTier(item);
                      const currentItemTierDef = PYRAMID_TIERS.find(
                        (tDef) => tDef.id === currentItemTierId
                      );
                      const isAlreadyInTarget = currentItemTierId === modalTierId;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleAssignFormulaMaterialToTier(item, modalTierId)}
                          data-testid={`modal-formula-item-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0E14] hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/60 cursor-pointer transition-all"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-white truncate">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono-tabular flex items-center gap-2 mt-0.5">
                              <span className="text-emerald-400 font-medium">
                                {item.percentage.toFixed(1)}% ({item.quantityGrams.toFixed(1)}g)
                              </span>
                              <span>·</span>
                              <span>
                                {lang === 'fa' ? 'لایه فعلی:' : 'Current:'}{' '}
                                {currentItemTierDef?.label}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignFormulaMaterialToTier(item, modalTierId);
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium shrink-0 transition-colors ${
                              isAlreadyInTarget
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {isAlreadyInTarget
                              ? lang === 'fa'
                                ? 'در همین لایه'
                                : 'Active in Tier'
                              : t('assignToTierBtn', lang)}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Section 2: Add New Raw Material from Organ Library */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    {t('fromOrganLibrarySection', lang)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {materials
                    .filter((m) =>
                      !modalSearchQuery
                        ? true
                        : m.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                          m.primaryFamily.toLowerCase().includes(modalSearchQuery.toLowerCase())
                    )
                    .slice(0, 8)
                    .map((mat) => (
                      <div
                        key={mat.id}
                        onClick={() => handleAddOrganMaterialToTier(mat, modalTierId)}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0E14] hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/60 cursor-pointer transition-all"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold text-white truncate">
                            {mat.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {mat.primaryFamily} · {mat.volatility}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddOrganMaterialToTier(mat, modalTierId);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-slate-700 text-[11px] font-medium shrink-0 transition-colors"
                        >
                          + {t('addToFormulaTierBtn', lang)}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-slate-800/70 pb-5">
        <div>
          <h1 className="text-2xl font-sans font-semibold text-white tracking-wide">
            {t('pyramidHeaderTitle', lang)}
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-normal">
            {t('pyramidHeaderDesc', lang)}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="text-xs text-slate-400 bg-[#0B0E14] border border-slate-800/80 rounded-md px-3.5 py-1.5 flex items-center justify-between sm:justify-start gap-2 font-normal">
            <span>{t('activeStudy', lang)}:</span>
            <span className="text-white font-medium truncate">
              {activeFormula ? `${activeFormula.name} (${currentVersion?.versionLabel || 'V1'})` : 'No Active Formula'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportToPng}
              data-testid="export-pyramid-png-btn"
              className="px-3.5 py-2 sm:py-1.5 bg-[#111621] hover:bg-slate-800 text-emerald-400 border border-emerald-500/35 hover:border-emerald-400 text-xs font-normal rounded-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{t('exportToPng', lang)}</span>
            </button>
            <button
              type="button"
              onClick={onOpenFormulaLab}
              className="px-3.5 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-normal rounded-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span>{t('openInFormulaLab', lang)} →</span>
            </button>
          </div>
        </div>
      </div>

      {/* Zero-Formula Empty State Banner */}
      {!activeFormula && (
        <div
          data-testid="pyramid-zero-formula-empty-state"
          className="rounded-xl bg-[#111621] border border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
        >
          <div className="space-y-1">
            <div className="font-semibold text-white text-sm">
              No Active Formula Selected for Pyramid Analysis
            </div>
            <p className="text-slate-400">
              Create or select a formula in Formula Lab to inspect its 5-tier volatility distribution, bridge cohesion index, and evaporation curve.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenFormulaLab}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            Create / Select Formula →
          </button>
        </div>
      )}

      {/* Main 2-Column Grid with Generous White Space */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (6 Cols): Minimal Flat Pyramid Schematic + Separated Tier Cards */}
        <div className="lg:col-span-6 space-y-7">
          <div className="rounded-xl bg-[#111621] border border-slate-800/70 p-6 sm:p-7 space-y-6">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-white flex items-center gap-2 text-sm">
                <Layers className="w-4 h-4 text-emerald-400" />
                {lang === 'fa' ? 'شماتیک تعاملی ۵ لایه هرم بویایی' : '5-Tier Olfactory Pyramid Schematic'}
              </span>
              <span className="text-slate-400 text-xs font-normal">
                {lang === 'fa' ? 'روی لایه خالی کلیک کنید تا ماده اضافه شود' : 'Click any tier to inspect or add notes'}
              </span>
            </div>

            {/* Minimal Flat Pyramid Schematic + 5 Spaced Tier Cards */}
            <div className="flex flex-col gap-6">
              {/* Top: Flat Minimal 5-Tier Pyramid with Clear White Space Between Slices */}
              <div
                data-testid="minimal-pyramid-container"
                className="w-full flex items-center justify-center bg-[#0B0E14] rounded-xl border border-slate-800/60 px-5 py-6"
              >
                <svg
                  viewBox="0 0 540 224"
                  className="w-full max-w-[510px] h-auto max-h-[224px] select-none overflow-visible"
                  role="img"
                  aria-label="Minimal Flat 5-Tier Olfactory Pyramid Schematic"
                >
                  {svgPyramidGeometry.map((geo) => {
                    const isSelected = selectedTierId === geo.id;
                    const isDragOver = dragOverTierId === geo.id;
                    const totalWeight = formulaTierBreakdown.totalWeight;
                    const tierWeight = formulaTierBreakdown.details[geo.id].weightGrams;
                    const influencePct =
                      totalWeight > 0 ? (tierWeight / totalWeight) * 100 : 0;
                    const isEmpty = formulaTierBreakdown.details[geo.id].items.length === 0;

                    return (
                      <g
                        key={geo.id}
                        data-testid={`pyramid-slice-${geo.id}`}
                        onClick={() => handleTierClick(geo.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverTierId(geo.id);
                        }}
                        onDragLeave={() => setDragOverTierId(null)}
                        onDrop={(e) => handleDropOnTier(e, geo.id)}
                        className="cursor-pointer transition-opacity duration-150 hover:opacity-95"
                      >
                        {/* Flat Matte Trapezoid Slice with White Space Gap Between Tiers */}
                        <polygon
                          points={geo.points}
                          fill={geo.strokeColor}
                          fillOpacity={isEmpty ? 0.25 : isSelected ? 0.94 : 0.80}
                          stroke={
                            isDragOver
                              ? '#34D399'
                              : isSelected
                              ? 'var(--color-text, #FFFFFF)'
                              : 'none'
                          }
                          strokeWidth={isDragOver ? '2' : isSelected ? '1.5' : '0'}
                        />

                        {/* Simple Non-Bold Label Inside Flat Pyramid Slice */}
                        <text
                          x="185"
                          y={geo.midY + 3.5}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="10"
                          fontWeight="400"
                          fontFamily="var(--font-sans), sans-serif"
                          pointerEvents="none"
                        >
                          {isEmpty
                            ? `${geo.roman} · +Add`
                            : `${geo.roman} · ${influencePct.toFixed(0)}%`}
                        </text>

                        {/* Minimal Flat Proportion Bar to the Right (Separated by Clean White Space) */}
                        <rect
                          x="348"
                          y={geo.midY - 7}
                          width="132"
                          height="14"
                          rx="3"
                          fill="var(--color-border-subtle, rgba(148, 163, 184, 0.16))"
                        />
                        <rect
                          x="348"
                          y={geo.midY - 7}
                          width={Math.max(0, Math.min(132, (influencePct / 100) * 132))}
                          height="14"
                          rx="3"
                          fill={geo.strokeColor}
                          fillOpacity="0.86"
                          pointerEvents="none"
                        />
                        <text
                          x="490"
                          y={geo.midY + 3.5}
                          textAnchor="start"
                          fill="var(--color-text-secondary, #CBD5E1)"
                          fontSize="10"
                          fontWeight="400"
                          fontFamily="var(--font-mono), monospace"
                          pointerEvents="none"
                        >
                          {`${influencePct.toFixed(1)}%`}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Below Pyramid: 5 Flat Spaced Tier Sections with Simple Note Tags */}
              <div className="flex flex-col gap-3.5">
                {PYRAMID_TIERS.map((tier, idx) => {
                  const geo = svgPyramidGeometry[idx];
                  const isSelected = selectedTierId === tier.id;
                  const isDragOver = dragOverTierId === tier.id;
                  const totalFormulaWeight = formulaTierBreakdown.totalWeight;
                  const weightGrams = formulaTierBreakdown.details[tier.id].weightGrams;
                  const influencePct =
                    totalFormulaWeight > 0 ? (weightGrams / totalFormulaWeight) * 100 : 0;
                  const tierItems = formulaTierBreakdown.details[tier.id].items;
                  const isEmpty = tierItems.length === 0;

                  return (
                    <div
                      key={tier.id}
                      data-testid={`pyramid-tier-card-${tier.id}`}
                      onClick={() => handleTierClick(tier.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverTierId(tier.id);
                      }}
                      onDragLeave={() => setDragOverTierId(null)}
                      onDrop={(e) => handleDropOnTier(e, tier.id)}
                      className={`relative overflow-hidden rounded-xl border px-4 py-3.5 flex flex-col justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#172033] border-emerald-500/70'
                          : isDragOver
                          ? 'bg-emerald-950/30 border-emerald-400'
                          : 'bg-[#0B0E14] border-slate-800/70 hover:border-slate-700'
                      }`}
                    >
                      {/* Flat Proportional Color Fill Showing Share of Total Formula */}
                      <div
                        data-testid={`tier-influence-indicator-${tier.id}`}
                        className="absolute inset-y-0 left-0 pointer-events-none transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, influencePct))}%`,
                          backgroundColor: geo.accentHex,
                          opacity: isSelected ? 0.20 : 0.13,
                        }}
                      />

                      {/* Top Row: Simple Tier Name + Proportion % + Quick Add Button */}
                      <div className="relative z-10 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 flex items-center gap-2.5">
                          <span
                            className={`text-[11px] font-mono-tabular font-normal px-2 py-0.5 rounded border shrink-0 ${geo.badgeBgClass}`}
                          >
                            {geo.roman}
                          </span>
                          <span className="text-sm font-normal text-white leading-tight truncate">
                            {tier.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`text-xs font-mono-tabular font-normal ${tier.accentTextColor}`}
                          >
                            {influencePct.toFixed(1)}%
                          </span>

                          <button
                            type="button"
                            data-testid={`open-tier-modal-${tier.id}`}
                            aria-label={`Add material to ${tier.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTierId(tier.id);
                              setModalTierId(tier.id);
                              setModalSearchQuery('');
                            }}
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-slate-700/70 transition-colors"
                            title={t('addMaterialModalTitle', lang)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Row: Simple Material Notes OR Empty Tier Click-to-Add Trigger */}
                      <div className="relative z-10 mt-2.5">
                        {isEmpty ? (
                          <button
                            type="button"
                            data-testid={`empty-tier-add-btn-${tier.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTierId(tier.id);
                              setModalTierId(tier.id);
                              setModalSearchQuery('');
                            }}
                            className="w-full py-1.5 px-3 rounded-lg border border-dashed border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-300 text-xs font-normal flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('emptyTierPrompt', lang)}</span>
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            {tierItems.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0B0E14] border border-slate-800/80 text-xs font-normal text-slate-200"
                              >
                                <span>{item.name}</span>
                                <span className="font-mono-tabular text-[11px] text-emerald-400 font-normal">
                                  {item.percentage.toFixed(1)}%
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveItem(item.id, item.name);
                                  }}
                                  aria-label={`Remove ${item.name} from ${tier.label}`}
                                  className="text-slate-400 hover:text-rose-400 ml-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Classical Archetype Benchmark Selector & Deviation Matrix */}
            <div className="pt-4 border-t border-slate-800/60 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-normal">
                  {t('classicalRatioArchetype', lang)}:
                </span>
                <select
                  value={selectedBenchmark}
                  onChange={(e) =>
                    setSelectedBenchmark(
                      e.target.value as 'modernEdp' | 'cologne' | 'chypre' | 'amber'
                    )
                  }
                  className="bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-1 text-white text-xs font-normal focus:outline-none focus:border-emerald-500"
                >
                  <option value="modernEdp">{t('archetypeModernEdp', lang)}</option>
                  <option value="cologne">{t('archetypeCologne', lang)}</option>
                  <option value="chypre">{t('archetypeChypre', lang)}</option>
                  <option value="amber">{t('archetypeAmber', lang)}</option>
                </select>
              </div>

              {/* Ratios vs Formula comparison table */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-center font-mono-tabular text-xs">
                {PYRAMID_TIERS.map((tier) => {
                  const currentPct = formulaTierBreakdown.percentages[tier.id];
                  const benchPct = tier.classicalBenchmark[selectedBenchmark];
                  const diff = currentPct - benchPct;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => handleTierClick(tier.id)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedTierId === tier.id
                          ? 'bg-slate-800 border-emerald-500/70 text-white'
                          : 'bg-[#0B0E14] border-slate-800/70 text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-[11px] text-slate-400 truncate font-normal">{tier.label}</div>
                      <div className="font-normal mt-0.5">{currentPct.toFixed(0)}%</div>
                      <div
                        className={`text-[10.5px] mt-0.5 font-normal ${
                          Math.abs(diff) < 4
                            ? 'text-slate-400'
                            : diff > 0
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {diff > 0 ? `+${diff.toFixed(0)}%` : `${diff.toFixed(0)}%`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bridge Cohesion Score & Structural Integrity Card */}
          <div className="rounded-xl bg-[#111621] border border-slate-800/70 p-6 space-y-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                {t('bridgeCohesionIndex', lang)}
              </span>
              <span className="font-mono-tabular font-normal text-emerald-400 text-sm">
                {bridgeCohesionAnalysis.score} / 100
              </span>
            </div>

            <div className="w-full bg-[#0B0E14] rounded-full h-2 overflow-hidden border border-slate-800/70">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${bridgeCohesionAnalysis.score}%` }}
              />
            </div>

            <div className="space-y-2 pt-1">
              {bridgeCohesionAnalysis.insights.map((ins, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-300 font-normal leading-relaxed text-xs">
                  <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{ins}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (6 Cols): Comprehensive Tier Detail, Faders & Library Shelf */}
        <div className="lg:col-span-6 space-y-7">
          {/* 1. Tier Identity & Evaporation Dynamics */}
          <div className="rounded-xl bg-[#111621] border border-slate-800/70 p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800/60 pb-5">
              <div>
                <div className="text-[11px] font-mono-tabular text-emerald-400 uppercase tracking-wider font-normal">
                  {selectedTier.frenchTerm} · {selectedTier.evaporationTime}
                </div>
                <h2 className="text-2xl font-sans font-semibold text-white mt-1">
                  {selectedTier.label}
                </h2>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-normal">
                  {selectedTier.description}
                </p>
              </div>
              <div className="text-right font-mono-tabular text-xs shrink-0 bg-[#0B0E14] border border-slate-800/70 rounded-lg px-4 py-3">
                <div className="text-slate-400 text-[10px] font-normal">{t('activeFormulaWeight', lang)}</div>
                <div className="text-xl font-normal text-white mt-0.5">
                  {formulaTierBreakdown.percentages[selectedTierId].toFixed(2)}%
                </div>
                <div className="text-[11px] text-emerald-400 mt-0.5 font-normal">
                  {formulaTierBreakdown.details[selectedTierId].weightGrams.toFixed(2)} g /{' '}
                  {formulaTierBreakdown.totalWeight.toFixed(1)} g
                </div>
              </div>
            </div>

            {/* Volatility Dynamics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-slate-800/70">
                <span className="text-[11px] text-slate-400 block font-normal">{t('olfactoryRoleFunction', lang)}</span>
                <span className="text-slate-200 font-normal mt-1 block leading-relaxed">
                  {selectedTier.olfactoryRole}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-slate-800/70">
                <span className="text-[11px] text-slate-400 block font-normal">{t('molecularClasses', lang)}</span>
                <span className="text-slate-200 font-normal mt-1 block leading-relaxed">
                  {selectedTier.molecularProfile}
                </span>
              </div>
            </div>

            {/* Evaporation Half-Life Curve Graphic */}
            <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {t('sensoryDecayTimeline', lang)}
                </span>
                <span className="font-mono-tabular text-[11px] text-slate-400">
                  {t('substantivityWindow', lang)}: {selectedTier.evaporationTime}
                </span>
              </div>

              {/* Blotter Intensity Step Timeline */}
              <div className="grid grid-cols-7 gap-1 pt-1 font-mono-tabular text-[10px] text-center">
                {[
                  { time: '0h', intensity: selectedTierId === 'top' ? 10 : selectedTierId === 'top-heart' ? 8 : selectedTierId === 'heart' ? 6 : selectedTierId === 'heart-base' ? 5 : 4 },
                  { time: '30m', intensity: selectedTierId === 'top' ? 8 : selectedTierId === 'top-heart' ? 9 : selectedTierId === 'heart' ? 8 : selectedTierId === 'heart-base' ? 6 : 5 },
                  { time: '2h', intensity: selectedTierId === 'top' ? 3 : selectedTierId === 'top-heart' ? 7 : selectedTierId === 'heart' ? 9 : selectedTierId === 'heart-base' ? 8 : 6 },
                  { time: '6h', intensity: selectedTierId === 'top' ? 0 : selectedTierId === 'top-heart' ? 2 : selectedTierId === 'heart' ? 8 : selectedTierId === 'heart-base' ? 9 : 8 },
                  { time: '12h', intensity: selectedTierId === 'top' ? 0 : selectedTierId === 'top-heart' ? 0 : selectedTierId === 'heart' ? 4 : selectedTierId === 'heart-base' ? 7 : 9 },
                  { time: '24h', intensity: selectedTierId === 'top' ? 0 : selectedTierId === 'top-heart' ? 0 : selectedTierId === 'heart' ? 1 : selectedTierId === 'heart-base' ? 5 : 9 },
                  { time: '48h+', intensity: selectedTierId === 'top' ? 0 : selectedTierId === 'top-heart' ? 0 : selectedTierId === 'heart' ? 0 : selectedTierId === 'heart-base' ? 2 : 8 },
                ].map((step, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="h-12 bg-slate-800/60 rounded flex items-end justify-center p-1">
                      <div
                        className={`w-full rounded-sm transition-all duration-200 ${
                          step.intensity >= 7
                            ? 'bg-emerald-500'
                            : step.intensity >= 4
                            ? 'bg-amber-500'
                            : step.intensity > 0
                            ? 'bg-slate-600'
                            : 'bg-transparent'
                        }`}
                        style={{ height: `${(step.intensity / 10) * 100}%` }}
                      />
                    </div>
                    <div className="text-slate-400">{step.time}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Special Bridge Formulation Principle */}
            {selectedTier.bridgePrinciple && (
              <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-700/60 text-xs text-emerald-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  {t('bridgingPrincipleTitle', lang)}
                </div>
                <p className="leading-relaxed text-[11px] text-emerald-100">
                  {selectedTier.bridgePrinciple}
                </p>
              </div>
            )}
          </div>

          {/* 2. Active Formula Ingredients with Interactive Vertical Volume Faders */}
          <div className="rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  {t('activeFormulaIngredientsInTier', lang)} ({formulaTierBreakdown.details[selectedTierId].items.length})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t('scrollGestureInstruction', lang)}
                </p>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="font-mono-tabular text-slate-300">
                  {formulaTierBreakdown.percentages[selectedTierId].toFixed(2)}% total
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setModalTierId(selectedTierId);
                    setModalSearchQuery('');
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'fa' ? 'افزودن ماده' : 'Add Material'}</span>
                </button>
              </div>
            </div>

            {formulaTierBreakdown.details[selectedTierId].items.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#0B0E14] border border-dashed border-emerald-500/50 text-xs text-slate-300 text-center space-y-3">
                <p>{t('noMaterialsAssigned', lang)}</p>
                <button
                  type="button"
                  onClick={() => {
                    setModalTierId(selectedTierId);
                    setModalSearchQuery('');
                  }}
                  className="mx-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('addMaterialModalTitle', lang)}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Visual Vertical Faders Console for Tier Materials */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3 bg-[#0B0E14] rounded-lg border border-slate-800">
                  {formulaTierBreakdown.details[selectedTierId].items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col items-center justify-between p-2.5 rounded border border-slate-800/80 bg-[#111621] hover:border-slate-700 transition-colors"
                    >
                      <div className="w-full flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-white truncate max-w-[80px]" title={item.name}>
                          {item.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id, item.name)}
                          className="text-slate-500 hover:text-rose-400 p-0.5"
                          title={t('removeFromTier', lang)}
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Interactive Vertical Volume Control */}
                      <VerticalVolumeControl
                        name={item.name}
                        value={item.percentage}
                        min={0}
                        max={40}
                        step={0.2}
                        unit="%"
                        label={`${item.quantityGrams.toFixed(1)}g`}
                        color={selectedTier.themeColor}
                        onChange={(newVal) => handleUpdateItemPercentage(item.id, newVal)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Drag & Drop Material Library Workbench */}
          <div className="rounded-xl bg-[#111621] border border-slate-800 p-5 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  {t('dragDropWorkbenchTitle', lang)} ({filteredWorkbenchMaterials.length})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t('dragDropWorkbenchSubtitle', lang)}
                </p>
              </div>

              {/* Tier Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-[#0B0E14] border border-slate-800 rounded-lg text-[11px] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setMaterialWorkbenchTierFilter('all')}
                  className={`px-2 py-0.5 rounded whitespace-nowrap ${
                    materialWorkbenchTierFilter === 'all'
                      ? 'bg-slate-800 text-white font-medium'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t('allTiers', lang)}
                </button>
                {PYRAMID_TIERS.map((tDef) => (
                  <button
                    key={tDef.id}
                    type="button"
                    onClick={() => setMaterialWorkbenchTierFilter(tDef.id)}
                    className={`px-2 py-0.5 rounded whitespace-nowrap ${
                      materialWorkbenchTierFilter === tDef.id
                        ? 'bg-slate-800 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tDef.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder={lang === 'fa' ? 'جستجوی نام ماده، خانواده بویایی یا نت‌ها...' : 'Search raw materials or family...'}
                value={materialSearchQuery}
                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                dir="auto"
                className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Draggable Materials Workbench Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {filteredWorkbenchMaterials.map((mat) => {
                const matTier = getMaterialPyramidTier(mat);
                const isUsedInActive = currentVersion?.items.some(
                  (i) => i.materialId === mat.id || i.name.toLowerCase() === mat.name.toLowerCase()
                );

                return (
                  <div
                    key={mat.id}
                    draggable
                    onDragStart={(e) =>
                      handleDragStart(e, {
                        materialId: mat.id,
                        name: mat.name,
                        tier: matTier,
                      })
                    }
                    className="p-3 rounded-lg bg-[#0B0E14] border border-slate-800 hover:border-slate-600 cursor-grab active:cursor-grabbing flex flex-col justify-between text-xs transition-all hover:bg-slate-900/60 group"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-white group-hover:text-emerald-400">
                          <GripVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
                          <span className="truncate max-w-[160px]">{mat.name}</span>
                        </div>
                        {isUsedInActive ? (
                          <span className="text-[10px] font-mono-tabular text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                            {t('inFormulaBadge', lang)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {matTier}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {mat.descriptiveNotes}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono-tabular text-slate-400">
                      <span>{mat.primaryFamily} · {mat.volatility}</span>
                      <button
                        type="button"
                        onClick={() => onSelectMaterial(mat.id)}
                        className="text-emerald-400 hover:text-emerald-300 font-sans font-medium flex items-center gap-0.5"
                      >
                        {t('dossierBtn', lang)} <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
