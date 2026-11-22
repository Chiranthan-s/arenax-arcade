import React from 'react';
import { InningsState, MatchConfig } from '../types/game';

interface ScoreboardProps {
  innings: InningsState;
  config: MatchConfig;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ innings, config }) => {
  const battingName = innings.battingSide === 'p1' ? config.p1Name : config.p2Name;
  const bowlingName = innings.bowlingSide === 'p1' ? config.p1Name : config.p2Name;

  const oversDisplay = `${Math.floor(innings.ballsBowled / 6)}.${innings.ballsBowled % 6}`;
  const crr =
    innings.ballsBowled > 0
      ? ((innings.runs / innings.ballsBowled) * 6).toFixed(2)
      : '0.00';

  const ballsLeft =
    innings.maxBalls !== null ? Math.max(0, innings.maxBalls - innings.ballsBowled) : null;
  const runsNeeded =
    innings.target !== null ? Math.max(0, innings.target - innings.runs) : null;

  const rrr =
    runsNeeded !== null && ballsLeft !== null && ballsLeft > 0
      ? ((runsNeeded / ballsLeft) * 6).toFixed(2)
      : null;

  const lastSix = innings.history.slice(-6);

  return (
    <section
      aria-label="Live Broadcast Scoreboard"
      className="glass-panel rounded-2xl p-4 shadow-xl sm:p-5"
    >
      {/* Top Broadcast Meta Line */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="font-semibold text-[#F5C451]">{battingName} Batting</span>
          <span aria-hidden="true">·</span>
          <span>vs {bowlingName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span>{innings.inningsNumber === 1 ? '1st Innings' : '2nd Innings'}</span>
          <span aria-hidden="true">·</span>
          <span>
            {config.mode === 'blitz'
              ? '1-Over Blitz'
              : `Classic (${innings.maxWickets} ${innings.maxWickets === 1 ? 'Wkt' : 'Wkts'})`}
          </span>
        </div>
      </div>

      {/* Main Score + Telemetry Grid */}
      <div className="mt-3.5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-5xl leading-none font-extrabold tracking-tight text-white tabular-nums sm:text-6xl">
              {innings.runs}/{innings.wickets}
            </span>
            <span className="font-mono-tabular text-sm font-medium text-slate-300">
              ({oversDisplay} ov)
            </span>
          </div>
          {innings.target !== null && (
            <p className="mt-1.5 text-sm font-semibold text-[#F5C451]">
              {runsNeeded === 0
                ? 'Target Reached!'
                : ballsLeft !== null
                  ? `Need ${runsNeeded} run${runsNeeded === 1 ? '' : 's'} off ${ballsLeft} ball${ballsLeft === 1 ? '' : 's'}`
                  : `Target: ${innings.target} · Need ${runsNeeded} run${runsNeeded === 1 ? '' : 's'}`}
            </p>
          )}
        </div>

        {/* Metrics Strip */}
        <div className="flex items-center gap-5 border-t border-white/10 pt-2 sm:border-t-0 sm:pt-0">
          <div>
            <div className="text-[11px] font-medium text-slate-400">
              {ballsLeft !== null ? 'Balls Left' : 'Wickets Left'}
            </div>
            <div className="font-mono-tabular text-lg font-bold text-white">
              {ballsLeft !== null
                ? `${ballsLeft}/${innings.maxBalls}`
                : `${innings.maxWickets - innings.wickets}/${innings.maxWickets}`}
            </div>
          </div>
          <div className="h-7 w-px bg-white/10" aria-hidden="true" />
          <div>
            <div className="text-[11px] font-medium text-slate-400">CRR</div>
            <div className="font-mono-tabular text-lg font-bold text-emerald-300">{crr}</div>
          </div>
          {rrr !== null && (
            <>
              <div className="h-7 w-px bg-white/10" aria-hidden="true" />
              <div>
                <div className="text-[11px] font-medium text-slate-400">RRR</div>
                <div className="font-mono-tabular text-lg font-bold text-[#F5C451]">{rrr}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Last 6 Balls Broadcast Timeline */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <span className="text-xs font-medium text-slate-400 whitespace-nowrap shrink-0">
          Last 6 Balls
        </span>
        <div className="flex items-center gap-1.5" aria-label="Last 6 deliveries">
          {Array.from({ length: 6 }).map((_, idx) => {
            const ball = lastSix[idx];
            if (!ball) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="font-mono-tabular flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-xs text-slate-600"
                >
                  ·
                </div>
              );
            }

            let style =
              'border-white/15 bg-white/10 text-slate-100';
            if (ball.isWicket) {
              style = 'border-red-500/60 bg-red-500/25 text-red-200 font-bold';
            } else if (ball.savedByFreeHit) {
              style = 'border-amber-400/60 bg-amber-400/20 text-amber-200 font-bold';
            } else if (ball.runsScored >= 6) {
              style = 'border-amber-400/70 bg-[#F5C451] text-[#051610] font-extrabold';
            } else if (ball.runsScored >= 4) {
              style = 'border-emerald-400/60 bg-emerald-500/25 text-emerald-200 font-bold';
            }

            return (
              <div
                key={`ball-${ball.ballNumber}`}
                title={ball.commentary}
                className={`font-mono-tabular flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition ${style}`}
              >
                {ball.label}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
