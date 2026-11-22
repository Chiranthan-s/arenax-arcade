import React, { useState } from 'react';
import { soundFX } from '../engine/soundFX';

interface CoinTossProps {
  callerName: string;
  opponentName: string;
  isVsAI: boolean;
  onComplete: (batFirstSide: 'p1' | 'p2', summary: string) => void;
  onCancel: () => void;
}

type CoinSide = 'HEADS' | 'TAILS';

export const CoinToss: React.FC<CoinTossProps> = ({
  callerName,
  opponentName,
  isVsAI,
  onComplete,
  onCancel,
}) => {
  const [call, setCall] = useState<CoinSide | null>(null);
  const [result, setResult] = useState<CoinSide | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [settled, setSettled] = useState(false);
  const [aiChoiceMessage, setAiChoiceMessage] = useState<string | null>(null);

  const callerWon = call !== null && result !== null && call === result;

  const handleFlip = (picked: CoinSide) => {
    if (flipping || settled) return;
    setCall(picked);
    const landed: CoinSide = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
    setResult(landed);
    setFlipping(true);
    soundFX.playCoinFlip();

    window.setTimeout(() => {
      setFlipping(false);
      setSettled(true);

      const didCallerWin = picked === landed;
      if (!didCallerWin && isVsAI) {
        const aiBatsFirst = Math.random() < 0.55;
        setAiChoiceMessage(
          `${opponentName} won the toss (${landed}) and elected to ${aiBatsFirst ? 'Bat' : 'Bowl'} first.`
        );
      }
    }, 1180);
  };

  const handleDecision = (callerBatsFirst: boolean) => {
    soundFX.playTap();
    if (callerWon) {
      const batFirstSide = callerBatsFirst ? 'p1' : 'p2';
      const summary = `${callerName} won the toss and elected to ${callerBatsFirst ? 'Bat' : 'Bowl'} first.`;
      onComplete(batFirstSide, summary);
    } else {
      // Pass & Play: opponent won toss and chooses Bat/Bowl
      const batFirstSide = callerBatsFirst ? 'p2' : 'p1';
      const summary = `${opponentName} won the toss and elected to ${callerBatsFirst ? 'Bat' : 'Bowl'} first.`;
      onComplete(batFirstSide, summary);
    }
  };

  return (
    <div className="glass-panel mx-auto w-full max-w-lg rounded-2xl p-6 shadow-2xl sm:p-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <p className="text-xs font-medium text-amber-300/90">Pre-Match Pitch Inspection</p>
          <h2 className="font-display text-3xl font-bold tracking-wide text-white">
            The Stadium Coin Toss
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[40px] rounded-lg px-3 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
        >
          Back
        </button>
      </div>

      {/* 3D Animated Coin */}
      <div className="my-8 flex flex-col items-center">
        <div className="coin-stage relative h-32 w-32">
          <div
            className={`coin-body relative h-full w-full ${
              flipping
                ? result === 'HEADS'
                  ? 'animate-coin-heads'
                  : 'animate-coin-tails'
                : settled && result === 'TAILS'
                  ? '[transform:rotateY(180deg)]'
                  : ''
            }`}
          >
            {/* Heads Face */}
            <div className="coin-face absolute inset-0 flex flex-col items-center justify-center rounded-full border-4 border-amber-200/80 bg-gradient-to-br from-[#FFE082] via-[#F5C451] to-[#B45309] text-[#051610] shadow-[0_0_35px_rgba(245,196,81,0.35)]">
              <span className="font-display text-3xl font-extrabold tracking-wider">H</span>
              <span className="text-[11px] font-bold tracking-widest uppercase">Heads</span>
            </div>

            {/* Tails Face */}
            <div className="coin-face coin-face-tails absolute inset-0 flex flex-col items-center justify-center rounded-full border-4 border-slate-200/80 bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 text-slate-950 shadow-[0_0_35px_rgba(226,232,240,0.28)]">
              <span className="font-display text-3xl font-extrabold tracking-wider">T</span>
              <span className="text-[11px] font-bold tracking-widest uppercase">Tails</span>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-slate-300">
          {!call && `${callerName}, call Heads or Tails in the air!`}
          {flipping && `Spinning in the floodlights... (${call} called)`}
          {settled && callerWon && (
            <span className="font-semibold text-[#F5C451]">
              It&apos;s {result}! {callerName} wins the toss!
            </span>
          )}
          {settled && !callerWon && !isVsAI && (
            <span className="font-semibold text-emerald-300">
              It&apos;s {result}! {opponentName} wins the toss!
            </span>
          )}
          {settled && !callerWon && isVsAI && aiChoiceMessage && (
            <span className="font-semibold text-emerald-300">{aiChoiceMessage}</span>
          )}
        </p>
      </div>

      {/* Action Buttons */}
      {!call && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleFlip('HEADS')}
            className="min-h-[48px] rounded-xl bg-[#F5C451] px-4 py-3 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472] active:scale-[0.98]"
          >
            Call Heads
          </button>
          <button
            type="button"
            onClick={() => handleFlip('TAILS')}
            className="min-h-[48px] rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
          >
            Call Tails
          </button>
        </div>
      )}

      {settled && (callerWon || !isVsAI) && (
        <div className="space-y-3">
          <p className="text-center text-xs font-medium text-slate-300">
            {callerWon ? callerName : opponentName}, choose your opening strategy:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleDecision(true)}
              className="min-h-[48px] rounded-xl bg-[#F5C451] px-4 py-3 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472] active:scale-[0.98]"
            >
              Bat First
            </button>
            <button
              type="button"
              onClick={() => handleDecision(false)}
              className="min-h-[48px] rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/25 active:scale-[0.98]"
            >
              Bowl First
            </button>
          </div>
        </div>
      )}

      {settled && !callerWon && isVsAI && (
        <button
          type="button"
          onClick={() => {
            const aiBats = aiChoiceMessage?.includes('Bat first') ?? true;
            onComplete(aiBats ? 'p2' : 'p1', aiChoiceMessage ?? 'AI won the toss.');
          }}
          className="min-h-[48px] w-full rounded-xl bg-[#F5C451] px-4 py-3 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472] active:scale-[0.98]"
        >
          Take the Pitch
        </button>
      )}
    </div>
  );
};
