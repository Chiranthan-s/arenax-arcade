import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { BallOutcome } from '../types/game';
import { HandGesture } from './HandGesture';

interface PitchArenaProps {
  batterName: string;
  bowlerName: string;
  lastBall: BallOutcome | null;
  revealSeq: number;
  statusHint?: string;
}

export const PitchArena: React.FC<PitchArenaProps> = ({
  batterName,
  bowlerName,
  lastBall,
  revealSeq,
  statusHint,
}) => {
  const isWicket = lastBall?.isWicket ?? false;
  const savedByFreeHit = lastBall?.savedByFreeHit ?? false;
  const runs = lastBall?.runsScored ?? 0;

  let outcomeBadgeText = 'READY ON STRIKE';
  let outcomeBadgeClass = 'text-slate-300';

  if (lastBall) {
    if (isWicket) {
      outcomeBadgeText = 'OUT · WICKET!';
      outcomeBadgeClass = 'text-red-400';
    } else if (savedByFreeHit) {
      outcomeBadgeText = `FREE HIT SAVED · +${runs}`;
      outcomeBadgeClass = 'text-emerald-300';
    } else if (runs >= 6) {
      outcomeBadgeText = `+${runs} RUNS · MAXIMUM!`;
      outcomeBadgeClass = 'text-[#F5C451]';
    } else if (runs >= 4) {
      outcomeBadgeText = `+${runs} RUNS · BOUNDARY!`;
      outcomeBadgeClass = 'text-emerald-300';
    } else {
      outcomeBadgeText = `+${runs} ${runs === 1 ? 'RUN' : 'RUNS'}`;
      outcomeBadgeClass = 'text-white';
    }
  }

  return (
    <section
      aria-label="Pitch Hand Duel Arena"
      className={`glass-panel relative overflow-hidden rounded-2xl p-4 shadow-xl sm:p-6 ${
        isWicket ? 'border-red-500/40' : ''
      }`}
    >
      {/* Subtle Pitch Crease Lines */}
      <div
        className="pointer-events-none absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        aria-hidden="true"
      />

      {/* Outcome Banner */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
        <div
          key={`badge-${revealSeq}`}
          className={`font-display text-xl font-extrabold tracking-wide sm:text-2xl ${
            lastBall ? 'animate-pop-score' : ''
          } ${outcomeBadgeClass}`}
        >
          {outcomeBadgeText}
        </div>

        {lastBall?.powerUpUsed && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200">
            {lastBall.powerUpUsed === 'free_hit' ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                <span>Free Hit Active</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 text-[#F5C451]" aria-hidden="true" />
                <span>2X Runs Active</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Dual Hand Reveal Stage */}
      <div
        key={`hands-${revealSeq}`}
        className="relative z-10 my-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:my-5 sm:gap-4"
      >
        {/* Batter Hand (Left) */}
        <div className="flex flex-col items-center">
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-2xl border border-amber-400/25 bg-black/30 sm:h-28 sm:w-28 ${
              lastBall ? 'animate-slam-left' : ''
            }`}
          >
            <HandGesture
              value={lastBall ? lastBall.batterPick : 0}
              side="batter"
              size={84}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className="max-w-[92px] truncate font-semibold text-[#F5C451] sm:max-w-none">
              {batterName}
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono-tabular font-bold text-white">
              {lastBall ? lastBall.batterPick : '–'}
            </span>
          </div>
        </div>

        {/* Center Clash Indicator */}
        <div className="flex flex-col items-center justify-center px-1">
          <div
            className={`font-display flex h-11 w-11 items-center justify-center rounded-full border text-sm font-extrabold tracking-wider sm:h-12 sm:w-12 ${
              !lastBall
                ? 'border-white/15 bg-white/5 text-slate-400'
                : isWicket
                  ? 'border-red-400 bg-red-500/30 text-red-200'
                  : savedByFreeHit
                    ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                    : runs >= 6
                      ? 'border-[#F5C451] bg-amber-400/25 text-[#F5C451]'
                      : 'border-white/20 bg-white/10 text-white'
            }`}
          >
            {lastBall ? (isWicket ? 'OUT' : `+${runs}`) : 'VS'}
          </div>
        </div>

        {/* Bowler Hand (Right, mirrored to face batter) */}
        <div className="flex flex-col items-center">
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-2xl border border-emerald-400/25 bg-black/30 sm:h-28 sm:w-28 ${
              lastBall ? 'animate-slam-right' : ''
            }`}
          >
            <HandGesture
              value={lastBall ? lastBall.bowlerPick : 0}
              side="bowler"
              size={84}
              mirror
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className="max-w-[92px] truncate font-semibold text-emerald-300 sm:max-w-none">
              {bowlerName}
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono-tabular font-bold text-white">
              {lastBall ? lastBall.bowlerPick : '–'}
            </span>
          </div>
        </div>
      </div>

      {/* Ball-by-Ball Commentary Strip */}
      <div
        aria-live="polite"
        className={`relative z-10 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed sm:text-sm ${
          isWicket
            ? 'border-red-500/35 bg-red-950/40 text-red-100'
            : savedByFreeHit
              ? 'border-emerald-400/35 bg-emerald-950/40 text-emerald-100'
              : runs >= 6
                ? 'border-amber-400/35 bg-amber-950/35 text-amber-100'
                : 'border-white/10 bg-black/30 text-slate-200'
        }`}
      >
        {lastBall
          ? lastBall.commentary
          : statusHint || 'Select a number from 1 to 6 below to deliver the opening ball.'}
      </div>
    </section>
  );
};
