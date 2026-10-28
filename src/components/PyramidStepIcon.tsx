import React from 'react';
import { PyramidUiCode, RawMaterial, VolatilityTier } from '../domain/types';
import { resolveEffectiveMaterialPyramidMetadata } from '../domain/formula-engine';

interface PyramidStepIconProps {
  volatility: VolatilityTier | string;
  material?: Pick<
    RawMaterial,
    | 'volatility'
    | 'pyramidUiCode'
    | 'pyramidOverrideCode'
    | 'pyramidHighlightTop'
    | 'pyramidHighlightHeart'
    | 'pyramidHighlightBase'
    | 'pyramidConfidence'
    | 'pyramidBasis'
  >;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showGlow?: boolean;
}

export const PyramidStepIcon: React.FC<PyramidStepIconProps> = ({
  volatility,
  material,
  size = 'md',
  className = '',
  showGlow = false,
}) => {
  const resolved = material
    ? resolveEffectiveMaterialPyramidMetadata(material)
    : null;

  const norm = (volatility || '').toLowerCase();
  const isFunctionalNone =
    resolved?.isFunctionalCarrier || norm === 'none';

  const highlightTop = resolved
    ? resolved.highlightTop
    : (norm.includes('top') && !norm.includes('heart')) ||
      norm.includes('top-heart') ||
      norm.includes('top heart') ||
      norm === 'th' ||
      norm === 'thb' ||
      norm === 'tb';

  const highlightHeart = resolved
    ? resolved.highlightHeart
    : norm === 'heart' ||
      (norm.includes('heart') &&
        !norm.includes('top') &&
        !norm.includes('base')) ||
      norm.includes('top-heart') ||
      norm.includes('top heart') ||
      norm.includes('heart-base') ||
      norm.includes('heart base') ||
      norm === 'th' ||
      norm === 'hb' ||
      norm === 'thb';

  const highlightBase = resolved
    ? resolved.highlightBase
    : (norm.includes('base') && !norm.includes('heart')) ||
      norm.includes('heart-base') ||
      norm.includes('heart base') ||
      norm === 'hb' ||
      norm === 'thb' ||
      norm === 'tb';

  const dim = size === 'xs' ? 14 : size === 'sm' ? 18 : size === 'lg' ? 32 : 24;

  if (isFunctionalNone) {
    return (
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 select-none overflow-visible ${className}`}
        aria-label="Functional Carrier / Solvent (NONE)"
        role="img"
      >
        <circle
          cx="12"
          cy="12"
          r="8.5"
          fill="rgba(71, 85, 105, 0.35)"
          stroke="#64748B"
          strokeWidth="1.4"
          strokeDasharray="2.5 2.5"
        />
        <line
          x1="8"
          y1="12"
          x2="16"
          y2="12"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const isTopBridge = highlightTop && highlightHeart && !highlightBase;
  const isBaseBridge = !highlightTop && highlightHeart && highlightBase;

  const topColor = highlightTop
    ? isTopBridge
      ? '#10B981'
      : '#F59E0B'
    : 'rgba(71, 85, 105, 0.4)';

  const topStroke = highlightTop
    ? isTopBridge
      ? '#34D399'
      : '#FBBF24'
    : '#334155';

  const heartColor = highlightHeart
    ? isTopBridge
      ? '#10B981'
      : isBaseBridge
      ? '#818CF8'
      : '#EC4899'
    : 'rgba(71, 85, 105, 0.4)';

  const heartStroke = highlightHeart
    ? isTopBridge
      ? '#34D399'
      : isBaseBridge
      ? '#A5B4FC'
      : '#F472B6'
    : '#334155';

  const baseColor = highlightBase
    ? isBaseBridge
      ? '#818CF8'
      : '#6366F1'
    : 'rgba(71, 85, 105, 0.4)';

  const baseStroke = highlightBase
    ? isBaseBridge
      ? '#A5B4FC'
      : '#818CF8'
    : '#334155';

  const strokeDasharray = resolved?.isSuggested ? '2 1.2' : undefined;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none overflow-visible ${className}`}
      aria-label={`Pyramid tier: ${resolved?.displayLabel || volatility}`}
      role="img"
    >
      {showGlow && (
        <defs>
          <filter
            id={`glow-${norm}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      )}

      {/* Top Slice */}
      <polygon
        points="12,2.5 16.5,9.5 7.5,9.5"
        fill={topColor}
        stroke={topStroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeDasharray={strokeDasharray}
      />

      {/* Heart / Middle Slice */}
      <polygon
        points="7.2,10.8 16.8,10.8 20,16.5 4,16.5"
        fill={heartColor}
        stroke={heartStroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeDasharray={strokeDasharray}
      />

      {/* Base / Bottom Slice */}
      <polygon
        points="3.8,17.8 20.2,17.8 23,23 1,23"
        fill={baseColor}
        stroke={baseStroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeDasharray={strokeDasharray}
      />
    </svg>
  );
};

export const getVolatilityBadgeConfig = (
  volatility: VolatilityTier | PyramidUiCode | string,
  material?: Pick<
    RawMaterial,
    | 'volatility'
    | 'pyramidUiCode'
    | 'pyramidOverrideCode'
    | 'pyramidHighlightTop'
    | 'pyramidHighlightHeart'
    | 'pyramidHighlightBase'
    | 'pyramidConfidence'
    | 'pyramidBasis'
  >
) => {
  const resolved = material
    ? resolveEffectiveMaterialPyramidMetadata(material)
    : null;
  const code = (resolved?.uiCode || volatility || '').toUpperCase();

  if (code === 'NONE') {
    return {
      label: 'FUNCTIONAL / SOLVENT',
      bgClass: 'bg-slate-900/80 border-slate-600/60 text-slate-300',
      textColor: 'text-slate-300',
      accentColor: '#94A3B8',
      isSuggested: false,
      confidenceBadgeLabel: resolved?.confidenceBadgeLabel || 'High Confidence',
    };
  }
  if (code === 'THB') {
    return {
      label: resolved?.isSuggested ? 'FULL SPAN (THB) · SUGGESTED' : 'FULL SPAN (THB)',
      bgClass: 'bg-cyan-950/60 border-cyan-600/60 text-cyan-300',
      textColor: 'text-cyan-400',
      accentColor: '#06B6D4',
      isSuggested: Boolean(resolved?.isSuggested),
      confidenceBadgeLabel: resolved?.confidenceBadgeLabel || 'Suggested',
    };
  }
  if (code === 'T' || (code.includes('TOP') && !code.includes('HEART'))) {
    return {
      label: resolved?.isSuggested ? 'TOP NOTE · SUGGESTED' : 'TOP NOTE',
      bgClass: 'bg-amber-950/60 border-amber-600/60 text-amber-300',
      textColor: 'text-amber-400',
      accentColor: '#F59E0B',
      isSuggested: Boolean(resolved?.isSuggested),
      confidenceBadgeLabel: resolved?.confidenceBadgeLabel || 'High Confidence',
    };
  }
  if (
    code === 'TH' ||
    code.includes('TOP-HEART') ||
    code.includes('TOP HEART')
  ) {
    return {
      label: resolved?.isSuggested
        ? 'TOP-HEART BRIDGE · SUGGESTED'
        : 'TOP-HEART BRIDGE',
      bgClass: 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300',
      textColor: 'text-emerald-400',
      accentColor: '#10B981',
      isSuggested: Boolean(resolved?.isSuggested),
      confidenceBadgeLabel: resolved?.confidenceBadgeLabel || 'Suggested',
    };
  }
  if (code === 'B' || (code.includes('BASE') && !code.includes('HEART'))) {
    return {
      label: resolved?.isSuggested ? 'BASE NOTE · SUGGESTED' : 'BASE NOTE',
      bgClass: 'bg-indigo-950/60 border-indigo-600/60 text-indigo-300',
      textColor: 'text-indigo-400',
      accentColor: '#6366F1',
      isSuggested: Boolean(resolved?.isSuggested),
      confidenceBadgeLabel: resolved?.confidenceBadgeLabel || 'High Confidence',
    };
  }
  if (
    code === 'HB' ||
    code === 'TB' ||
    code.includes('HEART-BASE') ||
    code.includes('HEART BASE')
  ) {
    return {
      label: resolved?.isSuggested
        ? 'HEART-BASE BRIDGE · SUGGESTED'
        : 'HEART-BASE BRIDGE',
      bgClass: 'bg-violet-950/60 border-violet-600/60 text-violet-300',
      textColor: 'text-violet-400',
      accentColor: '#818CF8',
      isSuggested: Boolean(resolved?.isSuggested),
      confidenceBadgeLabel: resolved?.confidenceBadgeLabel || 'Suggested',
    };
  }
  return {
    label: resolved?.isSuggested ? 'HEART NOTE · SUGGESTED' : 'HEART NOTE',
    bgClass: 'bg-[#2A1822] border-[#652D4E] text-rose-300',
    textColor: 'text-rose-400',
    accentColor: '#EC4899',
    isSuggested: Boolean(resolved?.isSuggested),
    confidenceBadgeLabel: resolved?.confidenceBadgeLabel || 'High Confidence',
  };
};
