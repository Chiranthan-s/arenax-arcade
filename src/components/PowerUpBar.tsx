import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { PowerUpInventory, PowerUpType } from '../types/game';

interface PowerUpBarProps {
  inventory: PowerUpInventory;
  activePowerUp: PowerUpType | null;
  canActivate: boolean;
  batterName: string;
  onToggle: (type: PowerUpType) => void;
}

export const PowerUpBar: React.FC<PowerUpBarProps> = ({
  inventory,
  activePowerUp,
  canActivate,
  batterName,
  onToggle,
}) => {
  const freeHitActive = activePowerUp === 'free_hit';
  const doubleActive = activePowerUp === 'double_runs';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="font-semibold text-slate-200">
          {batterName}&apos;s Tactical Cards
        </span>
        <span className="text-slate-400">1 use each per innings</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {/* FREE HIT CARD */}
        <button
          type="button"
          disabled={inventory.freeHitUsed || !canActivate}
          onClick={() => onToggle('free_hit')}
          className={`flex min-h-[54px] items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C451] ${
            inventory.freeHitUsed
              ? 'cursor-not-allowed border-white/5 bg-white/[0.03] text-slate-500 opacity-55'
              : freeHitActive
                ? 'border-emerald-300 bg-emerald-500/25 text-white shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : canActivate
                  ? 'border-white/15 bg-white/[0.06] text-slate-100 hover:border-emerald-400/50 hover:bg-emerald-500/10'
                  : 'cursor-default border-white/10 bg-white/[0.04] text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck
              className={`h-5 w-5 shrink-0 ${
                freeHitActive ? 'text-emerald-300' : 'text-emerald-400/80'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold tracking-wide whitespace-nowrap">
                FREE HIT
              </div>
              <div className="truncate text-[11px] text-slate-300/85">
                {inventory.freeHitUsed
                  ? 'Used this innings'
                  : freeHitActive
                    ? 'Armed · Not Out'
                    : 'No Out on match'}
              </div>
            </div>
          </div>
          {!inventory.freeHitUsed && (
            <span
              className={`text-[11px] font-bold whitespace-nowrap shrink-0 ${
                freeHitActive ? 'text-emerald-200' : 'text-slate-400'
              }`}
            >
              {freeHitActive ? 'ON' : '1x'}
            </span>
          )}
        </button>

        {/* 2X RUNS CARD */}
        <button
          type="button"
          disabled={inventory.doubleRunsUsed || !canActivate}
          onClick={() => onToggle('double_runs')}
          className={`flex min-h-[54px] items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C451] ${
            inventory.doubleRunsUsed
              ? 'cursor-not-allowed border-white/5 bg-white/[0.03] text-slate-500 opacity-55'
              : doubleActive
                ? 'border-[#F5C451] bg-amber-400/25 text-white shadow-[0_0_20px_rgba(245,196,81,0.28)]'
                : canActivate
                  ? 'border-white/15 bg-white/[0.06] text-slate-100 hover:border-amber-400/50 hover:bg-amber-400/10'
                  : 'cursor-default border-white/10 bg-white/[0.04] text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Zap
              className={`h-5 w-5 shrink-0 ${
                doubleActive ? 'text-[#F5C451]' : 'text-amber-300/80'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold tracking-wide whitespace-nowrap">
                2X RUNS
              </div>
              <div className="truncate text-[11px] text-slate-300/85">
                {inventory.doubleRunsUsed
                  ? 'Used this innings'
                  : doubleActive
                    ? 'Armed · Double'
                    : 'Doubles ball score'}
              </div>
            </div>
          </div>
          {!inventory.doubleRunsUsed && (
            <span
              className={`text-[11px] font-bold whitespace-nowrap shrink-0 ${
                doubleActive ? 'text-[#F5C451]' : 'text-slate-400'
              }`}
            >
              {doubleActive ? 'ON' : '1x'}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
