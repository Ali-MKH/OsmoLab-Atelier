import React from 'react';
import type { RawMaterial } from '../../domain/types';
import { resolveEffectiveMaterialPyramidMetadata } from '../../domain/formula-engine';
import {
  PyramidStepIcon,
  getVolatilityBadgeConfig,
} from '../../components/PyramidStepIcon';

interface PyramidBadgeProps {
  material: RawMaterial;
  size?: 'xs' | 'sm' | 'md';
  showConfidenceTag?: boolean;
  className?: string;
}

export const PyramidBadge: React.FC<PyramidBadgeProps> = ({
  material,
  size = 'xs',
  showConfidenceTag = true,
  className = '',
}) => {
  const resolved = resolveEffectiveMaterialPyramidMetadata(material);
  const badgeConfig = getVolatilityBadgeConfig(resolved.uiCode, material);

  return (
    <div
      data-testid={`pyramid-badge-${material.id}`}
      title={`${resolved.displayLabel} (${resolved.uiCode}) · ${resolved.confidenceBadgeLabel}: ${resolved.basis}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border font-mono-tabular text-xs shrink-0 ${badgeConfig.bgClass} ${
        resolved.isSuggested ? 'border-dashed' : ''
      } ${className}`}
    >
      <PyramidStepIcon
        volatility={material.volatility}
        material={material}
        size={size}
      />
      <span>{resolved.displayLabel}</span>
      {showConfidenceTag && resolved.isSuggested && (
        <span
          data-testid={`pyramid-suggested-tag-${material.id}`}
          className="px-1.5 py-0.2 rounded bg-slate-900/80 border border-slate-600/80 text-[10px] text-slate-200 font-sans font-medium"
        >
          Suggested
        </span>
      )}
      {showConfidenceTag && resolved.isUserOverride && (
        <span
          data-testid={`pyramid-override-tag-${material.id}`}
          className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/60 text-[10px] text-cyan-200 font-sans font-medium"
        >
          Shelf Override
        </span>
      )}
    </div>
  );
};
