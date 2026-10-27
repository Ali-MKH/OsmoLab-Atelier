import React, { useRef, useState, useCallback, useEffect } from 'react';

interface VerticalVolumeControlProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
  name?: string;
  color?: 'amber' | 'emerald' | 'blue' | 'purple' | 'slate';
  onChange: (newValue: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const VerticalVolumeControl: React.FC<VerticalVolumeControlProps> = ({
  value,
  min = 0,
  max = 50,
  step = 0.5,
  unit = '%',
  label,
  name,
  color = 'emerald',
  onChange,
  disabled = false,
  compact = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const clamp = (val: number) => Math.min(max, Math.max(min, val));

  // Handle pointer/touch/mouse vertical drag
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointerY(e.clientY);
  };

  const updateFromPointerY = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      // Y goes 0 at top to height at bottom.
      // Volume is 0 at bottom, 1 at top.
      const fractionFromBottom = (rect.bottom - clientY) / rect.height;
      const clampedFraction = Math.min(1, Math.max(0, fractionFromBottom));
      const rawValue = min + clampedFraction * (max - min);
      const stepped = Math.round(rawValue / step) * step;
      onChange(clamp(Number(stepped.toFixed(2))));
    },
    [min, max, step, onChange]
  );

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    updateFromPointerY(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Handle Mouse Wheel Scroll
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    // Invert delta: deltaY < 0 is scroll UP (increase), deltaY > 0 is scroll DOWN (decrease)
    const direction = e.deltaY < 0 ? 1 : -1;
    const deltaAmount = e.shiftKey ? step * 0.2 : step;
    const nextVal = clamp(Number((value + direction * deltaAmount).toFixed(2)));
    onChange(nextVal);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(clamp(Number((value + step).toFixed(2))));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(clamp(Number((value - step).toFixed(2))));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      onChange(clamp(Number((value + step * 5).toFixed(2))));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      onChange(clamp(Number((value - step * 5).toFixed(2))));
    }
  };

  const fillPercentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const colorStyles = {
    amber: {
      bar: 'from-amber-600 to-amber-400',
      thumb: 'bg-amber-400 shadow-amber-500/50',
      text: 'text-amber-300',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.35)]',
    },
    emerald: {
      bar: 'from-emerald-600 to-emerald-400',
      thumb: 'bg-emerald-400 shadow-emerald-500/50',
      text: 'text-emerald-300',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.35)]',
    },
    blue: {
      bar: 'from-blue-600 to-blue-400',
      thumb: 'bg-blue-400 shadow-blue-500/50',
      text: 'text-blue-300',
      glow: 'shadow-[0_0_12px_rgba(59,130,246,0.35)]',
    },
    purple: {
      bar: 'from-purple-600 to-purple-400',
      thumb: 'bg-purple-400 shadow-purple-500/50',
      text: 'text-purple-300',
      glow: 'shadow-[0_0_12px_rgba(168,85,247,0.35)]',
    },
    slate: {
      bar: 'from-slate-600 to-slate-400',
      thumb: 'bg-slate-300 shadow-slate-500/50',
      text: 'text-slate-300',
      glow: 'shadow-[0_0_12px_rgba(148,163,184,0.35)]',
    },
  }[color];

  const trackHeight = compact ? 'h-24' : 'h-36';

  return (
    <div
      className="flex flex-col items-center select-none group touch-none"
      onWheel={handleWheel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      role="slider"
      aria-label={name ? `${name} volume fader` : label || 'Volume Fader'}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value.toFixed(1)}${unit}`}
    >
      {/* Digital Numeric Readout */}
      <div
        className={`font-mono-tabular text-xs font-semibold px-1.5 py-0.5 rounded bg-[#0B0E14] border border-slate-800 ${colorStyles.text} transition-transform ${
          isDragging || isHovered ? 'scale-105 border-slate-600' : ''
        }`}
      >
        {value.toFixed(1)}
        <span className="text-[10px] opacity-70 ml-0.5">{unit}</span>
      </div>

      {/* Vertical Slider Track Container */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-8 ${trackHeight} my-2 flex items-center justify-center cursor-ns-resize transition-all`}
        title="Scroll mouse wheel or drag vertically to adjust"
      >
        {/* Background Groove & Tick Marks */}
        <div className="absolute inset-y-0 w-3 bg-[#0B0E14] rounded-full border border-slate-800 overflow-hidden shadow-inner flex flex-col justify-between py-1 items-center">
          {/* Subtle graduated tick marks */}
          <span className="w-1.5 h-[1px] bg-slate-700/60" />
          <span className="w-1.5 h-[1px] bg-slate-700/40" />
          <span className="w-2 h-[1px] bg-slate-600/70" />
          <span className="w-1.5 h-[1px] bg-slate-700/40" />
          <span className="w-1.5 h-[1px] bg-slate-700/60" />

          {/* Filled Fluid Bar */}
          <div
            className={`absolute bottom-0 inset-x-0 bg-gradient-to-t ${colorStyles.bar} transition-all duration-75`}
            style={{ height: `${fillPercentage}%` }}
          />
        </div>

        {/* Fader Knob Thumb */}
        <div
          className={`absolute w-7 h-3 rounded bg-slate-200 border border-white/60 shadow-md ${colorStyles.glow} flex items-center justify-center transition-all pointer-events-none ${
            isDragging ? 'ring-2 ring-white scale-110' : ''
          }`}
          style={{
            bottom: `calc(${fillPercentage}% - 6px)`,
          }}
        >
          {/* Center tactile ridges */}
          <div className="w-3.5 h-[1px] bg-slate-600" />
        </div>
      </div>

      {/* Label under fader */}
      {label && (
        <span
          className="text-[10px] text-slate-400 font-sans max-w-[70px] truncate text-center mt-0.5 leading-tight"
          title={label}
        >
          {label}
        </span>
      )}
    </div>
  );
};
