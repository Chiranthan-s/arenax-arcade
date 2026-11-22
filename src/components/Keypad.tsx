import React from 'react';
import { HandNumber } from '../types/game';
import { HandGesture } from './HandGesture';

interface KeypadProps {
  roleLabel: string;
  roleType: 'batter' | 'bowler';
  disabled?: boolean;
  onSelect: (num: HandNumber) => void;
}

const NUMBERS: HandNumber[] = [1, 2, 3, 4, 5, 6];

export const Keypad: React.FC<KeypadProps> = ({
  roleLabel,
  roleType,
  disabled = false,
  onSelect,
}) => {
  return (
    <section aria-label="Hand Signal Controls" className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span
          className={`font-semibold ${
            roleType === 'batter' ? 'text-[#F5C451]' : 'text-emerald-300'
          }`}
        >
          {roleLabel}
        </span>
        <span className="hidden text-slate-400 sm:inline">Keys 1–6 supported</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {NUMBERS.map((num) => (
          <button
            key={num}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(num)}
            aria-label={`Play ${num}`}
            className={`group relative flex min-h-[76px] flex-col items-center justify-center rounded-2xl border px-2 py-2.5 transition duration-150 active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C451] sm:min-h-[88px] ${
              disabled
                ? 'cursor-not-allowed border-white/5 bg-white/[0.03] opacity-50'
                : roleType === 'batter'
                  ? 'border-amber-300/20 bg-white/[0.07] hover:border-[#F5C451]/70 hover:bg-amber-400/15'
                  : 'border-emerald-300/20 bg-white/[0.07] hover:border-emerald-400/70 hover:bg-emerald-500/15'
            }`}
          >
            <HandGesture
              value={num}
              side={roleType}
              size={42}
              className="transition-transform duration-150 group-hover:scale-105"
            />
            <span className="font-mono-tabular mt-1 text-base font-extrabold leading-none text-white sm:text-lg">
              {num}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
