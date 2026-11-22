import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { HandGesture } from './HandGesture';
import { HandNumber } from '../types/game';

interface RulesModalProps {
  onClose: () => void;
}

const HANDS: HandNumber[] = [1, 2, 3, 4, 5, 6];

export const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
    >
      <div className="glass-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-[#F5C451]" aria-hidden="true" />
            <h2 id="rules-title" className="font-display text-2xl font-bold tracking-wide text-white">
              How to Play Hand Cricket
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-200">
          <p>
            On every ball, both the <strong>Batter</strong> and the <strong>Bowler</strong> throw
            a number from <strong>1 to 6</strong> at the exact same moment.
          </p>

          <div className="grid gap-2.5 rounded-xl border border-white/10 bg-black/25 p-4 text-xs sm:text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-emerald-300">Different Numbers</span>
              <span className="text-slate-300">Batter scores their chosen number!</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-red-400">Same Number</span>
              <span className="text-slate-300">OUT! Batter loses a wicket.</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wide text-[#F5C451] uppercase">
              Hand Signals (1 to 6)
            </h3>
            <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {HANDS.map((num) => (
                <div
                  key={num}
                  className="flex flex-col items-center rounded-xl border border-white/10 bg-black/25 p-2"
                >
                  <HandGesture value={num} size={46} side="batter" />
                  <span className="font-mono-tabular mt-1 text-xs font-bold text-white">
                    {num === 6 ? '6 (Thumb)' : num}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/10 pt-3 text-xs text-slate-300">
            <p>
              <strong className="text-emerald-300">FREE HIT (1x per innings):</strong> Protects
              the batter for one ball — even if both hands match, you are NOT OUT.
            </p>
            <p>
              <strong className="text-[#F5C451]">2X RUNS (1x per innings):</strong> Doubles whatever
              runs you score on that delivery (picking 6 scores 12).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-[44px] w-full rounded-xl bg-[#F5C451] py-2.5 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472]"
        >
          Back to Stadium
        </button>
      </div>
    </div>
  );
};
