import React from 'react';
import { VolatilityTier } from '../domain/types';

interface PyramidStepIconProps {
  volatility: VolatilityTier | string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showGlow?: boolean;
}

export const PyramidStepIcon: React.FC<PyramidStepIconProps> = ({
  volatility,
  size = 'md',
  className = '',
  showGlow = false,
}) => {
  const norm = (volatility || '').toLowerCase();
  const isTop = norm.includes('top') && !norm.includes('heart');
  const isTopHeart = norm.includes('top-heart') || norm.includes('top heart');
  const isHeart = norm === 'heart' || (norm.includes('heart') && !norm.includes('top') && !norm.includes('base'));
  const isHeartBase = norm.includes('heart-base') || norm.includes('heart base');
  const isBase = norm.includes('base') && !norm.includes('heart');

  // Dimensions
  const dim = size === 'xs' ? 14 : size === 'sm' ? 18 : size === 'lg' ? 32 : 24;

  // Colors
  const topColor = isTop
    ? '#F59E0B' // bright amber
    : isTopHeart
    ? '#10B981' // emerald
    : 'rgba(71, 85, 105, 0.4)';

  const topStroke = isTop ? '#FBBF24' : isTopHeart ? '#34D399' : '#334155';

  const heartColor = isHeart
    ? '#EC4899' // pink/rose as in user screenshot
    : isTopHeart
    ? '#10B981' // emerald
    : isHeartBase
    ? '#818CF8' // indigo
    : 'rgba(71, 85, 105, 0.4)';

  const heartStroke = isHeart ? '#F472B6' : isTopHeart ? '#34D399' : isHeartBase ? '#A5B4FC' : '#334155';

  const baseColor = isBase
    ? '#6366F1' // rich indigo / violet
    : isHeartBase
    ? '#818CF8'
    : 'rgba(71, 85, 105, 0.4)';

  const baseStroke = isBase ? '#818CF8' : isHeartBase ? '#A5B4FC' : '#334155';

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none overflow-visible ${className}`}
      aria-label={`Pyramid tier: ${volatility}`}
      role="img"
    >
      {showGlow && (
        <defs>
          <filter id={`glow-${norm}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      )}

      {/* Top Slice: Apex (12, 2.5), corners (7.5, 9.5), (16.5, 9.5) */}
      <polygon
        points="12,2.5 16.5,9.5 7.5,9.5"
        fill={topColor}
        stroke={topStroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Heart / Middle Slice: top (7.2, 10.8) to (16.8, 10.8), base (4, 16.5) to (20, 16.5) */}
      <polygon
        points="7.2,10.8 16.8,10.8 20,16.5 4,16.5"
        fill={heartColor}
        stroke={heartStroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Base / Bottom Slice: top (3.8, 17.8) to (20.2, 17.8), base (1, 23) to (23, 23) */}
      <polygon
        points="3.8,17.8 20.2,17.8 23,23 1,23"
        fill={baseColor}
        stroke={baseStroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const getVolatilityBadgeConfig = (volatility: VolatilityTier | string) => {
  const norm = (volatility || '').toLowerCase();
  if (norm.includes('top') && !norm.includes('heart')) {
    return {
      label: 'TOP NOTE',
      bgClass: 'bg-amber-950/60 border-amber-600/60 text-amber-300',
      textColor: 'text-amber-400',
      accentColor: '#F59E0B',
    };
  }
  if (norm.includes('top-heart') || norm.includes('top heart')) {
    return {
      label: 'TOP-HEART BRIDGE',
      bgClass: 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300',
      textColor: 'text-emerald-400',
      accentColor: '#10B981',
    };
  }
  if (norm.includes('base') && !norm.includes('heart')) {
    return {
      label: 'BASE NOTE',
      bgClass: 'bg-indigo-950/60 border-indigo-600/60 text-indigo-300',
      textColor: 'text-indigo-400',
      accentColor: '#6366F1',
    };
  }
  if (norm.includes('heart-base') || norm.includes('heart base')) {
    return {
      label: 'HEART-BASE BRIDGE',
      bgClass: 'bg-violet-950/60 border-violet-600/60 text-violet-300',
      textColor: 'text-violet-400',
      accentColor: '#818CF8',
    };
  }
  return {
    label: 'HEART NOTE',
    bgClass: 'bg-[#2A1822] border-[#652D4E] text-rose-300',
    textColor: 'text-rose-400',
    accentColor: '#EC4899',
  };
};
