import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Flame,
  Lock,
  Play,
  RotateCcw,
  Shield,
  Swords,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { CareerStatsModal } from '../components/CareerStatsModal';
import { CoinToss } from '../components/CoinToss';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { HandGesture } from '../components/HandGesture';
import { Keypad } from '../components/Keypad';
import { MatchPointsBanner } from '../components/MatchPointsBanner';
import { PitchArena } from '../components/PitchArena';
import { PowerUpBar } from '../components/PowerUpBar';
import { RulesModal } from '../components/RulesModal';
import { Scoreboard } from '../components/Scoreboard';
import { WhatsAppChallengeButton } from '../components/WhatsAppChallengeButton';
import { generateCommentary } from '../engine/commentary';
import { MatchPointsBreakdown } from '../engine/rankings';
import { SmartAIOpponent } from '../engine/smartAI';
import { soundFX } from '../engine/soundFX';
import { loadCareerStats, recordMatchStats, resetCareerStats } from '../engine/storage';
import {
  BallOutcome,
  CareerStats,
  GameMode,
  HandNumber,
  InningsState,
  MatchConfig,
  MatchPhase,
  PowerUpType,
  SideId,
} from '../types/game';

interface HandCricketGameProps {
  playerName: string;
  countryFlag: string;
  onMatchComplete: (result: {
    outcome: 'win' | 'draw' | 'loss';
    sixes: number;
  }) => MatchPointsBreakdown;
  onBackToHub: () => void;
}

function createInitialInnings(params: {
  inningsNumber: 1 | 2;
  battingSide: SideId;
  bowlingSide: SideId;
  maxWickets: number;
  maxBalls: number | null;
  target: number | null;
}): InningsState {
  return {
    inningsNumber: params.inningsNumber,
    battingSide: params.battingSide,
    bowlingSide: params.bowlingSide,
    runs: 0,
    wickets: 0,
    maxWickets: params.maxWickets,
    ballsBowled: 0,
    maxBalls: params.maxBalls,
    target: params.target,
    powerUps: { freeHitUsed: false, doubleRunsUsed: false },
    history: [],
  };
}

function isInningsComplete(inn: InningsState): boolean {
  if (inn.wickets >= inn.maxWickets) return true;
  if (inn.maxBalls !== null && inn.ballsBowled >= inn.maxBalls) return true;
  if (inn.target !== null && inn.runs >= inn.target) return true;
  return false;
}

export const HandCricketGame: React.FC<HandCricketGameProps> = ({
  playerName,
  countryFlag,
  onMatchComplete,
  onBackToHub,
}) => {
  const aiRef = useRef<SmartAIOpponent>(new SmartAIOpponent());
  const statsRecordedRef = useRef<boolean>(false);

  const [phase, setPhase] = useState<MatchPhase>('HOME');
  const [careerStats, setCareerStats] = useState<CareerStats>(() => loadCareerStats());
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [lastPointsBreakdown, setLastPointsBreakdown] = useState<MatchPointsBreakdown | null>(null);

  const [selectedMode, setSelectedMode] = useState<GameMode>('blitz');
  const [blitzStartOption, setBlitzStartOption] = useState<'bat' | 'bowl' | 'toss'>('bat');
  const [classicWickets, setClassicWickets] = useState<1 | 3>(3);
  const [passFormat, setPassFormat] = useState<'blitz' | 'classic1' | 'classic3'>('blitz');
  const [p1InputName, setP1InputName] = useState(playerName || 'Player 1');
  const [p2InputName, setP2InputName] = useState('Player 2');

  const [config, setConfig] = useState<MatchConfig>({
    mode: 'blitz',
    maxWickets: 1,
    maxBalls: 6,
    p1Name: playerName || 'You',
    p2Name: 'Smart AI',
    isVsAI: true,
  });
  const [tossSummary, setTossSummary] = useState<string>('');
  const [firstInnings, setFirstInnings] = useState<InningsState | null>(null);
  const [currentInnings, setCurrentInnings] = useState<InningsState | null>(null);
  const [armedPowerUp, setArmedPowerUp] = useState<PowerUpType | null>(null);

  const [ppTurn, setPpTurn] = useState<'P1' | 'P2'>('P1');
  const [pendingP1Pick, setPendingP1Pick] = useState<HandNumber | null>(null);
  const [pendingP1PowerUp, setPendingP1PowerUp] = useState<PowerUpType | null>(null);

  const [revealSeq, setRevealSeq] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const [confettiIntensity, setConfettiIntensity] = useState<'six' | 'win'>('six');
  const [wicketShakeKey, setWicketShakeKey] = useState(0);
  const [hitShakeKey, setHitShakeKey] = useState(0);

  const resetVisualFeedback = () => {
    setRevealSeq(0);
    setArmedPowerUp(null);
    setPendingP1Pick(null);
    setPendingP1PowerUp(null);
    setPpTurn('P1');
  };

  const openModeSetup = (mode: GameMode) => {
    soundFX.playTap();
    setSelectedMode(mode);
    setPhase('SETUP');
  };

  const beginInningsMatch = useCallback(
    (matchConfig: MatchConfig, batFirstSide: SideId, summary: string) => {
      aiRef.current.reset();
      statsRecordedRef.current = false;
      setLastPointsBreakdown(null);
      resetVisualFeedback();
      setConfig(matchConfig);
      setTossSummary(summary);
      setFirstInnings(null);
      setCurrentInnings(
        createInitialInnings({
          inningsNumber: 1,
          battingSide: batFirstSide,
          bowlingSide: batFirstSide === 'p1' ? 'p2' : 'p1',
          maxWickets: matchConfig.maxWickets,
          maxBalls: matchConfig.maxBalls,
          target: null,
        })
      );
      setPhase('PLAYING');
    },
    []
  );

  const handleStartFromSetup = () => {
    soundFX.playTap();
    const soloName = playerName || 'You';
    if (selectedMode === 'blitz') {
      const cfg: MatchConfig = {
        mode: 'blitz',
        maxWickets: 1,
        maxBalls: 6,
        p1Name: soloName,
        p2Name: 'Smart AI',
        isVsAI: true,
      };
      setConfig(cfg);
      if (blitzStartOption === 'toss') {
        setPhase('TOSS');
      } else {
        const batFirst: SideId = blitzStartOption === 'bat' ? 'p1' : 'p2';
        beginInningsMatch(
          cfg,
          batFirst,
          batFirst === 'p1'
            ? `Super Over Blitz · ${soloName} chose to set the target.`
            : `Super Over Blitz · ${soloName} chose to bowl first and chase.`
        );
      }
      return;
    }

    if (selectedMode === 'classic') {
      const cfg: MatchConfig = {
        mode: 'classic',
        maxWickets: classicWickets,
        maxBalls: null,
        p1Name: soloName,
        p2Name: 'Smart AI',
        isVsAI: true,
      };
      setConfig(cfg);
      setPhase('TOSS');
      return;
    }

    const cleanP1 = p1InputName.trim() || 'Player 1';
    const cleanP2 = p2InputName.trim() || 'Player 2';
    const maxWickets: 1 | 3 = passFormat === 'classic3' ? 3 : 1;
    const maxBalls = passFormat === 'blitz' ? 6 : null;
    const cfg: MatchConfig = {
      mode: passFormat === 'blitz' ? 'blitz' : 'classic',
      maxWickets,
      maxBalls,
      p1Name: cleanP1,
      p2Name: cleanP2,
      isVsAI: false,
    };
    setConfig(cfg);
    setPhase('TOSS');
  };

  const resolveDelivery = useCallback(
    (
      innings: InningsState,
      batterPick: HandNumber,
      bowlerPick: HandNumber,
      powerUpUsed: PowerUpType | null,
      aiReadPattern: boolean
    ) => {
      const isMatch = batterPick === bowlerPick;
      const savedByFreeHit = isMatch && powerUpUsed === 'free_hit';
      const isWicket = isMatch && !savedByFreeHit;

      const baseRuns = isWicket ? 0 : batterPick;
      const runsScored =
        !isWicket && powerUpUsed === 'double_runs' ? baseRuns * 2 : baseRuns;

      const newRuns = innings.runs + runsScored;
      const newWickets = innings.wickets + (isWicket ? 1 : 0);
      const newBalls = innings.ballsBowled + 1;

      const batterName = innings.battingSide === 'p1' ? config.p1Name : config.p2Name;
      const bowlerName = innings.bowlingSide === 'p1' ? config.p1Name : config.p2Name;

      const commentary = generateCommentary({
        batterName,
        bowlerName,
        runsScored,
        basePick: batterPick,
        isWicket,
        savedByFreeHit,
        powerUpUsed,
        aiReadPattern,
        newTotal: newRuns,
        prevTotal: innings.runs,
        target: innings.target,
      });

      const label = isWicket
        ? 'W'
        : savedByFreeHit
          ? `${runsScored}*`
          : String(runsScored);

      const outcome: BallOutcome = {
        ballNumber: newBalls,
        batterPick,
        bowlerPick,
        runsScored,
        isWicket,
        savedByFreeHit,
        powerUpUsed,
        aiReadPattern,
        label,
        commentary,
      };

      const nextInnings: InningsState = {
        ...innings,
        runs: newRuns,
        wickets: newWickets,
        ballsBowled: newBalls,
        powerUps: {
          freeHitUsed: innings.powerUps.freeHitUsed || powerUpUsed === 'free_hit',
          doubleRunsUsed: innings.powerUps.doubleRunsUsed || powerUpUsed === 'double_runs',
        },
        history: [...innings.history, outcome],
      };

      setRevealSeq((s) => s + 1);
      if (isWicket) {
        soundFX.playWicket();
        setWicketShakeKey((k) => k + 1);
      } else if (savedByFreeHit) {
        soundFX.playFreeHitSave();
      } else {
        soundFX.playBatHit(runsScored);
        if (runsScored >= 6) {
          setConfettiIntensity('six');
          setConfettiKey((k) => k + 1);
          setHitShakeKey((k) => k + 1);
        }
      }

      setCurrentInnings(nextInnings);
      setArmedPowerUp(null);

      const ended = isInningsComplete(nextInnings);

      if (!config.isVsAI) {
        setPhase('REVEAL_PAUSE');
        return;
      }

      if (ended) {
        if (nextInnings.inningsNumber === 1) {
          setFirstInnings(nextInnings);
          setPhase('INNINGS_BREAK');
        } else {
          if (!statsRecordedRef.current) {
            statsRecordedRef.current = true;
            const inn1 = firstInnings;
            const p1Innings =
              nextInnings.battingSide === 'p1' ? nextInnings : inn1;
            const p2Innings =
              nextInnings.battingSide === 'p2' ? nextInnings : inn1;
            const p1Runs = p1Innings?.runs ?? 0;
            const p2Runs = p2Innings?.runs ?? 0;
            const won = p1Runs > p2Runs;
            const tied = p1Runs === p2Runs;
            const playerSixes = (p1Innings?.history ?? []).filter(
              (b) => !b.isWicket && b.batterPick === 6
            ).length;

            if (won) {
              soundFX.playVictoryFanfare();
              setConfettiIntensity('win');
              setConfettiKey((k) => k + 1);
            } else if (!tied) {
              soundFX.playDefeatBuzzer();
            }

            const earned = onMatchComplete({
              outcome: won ? 'win' : tied ? 'draw' : 'loss',
              sixes: playerSixes,
            });
            setLastPointsBreakdown(earned);

            const updated = recordMatchStats({
              won,
              tied,
              playerRuns: p1Runs,
              playerSixes,
            });
            setCareerStats(updated);
          }
          setPhase('MATCH_OVER');
        }
      }
    },
    [config, firstInnings, onMatchComplete]
  );

  const handleSelectNumber = useCallback(
    (num: HandNumber) => {
      if (!currentInnings || phase !== 'PLAYING') return;

      if (config.isVsAI) {
        const userIsBatting = currentInnings.battingSide === 'p1';
        if (userIsBatting) {
          const { pick: aiBowl, predictedPattern } = aiRef.current.chooseBowlDelivery(
            currentInnings,
            armedPowerUp
          );
          aiRef.current.recordUserBat(num);
          resolveDelivery(currentInnings, num, aiBowl, armedPowerUp, predictedPattern);
        } else {
          const { pick: aiBat, powerUp: aiPowerUp } =
            aiRef.current.chooseBatShot(currentInnings);
          aiRef.current.recordUserBowl(num);
          resolveDelivery(currentInnings, aiBat, num, aiPowerUp, false);
        }
        return;
      }

      soundFX.playTap();
      if (ppTurn === 'P1') {
        setPendingP1Pick(num);
        setPendingP1PowerUp(currentInnings.battingSide === 'p1' ? armedPowerUp : null);
        setArmedPowerUp(null);
        setPhase('HANDOFF');
      } else {
        if (pendingP1Pick === null) return;
        const p1Batting = currentInnings.battingSide === 'p1';
        const batterPick = p1Batting ? pendingP1Pick : num;
        const bowlerPick = p1Batting ? num : pendingP1Pick;
        const powerUp = p1Batting ? pendingP1PowerUp : armedPowerUp;

        setPendingP1Pick(null);
        setPendingP1PowerUp(null);
        resolveDelivery(currentInnings, batterPick, bowlerPick, powerUp, false);
      }
    },
    [
      armedPowerUp,
      config.isVsAI,
      currentInnings,
      pendingP1Pick,
      pendingP1PowerUp,
      phase,
      ppTurn,
      resolveDelivery,
    ]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'PLAYING' || showRulesModal || showStatsModal) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        handleSelectNumber(Number(e.key) as HandNumber);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectNumber, phase, showRulesModal, showStatsModal]);

  const handlePowerUpToggle = (type: PowerUpType) => {
    if (!currentInnings || phase !== 'PLAYING') return;
    soundFX.playPowerUp();
    setArmedPowerUp((prev) => (prev === type ? null : type));
  };

  const handleAdvancePassAndPlay = () => {
    if (!currentInnings) return;
    soundFX.playTap();
    if (isInningsComplete(currentInnings)) {
      if (currentInnings.inningsNumber === 1) {
        setFirstInnings(currentInnings);
        setPhase('INNINGS_BREAK');
      } else {
        const inn1 = firstInnings;
        const p1Innings =
          currentInnings.battingSide === 'p1' ? currentInnings : inn1;
        const p2Innings =
          currentInnings.battingSide === 'p2' ? currentInnings : inn1;
        const p1Runs = p1Innings?.runs ?? 0;
        const p2Runs = p2Innings?.runs ?? 0;
        const p1Sixes = (p1Innings?.history ?? []).filter(
          (b) => !b.isWicket && b.batterPick === 6
        ).length;
        if (p1Runs !== p2Runs) {
          soundFX.playVictoryFanfare();
          setConfettiIntensity('win');
          setConfettiKey((k) => k + 1);
        }
        if (!statsRecordedRef.current) {
          statsRecordedRef.current = true;
          const earned = onMatchComplete({
            outcome: p1Runs > p2Runs ? 'win' : p1Runs === p2Runs ? 'draw' : 'loss',
            sixes: p1Sixes,
          });
          setLastPointsBreakdown(earned);
        }
        setPhase('MATCH_OVER');
      }
      return;
    }

    setPpTurn('P1');
    setPhase('PLAYING');
  };

  const handleStartSecondInnings = () => {
    if (!firstInnings) return;
    soundFX.playTap();
    resetVisualFeedback();
    const nextBat = firstInnings.bowlingSide;
    const nextBowl = firstInnings.battingSide;
    setCurrentInnings(
      createInitialInnings({
        inningsNumber: 2,
        battingSide: nextBat,
        bowlingSide: nextBowl,
        maxWickets: config.maxWickets,
        maxBalls: config.maxBalls,
        target: firstInnings.runs + 1,
      })
    );
    setPhase('PLAYING');
  };

  const handleRematch = () => {
    soundFX.playTap();
    if (config.mode === 'blitz' && config.isVsAI && blitzStartOption !== 'toss') {
      const batFirst: SideId = blitzStartOption === 'bat' ? 'p1' : 'p2';
      beginInningsMatch(config, batFirst, 'Super Over Rematch');
    } else {
      setPhase('TOSS');
    }
  };

  const matchResult = useMemo(() => {
    if (phase !== 'MATCH_OVER' || !currentInnings || !firstInnings) return null;
    const p1Inn = currentInnings.battingSide === 'p1' ? currentInnings : firstInnings;
    const p2Inn = currentInnings.battingSide === 'p2' ? currentInnings : firstInnings;
    const p1Runs = p1Inn.runs;
    const p2Runs = p2Inn.runs;
    const p1Sixes = p1Inn.history.filter((b) => !b.isWicket && b.batterPick === 6).length;
    const p2Sixes = p2Inn.history.filter((b) => !b.isWicket && b.batterPick === 6).length;

    const modeLabel =
      config.mode === 'blitz'
        ? '1-Over Super Over Blitz'
        : `Classic Hand Cricket (${config.maxWickets} ${config.maxWickets === 1 ? 'Wkt' : 'Wkts'})`;

    const topRuns = config.isVsAI ? p1Runs : Math.max(p1Runs, p2Runs);
    const topSixes = config.isVsAI ? p1Sixes : Math.max(p1Sixes, p2Sixes);
    const scoreToBeat = `${topRuns + 1} runs`;

    if (p1Runs === p2Runs) {
      return {
        winnerName: 'Match Tied',
        headline: 'SUPER TIE!',
        subtitle: `Both sides finished locked on ${p1Runs} runs!`,
        p1Runs,
        p2Runs,
        p1Wickets: p1Inn.wickets,
        p2Wickets: p2Inn.wickets,
        p1Sixes,
        p2Sixes,
        scoreSummary: `${modeLabel} · ${config.p1Name} ${p1Runs}/${p1Inn.wickets} vs ${config.p2Name} ${p2Runs}/${p2Inn.wickets} (${topSixes} six${topSixes === 1 ? '' : 'es'})`,
        scoreToBeat,
      };
    }

    const p1Won = p1Runs > p2Runs;
    const winnerName = p1Won ? config.p1Name : config.p2Name;
    const winningInn = p1Won ? p1Inn : p2Inn;
    const chasingWon = winningInn.inningsNumber === 2;

    const marginText = chasingWon
      ? `by ${winningInn.maxWickets - winningInn.wickets} wicket${
          winningInn.maxWickets - winningInn.wickets === 1 ? '' : 's'
        }`
      : `by ${Math.abs(p1Runs - p2Runs)} run${Math.abs(p1Runs - p2Runs) === 1 ? '' : 's'}`;

    return {
      winnerName,
      headline: `${winnerName.toUpperCase()} WIN${winnerName === 'You' ? '' : 'S'}!`,
      subtitle: `${winnerName} clinched the match ${marginText}.`,
      p1Runs,
      p2Runs,
      p1Wickets: p1Inn.wickets,
      p2Wickets: p2Inn.wickets,
      p1Sixes,
      p2Sixes,
      scoreSummary: `${modeLabel} · ${config.p1Name} (${p1Runs}/${p1Inn.wickets}) vs ${config.p2Name} (${p2Runs}/${p2Inn.wickets}) · ${winnerName} won ${marginText} (${topSixes} six${topSixes === 1 ? '' : 'es'})`,
      scoreToBeat,
    };
  }, [config, currentInnings, firstInnings, phase]);

  const activeBatterName = currentInnings
    ? currentInnings.battingSide === 'p1'
      ? config.p1Name
      : config.p2Name
    : '';
  const activeBowlerName = currentInnings
    ? currentInnings.bowlingSide === 'p1'
      ? config.p1Name
      : config.p2Name
    : '';
  const lastBall =
    currentInnings && currentInnings.history.length > 0
      ? currentInnings.history[currentInnings.history.length - 1]
      : null;

  const currentActorSide: SideId = config.isVsAI
    ? 'p1'
    : ppTurn === 'P1'
      ? 'p1'
      : 'p2';
  const currentActorName = currentActorSide === 'p1' ? config.p1Name : config.p2Name;
  const currentActorIsBatter =
    currentInnings !== null && currentInnings.battingSide === currentActorSide;

  const canUsePowerUp =
    phase === 'PLAYING' &&
    currentInnings !== null &&
    currentActorIsBatter;

  const totalShakeKey = wicketShakeKey + hitShakeKey;

  return (
    <div
      key={totalShakeKey > 0 ? `shake-${totalShakeKey}` : 'cricket-root'}
      className={totalShakeKey > 0 ? 'animate-stadium-shake' : ''}
    >
      {wicketShakeKey > 0 && (
        <div
          key={`flash-${wicketShakeKey}`}
          className="animate-wicket-flash pointer-events-none fixed inset-0 z-40 bg-red-600/35"
          aria-hidden="true"
        />
      )}

      <ConfettiBurst triggerKey={confettiKey} intensity={confettiIntensity} />

      {/* Sub-navigation bar inside Cricket Arena */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            soundFX.playTap();
            onBackToHub();
          }}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to ArenaX Hub</span>
        </button>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              soundFX.playTap();
              setShowRulesModal(true);
            }}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-slate-200 hover:bg-white/10 hover:text-white"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#F5C451]" aria-hidden="true" />
            <span>Cricket Rules</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundFX.playTap();
              setShowStatsModal(true);
            }}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-slate-200 hover:bg-white/10 hover:text-white"
          >
            <Trophy className="h-3.5 w-3.5 text-[#F5C451]" aria-hidden="true" />
            <span>Cricket Stats</span>
          </button>
        </div>
      </div>

      {/* ==================== CRICKET HOME ==================== */}
      {phase === 'HOME' && (
        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
          <div className="space-y-6">
            <div className="space-y-2.5">
              <p className="text-xs font-semibold tracking-wide text-[#F5C451]">
                Gully Clash · Floodlight Stadium Edition
              </p>
              <h1 className="font-display max-w-2xl text-4xl leading-[1.02] font-extrabold tracking-tight text-white [text-wrap:balance] sm:text-5xl">
                Hand Cricket &amp; Super Over Showdowns
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Outsmart an adaptive AI bowler, flip the toss coin for classic 1v1 duels, or pass
                the phone with tactical Free Hit and 2X Runs power-ups.
              </p>
            </div>

            <div className="grid gap-4">
              <button
                type="button"
                onClick={() => openModeSetup('blitz')}
                className="glass-panel group flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-left transition hover:border-[#F5C451]/60 hover:bg-[#0D3223]/90 active:scale-[0.99]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F5C451] text-[#051610]">
                    <Zap className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300/90">
                      <span>6 Balls</span>
                      <span aria-hidden="true">·</span>
                      <span>1 Wicket</span>
                      <span aria-hidden="true">·</span>
                      <span>Adaptive AI</span>
                    </div>
                    <h2 className="font-display mt-0.5 text-2xl font-bold tracking-wide text-white group-hover:text-[#F5C451]">
                      1-Over Super Over Blitz
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
                      Fast 6-ball chase or target-setting sprint against a smart AI that tracks
                      your number habits.
                    </p>
                  </div>
                </div>
                <Play
                  className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#F5C451]"
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={() => openModeSetup('classic')}
                className="glass-panel group flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-left transition hover:border-emerald-400/60 hover:bg-[#0D3223]/90 active:scale-[0.99]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/20 text-emerald-300">
                    <Swords className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-300/90">
                      <span>1 or 3 Wickets</span>
                      <span aria-hidden="true">·</span>
                      <span>Coin Toss</span>
                      <span aria-hidden="true">·</span>
                      <span>Full Innings</span>
                    </div>
                    <h2 className="font-display mt-0.5 text-2xl font-bold tracking-wide text-white group-hover:text-emerald-300">
                      Classic Hand Cricket
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
                      Toss Heads or Tails to bat or bowl first and play full-length 1v1 innings
                      until all wickets fall.
                    </p>
                  </div>
                </div>
                <Play
                  className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-300"
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={() => openModeSetup('passplay')}
                className="glass-panel group flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-left transition hover:border-sky-400/60 hover:bg-[#0D3223]/90 active:scale-[0.99]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/20 text-sky-300">
                    <Users className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300/90">
                      <span>2 Friends</span>
                      <span aria-hidden="true">·</span>
                      <span>1 Phone</span>
                      <span aria-hidden="true">·</span>
                      <span>Privacy Handoff</span>
                    </div>
                    <h2 className="font-display mt-0.5 text-2xl font-bold tracking-wide text-white group-hover:text-sky-300">
                      Pass &amp; Play Local Duel
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
                      Built-in privacy curtain hides Player 1&apos;s pick before handing over to
                      Player 2 for a fair reveal.
                    </p>
                  </div>
                </div>
                <Play
                  className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-sky-300"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[#F5C451]" aria-hidden="true" />
                  <h2 className="font-display text-xl font-bold tracking-wide text-white">
                    Cricket Career
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStatsModal(true)}
                  className="text-xs font-semibold text-[#F5C451] hover:underline underline-offset-4"
                >
                  Full Record
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400">Matches / Wins</div>
                  <div className="font-mono-tabular mt-0.5 text-xl font-bold text-white">
                    {careerStats.matchesPlayed}{' '}
                    <span className="text-sm font-medium text-emerald-300">
                      / {careerStats.wins}W
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Highest Score</div>
                  <div className="font-mono-tabular mt-0.5 text-xl font-bold text-[#F5C451]">
                    {careerStats.highestScore}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Sixes Hit</div>
                  <div className="font-mono-tabular mt-0.5 text-xl font-bold text-white">
                    {careerStats.sixesHit}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Win Streak</div>
                  <div className="font-mono-tabular mt-0.5 flex items-center gap-1.5 text-xl font-bold text-white">
                    <span>{careerStats.currentStreak}</span>
                    {careerStats.currentStreak >= 2 && (
                      <Flame className="h-4 w-4 text-[#F5C451]" aria-hidden="true" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <h2 className="font-display text-xl font-bold tracking-wide text-white">
                Tactical Power-Ups
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                Every batter gets 1 use of each card per innings:
              </p>

              <div className="mt-3.5 space-y-3 text-xs">
                <div className="flex items-start gap-2.5 border-t border-white/10 pt-3">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                  <div>
                    <div className="font-bold text-emerald-300">FREE HIT</div>
                    <p className="text-slate-300">
                      Survive even if the bowler matches your exact number.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 border-t border-white/10 pt-3">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#F5C451]" aria-hidden="true" />
                  <div>
                    <div className="font-bold text-[#F5C451]">2X RUNS</div>
                    <p className="text-slate-300">
                      Doubles your scored runs on that delivery (6 becomes 12).
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <div className="flex items-center gap-1.5">
                  {([1, 2, 3, 4, 5, 6] as HandNumber[]).map((n) => (
                    <HandGesture key={n} value={n} size={26} side="batter" />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRulesModal(true)}
                  className="text-xs font-semibold text-slate-200 hover:text-[#F5C451]"
                >
                  Hand Guide
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ==================== SETUP ==================== */}
      {phase === 'SETUP' && (
        <div className="glass-panel mx-auto w-full max-w-lg rounded-2xl p-6 shadow-2xl sm:p-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs font-medium text-[#F5C451]">Match Configuration</p>
              <h2 className="font-display text-3xl font-bold tracking-wide text-white">
                {selectedMode === 'blitz'
                  ? '1-Over Super Over Blitz'
                  : selectedMode === 'classic'
                    ? 'Classic Hand Cricket'
                    : 'Pass & Play Local Duel'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setPhase('HOME')}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Modes</span>
            </button>
          </div>

          <div className="mt-6 space-y-5">
            {selectedMode === 'blitz' && (
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Choose Opening Innings
                </label>
                <div className="grid gap-2.5">
                  {[
                    {
                      id: 'bat' as const,
                      title: 'Bat First (Set Target)',
                      desc: 'Play 6 balls to post a big score, then defend it.',
                    },
                    {
                      id: 'bowl' as const,
                      title: 'Bowl First (Chase Target)',
                      desc: 'Restrict Smart AI in 6 balls, then chase it down.',
                    },
                    {
                      id: 'toss' as const,
                      title: 'Flip Coin Toss',
                      desc: 'Let Heads or Tails decide who bats first.',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBlitzStartOption(opt.id)}
                      className={`rounded-xl border p-3.5 text-left transition ${
                        blitzStartOption === opt.id
                          ? 'border-[#F5C451] bg-amber-400/15 text-white'
                          : 'border-white/10 bg-black/25 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="text-sm font-bold">{opt.title}</div>
                      <div className="mt-0.5 text-xs text-slate-300/80">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedMode === 'classic' && (
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Wickets Per Innings
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setClassicWickets(1)}
                    className={`min-h-[68px] rounded-xl border p-3.5 text-left transition ${
                      classicWickets === 1
                        ? 'border-[#F5C451] bg-amber-400/15 text-white'
                        : 'border-white/10 bg-black/25 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="text-sm font-bold">1 Wicket</div>
                    <div className="mt-0.5 text-xs text-slate-300/80">Sudden Death</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassicWickets(3)}
                    className={`min-h-[68px] rounded-xl border p-3.5 text-left transition ${
                      classicWickets === 3
                        ? 'border-[#F5C451] bg-amber-400/15 text-white'
                        : 'border-white/10 bg-black/25 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="text-sm font-bold">3 Wickets</div>
                    <div className="mt-0.5 text-xs text-slate-300/80">Full Match</div>
                  </button>
                </div>
              </div>
            )}

            {selectedMode === 'passplay' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="p1-name" className="block text-xs font-semibold text-slate-300">
                      Player 1 Name
                    </label>
                    <input
                      id="p1-name"
                      type="text"
                      maxLength={14}
                      value={p1InputName}
                      onChange={(e) => setP1InputName(e.target.value)}
                      className="mt-1.5 w-full min-h-[44px] rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white focus:border-[#F5C451] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="p2-name" className="block text-xs font-semibold text-slate-300">
                      Player 2 Name
                    </label>
                    <input
                      id="p2-name"
                      type="text"
                      maxLength={14}
                      value={p2InputName}
                      onChange={(e) => setP2InputName(e.target.value)}
                      className="mt-1.5 w-full min-h-[44px] rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white focus:border-[#F5C451] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">Duel Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'blitz' as const, label: 'Super Over', sub: '6 Balls · 1 Wkt' },
                      { id: 'classic1' as const, label: 'Sudden Death', sub: '1 Wicket' },
                      { id: 'classic3' as const, label: 'Classic', sub: '3 Wickets' },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setPassFormat(fmt.id)}
                        className={`rounded-xl border p-3 text-left transition ${
                          passFormat === fmt.id
                            ? 'border-[#F5C451] bg-amber-400/15 text-white'
                            : 'border-white/10 bg-black/25 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <div className="text-xs font-bold">{fmt.label}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">{fmt.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleStartFromSetup}
            className="mt-6 min-h-[48px] w-full rounded-xl bg-[#F5C451] px-4 py-3 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472] active:scale-[0.98]"
          >
            {selectedMode === 'blitz' && blitzStartOption !== 'toss'
              ? 'Start Super Over'
              : 'Proceed to Coin Toss'}
          </button>
        </div>
      )}

      {/* ==================== COIN TOSS ==================== */}
      {phase === 'TOSS' && (
        <CoinToss
          callerName={config.p1Name}
          opponentName={config.p2Name}
          isVsAI={config.isVsAI}
          onComplete={(batFirstSide, summary) =>
            beginInningsMatch(config, batFirstSide, summary)
          }
          onCancel={() => setPhase('SETUP')}
        />
      )}

      {/* ==================== ACTIVE MATCH ==================== */}
      {(phase === 'PLAYING' ||
        phase === 'HANDOFF' ||
        phase === 'REVEAL_PAUSE' ||
        phase === 'INNINGS_BREAK' ||
        phase === 'MATCH_OVER') &&
        currentInnings && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <button
                type="button"
                onClick={() => {
                  soundFX.playTap();
                  setPhase('HOME');
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cricket Modes</span>
              </button>
              <span className="truncate text-slate-400">{tossSummary}</span>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
              <div className="space-y-4">
                <Scoreboard innings={currentInnings} config={config} />
                <PitchArena
                  batterName={activeBatterName}
                  bowlerName={activeBowlerName}
                  lastBall={lastBall}
                  revealSeq={revealSeq}
                  statusHint={
                    config.isVsAI
                      ? currentInnings.battingSide === 'p1'
                        ? `${config.p1Name} batting! Pick 1–6 to score runs.`
                        : `${config.p1Name} bowling! Match the AI number to take a wicket.`
                      : `${config.p1Name} picks first secretly, then hands over to ${config.p2Name}.`
                  }
                />
              </div>

              <div className="space-y-4">
                {phase === 'PLAYING' && (
                  <div className="glass-panel space-y-5 rounded-2xl p-4 shadow-xl sm:p-5">
                    {!config.isVsAI && (
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <span className="text-xs font-semibold text-sky-300">
                          {currentActorName}&apos;s Secret Turn
                        </span>
                        <span className="text-xs text-slate-400">
                          {currentActorIsBatter ? 'Batting' : 'Bowling'}
                        </span>
                      </div>
                    )}

                    <PowerUpBar
                      inventory={currentInnings.powerUps}
                      activePowerUp={armedPowerUp}
                      canActivate={canUsePowerUp}
                      batterName={activeBatterName}
                      onToggle={handlePowerUpToggle}
                    />

                    <Keypad
                      roleLabel={
                        currentActorIsBatter
                          ? `${currentActorName} (Batting) · Choose Runs`
                          : `${currentActorName} (Bowling) · Choose Delivery`
                      }
                      roleType={currentActorIsBatter ? 'batter' : 'bowler'}
                      onSelect={handleSelectNumber}
                    />
                  </div>
                )}

                {phase === 'HANDOFF' && (
                  <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-6 text-center shadow-2xl sm:p-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/35 bg-sky-500/20 text-sky-300">
                      <Lock className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-xs font-semibold tracking-wide text-sky-300 uppercase">
                      Privacy Handoff
                    </p>
                    <h3 className="font-display mt-1 text-3xl font-bold text-white">
                      Pass Phone to {config.p2Name}
                    </h3>
                    <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-300 sm:text-sm">
                      {config.p1Name} has locked in their move. Hand the device over without
                      peeking!
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playTap();
                        setPpTurn('P2');
                        setPhase('PLAYING');
                      }}
                      className="mt-6 min-h-[48px] w-full rounded-xl bg-[#F5C451] px-5 py-3 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472] active:scale-[0.98]"
                    >
                      I&apos;m {config.p2Name} — Ready
                    </button>
                  </div>
                )}

                {phase === 'REVEAL_PAUSE' && (
                  <div className="glass-panel flex flex-col items-center rounded-2xl p-6 text-center shadow-2xl">
                    <h3 className="font-display text-2xl font-bold text-white">
                      {isInningsComplete(currentInnings)
                        ? currentInnings.inningsNumber === 1
                          ? 'End of 1st Innings'
                          : 'Match Complete!'
                        : 'Ball Resolved'}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-300 sm:text-sm">
                      Both hands are revealed on the pitch. Ready for the next step?
                    </p>
                    <button
                      type="button"
                      onClick={handleAdvancePassAndPlay}
                      className="mt-5 min-h-[48px] w-full rounded-xl bg-[#F5C451] px-5 py-3 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472] active:scale-[0.98]"
                    >
                      {isInningsComplete(currentInnings)
                        ? currentInnings.inningsNumber === 1
                          ? 'View Innings Break'
                          : 'View Final Result'
                        : `Next Ball · ${config.p1Name} Picks First`}
                    </button>
                  </div>
                )}

                {phase === 'INNINGS_BREAK' && firstInnings && (
                  <div className="glass-panel rounded-2xl p-6 shadow-2xl sm:p-7">
                    <p className="text-xs font-semibold tracking-wide text-[#F5C451] uppercase">
                      Innings Break
                    </p>
                    <h3 className="font-display mt-1 text-3xl font-bold text-white">
                      Target Set: {firstInnings.runs + 1} Runs
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {firstInnings.battingSide === 'p1' ? config.p1Name : config.p2Name} scored{' '}
                      <span className="font-mono-tabular font-bold text-white">
                        {firstInnings.runs}/{firstInnings.wickets}
                      </span>{' '}
                      in {firstInnings.ballsBowled} ball
                      {firstInnings.ballsBowled === 1 ? '' : 's'}.
                    </p>
                    <p className="mt-1 text-sm font-medium text-emerald-300">
                      {firstInnings.bowlingSide === 'p1' ? config.p1Name : config.p2Name} needs{' '}
                      <span className="font-mono-tabular font-bold">{firstInnings.runs + 1}</span>{' '}
                      {config.maxBalls !== null ? `in ${config.maxBalls} balls` : 'to win'}.
                    </p>

                    <button
                      type="button"
                      onClick={handleStartSecondInnings}
                      className="mt-6 min-h-[48px] w-full rounded-xl bg-[#F5C451] px-5 py-3 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472] active:scale-[0.98]"
                    >
                      Start 2nd Innings Chase
                    </button>
                  </div>
                )}

                {phase === 'MATCH_OVER' && matchResult && (
                  <div className="glass-panel rounded-2xl p-6 shadow-2xl sm:p-7">
                    <div className="flex items-center gap-2.5 text-[#F5C451]">
                      <Award className="h-6 w-6" aria-hidden="true" />
                      <span className="text-xs font-bold tracking-wider uppercase">
                        Full Time
                      </span>
                    </div>
                    <h3 className="font-display mt-2 text-4xl font-extrabold tracking-wide text-white">
                      {matchResult.headline}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">{matchResult.subtitle}</p>

                    <div className="mt-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4">
                      <div>
                        <div className="text-xs text-slate-400">{config.p1Name}</div>
                        <div className="font-mono-tabular mt-0.5 text-2xl font-bold text-white">
                          {matchResult.p1Runs}/{matchResult.p1Wickets}
                        </div>
                        <div className="font-mono-tabular mt-0.5 text-xs text-amber-300/90">
                          {matchResult.p1Sixes} six{matchResult.p1Sixes === 1 ? '' : 'es'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">{config.p2Name}</div>
                        <div className="font-mono-tabular mt-0.5 text-2xl font-bold text-white">
                          {matchResult.p2Runs}/{matchResult.p2Wickets}
                        </div>
                        <div className="font-mono-tabular mt-0.5 text-xs text-emerald-300/90">
                          {matchResult.p2Sixes} six{matchResult.p2Sixes === 1 ? '' : 'es'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <MatchPointsBanner breakdown={lastPointsBreakdown} />
                    </div>

                    <div className="mt-4">
                      <WhatsAppChallengeButton
                        username={playerName}
                        countryFlag={countryFlag}
                        gameTitle="Gully Clash Hand Cricket"
                        scoreSummary={matchResult.scoreSummary}
                        scoreToBeat={matchResult.scoreToBeat}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleRematch}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#F5C451] px-4 py-3 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472] active:scale-[0.98]"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        <span>Play Again</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          soundFX.playTap();
                          setPhase('HOME');
                        }}
                        className="min-h-[48px] rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
                      >
                        Cricket Home
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {showStatsModal && (
        <CareerStatsModal
          stats={careerStats}
          onClose={() => setShowStatsModal(false)}
          onReset={() => setCareerStats(resetCareerStats())}
        />
      )}

      {showRulesModal && <RulesModal onClose={() => setShowRulesModal(false)} />}
    </div>
  );
};
