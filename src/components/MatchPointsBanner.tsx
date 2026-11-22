import React from 'react';
import { Award } from 'lucide-react';
import { MatchPointsBreakdown } from '../engine/rankings';

interface MatchPointsBannerProps {
  breakdown: MatchPointsBreakdown | null;
}

export const MatchPointsBanner: React.FC<MatchPointsBannerProps> = ({ breakdown }) => {
  if (!breakdown) return null;

  const parts: string[] = [];
  if (breakdown.resultPoints > 0) {
    parts.push(`+${breakdown.resultPoints} ${breakdown.outcome === 'win' ? 'Win' : 'Draw'}`);
  }
  parts.push(`+${breakdown.completionPoints} Match`);
  if (breakdown.bonusPoints > 0 && breakdown.bonusLabel) {
    parts.push(`+${breakdown.bonusPoints} ${breakdown.bonusLabel}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F5C451]/40 bg-[#F5C451]/12 px-3.5 py-2.5 text-left">
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 shrink-0 text-[#F5C451]" aria-hidden="true" />
        <span className="text-xs font-bold text-white">Arena Points Earned</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-amber-100/90">
          {parts.join(' · ')}
        </span>
        <span className="font-mono-tabular text-sm font-extrabold text-[#F5C451]">
          +{breakdown.totalEarned} pts
        </span>
      </div>
    </div>
  );
};
