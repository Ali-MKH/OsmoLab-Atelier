import React, { useState } from 'react';
import {
  Check,
  Compass,
  SlidersHorizontal,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  FacetRadarAxisPoint,
  FormulaFacetRadarResult,
  RADAR_CORE_FACETS,
} from '../domain/formula-engine';

interface FormulaFacetRadarChartProps {
  formulaName: string;
  versionLabel: string;
  radarResult: FormulaFacetRadarResult;
  targetFacets: Record<string, number>;
  includeAllCoreFacets: boolean;
  onToggleIncludeAllCoreFacets: (val: boolean) => void;
  onUpdateTargetFacet?: (facet: string, newScore: number) => void;
  onResetTargetFacets?: () => void;
}

export const FormulaFacetRadarChart: React.FC<FormulaFacetRadarChartProps> = ({
  formulaName,
  versionLabel,
  radarResult,
  targetFacets,
  includeAllCoreFacets,
  onToggleIncludeAllCoreFacets,
  onUpdateTargetFacet,
  onResetTargetFacets,
}) => {
  const [selectedFacet, setSelectedFacet] = useState<string | null>(null);
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newCustomFacet, setNewCustomFacet] = useState<string>('Aromatic');

  const axes = radarResult.axes;
  const numAxes = Math.max(axes.length, 3);

  // SVG Radar geometry constants
  const svgWidth = 460;
  const svgHeight = 380;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const maxRadius = 124;
  const rings = [2, 4, 6, 8, 10];

  const getPointCoordinates = (
    axisIndex: number,
    score: number,
    radiusOverride?: number
  ) => {
    const angle = (Math.PI * 2 * axisIndex) / numAxes - Math.PI / 2;
    const r =
      radiusOverride !== undefined
        ? radiusOverride
        : (Math.min(10, Math.max(0, score)) / 10) * maxRadius;
    return {
      x: Number((centerX + r * Math.cos(angle)).toFixed(2)),
      y: Number((centerY + r * Math.sin(angle)).toFixed(2)),
      angle,
    };
  };

  const buildPolygonPoints = (scores: number[]) =>
    scores
      .map((sc, idx) => {
        const pt = getPointCoordinates(idx, sc);
        return `${pt.x},${pt.y}`;
      })
      .join(' ');

  const targetPolygonPoints = buildPolygonPoints(
    axes.map((a) => a.targetScore)
  );
  const currentPolygonPoints = buildPolygonPoints(
    axes.map((a) => a.currentScore)
  );

  const activeAxisDetail: FacetRadarAxisPoint | undefined =
    axes.find((a) => a.facet === selectedFacet) || axes[0];

  const availableFacetsToAdd = [
    ...RADAR_CORE_FACETS,
    'Aromatic',
    'Fruity',
    'Marine',
    'Mineral',
    'Leather',
  ].filter((f) => targetFacets[f] === undefined);

  return (
    <div
      data-testid="formula-radar-chart-panel"
      className="rounded-lg bg-[#111621] border border-slate-800 p-5 space-y-4"
    >
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="text-sm font-semibold text-white">
              Olfactory Facet Spider / Radar Chart — Target Brief vs. Current Formulation
            </h2>
            <span
              data-testid="radar-alignment-badge"
              className={`px-2 py-0.5 text-[11px] font-mono-tabular font-semibold rounded border ${
                radarResult.alignmentPercent >= 80
                  ? 'bg-emerald-950/70 border-emerald-600/60 text-emerald-300'
                  : radarResult.alignmentPercent >= 65
                  ? 'bg-amber-950/70 border-amber-600/60 text-amber-300'
                  : 'bg-rose-950/70 border-rose-600/60 text-rose-300'
              }`}
            >
              {radarResult.alignmentPercent}% Target Match
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time psychophysical odor-impact comparison of{' '}
            <strong className="text-slate-200">
              {formulaName} ({versionLabel})
            </strong>{' '}
            against target scent facets (0–10 scale). Updates live as you adjust gram weights or dilutions.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
          {/* Axis Scope Toggle */}
          <div className="grid grid-cols-2 sm:flex items-center gap-1 p-1 bg-[#0B0E14] border border-slate-800 rounded-md w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onToggleIncludeAllCoreFacets(false)}
              className={`px-2.5 py-1.5 sm:py-1 text-xs font-medium rounded transition-colors whitespace-nowrap text-center justify-center flex items-center ${
                !includeAllCoreFacets
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Target Facets ({Object.keys(targetFacets).length || 8})
            </button>
            <button
              type="button"
              onClick={() => onToggleIncludeAllCoreFacets(true)}
              className={`px-2.5 py-1.5 sm:py-1 text-xs font-medium rounded transition-colors whitespace-nowrap text-center justify-center flex items-center ${
                includeAllCoreFacets
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All 10 Core Axes
            </button>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            {onUpdateTargetFacet && (
              <button
                type="button"
                onClick={() => setIsEditingTargets((prev) => !prev)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isEditingTargets
                    ? 'bg-amber-950/70 border-amber-500/70 text-amber-200'
                    : 'bg-[#0B0E14] border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{isEditingTargets ? 'Done Tuning Targets' : 'Tune Target Facets'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-md whitespace-nowrap flex items-center justify-center"
            >
              {isCollapsed ? 'Expand Radar' : 'Compact View'}
            </button>
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Interactive SVG Spider/Radar Polygon */}
          <div className="lg:col-span-7 rounded-lg bg-[#0B0E14] border border-slate-800/90 p-4 flex flex-col items-center justify-between">
            {/* Legend Strip */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs pb-2 border-b border-slate-800/70">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-2 text-slate-200 font-medium">
                  <span className="w-3.5 h-2 rounded-xs bg-emerald-500/40 border border-emerald-400 inline-block" />
                  <span>Current Formulation ({versionLabel})</span>
                </span>
                <span className="inline-flex items-center gap-2 text-slate-300 font-medium">
                  <span className="w-3.5 h-2 rounded-xs bg-amber-500/20 border border-dashed border-amber-400 inline-block" />
                  <span>Target Scent Profile</span>
                </span>
              </div>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                Scale: 0 – 10 Intensity
              </span>
            </div>

            {/* SVG Spider Chart */}
            <div className="w-full flex justify-center overflow-x-auto py-1">
              <svg
                data-testid="formula-facet-radar-svg"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full max-w-[460px] h-auto select-none"
                role="img"
                aria-label={`Spider radar chart comparing target scent facets and current formulation for ${formulaName}`}
              >
                {/* Concentric Polygonal Grid Rings (2, 4, 6, 8, 10) */}
                {rings.map((ringVal) => {
                  const ringRadius = (ringVal / 10) * maxRadius;
                  const ringPts = axes
                    .map((_, idx) => {
                      const pt = getPointCoordinates(idx, ringVal, ringRadius);
                      return `${pt.x},${pt.y}`;
                    })
                    .join(' ');
                  return (
                    <g key={ringVal}>
                      <polygon
                        points={ringPts}
                        fill="none"
                        stroke="var(--color-border, #334155)"
                        strokeWidth={ringVal === 10 ? 1.35 : 1}
                        strokeDasharray={ringVal % 4 === 2 ? '2,2' : undefined}
                      />
                      {/* Ring scale label on top vertical spoke */}
                      <text
                        x={centerX + 4}
                        y={centerY - ringRadius + 10}
                        fill="var(--color-text-muted, #64748B)"
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {ringVal}
                      </text>
                    </g>
                  );
                })}

                {/* Radial Spokes from Center to Each Facet Vertex */}
                {axes.map((ax, idx) => {
                  const outerPt = getPointCoordinates(idx, 10, maxRadius);
                  const isSelected = activeAxisDetail?.facet === ax.facet;
                  return (
                    <line
                      key={`spoke-${ax.facet}`}
                      x1={centerX}
                      y1={centerY}
                      x2={outerPt.x}
                      y2={outerPt.y}
                      stroke={isSelected ? '#10B981' : 'var(--color-border, #1E293B)'}
                      strokeWidth={isSelected ? 1.5 : 1}
                    />
                  );
                })}

                {/* Target Profile Polygon (Dashed Amber / Gold) */}
                <polygon
                  data-testid="radar-target-polygon"
                  points={targetPolygonPoints}
                  fill="rgba(245, 158, 11, 0.14)"
                  stroke="#D97706"
                  strokeWidth="2"
                  strokeDasharray="5,4"
                />

                {/* Current Formulation Polygon (Solid Emerald / Teal) */}
                <polygon
                  data-testid="radar-current-polygon"
                  points={currentPolygonPoints}
                  fill="rgba(16, 185, 129, 0.24)"
                  stroke="#059669"
                  strokeWidth="2.5"
                />

                {/* Target Vertex Nodes */}
                {axes.map((ax, idx) => {
                  const pt = getPointCoordinates(idx, ax.targetScore);
                  return (
                    <circle
                      key={`target-dot-${ax.facet}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={3.2}
                      fill="var(--color-surface, #0B0E14)"
                      stroke="#D97706"
                      strokeWidth="1.75"
                    >
                      <title>{`${ax.facet} Target: ${ax.targetScore.toFixed(1)} / 10`}</title>
                    </circle>
                  );
                })}

                {/* Current Formulation Interactive Vertex Nodes */}
                {axes.map((ax, idx) => {
                  const pt = getPointCoordinates(idx, ax.currentScore);
                  const isSelected = activeAxisDetail?.facet === ax.facet;
                  return (
                    <g
                      key={`current-dot-${ax.facet}`}
                      className="cursor-pointer"
                      onClick={() => setSelectedFacet(ax.facet)}
                      onMouseEnter={() => setSelectedFacet(ax.facet)}
                    >
                      {isSelected && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={8}
                          fill="rgba(16, 185, 129, 0.25)"
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 5 : 4}
                        fill="#10B981"
                        stroke="var(--color-surface, #0B0E14)"
                        strokeWidth="1.5"
                      >
                        <title>{`${ax.facet} — Current: ${ax.currentScore.toFixed(1)} vs Target: ${ax.targetScore.toFixed(1)} (${ax.delta >= 0 ? '+' : ''}${ax.delta.toFixed(1)})`}</title>
                      </circle>
                    </g>
                  );
                })}

                {/* Perimeter Facet Labels + Score Badges */}
                {axes.map((ax, idx) => {
                  const labelPt = getPointCoordinates(idx, 10, maxRadius + 32);
                  const cosA = Math.cos(labelPt.angle);
                  const textAnchor =
                    cosA > 0.25 ? 'start' : cosA < -0.25 ? 'end' : 'middle';
                  const isSelected = activeAxisDetail?.facet === ax.facet;

                  const deltaColor =
                    ax.status === 'on-target'
                      ? '#059669'
                      : ax.status === 'under-target'
                      ? '#D97706'
                      : '#0284C7';

                  return (
                    <g
                      key={`label-${ax.facet}`}
                      className="cursor-pointer"
                      onClick={() => setSelectedFacet(ax.facet)}
                      onMouseEnter={() => setSelectedFacet(ax.facet)}
                    >
                      <text
                        x={labelPt.x}
                        y={labelPt.y - 4}
                        textAnchor={textAnchor}
                        fill={
                          isSelected
                            ? 'var(--color-text, #FFFFFF)'
                            : 'var(--color-text-secondary, #E2E8F0)'
                        }
                        fontSize="11.5"
                        fontWeight={isSelected ? '700' : '600'}
                      >
                        {ax.facet}
                      </text>
                      <text
                        x={labelPt.x}
                        y={labelPt.y + 10}
                        textAnchor={textAnchor}
                        fill={deltaColor}
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="600"
                      >
                        {ax.currentScore.toFixed(1)} / {ax.targetScore.toFixed(1)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Active Selected Vertex Inspector Strip */}
            {activeAxisDetail && (
              <div className="w-full mt-1 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-white">
                    {activeAxisDetail.facet} Facet:
                  </span>
                  <span className="font-mono-tabular text-emerald-300">
                    Current {activeAxisDetail.currentScore.toFixed(1)}
                  </span>
                  <span className="text-slate-500">vs</span>
                  <span className="font-mono-tabular text-amber-300">
                    Target {activeAxisDetail.targetScore.toFixed(1)}
                  </span>
                  <span
                    className={`font-mono-tabular font-semibold ${
                      activeAxisDetail.status === 'on-target'
                        ? 'text-emerald-400'
                        : activeAxisDetail.status === 'under-target'
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    ({activeAxisDetail.delta >= 0 ? '+' : ''}
                    {activeAxisDetail.delta.toFixed(1)})
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {activeAxisDetail.topContributors.length > 0 ? (
                    <>
                      Driven by:{' '}
                      {activeAxisDetail.topContributors
                        .map((c) => `${c.name} (${c.sharePercent}%)`)
                        .join(' · ')}
                    </>
                  ) : (
                    <span>No active ingredients contributing to {activeAxisDetail.facet}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column (5 cols): Facet Alignment Summary & Interactive Target Sliders */}
          <div className="lg:col-span-5 space-y-3.5">
            {/* Alignment Diagnostics Summary */}
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-lg bg-[#0B0E14] border border-slate-800">
                <div className="text-[11px] text-slate-400">Profile Match</div>
                <div className="text-lg font-mono-tabular font-semibold text-emerald-400 mt-0.5">
                  {radarResult.alignmentPercent}%
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#0B0E14] border border-slate-800">
                <div className="text-[11px] text-slate-400">Facets On Target</div>
                <div className="text-lg font-mono-tabular font-semibold text-white mt-0.5">
                  {radarResult.onTargetCount}{' '}
                  <span className="text-xs text-slate-400">/ {axes.length}</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#0B0E14] border border-slate-800">
                <div className="text-[11px] text-slate-400">Mean Facet Gap</div>
                <div className="text-lg font-mono-tabular font-semibold text-slate-200 mt-0.5">
                  ±{radarResult.meanAbsoluteDelta.toFixed(1)}
                </div>
              </div>
            </div>

            {/* Diagnostic Guidance Callout */}
            <div className="p-3 rounded-lg bg-[#0B0E14] border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>At-a-Glance Balance Diagnostics</span>
                </span>
                {isEditingTargets && onResetTargetFacets && (
                  <button
                    type="button"
                    onClick={onResetTargetFacets}
                    className="text-[11px] text-slate-400 hover:text-white underline"
                  >
                    Reset Targets
                  </button>
                )}
              </div>

              {radarResult.underTargetFacets.length === 0 &&
              radarResult.overTargetFacets.length === 0 ? (
                <p className="text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    All scent facets are balanced within ±1.2 of the target olfactory profile.
                  </span>
                </p>
              ) : (
                <div className="space-y-1 text-[11px]">
                  {radarResult.underTargetFacets.length > 0 && (
                    <div className="text-amber-300">
                      <strong className="font-semibold">Under Target:</strong>{' '}
                      {radarResult.underTargetFacets
                        .map((f) => `${f.facet} (${f.delta.toFixed(1)})`)
                        .join(', ')}
                    </div>
                  )}
                  {radarResult.overTargetFacets.length > 0 && (
                    <div className="text-sky-300">
                      <strong className="font-semibold">Above Target:</strong>{' '}
                      {radarResult.overTargetFacets
                        .map(
                          (f) =>
                            `${f.facet} (+${f.delta.toFixed(1)})`
                        )
                        .join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Per-Facet Comparison Table / Interactive Target Sliders */}
            <div className="rounded-lg bg-[#0B0E14] border border-slate-800 divide-y divide-slate-800/70 max-h-[265px] overflow-y-auto">
              {axes.map((ax) => {
                const isSelected = activeAxisDetail?.facet === ax.facet;
                return (
                  <div
                    key={ax.facet}
                    onClick={() => setSelectedFacet(ax.facet)}
                    className={`p-2.5 text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-800/50' : 'hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-white truncate">
                          {ax.facet}
                        </span>
                        {ax.topContributors[0] && (
                          <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                            ({ax.topContributors[0].name})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-mono-tabular shrink-0">
                        <span className="text-emerald-400 font-semibold">
                          {ax.currentScore.toFixed(1)}
                        </span>
                        <span className="text-slate-500">/</span>
                        <span className="text-amber-400">
                          {ax.targetScore.toFixed(1)}
                        </span>
                        <span
                          className={`w-12 text-right text-[11px] font-semibold ${
                            ax.status === 'on-target'
                              ? 'text-emerald-400'
                              : ax.status === 'under-target'
                              ? 'text-amber-400'
                              : 'text-sky-400'
                          }`}
                        >
                          {ax.delta >= 0 ? `+${ax.delta.toFixed(1)}` : ax.delta.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Dual Progress Comparison Bar or Target Slider */}
                    {isEditingTargets && onUpdateTargetFacet ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-amber-300 w-16 shrink-0">
                          Target: {ax.targetScore.toFixed(1)}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={0.5}
                          aria-label={`Target score for ${ax.facet}`}
                          value={ax.targetScore}
                          onChange={(e) =>
                            onUpdateTargetFacet(ax.facet, parseFloat(e.target.value))
                          }
                          className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                        />
                      </div>
                    ) : (
                      <div className="mt-1.5 relative h-1.5 w-full rounded bg-slate-900 overflow-hidden">
                        {/* Current score fill */}
                        <div
                          className="h-full bg-emerald-500/80 rounded"
                          style={{ width: `${Math.min(100, ax.currentScore * 10)}%` }}
                        />
                        {/* Target marker tick */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
                          style={{
                            left: `${Math.min(99, Math.max(1, ax.targetScore * 10))}%`,
                          }}
                          title={`Target: ${ax.targetScore.toFixed(1)}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Optional Add Target Facet Axis Control when Tuning Targets */}
            {isEditingTargets &&
              onUpdateTargetFacet &&
              availableFacetsToAdd.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <select
                    aria-label="Select new target facet to add"
                    value={newCustomFacet}
                    onChange={(e) => setNewCustomFacet(e.target.value)}
                    className="flex-1 bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    {availableFacetsToAdd.map((f) => (
                      <option key={f} value={f}>
                        Add Facet: {f}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const facetToAdd =
                        availableFacetsToAdd.includes(newCustomFacet)
                          ? newCustomFacet
                          : availableFacetsToAdd[0];
                      if (facetToAdd) {
                        onUpdateTargetFacet(facetToAdd, 5);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded whitespace-nowrap"
                  >
                    + Add Target Axis
                  </button>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
