import React, { useState } from 'react';
import { RotateCcw, Trophy, X } from 'lucide-react';
import { CareerStats } from '../types/game';

interface CareerStatsModalProps {
  stats: CareerStats;
  onClose: () => void;
  onReset: () => void;
}

export const CareerStatsModal: React.FC<CareerStatsModalProps> = ({
  stats,
  onClose,
  onReset,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const winRate =
    stats.matchesPlayed > 0
      ? Math.round((stats.wins / stats.matchesPlayed) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="career-stats-title"
    >
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-[#F5C451]" aria-hidden="true" />
            <h2 id="career-stats-title" className="font-display text-2xl font-bold tracking-wide text-white">
              Career Record
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close career stats"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Tracked across solo matches vs Smart AI and saved locally on this device.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
            <div className="text-xs text-slate-400">Matches Played</div>
            <div className="font-mono-tabular mt-1 text-2xl font-bold text-white">
              {stats.matchesPlayed}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
            <div className="text-xs text-slate-400">Wins · Win Rate</div>
            <div className="font-mono-tabular mt-1 text-2xl font-bold text-emerald-300">
              {stats.wins}{' '}
              <span className="text-sm font-medium text-slate-400">({winRate}%)</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
            <div className="text-xs text-slate-400">Highest Innings</div>
            <div className="font-mono-tabular mt-1 text-2xl font-bold text-[#F5C451]">
              {stats.highestScore}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
            <div className="text-xs text-slate-400">Career Sixes</div>
            <div className="font-mono-tabular mt-1 text-2xl font-bold text-white">
              {stats.sixesHit}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
            <div className="text-xs text-slate-400">Current Win Streak</div>
            <div className="font-mono-tabular mt-1 text-2xl font-bold text-white">
              {stats.currentStreak}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
            <div className="text-xs text-slate-400">Best Streak</div>
            <div className="font-mono-tabular mt-1 text-2xl font-bold text-[#F5C451]">
              {stats.bestStreak}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/15"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset Stats</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onReset();
                  setConfirmReset(false);
                }}
                className="min-h-[40px] rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[40px] rounded-lg px-2.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl bg-[#F5C451] px-5 py-2 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
