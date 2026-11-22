import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  CircleDot,
  Crown,
  Flame,
  LogOut,
  Play,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  WifiOff,
  Zap,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { RankingsModal } from './components/RankingsModal';
import { SettingsModal } from './components/SettingsModal';
import {
  ActivePlayerProfile,
  getActiveSession,
  logoutSession,
  recordCarromQueenCapture,
  recordMatchResult,
} from './engine/auth';
import { calculateMatchPoints, getRankInfo, MatchPointsBreakdown } from './engine/rankings';
import { soundFX } from './engine/soundFX';
import { CarromGame } from './games/CarromGame';
import { ChessGame } from './games/ChessGame';
import { FootballPenaltyGame } from './games/FootballPenaltyGame';
import { HandCricketGame } from './games/HandCricketGame';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePWAInstall } from './hooks/usePWAInstall';

type ActiveSport = 'hub' | 'cricket' | 'carrom' | 'football' | 'chess';

export default function App() {
  const pwaInstall = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [profile, setProfile] = useState<ActivePlayerProfile | null>(() => getActiveSession());
  const [activeSport, setActiveSport] = useState<ActiveSport>('hub');
  const [muted, setMuted] = useState<boolean>(() => soundFX.isMuted());
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRankingsModal, setShowRankingsModal] = useState(false);

  useEffect(() => {
    return soundFX.subscribe(() => {
      setMuted(soundFX.isMuted());
    });
  }, []);

  const handleToggleMute = () => {
    setMuted(soundFX.toggleMute());
  };

  const handleCricketMatchComplete = useCallback(
    (res: { outcome: 'win' | 'draw' | 'loss'; sixes: number }): MatchPointsBreakdown => {
      const bonusLabel =
        res.sixes > 0 ? `${res.sixes} Six${res.sixes === 1 ? '' : 'es'}` : undefined;
      setProfile((prev) =>
        prev
          ? recordMatchResult(prev, {
              sport: 'cricket',
              outcome: res.outcome,
              bonusCount: res.sixes,
              bonusLabel,
            }).profile
          : prev
      );
      return calculateMatchPoints({
        outcome: res.outcome,
        bonusCount: res.sixes,
        bonusLabel,
      });
    },
    []
  );

  const handleCarromMatchComplete = useCallback(
    (res: { outcome: 'win' | 'loss'; queenCovers: number }): MatchPointsBreakdown => {
      const bonusLabel =
        res.queenCovers > 0
          ? res.queenCovers === 1
            ? 'Queen Covered'
            : `${res.queenCovers} Queens`
          : undefined;
      setProfile((prev) =>
        prev
          ? recordMatchResult(prev, {
              sport: 'carrom',
              outcome: res.outcome,
              bonusCount: res.queenCovers,
              bonusLabel,
            }).profile
          : prev
      );
      return calculateMatchPoints({
        outcome: res.outcome,
        bonusCount: res.queenCovers,
        bonusLabel,
      });
    },
    []
  );

  const handleCarromQueenCaptured = useCallback(() => {
    setProfile((prev) => (prev ? recordCarromQueenCapture(prev) : prev));
  }, []);

  const handlePenaltyMatchComplete = useCallback(
    (res: { outcome: 'win' | 'loss'; topCornerGoals: number }): MatchPointsBreakdown => {
      const bonusLabel =
        res.topCornerGoals > 0
          ? `${res.topCornerGoals} Top-Corner${res.topCornerGoals === 1 ? '' : 's'}`
          : undefined;
      setProfile((prev) =>
        prev
          ? recordMatchResult(prev, {
              sport: 'penalty',
              outcome: res.outcome,
              bonusCount: res.topCornerGoals,
              bonusLabel,
            }).profile
          : prev
      );
      return calculateMatchPoints({
        outcome: res.outcome,
        bonusCount: res.topCornerGoals,
        bonusLabel,
      });
    },
    []
  );

  const handleChessMatchComplete = useCallback(
    (res: { outcome: 'win' | 'draw' | 'loss'; checkmates: number }): MatchPointsBreakdown => {
      const bonusLabel = res.checkmates > 0 ? 'Checkmate' : undefined;
      setProfile((prev) =>
        prev
          ? recordMatchResult(prev, {
              sport: 'chess',
              outcome: res.outcome,
              bonusCount: res.checkmates,
              bonusLabel,
            }).profile
          : prev
      );
      return calculateMatchPoints({
        outcome: res.outcome,
        bonusCount: res.checkmates,
        bonusLabel,
      });
    },
    []
  );

  const handleLogout = () => {
    soundFX.playTap();
    logoutSession();
    setProfile(null);
    setActiveSport('hub');
  };

  const rankInfo = profile ? getRankInfo(profile.arenaPoints) : null;

  const arenaBgClass =
    !profile || activeSport === 'hub'
      ? 'arena-hub'
      : activeSport === 'cricket'
        ? 'arena-cricket'
        : activeSport === 'carrom'
          ? 'arena-carrom'
          : activeSport === 'chess'
            ? 'arena-chess'
            : 'arena-football';

  return (
    <div className={`arena-bg-layer relative min-h-screen text-slate-100 ${arenaBgClass}`}>
      {/* Subtle animated floodlight atmosphere */}
      <div
        className="animate-floodlight-sweep pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.04] to-transparent"
        aria-hidden="true"
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050d12]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-5 sm:px-6">
          {/* Zone 1: Brand Wordmark + Subtle Offline Ready Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                soundFX.playTap();
                if (profile) setActiveSport('hub');
              }}
              className="font-display text-xl font-extrabold tracking-wide text-white transition hover:text-[#F5C451] whitespace-nowrap shrink-0 sm:text-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C451]"
            >
              ArenaX
            </button>

            {(pwaInstall.offlineReady || !isOnline) && (
              <span
                title={
                  !isOnline
                    ? 'Playing offline from local Service Worker cache'
                    : 'All 4 games precached for 100% offline play'
                }
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap shrink-0 sm:px-2 sm:text-[11px] ${
                  !isOnline
                    ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                    : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {!isOnline ? (
                  <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">Offline Ready</span>
                <span className="sm:hidden">Offline</span>
              </span>
            )}
          </div>

          {/* Zone 2: Logged-in Player Profile OR Privacy link */}
          {profile ? (
            <div className="flex min-w-0 items-center gap-2 text-xs sm:gap-3 sm:text-sm">
              <div className="flex min-w-0 items-center gap-1.5 font-semibold text-white">
                <span className="text-base leading-none" aria-label={profile.countryName}>
                  {profile.countryFlag}
                </span>
                <span className="max-w-[60px] truncate sm:max-w-[140px]">
                  {profile.username}
                </span>
              </div>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <div className="font-mono-tabular flex items-center gap-1 font-bold text-[#F5C451] whitespace-nowrap shrink-0">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{profile.arenaPoints.toLocaleString()}</span>
                <span className="hidden text-xs font-medium text-slate-300 sm:inline">
                  Pts
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="hidden items-center gap-1.5 text-xs font-medium text-emerald-300 hover:underline underline-offset-4 sm:inline-flex"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>On-Device Encrypted</span>
            </button>
          )}

          {/* Zone 3: Sound, Install App & Logout */}
          <div className="flex items-center gap-1.5 shrink-0 sm:gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
              title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-slate-400" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4 text-[#F5C451]" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                soundFX.playTap();
                setShowSettingsModal(true);
              }}
              aria-label="Open Sound and Account Settings"
              title="Sound & Account Settings"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-[#F5C451]"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </button>

            <PWAInstallButton installState={pwaInstall} />

            {profile && (
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {!profile ? (
          <AuthGate
            onAuthenticated={(nextProfile) => {
              setProfile(nextProfile);
              setActiveSport('hub');
            }}
            onOpenPrivacy={() => setShowPrivacyModal(true)}
          />
        ) : activeSport === 'hub' ? (
          <div className="space-y-6">
            {/* Hub Hero */}
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-[#F5C451]">
                  ArenaX: Mini-Sports Arcade · Offline-Ready PWA
                </p>
                <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight text-white sm:text-5xl">
                  Choose Your Arena, {profile.username}
                </h1>
                <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                  Every arena shifts the stadium atmosphere and adds victories directly to your
                  local profile.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="inline-flex min-h-[38px] items-center gap-1.5 self-start rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 md:self-auto"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                <span>100% On-Device Encrypted Privacy</span>
              </button>
            </div>

            {/* Unified Player Profile, Rank Tier & Multi-Sport Stats Card */}
            <section
              aria-label="Unified Arcade Profile Stats"
              className="glass-panel rounded-2xl p-5 shadow-xl"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/35 text-2xl">
                    <span aria-label={profile.countryName}>{profile.countryFlag}</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-2xl font-bold tracking-wide text-white">
                        {profile.username}
                      </h2>
                      {rankInfo && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${rankInfo.accentBgClass}`}
                        >
                          <Award className="h-3 w-3" aria-hidden="true" />
                          <span>{rankInfo.tier}</span>
                        </span>
                      )}
                      <span className="text-xs font-medium text-slate-400">
                        · {profile.countryName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {profile.isGuest
                        ? 'Guest Session · Register to save points & rank permanently on this device'
                        : 'Unified Multi-Sport Career Record'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {rankInfo && (
                    <div className="min-w-[175px] rounded-xl border border-white/10 bg-black/25 px-3.5 py-2">
                      <div className="flex items-center justify-between gap-3 text-[11px]">
                        <span className="font-semibold text-slate-300">Arena Points</span>
                        <span className="font-mono-tabular font-extrabold text-[#F5C451]">
                          {profile.arenaPoints.toLocaleString()} pts
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/45">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${rankInfo.barClass}`}
                          style={{ width: `${rankInfo.progressPct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {rankInfo.nextTier
                          ? `${rankInfo.pointsToNext.toLocaleString()} pts to ${rankInfo.nextTier}`
                          : 'Legend Tier Unlocked'}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playTap();
                      setShowRankingsModal(true);
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#F5C451]/50 bg-[#F5C451]/15 px-4 py-2 text-xs font-bold text-[#F5C451] transition hover:bg-[#F5C451] hover:text-[#051610] whitespace-nowrap shrink-0 sm:text-sm"
                  >
                    <span>Rankings 🏆</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-4 sm:grid-cols-3 lg:grid-cols-7">
                <div className="rounded-xl border border-[#F5C451]/30 bg-[#F5C451]/10 px-3 py-2.5">
                  <div className="text-[11px] font-semibold text-[#F5C451]">Arena Points</div>
                  <div className="font-mono-tabular mt-0.5 text-2xl font-extrabold text-white">
                    {profile.arenaPoints.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                  <div className="text-[11px] font-semibold text-[#F5C451]">Total Wins</div>
                  <div className="font-mono-tabular mt-0.5 text-2xl font-extrabold text-white">
                    {profile.arcadeWins}
                  </div>
                </div>
                <div className="rounded-xl border border-orange-400/25 bg-orange-500/10 px-3 py-2.5">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-orange-300">
                    <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden="true" />
                    <span>Daily Streak</span>
                  </div>
                  <div className="font-mono-tabular mt-0.5 text-2xl font-extrabold text-white">
                    {profile.dailyWinStreak}
                    <span className="ml-1 text-xs font-semibold text-orange-200/80">
                      {profile.dailyWinStreak === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                  <div className="text-[11px] font-semibold text-amber-300">Hand Cricket</div>
                  <div className="font-mono-tabular mt-0.5 text-2xl font-extrabold text-white">
                    {profile.cricketWins}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                  <div className="text-[11px] font-semibold text-cyan-300">Neon Carrom</div>
                  <div className="font-mono-tabular mt-0.5 flex items-baseline gap-2 text-2xl font-extrabold text-white">
                    <span>{profile.carromWins}</span>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-red-300">
                      <Crown className="h-3 w-3 text-red-400" aria-hidden="true" />
                      {profile.carromQueenCaptures}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                  <div className="text-[11px] font-semibold text-emerald-300">Curve Penalty</div>
                  <div className="font-mono-tabular mt-0.5 text-2xl font-extrabold text-white">
                    {profile.penaltyWins}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                  <div className="text-[11px] font-semibold text-emerald-200">Royal Chess</div>
                  <div className="font-mono-tabular mt-0.5 text-2xl font-extrabold text-white">
                    {profile.chessWins}
                  </div>
                </div>
              </div>
            </section>

            {/* 4 Mini-Sport Cards */}
            <div className="grid gap-5 md:grid-cols-2">
              {/* Sport 1: Gully Clash Hand Cricket */}
              <button
                type="button"
                onClick={() => {
                  soundFX.playTap();
                  setActiveSport('cricket');
                }}
                className="glass-panel group flex flex-col justify-between rounded-2xl p-6 text-left transition duration-200 hover:-translate-y-1 hover:border-[#F5C451]/80 hover:shadow-[0_0_32px_rgba(245,196,81,0.24)] active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5C451] text-[#051610]">
                      <Zap className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold text-amber-300">
                      Night-Green Stadium
                    </span>
                  </div>

                  <h2 className="font-display mt-4 text-3xl font-bold tracking-wide text-white group-hover:text-[#F5C451]">
                    Gully Clash Cricket
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
                    1-Over Super Over Blitz, Classic 1v1 Coin Toss Matches, and 2-Player Pass &amp;
                    Play with Free Hit &amp; 2X Runs cards.
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-bold text-[#F5C451]">
                  <span>3 Game Modes</span>
                  <span className="inline-flex items-center gap-1">
                    Enter Pitch <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
              </button>

              {/* Sport 2: Neon Carrom Striker */}
              <button
                type="button"
                onClick={() => {
                  soundFX.playTap();
                  setActiveSport('carrom');
                }}
                className="glass-panel group flex flex-col justify-between rounded-2xl p-6 text-left transition duration-200 hover:-translate-y-1 hover:border-cyan-400/80 hover:shadow-[0_0_32px_rgba(34,211,238,0.24)] active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/20 text-cyan-300">
                      <CircleDot className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold text-cyan-300">
                      Cyber-Wood Arena
                    </span>
                  </div>

                  <h2 className="font-display mt-4 text-3xl font-bold tracking-wide text-white group-hover:text-cyan-300">
                    Neon Carrom Striker
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
                    Authentic 19-coin board (9 white, 9 black, Red Queen +3 bonus), slingshot aim
                    trajectory, vs Smart AI &amp; 2P Pass &amp; Play.
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-bold text-cyan-300">
                  <span>60fps Rigid-Body</span>
                  <span className="inline-flex items-center gap-1">
                    Break Board <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
              </button>

              {/* Sport 3: Curve-Shot Penalty Duel */}
              <button
                type="button"
                onClick={() => {
                  soundFX.playTap();
                  setActiveSport('football');
                }}
                className="glass-panel group flex flex-col justify-between rounded-2xl p-6 text-left transition duration-200 hover:-translate-y-1 hover:border-emerald-400/80 hover:shadow-[0_0_32px_rgba(16,185,129,0.24)] active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/20 text-emerald-300">
                      <Target className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-300">
                      Floodlit Euro Pitch
                    </span>
                  </div>

                  <h2 className="font-display mt-4 text-3xl font-bold tracking-wide text-white group-hover:text-emerald-300">
                    Curve-Shot Penalty Duel
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
                    Swipe-to-bend Magnus spin around a moving defender wall into the 3D goal net!
                    5-kick shootout + sudden death vs AI or 2P Pass &amp; Play.
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-bold text-emerald-300">
                  <span>Swipe Curve &amp; Keep</span>
                  <span className="inline-flex items-center gap-1">
                    Take Spot <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
              </button>

              {/* Sport 4: Royal & Chaos Chess */}
              <button
                type="button"
                onClick={() => {
                  soundFX.playTap();
                  setActiveSport('chess');
                }}
                className="glass-panel group flex flex-col justify-between rounded-2xl p-6 text-left transition duration-200 hover:-translate-y-1 hover:border-emerald-300/80 hover:shadow-[0_0_32px_rgba(16,185,129,0.28)] active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-900/50 text-[#F5C451]">
                      <Crown className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-200">
                      Royal-Emerald &amp; Obsidian
                    </span>
                  </div>

                  <h2 className="font-display mt-4 text-3xl font-bold tracking-wide text-white group-hover:text-[#F5C451]">
                    Royal &amp; Chaos Chess
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
                    Classic Blitz (3m / 5m / Casual) or Chaos Modifier Chess with 2 dealt rule
                    twists! Alpha-beta Minimax AI &amp; auto-flip 2P Pass &amp; Play.
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-bold text-[#F5C451]">
                  <span>Classic &amp; Chaos</span>
                  <span className="inline-flex items-center gap-1">
                    Enter Board <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
              </button>
            </div>
          </div>
        ) : activeSport === 'cricket' ? (
          <HandCricketGame
            playerName={profile.username}
            countryFlag={profile.countryFlag}
            onMatchComplete={handleCricketMatchComplete}
            onBackToHub={() => setActiveSport('hub')}
          />
        ) : activeSport === 'carrom' ? (
          <CarromGame
            playerName={profile.username}
            countryFlag={profile.countryFlag}
            carromWins={profile.carromWins}
            queenCaptures={profile.carromQueenCaptures}
            onMatchComplete={handleCarromMatchComplete}
            onQueenCaptured={handleCarromQueenCaptured}
            onBackToHub={() => setActiveSport('hub')}
          />
        ) : activeSport === 'chess' ? (
          <ChessGame
            playerName={profile.username}
            countryFlag={profile.countryFlag}
            chessWins={profile.chessWins}
            onMatchComplete={handleChessMatchComplete}
            onBackToHub={() => setActiveSport('hub')}
          />
        ) : (
          <FootballPenaltyGame
            playerName={profile.username}
            countryFlag={profile.countryFlag}
            penaltyWins={profile.penaltyWins}
            onMatchComplete={handlePenaltyMatchComplete}
            onBackToHub={() => setActiveSport('hub')}
          />
        )}
      </main>

      {showPrivacyModal && (
        <PrivacyPolicyModal onClose={() => setShowPrivacyModal(false)} />
      )}

      {showRankingsModal && profile && (
        <RankingsModal
          profile={profile}
          onClose={() => setShowRankingsModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          profile={profile}
          onClose={() => setShowSettingsModal(false)}
          onAccountClosed={() => {
            setProfile(null);
            setActiveSport('hub');
          }}
          onUpgradeGuest={() => {
            logoutSession();
            setProfile(null);
            setActiveSport('hub');
          }}
          onStatsReset={(updated) => setProfile(updated)}
        />
      )}

      <OfflineIndicator />
    </div>
  );
}
