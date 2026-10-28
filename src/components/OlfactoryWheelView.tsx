import React, { useState, useMemo } from 'react';
import {
  AccordDefinition,
  Formula,
  FormulaLineItem,
  MacroFamily,
  OlfactoryFamilyDef,
  RawMaterial,
  SensoryEvaluation,
} from '../domain/types';
import { OLFACTORY_WHEEL_FAMILIES } from '../domain/olfactory-wheel-families';
import {
  Plus,
  Layers,
  Compass,
  ArrowRight,
  Radar,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface OlfactoryWheelViewProps {
  mode: 'wheel' | 'hierarchy';
  formulas: Formula[];
  activeFormula?: Formula | null;
  materials: RawMaterial[];
  accords: AccordDefinition[];
  evaluations: SensoryEvaluation[];
  onUpdateTargetFacets: (formulaId: number, updatedFacets: Record<string, number>) => void;
  onUpdateFormulaItems?: (newItems: FormulaLineItem[]) => void;
  onSelectMaterial: (materialId: number) => void;
  onSelectFormula: (formulaId: number) => void;
}

interface MacroFamilyMeta {
  id: MacroFamily;
  name: string;
  tagline: string;
  color: string;
  bgLight: string;
  borderStroke: string;
}

const MACRO_GROUPS: MacroFamilyMeta[] = [
  {
    id: 'Floral',
    name: 'Floral',
    tagline: 'Blossoms, powdery aldehydes & airy musks',
    color: '#F43F5E',
    bgLight: 'rgba(244, 63, 94, 0.16)',
    borderStroke: '#F43F5E',
  },
  {
    id: 'Amber',
    name: 'Amber',
    tagline: 'Warm resins, spices, ambergris & gourmand',
    color: '#F97316',
    bgLight: 'rgba(249, 115, 22, 0.16)',
    borderStroke: '#F97316',
  },
  {
    id: 'Woody',
    name: 'Woody',
    tagline: 'Cedar, sandalwood, mossy chypres & leather',
    color: '#A16207',
    bgLight: 'rgba(161, 98, 7, 0.16)',
    borderStroke: '#A16207',
  },
  {
    id: 'Fresh',
    name: 'Fresh',
    tagline: 'Citrus peel, green leaves, marine & aromatics',
    color: '#10B981',
    bgLight: 'rgba(16, 185, 129, 0.16)',
    borderStroke: '#10B981',
  },
];

// Aligned clockwise radar axes matching all 14 sectors of the Michael Edwards wheel:
export const RADAR_AXES_CLOCKWISE = [
  { id: 'floral', name: 'Floral', angleDeg: -167.14, macro: 'Floral', aliases: ['Jasmine', 'Rose', 'Floral'] },
  { id: 'soft-floral', name: 'Soft Floral', angleDeg: -141.43, macro: 'Floral', aliases: ['Musky', 'Aldehydic', 'Powdery', 'Soft Floral'] },
  { id: 'floral-amber', name: 'Floral Amber', angleDeg: -115.71, macro: 'Floral', aliases: ['Solar', 'Orange Blossom', 'Floral Amber'] },
  { id: 'soft-amber', name: 'Soft Amber', angleDeg: -90.00, macro: 'Amber', aliases: ['Spicy', 'Incense', 'Cardamom', 'Soft Amber'] },
  { id: 'amber', name: 'Amber', angleDeg: -64.29, macro: 'Amber', aliases: ['Ambroxan', 'Resinous', 'Balsamic', 'Amber'] },
  { id: 'woody-amber', name: 'Woody Amber', angleDeg: -38.57, macro: 'Amber', aliases: ['Sweet', 'Tonka', 'Gourmand', 'Woody Amber'] },
  { id: 'woods', name: 'Woods', angleDeg: -12.86, macro: 'Woody', aliases: ['Woody', 'Cedar', 'Sandalwood', 'Woods'] },
  { id: 'mossy-woods', name: 'Mossy Woods', angleDeg: 12.86, macro: 'Woody', aliases: ['Mossy', 'Chypre', 'Oakmoss', 'Mossy Woods'] },
  { id: 'dry-woods', name: 'Dry Woods', angleDeg: 38.57, macro: 'Woody', aliases: ['Earthy', 'Leather', 'Smoky', 'Tobacco', 'Dry Woods'] },
  { id: 'aromatic', name: 'Aromatic', angleDeg: 64.29, macro: 'Fresh', aliases: ['Fougère', 'Lavender', 'Herbal', 'Aromatic'] },
  { id: 'citrus', name: 'Citrus', angleDeg: 90.00, macro: 'Fresh', aliases: ['Bergamot', 'Lemon', 'Mandarin', 'Citrus'] },
  { id: 'water', name: 'Water', angleDeg: 115.71, macro: 'Fresh', aliases: ['Marine', 'Aquatic', 'Ozonic', 'Mineral', 'Water'] },
  { id: 'green', name: 'Green', angleDeg: 141.43, macro: 'Fresh', aliases: ['Galbanum', 'Leafy', 'Cut Grass', 'Green'] },
  { id: 'fruity', name: 'Fruity', angleDeg: 167.14, macro: 'Fresh', aliases: ['Cassis', 'Peach', 'Pear', 'Apple', 'Berry', 'Fruity'] },
];

export const getFacetScore = (
  profile: Record<string, number>,
  axis: (typeof RADAR_AXES_CLOCKWISE)[number]
): number => {
  if (profile[axis.name] !== undefined) return profile[axis.name];
  if (profile[axis.id] !== undefined) return profile[axis.id];
  for (const al of axis.aliases) {
    if (profile[al] !== undefined) return profile[al];
  }
  return 0;
};

// Maps each of the 14 Michael Edwards wheel families to related material/accord family tags
const FAMILY_MATCH_ALIASES: Record<string, string[]> = {
  floral: ['floral', 'jasmine', 'rose', 'white floral'],
  'soft-floral': ['soft floral', 'aldehydic', 'musky', 'powdery'],
  'floral-amber': ['floral amber', 'orange blossom', 'solar', 'musky'],
  'soft-amber': ['soft amber', 'spicy', 'incense', 'cardamom'],
  amber: ['amber', 'resinous', 'balsamic', 'labdanum'],
  'woody-amber': ['woody amber', 'gourmand', 'sweet', 'tonka', 'patchouli'],
  woods: ['woods', 'woody', 'cedar', 'sandalwood'],
  'mossy-woods': ['mossy woods', 'mossy', 'earthy', 'chypre', 'oakmoss'],
  'dry-woods': ['dry woods', 'leather', 'tobacco', 'smoky', 'suede'],
  aromatic: ['aromatic', 'fougère', 'lavender', 'herbal'],
  citrus: ['citrus', 'bergamot', 'lemon', 'mandarin'],
  water: ['water', 'marine', 'mineral', 'ozonic', 'aquatic'],
  green: ['green', 'galbanum', 'leafy', 'violet leaf'],
  fruity: ['fruity', 'pear', 'fig', 'cassis', 'peach'],
};

export const OlfactoryWheelView: React.FC<OlfactoryWheelViewProps> = ({
  mode,
  formulas,
  activeFormula,
  materials,
  accords,
  evaluations,
  onUpdateTargetFacets,
  onUpdateFormulaItems,
  onSelectMaterial,
  onSelectFormula,
}) => {
  // Allow null state when "All 14 Families" is active so no sector appears selected
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedSubFacet, setSelectedSubFacet] = useState<string>('Crystalline');
  const [customSubFacets, setCustomSubFacets] = useState<Record<string, string[]>>({});
  const [newSubFacetName, setNewSubFacetName] = useState('');
  const [macroFilter, setMacroFilter] = useState<'All' | MacroFamily>('All');
  const [showRadarOverlay, setShowRadarOverlay] = useState<boolean>(true);
  const [editProfileMode, setEditProfileMode] = useState<'target' | 'result'>('target');
  const [suggestionFeedback, setSuggestionFeedback] = useState<string | null>(null);

  const latestEval = activeFormula
    ? evaluations.find((e) => e.formulaId === activeFormula.id) || evaluations[0]
    : evaluations[0];
  const [localResultFacets, setLocalResultFacets] = useState<Record<string, number>>(
    latestEval?.evaluatedFacets || {
      Floral: 6,
      'Soft Floral': 5,
      'Floral Amber': 4,
      'Soft Amber': 3,
      Amber: 5,
      'Woody Amber': 2,
      Woods: 8,
      'Mossy Woods': 4,
      'Dry Woods': 4,
      Aromatic: 4,
      Citrus: 5,
      Water: 6,
      Green: 8,
      Fruity: 3,
    }
  );

  const selectedFamily = selectedFamilyId
    ? OLFACTORY_WHEEL_FAMILIES.find((f) => f.id === selectedFamilyId) || null
    : null;

  const activeFamilyForSubFacets = selectedFamily || OLFACTORY_WHEEL_FAMILIES[0];

  const allSubFacetsForFamily = [
    ...activeFamilyForSubFacets.subFacets,
    ...(customSubFacets[activeFamilyForSubFacets.id] || []),
  ];

  const targetFacets = activeFormula?.targetFacets || {};

  const handleScoreChange = (facetName: string, score: number) => {
    if (editProfileMode === 'target') {
      const next = { ...targetFacets, [facetName]: score };
      if (activeFormula) {
        onUpdateTargetFacets(activeFormula.id, next);
      }
    } else {
      setLocalResultFacets((prev) => ({ ...prev, [facetName]: score }));
    }
  };

  const handleAddCustomSubFacet = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubFacetName.trim();
    if (!trimmed || !activeFamilyForSubFacets) return;
    setCustomSubFacets((prev) => ({
      ...prev,
      [activeFamilyForSubFacets.id]: [...(prev[activeFamilyForSubFacets.id] || []), trimmed],
    }));
    setSelectedSubFacet(trimmed);
    setNewSubFacetName('');
  };

  // Build radar polygon using 14 clockwise axes aligned with the wheel sectors
  const buildRadarPolygonClockwise = (
    profile: Record<string, number>,
    maxRadius: number,
    cx: number,
    cy: number
  ) => {
    return RADAR_AXES_CLOCKWISE.map((axis) => {
      const rad = (axis.angleDeg * Math.PI) / 180;
      const val = Math.min(10, Math.max(0, getFacetScore(profile, axis)));
      const r = (val / 10) * maxRadius;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  const selectedAliases = selectedFamily
    ? FAMILY_MATCH_ALIASES[selectedFamily.id] || [selectedFamily.name.toLowerCase()]
    : [];

  // Filter materials, accords, and formulas using canonical family aliases
  const matchingMaterials = materials.filter((m) => {
    if (!selectedFamily) return true;
    const pFam = m.primaryFamily.toLowerCase();
    return (
      selectedAliases.includes(pFam) ||
      m.facets.some((f) => {
        const lowerF = f.toLowerCase();
        return (
          lowerF.includes(selectedSubFacet.toLowerCase()) ||
          selectedAliases.some((al) => lowerF.includes(al))
        );
      })
    );
  });

  const matchingAccords = accords.filter((a) => {
    if (!selectedFamily) return true;
    const cat = a.category.toLowerCase();
    return (
      selectedAliases.some((al) => cat.includes(al)) ||
      cat === selectedSubFacet.toLowerCase() ||
      Object.keys(a.olfactoryProfile).some((k) =>
        selectedAliases.includes(k.toLowerCase())
      )
    );
  });

  const matchingFormulas = formulas.filter((f) => {
    if (!selectedFamily) return true;
    return (
      f.targetFamilies.some((fam) =>
        selectedAliases.includes(fam.toLowerCase())
      ) ||
      (f.targetFacets &&
        Object.entries(f.targetFacets).some(
          ([k, score]) => score >= 4 && selectedAliases.includes(k.toLowerCase())
        ))
    );
  });

  // Active formula distribution mapped across the 14 wheel families
  const activeFormulaFamilyWeights = useMemo(() => {
    if (!activeFormula || !activeFormula.versions || activeFormula.versions.length === 0) {
      const emptyMap: Record<string, { grams: number; pct: number; count: number }> = {};
      OLFACTORY_WHEEL_FAMILIES.forEach((fam) => {
        emptyMap[fam.id] = { grams: 0, pct: 0, count: 0 };
      });
      return emptyMap;
    }
    const currentVersion =
      activeFormula.versions.find(
        (v) => v.versionLabel === activeFormula.activeVersionLabel
      ) || activeFormula.versions[0];
    const items = currentVersion?.items || [];
    const totalGrams = items.reduce((s, it) => s + it.quantityGrams, 0);
    const map: Record<string, { grams: number; pct: number; count: number }> = {};

    OLFACTORY_WHEEL_FAMILIES.forEach((fam) => {
      map[fam.id] = { grams: 0, pct: 0, count: 0 };
    });

    items.forEach((it) => {
      const mat = materials.find((m) => m.id === it.materialId);
      const primary = (mat?.primaryFamily || (it as any).role || '').toLowerCase();
      if (!primary) return;

      // Match to canonical wheel family ID
      const matchedFam =
        OLFACTORY_WHEEL_FAMILIES.find(
          (f) => f.name.toLowerCase() === primary || f.id === primary
        ) ||
        OLFACTORY_WHEEL_FAMILIES.find((f) =>
          (FAMILY_MATCH_ALIASES[f.id] || []).includes(primary)
        );

      if (matchedFam) {
        map[matchedFam.id].grams += it.quantityGrams;
        map[matchedFam.id].count += 1;
      }
    });

    Object.keys(map).forEach((k) => {
      map[k].pct = totalGrams > 0 ? (map[k].grams / totalGrams) * 100 : 0;
    });
    return map;
  }, [activeFormula, materials]);

  // Apply a suggested database material (or adjust an existing material) directly to the active formula
  const handleApplySuggestionToFormula = (
    material: RawMaterial,
    recommendedPctDelta: number,
    familyName: string
  ) => {
    if (!activeFormula || !activeFormula.versions || activeFormula.versions.length === 0) return;
    const currentVersion =
      activeFormula.versions.find(
        (v) => v.versionLabel === activeFormula.activeVersionLabel
      ) || activeFormula.versions[0];
    if (!currentVersion) return;

    const existingItems = [...currentVersion.items];
    const totalCurrentGrams =
      existingItems.reduce((sum, it) => sum + it.quantityGrams, 0) || 100;
    const deltaGrams = Number(
      Math.max(0.2, (Math.abs(recommendedPctDelta) / 100) * totalCurrentGrams).toFixed(2)
    );

    const existingIdx = existingItems.findIndex((it) => it.materialId === material.id);
    let updatedRawItems: FormulaLineItem[];

    if (existingIdx >= 0) {
      updatedRawItems = existingItems.map((it, idx) => {
        if (idx !== existingIdx) return it;
        const nextGrams =
          recommendedPctDelta >= 0
            ? Number((it.quantityGrams + deltaGrams).toFixed(2))
            : Math.max(0.1, Number((it.quantityGrams - deltaGrams).toFixed(2)));
        return {
          ...it,
          quantityGrams: nextGrams,
          activeMaterialPercent: nextGrams * (it.dilutionPercent / 100),
          notes: `Adjusted via Olfactory Wheel Advisor (${familyName})`,
        };
      });
    } else {
      const newLine: FormulaLineItem = {
        id: `wheel-sug-${Date.now()}-${material.id}`,
        type: 'material',
        materialId: material.id,
        name: material.name,
        quantityGrams: deltaGrams,
        percentage: Math.abs(recommendedPctDelta),
        dilutionPercent: 100,
        solvent: 'Neat',
        activeMaterialPercent: deltaGrams,
        supplier: material.supplier || 'Atelier Stock',
        costPerGram: material.costPerGram ?? 0.38,
        notes: `Suggested for ${familyName} target alignment (${material.volatility} note)`,
      };
      updatedRawItems = [...existingItems, newLine];
    }

    const newTotalGrams = updatedRawItems.reduce((s, it) => s + it.quantityGrams, 0);
    const normalizedItems = updatedRawItems.map((it) => ({
      ...it,
      percentage: newTotalGrams > 0 ? (it.quantityGrams / newTotalGrams) * 100 : 0,
    }));

    if (onUpdateFormulaItems) {
      onUpdateFormulaItems(normalizedItems);
    }

    // Also nudge local smelled result closer to target so user sees immediate visual convergence
    setLocalResultFacets((prev) => {
      const cur = prev[familyName] ?? 0;
      const tgt = targetFacets[familyName] ?? cur;
      const step = tgt > cur ? Math.min(tgt, cur + 2) : Math.max(tgt, cur - 2);
      return { ...prev, [familyName]: step };
    });

    if (activeFormula) {
      setSuggestionFeedback(
        `${recommendedPctDelta >= 0 ? 'Added' : 'Reduced'} ${material.name} (${recommendedPctDelta >= 0 ? '+' : ''}${recommendedPctDelta.toFixed(1)}% / ${deltaGrams}g) in ${activeFormula.name} (${activeFormula.activeVersionLabel}) to align ${familyName}.`
      );
      setTimeout(() => setSuggestionFeedback(null), 5000);
    }
  };

  // Compute Target vs. Result Distance Diagnostics & Database Material Recommendations
  const gapDiagnostics = useMemo(() => {
    const currentVersion =
      activeFormula?.versions?.find(
        (v) => v.versionLabel === activeFormula.activeVersionLabel
      ) || activeFormula?.versions?.[0];
    const formulaItems = currentVersion?.items || [];
    const formulaMaterialIds = new Set(
      formulaItems.map((i) => i.materialId).filter(Boolean)
    );

    const diagnostics = RADAR_AXES_CLOCKWISE.map((axis, idx) => {
      const fam =
        OLFACTORY_WHEEL_FAMILIES.find((f) => f.id === axis.id) ||
        OLFACTORY_WHEEL_FAMILIES[idx];
      const targetVal = getFacetScore(targetFacets, axis);
      const resultVal = getFacetScore(localResultFacets, axis);
      const delta = resultVal - targetVal; // negative = deficit (Result < Target), positive = excess (Result > Target)
      const absGap = Math.abs(delta);
      const famWeight = activeFormulaFamilyWeights[fam.id] || {
        grams: 0,
        pct: 0,
        count: 0,
      };
      const aliases = FAMILY_MATCH_ALIASES[fam.id] || [fam.name.toLowerCase()];

      // Find complementary opposite family on the 14-sector wheel (index + 7)
      const oppositeFam =
        OLFACTORY_WHEEL_FAMILIES[(idx + 7) % OLFACTORY_WHEEL_FAMILIES.length];

      // Find database materials matching this family
      const candidateMaterials = materials
        .filter((m) => {
          const pFam = m.primaryFamily.toLowerCase();
          return (
            aliases.includes(pFam) ||
            m.facets.some((fac) => aliases.some((al) => fac.toLowerCase().includes(al)))
          );
        })
        .sort((a, b) => {
          // Priority 1: Available workbench materials (m.isOnWorkbench !== false)
          const aWorkbench = a.isOnWorkbench !== false ? 1 : 0;
          const bWorkbench = b.isOnWorkbench !== false ? 1 : 0;
          if (aWorkbench !== bWorkbench) return bWorkbench - aWorkbench;
          // Prefer materials not yet in formula for deficits, or materials already in formula for excesses
          const aIn = formulaMaterialIds.has(a.id) ? 1 : 0;
          const bIn = formulaMaterialIds.has(b.id) ? 1 : 0;
          if (delta < 0 && aIn !== bIn) return aIn - bIn;
          if (delta > 0 && aIn !== bIn) return bIn - aIn;
          return (b.intensity || 5) - (a.intensity || 5);
        });

      // Explain WHY there is a distance between Target Intent and Smelled Result
      let whyDistance = '';
      let actionStrategy = '';
      if (delta < 0) {
        if (famWeight.count === 0 || famWeight.pct < 1) {
          whyDistance = `Structural Deficit (${resultVal}/10 smelled vs ${targetVal}/10 target): Your active formula currently contains ${famWeight.pct.toFixed(1)}% raw materials in the ${fam.name} family, leaving an unbridged ${absGap}-point sensory gap.`;
          actionStrategy = `Introduce a high-impact ${fam.name} heart/top or base anchor from your database at +${Math.min(6, Math.max(1.5, absGap * 1.1)).toFixed(1)}% to build immediate ${fam.subFacets.slice(0, 2).join(' & ')} presence.`;
        } else {
          whyDistance = `Olfactory Masking & Volatility Suppression (${resultVal}/10 smelled vs ${targetVal}/10 target): Although ${fam.name} represents ${famWeight.pct.toFixed(1)}% (${famWeight.count} material${famWeight.count > 1 ? 's' : ''}) of the formula, heavier base/woody fixatives are dampening its perceived radiance on the blotter.`;
          actionStrategy = `Boost diffusive ${fam.name} modifiers (+${Math.min(4.5, Math.max(1.2, absGap * 0.9)).toFixed(1)}%) with high Olfactory Power to project through the base structure.`;
        }
      } else if (delta > 0) {
        whyDistance = `Headspace Over-Projection (+${delta} pts above ${targetVal}/10 target): High-impact materials in ${fam.name} (${famWeight.pct.toFixed(1)}% of batch weight) are dominating evaporation and crowding adjacent nuances.`;
        actionStrategy = `Reduce ${fam.name} dosage by ~${Math.min(5, Math.max(1.0, delta * 1.0)).toFixed(1)}% or counterbalance with complementary ${oppositeFam.name} (${oppositeFam.macroFamily}) notes across the wheel.`;
      } else {
        whyDistance = `Calibrated Equilibrium (${targetVal}/10): Perceived blotter evaluation matches your target brief for ${fam.name} (${famWeight.pct.toFixed(1)}% of formula weight).`;
        actionStrategy = `Maintain current ${fam.name} ratio or fine-tune sub-facet nuances (${fam.subFacets.slice(0, 2).join(', ')}).`;
      }

      const recommendedPctDelta =
        delta < 0
          ? Number(Math.min(5.5, Math.max(1.5, absGap * 1.1)).toFixed(1))
          : delta > 0
          ? -Number(Math.min(4.5, Math.max(1.0, absGap * 0.9)).toFixed(1))
          : 1.5;

      return {
        axis,
        fam,
        oppositeFam,
        targetVal,
        resultVal,
        delta,
        absGap,
        famWeight,
        whyDistance,
        actionStrategy,
        recommendedPctDelta,
        suggestedMaterials: candidateMaterials.slice(0, 3),
      };
    });

    // Overall alignment % across the 14 families
    const totalMaxDiff = RADAR_AXES_CLOCKWISE.length * 10;
    const totalActualDiff = diagnostics.reduce((s, d) => s + d.absGap, 0);
    const alignmentScore = Math.max(
      0,
      Math.round(((totalMaxDiff - totalActualDiff) / totalMaxDiff) * 100)
    );

    return {
      all: diagnostics,
      divergent: [...diagnostics]
        .filter((d) => d.absGap > 0)
        .sort((a, b) => b.absGap - a.absGap),
      alignmentScore,
    };
  }, [targetFacets, localResultFacets, activeFormulaFamilyWeights, materials, activeFormula]);

  // Michael Edwards 14-Sector Single-Ring Wheel Geometry:
  // Center Circle: rCenterHub = 228 (diameter 456px; expanded calibration hub)
  // Single Ring of 14 Equal Wedges: rInnerSub = 236 to rOuterSub = 312 (76px slim radial thickness)
  // Curved Sub-Family Titles outside each wedge: rSubTitle = 328..335
  // Outer Aspect Border Track & Directional Arrows: rOuterTrack = 380
  const cx = 420;
  const cy = 420;
  const rCenterHub = 228;
  const rRadarMax = 175;
  const rInnerSub = 236;
  const rOuterSub = 312;
  const rOuterTrack = 380;
  const degToRad = (deg: number) => (deg * Math.PI) / 180;
  const sliceDeg = 360 / OLFACTORY_WHEEL_FAMILIES.length; // 25.7142857°

  // Outer Aspect Border Configurations matching the Michael Edwards schematic:
  // Floral: Wedges 0..2 (-180° to -102.86°)
  // Amber (AMBERY): Wedges 3..5 (-102.86° to -25.71°)
  // Woody (WOODY): Wedges 6..8 (-25.71° to +51.43°)
  // Fresh (FRESH): Wedges 9..13 (+51.43° to +180°)
  const OUTER_ASPECT_ARCS: Array<{
    macro: MacroFamily;
    displayLabel: string;
    color: string;
    startDeg: number;
    endDeg: number;
    labelStartDeg: number;
    labelEndDeg: number;
    reverseText: boolean;
  }> = [
    {
      macro: 'Floral',
      displayLabel: 'FLORAL',
      color: '#EA6E99',
      startDeg: -178.8,
      endDeg: -104.2,
      labelStartDeg: -155.0,
      labelEndDeg: -128.0,
      reverseText: false,
    },
    {
      macro: 'Amber',
      displayLabel: 'AMBERY',
      color: '#BD5C18',
      startDeg: -101.6,
      endDeg: -27.0,
      labelStartDeg: -78.5,
      labelEndDeg: -50.0,
      reverseText: false,
    },
    {
      macro: 'Woody',
      displayLabel: 'WOODY',
      color: '#AD7B3B',
      startDeg: -24.4,
      endDeg: 50.1,
      labelStartDeg: 4.0,
      labelEndDeg: 31.0,
      reverseText: true,
    },
    {
      macro: 'Fresh',
      displayLabel: 'FRESH',
      color: '#008AC5',
      startDeg: 52.7,
      endDeg: 178.8,
      labelStartDeg: 103.0,
      labelEndDeg: 129.0,
      reverseText: true,
    },
  ];

  if (mode === 'hierarchy') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-sans font-semibold text-white">
              Scent Hierarchy Explorer
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Drill down from olfactory super-families and sub-facets directly to matching raw materials, accords, and formulas.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-tabular">
            <span>4 Primary Super-Families</span>
            <span aria-hidden="true">·</span>
            <span>{OLFACTORY_WHEEL_FAMILIES.length} Standard Families</span>
            <span aria-hidden="true">·</span>
            <span>{materials.length} Materials</span>
          </div>
        </div>

        {(() => {
          const academicFamily = selectedFamily || OLFACTORY_WHEEL_FAMILIES[0];
          const academicSubFacets = [
            ...academicFamily.subFacets,
            ...(customSubFacets[academicFamily.id] || []),
          ];
          return (
            <>
              {/* Academic Breadcrumb Chain */}
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-[#111621] border border-slate-800 text-xs">
                <span className="text-slate-400">Academic Hierarchy:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
                  {academicFamily.macroFamily} Super-Family
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-white">{academicFamily.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-300">{selectedSubFacet} Sub-Facet</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-400 font-mono-tabular">
                  {matchingMaterials.length} Raw Materials · {matchingAccords.length} Accords · {matchingFormulas.length} Formulas
                </span>
              </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: 17 Olfactory Families Grouped by Super-Family */}
          <div className="lg:col-span-3 rounded-lg bg-[#111621] border border-slate-800 p-4">
            <h2 className="text-xs font-semibold text-slate-300 mb-3 flex items-center justify-between">
              <span>01. Standard Families</span>
              <span className="font-mono-tabular text-slate-400">17 Categories</span>
            </h2>
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {MACRO_GROUPS.map((mg) => {
                const groupFamilies = OLFACTORY_WHEEL_FAMILIES.filter(
                  (f) => f.macroFamily === mg.id
                );
                return (
                  <div key={mg.id} className="space-y-1">
                    <div className="text-[10px] uppercase font-mono-tabular tracking-wider text-slate-400 px-2 py-0.5 border-b border-slate-800/80">
                      {mg.name} Super-Family ({groupFamilies.length})
                    </div>
                    {groupFamilies.map((fam) => {
                      const isSelected = fam.id === academicFamily.id;
                      return (
                        <button
                          key={fam.id}
                          type="button"
                          onClick={() => {
                            setSelectedFamilyId(fam.id);
                            setSelectedSubFacet(fam.subFacets[0] || fam.name);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-xs transition-colors ${
                            isSelected
                              ? 'bg-slate-800 text-white font-medium'
                              : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: fam.color }}
                            />
                            <span className="truncate">{fam.name}</span>
                          </span>
                          <span className="font-mono-tabular text-[11px] text-slate-400">
                            {fam.subFacets.length + (customSubFacets[fam.id]?.length || 0)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Sub-Facets + Academic Reference */}
          <div className="lg:col-span-3 rounded-lg bg-[#111621] border border-slate-800 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: academicFamily.color }}
                />
                <h2 className="text-xs font-semibold text-slate-200">
                  02. {academicFamily.name} Facets
                </h2>
              </div>
              <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                {academicFamily.description}
              </p>
              {academicFamily.academicNotes && (
                <div className="p-2.5 rounded-md bg-[#0B0E14] border border-slate-800/80 text-[11px] text-slate-300 mb-3 leading-relaxed">
                  <span className="text-emerald-400 font-mono-tabular block text-[10px] uppercase">
                    Academic Standard Note
                  </span>
                  {academicFamily.academicNotes}
                </div>
              )}
              <div className="space-y-1.5">
                {academicSubFacets.map((sub) => {
                  const active = sub === selectedSubFacet;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubFacet(sub)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors ${
                        active
                          ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 font-medium'
                          : 'bg-[#0B0E14] border border-slate-800/80 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>{sub}</span>
                      <ArrowRight className="w-3 h-3 opacity-70" />
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleAddCustomSubFacet} className="mt-6 pt-4 border-t border-slate-800">
              <label
                htmlFor="custom-subfacet-input"
                className="block text-[11px] font-medium text-slate-400 mb-1.5"
              >
                Add Custom Sub-Facet to {academicFamily.name}
              </label>
              <div className="flex gap-2">
                <input
                  id="custom-subfacet-input"
                  type="text"
                  value={newSubFacetName}
                  onChange={(e) => setNewSubFacetName(e.target.value)}
                  placeholder="e.g., Damp Pine Needles"
                  className="flex-1 bg-[#0B0E14] border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  Add
                </button>
              </div>
            </form>
          </div>

          {/* Column 3: Connected Raw Materials, Accords, and Formulas */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-lg bg-[#111621] border border-slate-800 p-4">
              <h2 className="text-xs font-semibold text-slate-300 mb-3">
                03. Raw Materials in {academicFamily.name} → {selectedSubFacet} ({matchingMaterials.length})
              </h2>
              {matchingMaterials.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">
                  No raw materials currently tagged with {selectedSubFacet}. Select another facet or tag a raw material in the library.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {matchingMaterials.map((mat) => (
                    <div
                      key={mat.id}
                      className="p-3 rounded-md bg-[#0B0E14] border border-slate-800/90 hover:border-slate-700 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white">{mat.name}</span>
                          <span className="text-[11px] font-mono-tabular text-slate-400">
                            {mat.volatility}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {mat.naturalOrSynthetic} · CAS {mat.casNumber}
                        </p>
                        <p className="text-xs text-slate-300 mt-2 line-clamp-2">
                          {mat.descriptiveNotes}
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 truncate">
                          {mat.facets.join(' · ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectMaterial(mat.id)}
                          className="text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap shrink-0 ml-2"
                        >
                          Inspect →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg bg-[#111621] border border-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-300 mb-2">
                  04. Structural Accords ({matchingAccords.length})
                </h3>
                {matchingAccords.length === 0 ? (
                  <p className="text-xs text-slate-400">No accords linked to {academicFamily.name}.</p>
                ) : (
                  <div className="space-y-2">
                    {matchingAccords.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-2.5 rounded bg-[#0B0E14] border border-slate-800 text-xs"
                      >
                        <div className="font-semibold text-white">{acc.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {acc.items.map((i) => `${i.materialName} ${i.percentage}%`).join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-[#111621] border border-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-300 mb-2">
                  05. Formulas Using This Family ({matchingFormulas.length})
                </h3>
                {matchingFormulas.length === 0 ? (
                  <p className="text-xs text-slate-400">No formulas targeting {academicFamily.name}.</p>
                ) : (
                  <div className="space-y-2">
                    {matchingFormulas.map((f) => (
                      <div
                        key={f.id}
                        className="p-2.5 rounded bg-[#0B0E14] border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {f.name} ({f.activeVersionLabel})
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {f.status} · {f.intendedProduct}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectFormula(f.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium whitespace-nowrap shrink-0"
                        >
                          Open Lab
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
            </>
          );
        })()}
      </div>
    );
  }

  // 2. Interactive Academic Olfactory Wheel View
  return (
    <div className="space-y-6">
      {/* Clean Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-sans font-semibold text-white">
            Academic Fragrance Wheel & Aligned Calibration
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">
            Classify ingredients across 14 academic fragrance families and calibrate your target brief against perceived blotter results.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="toggle-radar-overlay-btn"
            onClick={() => setShowRadarOverlay((prev) => !prev)}
            className={`px-3 py-1.5 rounded-md text-xs font-normal border transition-colors flex items-center gap-1.5 ${
              showRadarOverlay
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                : 'bg-[#111621] text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>{showRadarOverlay ? 'Radar Overlay On' : 'Radar Overlay Off'}</span>
          </button>
        </div>
      </div>

      {/* Super-Family Segmented Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 mr-1 font-normal">Outer Aspects:</span>
            <button
              type="button"
              data-testid="filter-macro-all"
              onClick={() => {
                setMacroFilter('All');
                setSelectedFamilyId(null);
              }}
              className={`px-2.5 py-1 rounded text-xs font-normal transition-colors border ${
                macroFilter === 'All'
                  ? 'bg-slate-700/80 text-white border-slate-600'
                  : 'bg-[#0B0E14] text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              All 14 Families
            </button>
            {MACRO_GROUPS.map((mg) => {
              const count = OLFACTORY_WHEEL_FAMILIES.filter((f) => f.macroFamily === mg.id).length;
              const isActive = macroFilter === mg.id;
              return (
                <button
                  key={mg.id}
                  type="button"
                  data-testid={`filter-macro-${mg.id.toLowerCase()}`}
                  onClick={() => {
                    // Pressing again on the active macro aspect resets to All 14 Families
                    if (macroFilter === mg.id) {
                      setMacroFilter('All');
                      setSelectedFamilyId(null);
                      return;
                    }
                    setMacroFilter(mg.id);
                    const firstFam = OLFACTORY_WHEEL_FAMILIES.find((f) => f.macroFamily === mg.id);
                    if (firstFam) {
                      setSelectedFamilyId(firstFam.id);
                      setSelectedSubFacet(firstFam.subFacets[0] || firstFam.name);
                    }
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-normal transition-colors border flex items-center gap-1.5 ${
                    isActive
                      ? 'text-white font-medium border-current'
                      : 'bg-[#0B0E14] text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  style={isActive ? { backgroundColor: mg.bgLight, borderColor: mg.color } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: mg.color }}
                  />
                  <span>
                    {mg.name} ({count})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-[#0B0E14] border border-slate-800 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setEditProfileMode('target')}
              className={`px-3 py-1 rounded-md transition-colors ${
                editProfileMode === 'target'
                  ? 'bg-emerald-600 text-white font-normal'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Intent (Brief)
            </button>
            <button
              type="button"
              onClick={() => setEditProfileMode('result')}
              className={`px-3 py-1 rounded-md transition-colors ${
                editProfileMode === 'result'
                  ? 'bg-amber-600 text-white font-normal'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Result (Smelled)
            </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Michael Edwards Academic Single-Ring Fragrance Wheel SVG */}
        <div className="lg:col-span-7 rounded-xl bg-[#111621] border border-slate-800/80 p-5 sm:p-7 flex flex-col items-center">
          <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">
                Academic Fragrance Wheel
              </span>
              <span className="text-xs text-slate-400 font-mono-tabular">
                4 Outer Aspects · 14 Canonical Families
              </span>
            </div>
            {showRadarOverlay && (
              <div className="flex items-center gap-4 text-xs font-medium font-mono-tabular">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-3.5 h-1 rounded bg-emerald-400 inline-block" /> Intent
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-3.5 h-1 rounded bg-amber-400 inline-block" /> Smelled
                </span>
              </div>
            )}
          </div>

          <svg
            viewBox="0 0 840 840"
            data-testid="olfactory-wheel-svg"
            className="w-full max-w-[760px] h-auto select-none my-1"
            role="img"
            aria-label="Academic Fragrance Wheel with 4 outer aspect borders and 14 canonical fragrance families"
          >
            <defs>
              <radialGradient id="hubGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1E293B" stopOpacity="0.96" />
                <stop offset="100%" stopColor="#0B0E14" stopOpacity="1" />
              </radialGradient>

              {/* Curved Text Paths for the 4 Outer Aspect Titles (FLORAL, AMBERY, WOODY, FRESH) */}
              {OUTER_ASPECT_ARCS.map((arc) => {
                const rText = arc.reverseText ? rOuterTrack + 5 : rOuterTrack - 2;
                const sRad = degToRad(arc.reverseText ? arc.labelEndDeg : arc.labelStartDeg);
                const eRad = degToRad(arc.reverseText ? arc.labelStartDeg : arc.labelEndDeg);
                const sweep = arc.reverseText ? 0 : 1;
                const x1 = cx + rText * Math.cos(sRad);
                const y1 = cy + rText * Math.sin(sRad);
                const x2 = cx + rText * Math.cos(eRad);
                const y2 = cy + rText * Math.sin(eRad);
                return (
                  <path
                    key={`aspect-arc-def-${arc.macro}`}
                    id={`outer-aspect-arc-${arc.macro}`}
                    d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rText} ${rText} 0 0 ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)}`}
                  />
                );
              })}

              {/* Curved Text Paths for each of the 14 Sub-Family Titles right outside their wedge */}
              {OLFACTORY_WHEEL_FAMILIES.map((fam, idx) => {
                const startDeg = -180 + idx * sliceDeg + 0.5;
                const endDeg = -180 + (idx + 1) * sliceDeg - 0.5;
                const isBottomHalf = idx >= 7; // 0° to +180° reads left-to-right counter-clockwise
                const rSubArc = isBottomHalf ? rOuterSub + 25 : rOuterSub + 18;
                const sRad = degToRad(isBottomHalf ? endDeg : startDeg);
                const eRad = degToRad(isBottomHalf ? startDeg : endDeg);
                const sweep = isBottomHalf ? 0 : 1;
                const x1 = cx + rSubArc * Math.cos(sRad);
                const y1 = cy + rSubArc * Math.sin(sRad);
                const x2 = cx + rSubArc * Math.cos(eRad);
                const y2 = cy + rSubArc * Math.sin(eRad);
                return (
                  <path
                    key={`sub-arc-def-${fam.id}`}
                    id={`sub-title-arc-${fam.id}`}
                    d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rSubArc} ${rSubArc} 0 0 ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)}`}
                  />
                );
              })}
            </defs>

            {/* 1. OUTER ASPECT BORDER TRACK, RADIAL BOUNDARIES & DIRECTIONAL ARROWS (FLORAL, AMBERY, WOODY, FRESH) */}
            {OUTER_ASPECT_ARCS.map((arc) => {
              const isMacroHighlighted =
                macroFilter === arc.macro || selectedFamily?.macroFamily === arc.macro;
              const strokeColor = isMacroHighlighted ? '#FFFFFF' : arc.color;

              // Arc segment 1: startDeg -> labelStartDeg
              const s1 = degToRad(arc.startDeg);
              const e1 = degToRad(arc.labelStartDeg);
              const seg1D = `M ${(cx + rOuterTrack * Math.cos(s1)).toFixed(2)} ${(cy + rOuterTrack * Math.sin(s1)).toFixed(2)} A ${rOuterTrack} ${rOuterTrack} 0 0 1 ${(cx + rOuterTrack * Math.cos(e1)).toFixed(2)} ${(cy + rOuterTrack * Math.sin(e1)).toFixed(2)}`;

              // Arc segment 2: labelEndDeg -> endDeg
              const s2 = degToRad(arc.labelEndDeg);
              const e2 = degToRad(arc.endDeg);
              const seg2D = `M ${(cx + rOuterTrack * Math.cos(s2)).toFixed(2)} ${(cy + rOuterTrack * Math.sin(s2)).toFixed(2)} A ${rOuterTrack} ${rOuterTrack} 0 0 1 ${(cx + rOuterTrack * Math.cos(e2)).toFixed(2)} ${(cy + rOuterTrack * Math.sin(e2)).toFixed(2)}`;

              // Clockwise directional arrowhead at endDeg along the outer circle
              const tipX = cx + rOuterTrack * Math.cos(e2);
              const tipY = cy + rOuterTrack * Math.sin(e2);
              const tangentAngleDeg = arc.endDeg + 90;

              // Radial boundary tick at aspect start boundary
              const boundRad = degToRad(arc.startDeg - 1.2);
              const bx1 = cx + (rOuterSub + 6) * Math.cos(boundRad);
              const by1 = cy + (rOuterSub + 6) * Math.sin(boundRad);
              const bx2 = cx + (rOuterTrack + 10) * Math.cos(boundRad);
              const by2 = cy + (rOuterTrack + 10) * Math.sin(boundRad);

              return (
                <g
                  key={arc.macro}
                  data-testid={`wheel-macro-${arc.macro.toLowerCase()}`}
                  onClick={() => {
                    // Pressing again on the selected outer aspect triggers "All 14 Families"
                    if (macroFilter === arc.macro) {
                      setMacroFilter('All');
                      setSelectedFamilyId(null);
                      return;
                    }
                    setMacroFilter(arc.macro);
                    const firstFam = OLFACTORY_WHEEL_FAMILIES.find(
                      (f) => f.macroFamily === arc.macro
                    );
                    if (firstFam) {
                      setSelectedFamilyId(firstFam.id);
                      setSelectedSubFacet(firstFam.subFacets[0] || firstFam.name);
                    }
                  }}
                  className="cursor-pointer transition-all hover:opacity-95"
                >
                  {/* Radial boundary divider tick marking the exact sector area for this aspect */}
                  <line
                    x1={bx1}
                    y1={by1}
                    x2={bx2}
                    y2={by2}
                    stroke={arc.color}
                    strokeWidth="2"
                    strokeDasharray="3 3"
                    strokeOpacity="0.65"
                  />

                  {/* Outer Circular Border Segments */}
                  <path
                    d={seg1D}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={isMacroHighlighted ? '5.5' : '3.8'}
                    strokeLinecap="round"
                  />
                  <path
                    d={seg2D}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={isMacroHighlighted ? '5.5' : '3.8'}
                    strokeLinecap="round"
                  />

                  {/* Directional Arrowhead along the Outer Aspect Track */}
                  <polygon
                    points="0,0 -11,-5.5 -11,5.5"
                    fill={arc.color}
                    transform={`translate(${tipX.toFixed(2)}, ${tipY.toFixed(2)}) rotate(${tangentAngleDeg.toFixed(2)})`}
                  />

                  {/* Enlarged Curved Aspect Title (FLORAL, AMBERY, WOODY, FRESH) in the break of the outer border */}
                  <text
                    fill={arc.color}
                    fontSize="19"
                    fontFamily="Inter, Plus Jakarta Sans, system-ui, sans-serif"
                    fontWeight="800"
                    letterSpacing="0.16em"
                    className="select-none"
                  >
                    <textPath
                      href={`#outer-aspect-arc-${arc.macro}`}
                      startOffset="50%"
                      textAnchor="middle"
                    >
                      {arc.displayLabel}
                    </textPath>
                  </text>
                </g>
              );
            })}

            {/* 2. SINGLE RING OF 14 EQUAL-ANGLE WEDGE SECTORS + ENLARGED CURVED TITLES */}
            {OLFACTORY_WHEEL_FAMILIES.map((fam, idx) => {
              const padDeg = 1.15;
              const startDeg = -180 + idx * sliceDeg + padDeg;
              const endDeg = -180 + (idx + 1) * sliceDeg - padDeg;
              const midDeg = (startDeg + endDeg) / 2;
              const sRad = degToRad(startDeg);
              const eRad = degToRad(endDeg);
              const midRad = degToRad(midDeg);

              const isSelected = selectedFamily ? fam.id === selectedFamily.id : false;
              const isDimmedByFilter =
                macroFilter !== 'All' && fam.macroFamily !== macroFilter;
              const rOuterCur = isSelected ? rOuterSub + 6 : rOuterSub;

              const x1 = cx + rOuterCur * Math.cos(sRad);
              const y1 = cy + rOuterCur * Math.sin(sRad);
              const x2 = cx + rOuterCur * Math.cos(eRad);
              const y2 = cy + rOuterCur * Math.sin(eRad);
              const x3 = cx + rInnerSub * Math.cos(eRad);
              const y3 = cy + rInnerSub * Math.sin(eRad);
              const x4 = cx + rInnerSub * Math.cos(sRad);
              const y4 = cy + rInnerSub * Math.sin(sRad);

              const pathD = [
                `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
                `A ${rOuterCur} ${rOuterCur} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
                `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
                `A ${rInnerSub} ${rInnerSub} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
                'Z',
              ].join(' ');

              // Mid-sector badge coordinates for clear score/gap readability
              const rMidWedge = (rInnerSub + rOuterCur) / 2;
              const badgeX = cx + rMidWedge * Math.cos(midRad);
              const badgeY = cy + rMidWedge * Math.sin(midRad);
              const axisObj = RADAR_AXES_CLOCKWISE[idx];
              const tVal = axisObj ? getFacetScore(targetFacets, axisObj) : 0;
              const rVal = axisObj ? getFacetScore(localResultFacets, axisObj) : 0;

              // Ensure high-contrast legible text color for the curved title outside the wedge
              const curvedTitleColor =
                fam.id === 'amber'
                  ? '#E11D48'
                  : fam.id === 'aromatic'
                  ? '#4F46E5'
                  : fam.id === 'mossy-woods'
                  ? '#059669'
                  : fam.id === 'citrus'
                  ? '#D97706'
                  : fam.color;

              return (
                <motion.g
                  key={fam.id}
                  data-testid={`wheel-sector-${fam.id}`}
                  initial={{ opacity: 0, scale: 0.93 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.45,
                    delay: idx * 0.03,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{ transformOrigin: `${cx}px ${cy}px` }}
                  onClick={() => {
                    // Pressing again on the already-selected family sector acts as "All 14 Families"
                    if (selectedFamilyId === fam.id) {
                      setSelectedFamilyId(null);
                      setMacroFilter('All');
                    } else {
                      setSelectedFamilyId(fam.id);
                      setSelectedSubFacet(fam.subFacets[0] || fam.name);
                    }
                  }}
                  className="cursor-pointer transition-all hover:opacity-95"
                >
                  {/* A. Rich Solid Michael Edwards Sector Wedge */}
                  <path
                    d={pathD}
                    fill={fam.color}
                    fillOpacity={isDimmedByFilter ? 0.28 : isSelected ? 1 : 0.92}
                    stroke={isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)'}
                    strokeWidth={isSelected ? '3.5' : '1.2'}
                  />

                  {/* B. Enlarged Curved Sub-Family Title Right Outside the Wedge Arc */}
                  <text
                    fill={curvedTitleColor}
                    fontSize="17.5"
                    fontFamily="Inter, Plus Jakarta Sans, system-ui, sans-serif"
                    fontWeight="800"
                    letterSpacing="0.01em"
                    className="select-none"
                  >
                    <textPath
                      href={`#sub-title-arc-${fam.id}`}
                      startOffset="50%"
                      textAnchor="middle"
                    >
                      {fam.name}
                    </textPath>
                  </text>

                  {/* C. Enlarged Sector Score Pill (Target vs Result) inside the Wedge */}
                  {!isDimmedByFilter && (
                    <g transform={`translate(${badgeX.toFixed(1)}, ${badgeY.toFixed(1)})`}>
                      <rect
                        x="-22"
                        y="-11"
                        width="44"
                        height="22"
                        rx="6"
                        fill="rgba(15, 23, 42, 0.82)"
                        stroke={isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
                        strokeWidth={isSelected ? '1.5' : '0.8'}
                      />
                      <text
                        x="0"
                        y="1"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#FFFFFF"
                        fontSize="12.5"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="700"
                      >
                        {tVal}/{rVal}
                      </text>
                    </g>
                  )}
                </motion.g>
              );
            })}

            {/* 3. ENLARGED CENTER CIRCLE (DIAMETER 456px: r=228, expanded for crystal-clear radar calibration) */}
            <circle
              cx={cx}
              cy={cy}
              r={rCenterHub}
              fill="url(#hubGradient)"
              stroke="#475569"
              strokeWidth="2"
            />

            {showRadarOverlay ? (
              /* ALIGNED CALIBRATION RADAR: 14 discrete axes matching all 14 families 1:1 */
              <g data-testid="aligned-radar-overlay">
                {[0.25, 0.5, 0.75, 1].map((step) => (
                  <circle
                    key={step}
                    cx={cx}
                    cy={cy}
                    r={rRadarMax * step}
                    fill="none"
                    stroke="#64748B"
                    strokeWidth="1"
                    strokeDasharray={step < 1 ? '3 3' : undefined}
                    strokeOpacity={0.75}
                  />
                ))}

                {RADAR_AXES_CLOCKWISE.map((ax) => {
                  const rad = (ax.angleDeg * Math.PI) / 180;
                  const xEnd = cx + rRadarMax * Math.cos(rad);
                  const yEnd = cy + rRadarMax * Math.sin(rad);
                  const labelR = rRadarMax + 24;
                  const lx = cx + labelR * Math.cos(rad);
                  const ly = cy + labelR * Math.sin(rad);
                  const tScore = getFacetScore(targetFacets, ax);
                  const rScore = getFacetScore(localResultFacets, ax);
                  const diff = rScore - tScore;

                  return (
                    <g key={ax.id}>
                      <line
                        x1={cx}
                        y1={cy}
                        x2={xEnd}
                        y2={yEnd}
                        stroke="#64748B"
                        strokeWidth="1"
                        strokeOpacity="0.75"
                      />
                      {Math.abs(diff) >= 2 && (
                        <text
                          x={lx}
                          y={ly}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={diff > 0 ? '#FBBF24' : '#38BDF8'}
                          fontSize="12.5"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="700"
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Target Intent Polygon (Emerald) */}
                <polygon
                  points={buildRadarPolygonClockwise(targetFacets, rRadarMax, cx, cy)}
                  fill="rgba(16, 185, 129, 0.28)"
                  stroke="#10B981"
                  strokeWidth="2.8"
                />

                {/* Smelled Result Polygon (Amber) */}
                <polygon
                  points={buildRadarPolygonClockwise(localResultFacets, rRadarMax, cx, cy)}
                  fill="rgba(245, 158, 11, 0.25)"
                  stroke="#F59E0B"
                  strokeWidth="2.8"
                  strokeDasharray="5 3"
                />

                <circle cx={cx} cy={cy} r="4.5" fill="#10B981" />
              </g>
            ) : (
              /* LARGE MICHAEL EDWARDS STYLE CENTER HUB OVERVIEW WITH ENLARGED FONTS */
              <g className="cursor-pointer" onClick={() => setShowRadarOverlay(true)}>
                <rect
                  x={cx - 105}
                  y={cy - 72}
                  width="210"
                  height="32"
                  rx="16"
                  fill="rgba(16, 185, 129, 0.18)"
                  stroke="#10B981"
                  strokeWidth="1.4"
                />
                <text
                  x={cx}
                  y={cy - 55}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#34D399"
                  fontSize="14"
                  fontFamily="JetBrains Mono, monospace"
                  letterSpacing="0.12em"
                  fontWeight="700"
                >
                  {selectedFamily ? `${selectedFamily.macroFamily.toUpperCase()} ASPECT` : 'ALL 14 FAMILIES'}
                </text>

                <text
                  x={cx}
                  y={cy - 10}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="27"
                  fontFamily="Inter, Plus Jakarta Sans, system-ui, sans-serif"
                  fontWeight="700"
                >
                  {selectedFamily ? selectedFamily.name : 'Michael Edwards Standard'}
                </text>

                <text
                  x={cx}
                  y={cy + 24}
                  textAnchor="middle"
                  fill="#E2E8F0"
                  fontSize="15.5"
                  fontFamily="Inter, Plus Jakarta Sans, system-ui, sans-serif"
                  fontWeight="500"
                >
                  {selectedFamily
                    ? selectedFamily.subFacets.slice(0, 3).join(' · ')
                    : '14 Canonical Fragrance Families'}
                </text>

                <text
                  x={cx}
                  y={cy + 58}
                  textAnchor="middle"
                  fill="#38BDF8"
                  fontSize="14"
                  fontFamily="Inter, Plus Jakarta Sans, system-ui, sans-serif"
                  fontWeight="600"
                >
                  Click to Show Radar Overlay ↻
                </text>
              </g>
            )}
          </svg>

          <p className="text-xs text-slate-400 text-center mt-3 max-w-lg font-normal leading-relaxed">
            Click any sector to inspect its notes and calibrate Target Intent vs. Smelled Result.{' '}
            <strong className="text-slate-200">Click the selected sector again</strong> to reset to{' '}
            <span className="text-emerald-400">All 14 Families</span>.
          </p>
        </div>

        {/* Right Column: Selected Family Intelligence, Academic Notes & 0–10 Sliders */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Selected Family Academic Card or 14-Family Overview */}
          {selectedFamily ? (
            <div className="rounded-xl bg-[#111621] border border-slate-800/80 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3.5 h-3.5 rounded-sm shrink-0"
                    style={{ backgroundColor: selectedFamily.color }}
                  />
                  <div>
                    <span className="text-[10px] uppercase font-mono-tabular tracking-wider text-emerald-400 block">
                      {selectedFamily.macroFamily} Super-Family
                    </span>
                    <h2 className="text-base font-normal text-white mt-0.5">
                      {selectedFamily.name} Family
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-tabular text-slate-400 font-normal">
                    Intent: {targetFacets[selectedFamily.name] ?? 0}/10 · Result:{' '}
                    {localResultFacets[selectedFamily.name] ?? 0}/10
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFamilyId(null)}
                    title="Clear sector selection"
                    className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
                  >
                    Clear ×
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                {selectedFamily.description}
              </p>

              {selectedFamily.academicNotes && (
                <div className="p-3 rounded-lg bg-[#0B0E14] border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1">
                  <span className="text-emerald-400 font-mono-tabular text-[10px] uppercase block">
                    Perfumery Standard Context
                  </span>
                  <p>{selectedFamily.academicNotes}</p>
                </div>
              )}

              {selectedFamily.keyMaterials && selectedFamily.keyMaterials.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 font-normal">
                    Iconic Aroma Chemicals & Raw Materials:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFamily.keyMaterials.map((km) => (
                      <span
                        key={km}
                        className="px-2 py-0.5 rounded bg-[#0B0E14] border border-slate-800 text-[11px] text-slate-200 font-normal"
                      >
                        {km}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Facet Note Selectors */}
              <div className="pt-2 border-t border-slate-800/70 space-y-2">
                <div className="text-xs font-normal text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sub-Facet Notes in {selectedFamily.name}:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allSubFacetsForFamily.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubFacet(sub)}
                      className={`px-2.5 py-1 rounded-md text-xs font-normal transition-colors whitespace-nowrap ${
                        selectedSubFacet === sub
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#0B0E14] border border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* GLOBAL 14-FAMILY OVERVIEW WHEN NO SECTOR IS SELECTED */
            <div className="rounded-xl bg-[#111621] border border-slate-800/80 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-mono-tabular tracking-wider text-emerald-400 block">
                    Michael Edwards Taxonomy
                  </span>
                  <h2 className="text-base font-normal text-white mt-0.5">
                    All 14 Fragrance Families
                  </h2>
                </div>
                <span className="text-xs font-mono-tabular text-slate-400">
                  Global Schematic
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                Click any sector on the wheel or select a family below to inspect its iconic raw materials, sub-facets, and formula presence.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {OLFACTORY_WHEEL_FAMILIES.map((fam) => {
                  const weight = activeFormulaFamilyWeights[fam.id];
                  return (
                    <button
                      key={fam.id}
                      type="button"
                      onClick={() => {
                        setSelectedFamilyId(fam.id);
                        setSelectedSubFacet(fam.subFacets[0] || fam.name);
                      }}
                      className="p-2.5 rounded-lg bg-[#0B0E14] border border-slate-800/80 hover:border-slate-700 text-left transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: fam.color }}
                        />
                        <span className="text-xs text-white truncate">{fam.name}</span>
                      </div>
                      <span className="text-[11px] font-mono-tabular text-slate-400 shrink-0">
                        {weight && weight.pct > 0 ? `${weight.pct.toFixed(0)}%` : `${fam.subFacets.length} notes`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Intent vs Result Calibration (14 Axes 0–10 Scale) */}
          <div className="rounded-xl bg-[#111621] border border-slate-800/80 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
              <div>
                <h3 className="text-xs font-normal text-slate-200">
                  Target Intent vs Smelled Result Calibration
                </h3>
                <p className="text-[11px] text-slate-400">
                  Calibrate for {activeFormula ? `${activeFormula.name} (${activeFormula.activeVersionLabel})` : 'Target Intent'}
                </p>
              </div>
              <span className="text-[11px] font-mono-tabular text-emerald-400 font-normal">
                Editing: {editProfileMode === 'target' ? 'Target Intent' : 'Smelled Result'}
              </span>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {RADAR_AXES_CLOCKWISE.map((axis) => {
                const facet = axis.name;
                const targetVal = getFacetScore(targetFacets, axis);
                const resultVal = getFacetScore(localResultFacets, axis);
                const delta = resultVal - targetVal;
                const activeVal = editProfileMode === 'target' ? targetVal : resultVal;

                return (
                  <div key={axis.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200 font-normal">{facet}</span>
                        <span className="text-[10px] text-slate-400 font-mono-tabular">
                          ({axis.macro})
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 font-mono-tabular text-[11px] font-normal">
                        <span className="text-emerald-400">Intent {targetVal}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-amber-400">Result {resultVal}</span>
                        <span className="text-slate-600">·</span>
                        <span
                          className={
                            delta === 0
                              ? 'text-slate-400'
                              : delta > 0
                              ? 'text-amber-300'
                              : 'text-sky-300'
                          }
                        >
                          {delta === 0 ? 'Match' : `${delta > 0 ? '+' : ''}${delta}`}
                        </span>
                      </div>
                    </div>
                      <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      aria-label={`${facet} ${editProfileMode} intensity`}
                      value={activeVal}
                      onChange={(e) => handleScoreChange(facet, Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SUGGESTIVE TARGET vs. RESULT FORMULATION ADVISOR & DATABASE MATERIAL RECOMMENDATIONS */}
      <div
        data-testid="wheel-formulation-advisor"
        className="rounded-xl bg-[#111621] border border-slate-800/80 p-6 space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-mono-tabular uppercase tracking-wider text-emerald-400 font-semibold">
                Suggestive Target vs. Result Formulation Advisor
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 font-mono-tabular text-[11px] font-semibold">
                {gapDiagnostics.alignmentScore}% Profile Convergence
              </span>
            </div>
            <h2 className="text-lg font-sans font-bold text-white">
              Why There Is Distance & How to Close the Gap with Database Materials
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
              {activeFormula ? (
                <>
                  Comparing <strong className="text-white">{activeFormula.name} ({activeFormula.activeVersionLabel})</strong> Target Brief against Smelled Evaluation across all 14 fragrance families. Click any suggested material below to implement it directly into your active formula.
                </>
              ) : (
                <>Comparing Target Intent against Smelled Evaluation across all 14 fragrance families.</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selectedFamily && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFamilyId(null);
                  setMacroFilter('All');
                }}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white border border-slate-700 transition-colors"
              >
                Show All 14 Families
              </button>
            )}
          </div>
        </div>

        {suggestionFeedback && (
          <div
            role="status"
            className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{suggestionFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeFormula) onSelectFormula(activeFormula.id);
              }}
              className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold whitespace-nowrap shrink-0"
            >
              Inspect in Formula Lab →
            </button>
          </div>
        )}

        {(() => {
          const cardsToShow = selectedFamily
            ? gapDiagnostics.all.filter((d) => d.fam.id === selectedFamily.id)
            : gapDiagnostics.divergent.length > 0
            ? gapDiagnostics.divergent.slice(0, 6)
            : gapDiagnostics.all.slice(0, 4);

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {cardsToShow.map((diag) => {
                const isDeficit = diag.delta < 0;
                const isExcess = diag.delta > 0;

                return (
                  <div
                    key={diag.fam.id}
                    data-testid={`advisor-card-${diag.fam.id}`}
                    className="rounded-lg bg-[#0B0E14] border border-slate-800 p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Card Header: Family Name, Target vs Result Badges, and Gap Delta */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-sm shrink-0"
                            style={{ backgroundColor: diag.fam.color }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white">
                                {diag.fam.name}
                              </h3>
                              <span className="text-[11px] font-mono-tabular text-slate-400">
                                ({diag.fam.macroFamily} · {diag.famWeight.pct.toFixed(1)}% in Formula)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 font-mono-tabular text-xs">
                          <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-700/40 text-emerald-300">
                            Target: {diag.targetVal}/10
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-700/40 text-amber-300">
                            Result: {diag.resultVal}/10
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 border ${
                              isDeficit
                                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                                : isExcess
                                ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                                : 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
                            }`}
                          >
                            {isDeficit ? (
                              <>
                                <TrendingDown className="w-3 h-3" />
                                <span>{diag.delta} Deficit</span>
                              </>
                            ) : isExcess ? (
                              <>
                                <TrendingUp className="w-3 h-3" />
                                <span>+{diag.delta} Excess</span>
                              </>
                            ) : (
                              <span>Aligned</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Diagnostic Explanation: Why There Is Distance & How to Close It */}
                      <div className="space-y-2 text-xs leading-relaxed">
                        <div className="p-3 rounded-md bg-[#111621] border border-slate-800/90 space-y-1.5">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <span>Why There Is Distance:</span>
                          </div>
                          <p className="text-slate-300">{diag.whyDistance}</p>
                          <div className="pt-1 text-emerald-400 font-medium">
                            How to Become Closer to Target: {diag.actionStrategy}
                          </div>
                        </div>
                      </div>

                      {/* Concrete Database Raw Material Suggestions */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
                          <span>
                            AVAILABLE DATABASE MATERIALS FOR {diag.fam.name.toUpperCase()} ({diag.suggestedMaterials.length})
                          </span>
                          <span>RECOMMENDED ADJUSTMENT</span>
                        </div>

                        {diag.suggestedMaterials.length === 0 ? (
                          <p className="text-xs text-slate-400 py-2">
                            No raw materials tagged with {diag.fam.name} in current palette.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {diag.suggestedMaterials.map((mat) => (
                              <div
                                key={mat.id}
                                className="p-2.5 rounded-md bg-[#111621] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => onSelectMaterial(mat.id)}
                                      className="text-xs font-bold text-white hover:text-emerald-400 transition-colors text-left"
                                    >
                                      {mat.name}
                                    </button>
                                    <span className="px-1.5 py-0.5 rounded bg-[#0B0E14] border border-slate-800 text-[10px] font-mono-tabular text-slate-300">
                                      {mat.volatility} Note
                                    </span>
                                    {mat.isOnWorkbench !== false ? (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-600/50 text-[10px] font-mono-tabular text-emerald-300 font-semibold">
                                        ✓ On My Workbench (Priority 1)
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-600/50 text-[10px] font-mono-tabular text-amber-300">
                                        Catalog / To Purchase
                                      </span>
                                    )}
                                    <span className="text-[10px] font-mono-tabular text-emerald-400">
                                      Impact {mat.intensity || 7}/10
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 truncate max-w-md">
                                    {mat.facets.slice(0, 4).join(' · ')} — {mat.descriptiveNotes}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end sm:justify-start">
                                  <button
                                    type="button"
                                    data-testid={`apply-suggestion-${diag.fam.id}-${mat.id}`}
                                    onClick={() =>
                                      handleApplySuggestionToFormula(
                                        mat,
                                        diag.recommendedPctDelta,
                                        diag.fam.name
                                      )
                                    }
                                    className="w-full sm:w-auto justify-center px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>
                                      {diag.recommendedPctDelta >= 0
                                        ? `Add +${diag.recommendedPctDelta}% to Formula`
                                        : `Reduce ${diag.recommendedPctDelta}% in Formula`}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
