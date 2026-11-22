import React, { useCallback, useMemo, useState } from 'react';
import { Award, Check, Copy, Flame, Medal, MessageCircle, Trophy, X } from 'lucide-react';
import { ActivePlayerProfile, getDeviceLeaderboard } from '../engine/auth';
import { getRankInfo, RANK_TIERS } from '../engine/rankings';
import { soundFX } from '../engine/soundFX';

interface RankingsModalProps {
  profile: ActivePlayerProfile;
  onClose: () => void;
}

export const RankingsModal: React.FC<RankingsModalProps> = ({ profile, onClose }) => {
  const [copied, setCopied] = useState(false);

  const entries = useMemo(() => getDeviceLeaderboard(profile), [profile]);
  const myIndex = entries.findIndex((e) => e.isCurrentUser);
  const myPosition = myIndex >= 0 ? myIndex + 1 : 1;
  const myRank = getRankInfo(profile.arenaPoints);

  const liveUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareMessage = [
    `${profile.countryFlag} ${profile.username} · ArenaX Rank Card`,
    `Rank Tier: ${myRank.tier}`,
    `Total Points: ${profile.arenaPoints.toLocaleString()} pts`,
    `Wins: ${profile.arcadeWins} · Streak: ${profile.dailyWinStreak} day${profile.dailyWinStreak === 1 ? '' : 's'}`,
    `Device Standing: #${myPosition} of ${entries.length}`,
    `Think you can climb higher? Play ArenaX offline or online: ${liveUrl}`,
  ].join('\n');

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  const handleCopyRank = useCallback(async () => {
    soundFX.playTap();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareMessage);
      } else {
        const ta = document.createElement('textarea');
        ta.value = shareMessage;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    } catch {
      setCopied(false);
    }
  }, [shareMessage]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rankings-modal-title"
      onClick={onClose}
    >
      <div
        className="glass-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-semibold text-[#F5C451]">
              On-Device Arcade Standings
            </p>
            <h2
              id="rankings-modal-title"
              className="font-display mt-0.5 flex items-center gap-2 text-2xl font-bold tracking-wide text-white sm:text-3xl"
            >
              <span>Device Rankings 🏆</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFX.playTap();
              onClose();
            }}
            aria-label="Close rankings"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Active Player Rank Summary */}
        <div className="mt-4 rounded-xl border border-[#F5C451]/35 bg-[#F5C451]/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>Your Rank Tier</span>
                <span aria-hidden="true">·</span>
                <span>
                  Device #{myPosition} of {entries.length}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2.5">
                <span className={`font-display text-3xl font-extrabold ${myRank.textClass}`}>
                  {myRank.tier}
                </span>
                <span className="font-mono-tabular text-sm font-bold text-white">
                  {profile.arenaPoints.toLocaleString()} pts
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-300">Next Tier</div>
              <div className="font-mono-tabular mt-0.5 text-sm font-bold text-white">
                {myRank.nextTier
                  ? `${myRank.pointsToNext.toLocaleString()} pts to ${myRank.nextTier}`
                  : 'Top Tier Unlocked'}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/40">
            <div
              className={`h-full rounded-full transition-all duration-300 ${myRank.barClass}`}
              style={{ width: `${myRank.progressPct}%` }}
            />
          </div>

          {/* Tier Ladder Guide */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
            {RANK_TIERS.map((t, idx) => (
              <span key={t.tier} className="inline-flex items-center gap-1">
                {idx > 0 && (
                  <span className="mr-1 text-slate-500" aria-hidden="true">
                    →
                  </span>
                )}
                <span className={`font-bold ${t.textClass}`}>{t.tier}</span>
                <span className="font-mono-tabular text-slate-400">({t.minPoints}+)</span>
              </span>
            ))}
          </div>
        </div>

        {/* Scoring Breakdown Hint */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>Win +100 pts · Draw +40 pts · Match +15 pts</span>
          <span>Six / Queen / Top-Corner / Checkmate +25 pts</span>
        </div>

        {/* Device Leaderboard List */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Saved Profiles on This Device ({entries.length})</span>
            <span>Points</span>
          </div>

          {entries.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-center text-xs text-slate-300">
              Play a match to appear on the device leaderboard.
            </p>
          ) : (
            <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-black/25">
              {entries.map((entry, idx) => {
                const pos = idx + 1;
                const entryRank = getRankInfo(entry.arenaPoints);
                const rankColor =
                  pos === 1
                    ? 'text-[#F5C451]'
                    : pos === 2
                      ? 'text-slate-200'
                      : pos === 3
                        ? 'text-amber-500'
                        : 'text-slate-400';

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${
                      entry.isCurrentUser ? 'bg-emerald-500/12' : ''
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`font-mono-tabular w-6 shrink-0 text-center text-sm font-extrabold ${rankColor}`}
                      >
                        #{pos}
                      </span>
                      <span className="shrink-0 text-lg leading-none" aria-label={entry.countryName}>
                        {entry.countryFlag}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-white">
                            {entry.username}
                          </span>
                          {entry.isCurrentUser && (
                            <span className="shrink-0 text-[11px] font-bold text-emerald-300">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span className={`font-semibold ${entryRank.textClass}`}>
                            {entryRank.tier}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular inline-flex items-center gap-1">
                            <Trophy className="h-3 w-3 text-[#F5C451]" aria-hidden="true" />
                            {entry.arcadeWins} wins
                          </span>
                          {entry.dailyWinStreak > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular inline-flex items-center gap-0.5 text-orange-300">
                                <Flame className="h-3 w-3" aria-hidden="true" />
                                {entry.dailyWinStreak}d
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-mono-tabular flex items-center justify-end gap-1 text-base font-extrabold text-white">
                        {pos === 1 && (
                          <Medal className="h-4 w-4 text-[#F5C451]" aria-hidden="true" />
                        )}
                        {pos !== 1 && entryRank.tier === 'Legend' && (
                          <Award className="h-4 w-4 text-[#F5C451]" aria-hidden="true" />
                        )}
                        <span>{entry.arenaPoints.toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] font-medium text-slate-400">Arena Pts</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Share My Rank on WhatsApp */}
        <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
          <div className="flex items-stretch gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleCopyRank}
              className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-[#03120C] transition hover:bg-emerald-400 active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Share My Rank on WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={handleCopyRank}
              aria-label="Copy rank summary"
              title="Copy rank summary"
              className="inline-flex min-h-[46px] min-w-[46px] items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 text-slate-100 transition hover:bg-white/15 active:scale-[0.98]"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {copied && (
            <p
              role="status"
              aria-live="polite"
              className="text-center text-xs font-medium text-emerald-300"
            >
              Rank summary copied to clipboard · Ready to share on WhatsApp!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
