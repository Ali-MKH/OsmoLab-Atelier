import React from 'react';
import type { RegulatoryVerificationStatus } from '../../domain/types';

interface RegulatoryBadgeProps {
  status: RegulatoryVerificationStatus;
  className?: string;
}

export const RegulatoryBadge: React.FC<RegulatoryBadgeProps> = ({
  status,
  className = '',
}) => {
  if (status === 'VERIFIED_OFFICIAL') {
    return (
      <span
        data-testid="regulatory-status-badge-verified"
        className={`px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/60 text-emerald-300 text-[10px] font-mono-tabular font-semibold ${className}`}
      >
        Official source verified
      </span>
    );
  }
  if (status === 'PARTIALLY_VERIFIED') {
    return (
      <span
        data-testid="regulatory-status-badge-partial"
        className={`px-2 py-0.5 rounded bg-sky-950/70 border border-sky-500/60 text-sky-300 text-[10px] font-mono-tabular font-semibold ${className}`}
      >
        Partially verified
      </span>
    );
  }
  if (status === 'USER_ENTERED_UNVERIFIED') {
    return (
      <span
        data-testid="regulatory-status-badge-user-unverified"
        className={`px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/60 text-amber-300 text-[10px] font-mono-tabular font-semibold ${className}`}
      >
        User-entered, unverified
      </span>
    );
  }
  if (status === 'DEMO') {
    return (
      <span
        data-testid="regulatory-status-badge-demo"
        className={`px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/60 text-amber-300 text-[10px] font-mono-tabular font-semibold ${className}`}
      >
        Educational demonstration data — not verified for compliance
      </span>
    );
  }
  return (
    <span
      data-testid="lookup-required-badge"
      className={`px-2 py-0.5 rounded bg-slate-700/90 border border-slate-500 text-slate-100 text-[10px] font-mono-tabular font-semibold ${className}`}
    >
      Regulatory data not verified — lookup required
    </span>
  );
};
