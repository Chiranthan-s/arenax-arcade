import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Color, PieceSymbol, Square } from 'chess.js';
import {
  ArrowLeft,
  Award,
  Clock,
  Cpu,
  Crown,
  Lock,
  LockOpen,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trophy,
  Undo2,
  Users,
  Zap,
} from 'lucide-react';
import { ChessPieceSVG } from '../components/ChessPieceSVG';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { MatchPointsBanner } from '../components/MatchPointsBanner';
import { WhatsAppChallengeButton } from '../components/WhatsAppChallengeButton';
import {
  AIDifficulty,
  applyRank7Promotion,
  applySideStepPawnMove,
  ChaosModifierId,
  ChaosModifierInfo,
  ChessFlavor,
  chooseBestAIMove,
  dealChaosModifiers,
  findKingSquare,
  flipTurnForDoubleJump,
  getLegalTargetsForSquare,
  LegalTarget,
  TimeControlId,
} from '../engine/chessEngine';
import { MatchPointsBreakdown } from '../engine/rankings';
import { soundFX } from '../engine/soundFX';

interface ChessGameProps {
  playerName: string;
  countryFlag: string;
  chessWins: number;
  onMatchComplete: (result: {
    outcome: 'win' | 'draw' | 'loss';
    checkmates: number;
  }) => MatchPointsBreakdown;
  onBackToHub: () => void;
}

type OpponentMode = 'ai' | 'passplay';

interface ChessSnapshot {
  fen: string;
  lastFrom: Square | null;
  lastTo: Square | null;
  san: string | null;
  capturedByWhite: PieceSymbol[];
  capturedByBlack: PieceSymbol[];
  whiteDoubleJumpUsed: boolean;
  blackDoubleJumpUsed: boolean;
  pendingDoubleJumpSquare: Square | null;
}

interface MatchResult {
  winnerSide: 'w' | 'b' | 'draw';
  title: string;
  reason: string;
  isCheckmate?: boolean;
}

interface PendingPromotion {
  from: Square;
  to: Square;
  color: Color;
  isRank7Rush: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

const PIECE_SORT_ORDER: Record<PieceSymbol, number> = {
  q: 5,
  r: 4,
  b: 3,
  n: 2,
  p: 1,
  k: 0,
};

const PIECE_POINTS: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getInitialSeconds(
  flavor: ChessFlavor,
  timeControl: TimeControlId,
  modifiers: ChaosModifierInfo[]
): number | null {
  if (flavor === 'chaos' && modifiers.some((m) => m.id === 'sudden_death_60')) {
    return 60;
  }
  if (timeControl === 'blitz3') return 180;
  if (timeControl === 'rapid5') return 300;
  return null;
}

function createInitialSnapshot(): ChessSnapshot {
  return {
    fen: new Chess().fen(),
    lastFrom: null,
    lastTo: null,
    san: null,
    capturedByWhite: [],
    capturedByBlack: [],
    whiteDoubleJumpUsed: false,
    blackDoubleJumpUsed: false,
    pendingDoubleJumpSquare: null,
  };
}

export const ChessGame: React.FC<ChessGameProps> = ({
  playerName,
  countryFlag,
  chessWins,
  onMatchComplete,
  onBackToHub,
}) => {
  const [flavor, setFlavor] = useState<ChessFlavor>('classic');
  const [timeControl, setTimeControl] = useState<TimeControlId>('blitz3');
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('ai');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [autoFlipPassPlay, setAutoFlipPassPlay] = useState<boolean>(true);
  const [chaosModifiers, setChaosModifiers] = useState<ChaosModifierInfo[]>(() =>
    dealChaosModifiers()
  );

  const [historyStack, setHistoryStack] = useState<ChessSnapshot[]>(() => [
    createInitialSnapshot(),
  ]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [lastPointsBreakdown, setLastPointsBreakdown] = useState<MatchPointsBreakdown | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);

  const activeClockInit = useMemo(
    () => getInitialSeconds(flavor, timeControl, chaosModifiers),
    [chaosModifiers, flavor, timeControl]
  );
  const [whiteSeconds, setWhiteSeconds] = useState<number | null>(activeClockInit);
  const [blackSeconds, setBlackSeconds] = useState<number | null>(activeClockInit);

  // Drag-and-Drop state
  const [dragState, setDragState] = useState<{
    from: Square;
    piece: { type: PieceSymbol; color: Color };
    x: number;
    y: number;
  } | null>(null);
  const dragOriginRef = useRef<{
    from: Square;
    piece: { type: PieceSymbol; color: Color };
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef<boolean>(false);
  const justSelectedOnPointerDownRef = useRef<Square | null>(null);
  const winRecordedRef = useRef<boolean>(false);
  const moveListRef = useRef<HTMLDivElement | null>(null);

  const currentSnap = historyStack[historyStack.length - 1];
  const chess = useMemo(() => new Chess(currentSnap.fen), [currentSnap.fen]);
  const activeTurn = chess.turn();
  const inCheck = chess.inCheck();
  const activeModifierIds = useMemo<ChaosModifierId[]>(
    () => (flavor === 'chaos' ? chaosModifiers.map((m) => m.id) : []),
    [chaosModifiers, flavor]
  );

  const hasMovesYet = historyStack.length > 1;
  const isTimed = activeClockInit !== null;

  // Auto-scroll move history
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [historyStack.length]);

  const finishMatch = useCallback(
    (result: MatchResult) => {
      setMatchResult(result);
      setAiThinking(false);
      setSelectedSquare(null);
      setPendingPromotion(null);

      if (result.winnerSide === 'w') {
        soundFX.playVictoryFanfare();
        setConfettiKey((k) => k + 1);
      } else if (result.winnerSide === 'b') {
        if (opponentMode === 'passplay') {
          soundFX.playVictoryFanfare();
          setConfettiKey((k) => k + 1);
        } else {
          soundFX.playDefeatBuzzer();
        }
      } else {
        soundFX.playTap();
      }

      if (!winRecordedRef.current) {
        winRecordedRef.current = true;
        const earned = onMatchComplete({
          outcome:
            result.winnerSide === 'w'
              ? 'win'
              : result.winnerSide === 'draw'
                ? 'draw'
                : 'loss',
          checkmates: result.winnerSide === 'w' && result.isCheckmate ? 1 : 0,
        });
        setLastPointsBreakdown(earned);
      }
    },
    [onMatchComplete, opponentMode]
  );

  // Start / Reset Match
  const startNewMatch = useCallback(
    (opts?: {
      nextFlavor?: ChessFlavor;
      nextTime?: TimeControlId;
      nextOpponent?: OpponentMode;
      redealChaos?: boolean;
    }) => {
      soundFX.playTap();
      const f = opts?.nextFlavor ?? flavor;
      const t = opts?.nextTime ?? timeControl;
      const opp = opts?.nextOpponent ?? opponentMode;
      const nextMods =
        opts?.redealChaos || (opts?.nextFlavor === 'chaos' && flavor !== 'chaos')
          ? dealChaosModifiers()
          : chaosModifiers;

      if (opts?.nextFlavor) setFlavor(f);
      if (opts?.nextTime) setTimeControl(t);
      if (opts?.nextOpponent) setOpponentMode(opp);
      if (nextMods !== chaosModifiers) setChaosModifiers(nextMods);

      const clockSecs = getInitialSeconds(f, t, nextMods);
      setWhiteSeconds(clockSecs);
      setBlackSeconds(clockSecs);
      setHistoryStack([createInitialSnapshot()]);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setMatchResult(null);
      setLastPointsBreakdown(null);
      setAiThinking(false);
      winRecordedRef.current = false;
    },
    [chaosModifiers, flavor, opponentMode, timeControl]
  );

  // Countdown Clock (starts running once White makes the first move)
  useEffect(() => {
    if (!isTimed || matchResult || !hasMovesYet || pendingPromotion) return;

    const id = window.setInterval(() => {
      if (activeTurn === 'w') {
        setWhiteSeconds((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            finishMatch({
              winnerSide: 'b',
              title:
                opponentMode === 'ai' ? 'Smart AI Wins on Time' : 'Player 2 (Black) Wins!',
              reason: `${playerName} ran out of time.`,
            });
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackSeconds((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            finishMatch({
              winnerSide: 'w',
              title: `${playerName} Wins on Time!`,
              reason: `${opponentMode === 'ai' ? 'Smart AI' : 'Player 2'} ran out of time.`,
            });
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [
    activeTurn,
    finishMatch,
    hasMovesYet,
    isTimed,
    matchResult,
    opponentMode,
    pendingPromotion,
    playerName,
  ]);

  const checkPostMoveOutcome = useCallback(
    (nextChess: Chess, moverColor: Color): MatchResult | null => {
      if (nextChess.isCheckmate()) {
        const winnerName =
          moverColor === 'w'
            ? playerName
            : opponentMode === 'ai'
              ? 'Smart AI'
              : 'Player 2 (Black)';
        return {
          winnerSide: moverColor,
          title: `Checkmate! ${winnerName} Wins!`,
          reason: `${moverColor === 'w' ? 'White' : 'Black'} delivered checkmate.`,
          isCheckmate: true,
        };
      }
      if (nextChess.isStalemate()) {
        return {
          winnerSide: 'draw',
          title: 'Draw by Stalemate',
          reason: 'No legal moves remaining without check.',
        };
      }
      if (nextChess.isThreefoldRepetition()) {
        return {
          winnerSide: 'draw',
          title: 'Draw by Repetition',
          reason: 'Threefold position repetition.',
        };
      }
      if (nextChess.isInsufficientMaterial()) {
        return {
          winnerSide: 'draw',
          title: 'Draw · Insufficient Material',
          reason: 'Neither side has enough material to force checkmate.',
        };
      }
      if (nextChess.isDraw()) {
        return {
          winnerSide: 'draw',
          title: 'Match Drawn',
          reason: '50-move rule or draw condition reached.',
        };
      }
      return null;
    },
    [opponentMode, playerName]
  );

  // Execute a move (standard, promotion, or Chaos side-step pawn)
  const commitMove = useCallback(
    (params: {
      from: Square;
      to: Square;
      promotion?: Exclude<PieceSymbol, 'p' | 'k'>;
      isChaosSideStep?: boolean;
      isRank7Rush?: boolean;
    }) => {
      if (matchResult) return;
      const snap = historyStack[historyStack.length - 1];
      const boardBefore = new Chess(snap.fen);
      const movingPiece = boardBefore.get(params.from);
      if (!movingPiece) return;

      const moverColor = movingPiece.color;
      let nextFen = snap.fen;
      let san = '';
      let capturedPiece: PieceSymbol | null = null;
      let isCheckAfter = false;
      let nextPendingJump: Square | null = null;
      let nextWhiteJumpUsed = snap.whiteDoubleJumpUsed;
      let nextBlackJumpUsed = snap.blackDoubleJumpUsed;

      if (params.isChaosSideStep) {
        const res = applySideStepPawnMove(snap.fen, params.from, params.to);
        nextFen = res.nextFen;
        san = res.san;
        isCheckAfter = res.isCheck;
      } else {
        const moveResult = boardBefore.move({
          from: params.from,
          to: params.to,
          promotion: params.isRank7Rush ? undefined : params.promotion,
        });
        if (!moveResult) return;

        capturedPiece = moveResult.captured ?? null;
        san = moveResult.san;
        nextFen = boardBefore.fen();

        // Handle Rank-7 Promotion Rush if applicable
        if (params.isRank7Rush && params.promotion) {
          const rushRes = applyRank7Promotion(nextFen, params.to, moverColor, params.promotion);
          nextFen = rushRes.nextFen;
          san = `${san}=${params.promotion.toUpperCase()}${
            rushRes.isCheckmate ? '#' : rushRes.isCheck ? '+' : ''
          }`;
        }

        const boardAfter = new Chess(nextFen);
        isCheckAfter = boardAfter.isCheck();

        // Handle Double-Jump Knights Chaos Modifier
        if (activeModifierIds.includes('double_jump_knights')) {
          if (snap.pendingDoubleJumpSquare) {
            // Consumed the bonus jump!
            if (moverColor === 'w') nextWhiteJumpUsed = true;
            else nextBlackJumpUsed = true;
            nextPendingJump = null;
          } else if (
            movingPiece.type === 'n' &&
            !boardAfter.isGameOver() &&
            !isCheckAfter &&
            !(moverColor === 'w' ? snap.whiteDoubleJumpUsed : snap.blackDoubleJumpUsed)
          ) {
            // Check if Knight actually has at least 1 follow-up move from `to`
            const bonusFen = flipTurnForDoubleJump(nextFen, moverColor);
            const bonusBoard = new Chess(bonusFen);
            const bonusMoves = bonusBoard.moves({ verbose: true, square: params.to });
            if (bonusMoves.length > 0) {
              nextFen = bonusFen;
              nextPendingJump = params.to;
            }
          }
        }
      }

      const nextChess = new Chess(nextFen);
      const nextWhiteCaps = [...snap.capturedByWhite];
      const nextBlackCaps = [...snap.capturedByBlack];
      if (capturedPiece) {
        if (moverColor === 'w') nextWhiteCaps.push(capturedPiece);
        else nextBlackCaps.push(capturedPiece);
      }

      const nextSnap: ChessSnapshot = {
        fen: nextFen,
        lastFrom: params.from,
        lastTo: params.to,
        san,
        capturedByWhite: nextWhiteCaps,
        capturedByBlack: nextBlackCaps,
        whiteDoubleJumpUsed: nextWhiteJumpUsed,
        blackDoubleJumpUsed: nextBlackJumpUsed,
        pendingDoubleJumpSquare: nextPendingJump,
      };

      setHistoryStack((prev) => [...prev, nextSnap]);
      setSelectedSquare(nextPendingJump);
      setPendingPromotion(null);

      // Audio cues
      if (isCheckAfter && !nextChess.isCheckmate()) {
        soundFX.playChessCheck();
      } else if (capturedPiece) {
        soundFX.playChessCapture();
      } else {
        soundFX.playChessSlide();
      }

      if (nextPendingJump) {
        soundFX.playPowerUp();
      }

      const outcome = checkPostMoveOutcome(nextChess, moverColor);
      if (outcome) {
        finishMatch(outcome);
      }
    },
    [activeModifierIds, checkPostMoveOutcome, finishMatch, historyStack, matchResult]
  );

  // Skip optional Double-Jump Knight bonus move and pass turn normally
  const handleFinishBonusJump = useCallback(() => {
    if (!currentSnap.pendingDoubleJumpSquare || matchResult) return;
    soundFX.playTap();
    const parts = currentSnap.fen.split(' ');
    const curColor = parts[1] as Color;
    parts[1] = curColor === 'w' ? 'b' : 'w';
    parts[3] = '-';
    const passedFen = parts.join(' ');
    const passedChess = new Chess(passedFen);

    setHistoryStack((prev) => {
      const next = [...prev];
      const top = next[next.length - 1];
      next[next.length - 1] = {
        ...top,
        fen: passedFen,
        pendingDoubleJumpSquare: null,
      };
      return next;
    });
    setSelectedSquare(null);

    const outcome = checkPostMoveOutcome(passedChess, curColor);
    if (outcome) {
      finishMatch(outcome);
    }
  }, [checkPostMoveOutcome, currentSnap.fen, currentSnap.pendingDoubleJumpSquare, finishMatch, matchResult]);

  // Trigger AI move when it's Black's turn in vs-AI mode
  useEffect(() => {
    if (
      opponentMode !== 'ai' ||
      activeTurn !== 'b' ||
      matchResult ||
      pendingPromotion
    ) {
      return;
    }

    setAiThinking(true);
    const delayMs = difficulty === 'hard' ? 280 : 210;
    const timer = window.setTimeout(() => {
      const choice = chooseBestAIMove(
        currentSnap.fen,
        difficulty,
        activeModifierIds,
        currentSnap.pendingDoubleJumpSquare
      );

      if (!choice) {
        // If AI had an optional pending double-jump with no good move, pass turn
        if (currentSnap.pendingDoubleJumpSquare) {
          handleFinishBonusJump();
        }
        setAiThinking(false);
        return;
      }

      // If AI is on its optional bonus Double-Jump, only take it if it captures or checks or improves position
      if (currentSnap.pendingDoubleJumpSquare) {
        const testBoard = new Chess(currentSnap.fen);
        const targetCell = testBoard.get(choice.to);
        const m = testBoard.move({ from: choice.from, to: choice.to });
        const givesCheck = m ? testBoard.inCheck() : false;
        if (!targetCell && !givesCheck && Math.random() < 0.55) {
          handleFinishBonusJump();
          setAiThinking(false);
          return;
        }
      }

      const movingPiece = new Chess(currentSnap.fen).get(choice.from);
      const isRank7Rush =
        choice.type === 'standard' &&
        activeModifierIds.includes('promotion_rush') &&
        movingPiece?.type === 'p' &&
        choice.to[1] === '2';

      setAiThinking(false);
      commitMove({
        from: choice.from,
        to: choice.to,
        promotion: choice.promotion ?? (isRank7Rush ? 'q' : undefined),
        isChaosSideStep: choice.type === 'sidestep',
        isRank7Rush,
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [
    activeModifierIds,
    activeTurn,
    commitMove,
    currentSnap.fen,
    currentSnap.pendingDoubleJumpSquare,
    difficulty,
    handleFinishBonusJump,
    matchResult,
    opponentMode,
    pendingPromotion,
  ]);

  const legalTargets = useMemo<LegalTarget[]>(() => {
    if (!selectedSquare || matchResult || aiThinking || pendingPromotion) return [];
    return getLegalTargetsForSquare(
      chess,
      selectedSquare,
      activeModifierIds,
      currentSnap.pendingDoubleJumpSquare
    );
  }, [
    activeModifierIds,
    aiThinking,
    chess,
    currentSnap.pendingDoubleJumpSquare,
    matchResult,
    pendingPromotion,
    selectedSquare,
  ]);

  const targetMap = useMemo(() => {
    const map = new Map<Square, LegalTarget>();
    for (const t of legalTargets) {
      map.set(t.to, t);
    }
    return map;
  }, [legalTargets]);

  const attemptTargetMove = useCallback(
    (target: LegalTarget) => {
      if (target.promotionRequired) {
        const piece = chess.get(target.from);
        const isRush =
          activeModifierIds.includes('promotion_rush') &&
          piece?.type === 'p' &&
          target.to[1] === (piece.color === 'w' ? '7' : '2');
        setPendingPromotion({
          from: target.from,
          to: target.to,
          color: piece?.color ?? activeTurn,
          isRank7Rush: isRush,
        });
        return;
      }
      commitMove({
        from: target.from,
        to: target.to,
        isChaosSideStep: target.isChaosSideStep,
      });
    },
    [activeModifierIds, activeTurn, chess, commitMove]
  );

  const canHumanInteract =
    !matchResult &&
    !aiThinking &&
    !pendingPromotion &&
    (opponentMode === 'passplay' || activeTurn === 'w');

  // Window pointer tracking for smooth Drag-and-Drop
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const origin = dragOriginRef.current;
      if (!origin) return;
      if (!origin.dragging) {
        if (Math.hypot(e.clientX - origin.startX, e.clientY - origin.startY) > 6) {
          origin.dragging = true;
          setDragState({
            from: origin.from,
            piece: origin.piece,
            x: e.clientX,
            y: e.clientY,
          });
        }
      } else {
        setDragState((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const origin = dragOriginRef.current;
      if (!origin) return;
      dragOriginRef.current = null;

      if (origin.dragging) {
        justSelectedOnPointerDownRef.current = null;
        setDragState(null);
        suppressNextClickRef.current = true;
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 40);

        const el = document.elementFromPoint(e.clientX, e.clientY);
        const sqEl = el?.closest('[data-square]') as HTMLElement | null;
        const dropSq = sqEl?.dataset.square as Square | undefined;

        if (dropSq && dropSq !== origin.from) {
          const validFromOrigin = getLegalTargetsForSquare(
            chess,
            origin.from,
            activeModifierIds,
            currentSnap.pendingDoubleJumpSquare
          );
          const hit = validFromOrigin.find((t) => t.to === dropSq);
          if (hit) {
            attemptTargetMove(hit);
          }
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [activeModifierIds, attemptTargetMove, chess, currentSnap.pendingDoubleJumpSquare]);

  const handleSquareClick = (sq: Square) => {
    if (suppressNextClickRef.current || !canHumanInteract) return;

    // 1. Tapping a highlighted legal destination square immediately executes the move
    const hitTarget = targetMap.get(sq);
    if (hitTarget) {
      justSelectedOnPointerDownRef.current = null;
      attemptTargetMove(hitTarget);
      return;
    }

    // 2. If this square was just selected on pointerdown milliseconds ago, keep it selected
    if (justSelectedOnPointerDownRef.current === sq) {
      justSelectedOnPointerDownRef.current = null;
      return;
    }

    if (
      currentSnap.pendingDoubleJumpSquare &&
      sq !== currentSnap.pendingDoubleJumpSquare
    ) {
      return;
    }

    // 3. Tapping the already-selected friendly piece deselects; tapping another friendly piece switches selection
    const piece = chess.get(sq);
    if (piece && piece.color === activeTurn) {
      soundFX.playTap();
      setSelectedSquare((prev) => (prev === sq ? null : sq));
    } else {
      setSelectedSquare(null);
    }
  };

  const handleUndoCasualAI = () => {
    if (
      opponentMode !== 'ai' ||
      timeControl !== 'casual' ||
      isTimed ||
      historyStack.length < 2 ||
      aiThinking ||
      matchResult
    ) {
      return;
    }
    soundFX.playTap();
    // Walk back to the last snapshot where it was White's turn (before human's last move)
    let cutIdx = historyStack.length - 1;
    while (cutIdx > 0) {
      cutIdx--;
      const snap = historyStack[cutIdx];
      if (new Chess(snap.fen).turn() === 'w' && !snap.pendingDoubleJumpSquare) {
        break;
      }
    }
    setHistoryStack((prev) => prev.slice(0, Math.max(1, cutIdx + 1)));
    setSelectedSquare(null);
    setPendingPromotion(null);
  };

  // Board Orientation: auto-flip in 2P Pass & Play if enabled
  const flipped =
    opponentMode === 'passplay' && autoFlipPassPlay && activeTurn === 'b';
  const renderedRanks = flipped ? [...RANKS].reverse() : RANKS;
  const renderedFiles = flipped ? [...FILES].reverse() : FILES;
  const checkedKingSq = inCheck ? findKingSquare(chess, activeTurn) : null;

  // Material calculation
  const whiteMaterial = currentSnap.capturedByWhite.reduce((s, p) => s + PIECE_POINTS[p], 0);
  const blackMaterial = currentSnap.capturedByBlack.reduce((s, p) => s + PIECE_POINTS[p], 0);
  const whiteAdv = whiteMaterial - blackMaterial;

  // Build algebraic move pairs for Move History list
  const moveRows = useMemo(() => {
    const sans = historyStack.slice(1).map((s) => s.san ?? '');
    const rows: Array<{ moveNum: number; white: string; black?: string }> = [];
    for (let i = 0; i < sans.length; i += 2) {
      rows.push({
        moveNum: Math.floor(i / 2) + 1,
        white: sans[i],
        black: sans[i + 1],
      });
    }
    return rows;
  }, [historyStack]);

  const sortCaptured = (list: PieceSymbol[]) =>
    [...list].sort((a, b) => PIECE_SORT_ORDER[b] - PIECE_SORT_ORDER[a]);

  const whiteDisplayName = playerName;
  const blackDisplayName =
    opponentMode === 'ai' ? `Minimax AI (${difficulty})` : 'Player 2';

  const topPlayerIsBlack = !flipped;
  const topName = topPlayerIsBlack ? blackDisplayName : whiteDisplayName;
  const bottomName = topPlayerIsBlack ? whiteDisplayName : blackDisplayName;
  const topColor: Color = topPlayerIsBlack ? 'b' : 'w';
  const bottomColor: Color = topPlayerIsBlack ? 'w' : 'b';
  const topClock = topPlayerIsBlack ? blackSeconds : whiteSeconds;
  const bottomClock = topPlayerIsBlack ? whiteSeconds : blackSeconds;
  const topCaptured = sortCaptured(
    topPlayerIsBlack ? currentSnap.capturedByBlack : currentSnap.capturedByWhite
  );
  const bottomCaptured = sortCaptured(
    topPlayerIsBlack ? currentSnap.capturedByWhite : currentSnap.capturedByBlack
  );
  const topAdv = topPlayerIsBlack ? -whiteAdv : whiteAdv;
  const bottomAdv = topPlayerIsBlack ? whiteAdv : -whiteAdv;

  const canUndo =
    opponentMode === 'ai' &&
    timeControl === 'casual' &&
    !isTimed &&
    historyStack.length > 1 &&
    !aiThinking &&
    !matchResult;

  return (
    <div className="space-y-4">
      <ConfettiBurst triggerKey={confettiKey} intensity="win" />

      {/* Top Controls & Flavor Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <button
          type="button"
          onClick={() => {
            soundFX.playTap();
            onBackToHub();
          }}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-slate-200 hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to ArenaX Hub</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Flavor Switcher */}
          <div className="flex items-center gap-1 rounded-xl bg-black/45 p-1">
            <button
              type="button"
              onClick={() => startNewMatch({ nextFlavor: 'classic' })}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
                flavor === 'classic'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Classic Blitz</span>
            </button>
            <button
              type="button"
              onClick={() => startNewMatch({ nextFlavor: 'chaos', redealChaos: true })}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
                flavor === 'chaos'
                  ? 'bg-[#F5C451] text-[#051610]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Chaos Modifiers</span>
            </button>
          </div>

          {/* Opponent Switcher */}
          <div className="flex items-center gap-1 rounded-xl bg-black/45 p-1">
            <button
              type="button"
              onClick={() => startNewMatch({ nextOpponent: 'ai' })}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
                opponentMode === 'ai'
                  ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/50'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
              <span>vs AI</span>
            </button>
            <button
              type="button"
              onClick={() => startNewMatch({ nextOpponent: 'passplay' })}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
                opponentMode === 'passplay'
                  ? 'bg-amber-400/25 text-amber-200 ring-1 ring-amber-400/50'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>2P Pass &amp; Play</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,520px)_1fr] lg:items-start">
        {/* Left: Board Column */}
        <div className="glass-panel mx-auto w-full max-w-[520px] rounded-2xl p-3.5 shadow-2xl sm:p-4">
          {/* Top Player Bar */}
          <div
            className={`mb-2.5 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition ${
              activeTurn === topColor && !matchResult
                ? 'border-emerald-400/60 bg-emerald-500/15'
                : 'border-white/10 bg-black/30'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    topColor === 'w'
                      ? 'bg-slate-100 ring-1 ring-slate-400'
                      : 'bg-slate-900 ring-1 ring-emerald-400'
                  }`}
                />
                <span className="truncate text-xs font-bold text-white sm:text-sm">
                  {topName}
                </span>
                {aiThinking && topColor === 'b' && (
                  <span className="text-[11px] font-medium text-emerald-300">Thinking…</span>
                )}
              </div>
              <div className="mt-1 flex min-h-[18px] flex-wrap items-center gap-0.5">
                {topCaptured.map((p, idx) => (
                  <div key={`top-cap-${idx}`} className="h-4 w-4">
                    <ChessPieceSVG type={p} color={topColor === 'w' ? 'b' : 'w'} />
                  </div>
                ))}
                {topAdv > 0 && (
                  <span className="font-mono-tabular ml-1 text-[11px] font-bold text-[#F5C451]">
                    +{topAdv}
                  </span>
                )}
              </div>
            </div>

            {topClock !== null && (
              <div
                className={`font-mono-tabular flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-bold ${
                  activeTurn === topColor && !matchResult
                    ? 'border-[#F5C451]/60 bg-[#F5C451]/15 text-[#F5C451]'
                    : 'border-white/10 bg-black/40 text-slate-300'
                }`}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{formatClock(topClock)}</span>
              </div>
            )}
          </div>

          {/* Knight Double-Jump Banner */}
          {currentSnap.pendingDoubleJumpSquare && !matchResult && (
            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-[#F5C451]/60 bg-[#F5C451]/15 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-amber-100">
                <Zap className="h-4 w-4 shrink-0 text-[#F5C451]" aria-hidden="true" />
                <span>
                  Double-Jump Knight ready on{' '}
                  <strong className="font-mono-tabular uppercase">
                    {currentSnap.pendingDoubleJumpSquare}
                  </strong>
                  !
                </span>
              </div>
              <button
                type="button"
                onClick={handleFinishBonusJump}
                className="min-h-[32px] shrink-0 rounded-lg bg-[#F5C451] px-2.5 py-1 text-[11px] font-bold text-[#051610] hover:bg-[#fbd472]"
              >
                Skip Jump
              </button>
            </div>
          )}

          {/* 8x8 Royal-Emerald & Obsidian Board */}
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border-2 border-emerald-500/35 shadow-inner select-none">
            <div className="grid h-full w-full grid-cols-8 grid-rows-8">
              {renderedRanks.map((rank, rIdx) =>
                renderedFiles.map((file, fIdx) => {
                  const sq = `${file}${rank}` as Square;
                  const isLight = (FILES.indexOf(file) + Number(rank)) % 2 === 1;
                  const piece = chess.get(sq);
                  const isSelected = selectedSquare === sq;
                  const isLastMove =
                    currentSnap.lastFrom === sq || currentSnap.lastTo === sq;
                  const isKingInCheck = checkedKingSq === sq;
                  const target = targetMap.get(sq);
                  const isDraggedSource = dragState?.from === sq;

                  return (
                    <button
                      key={sq}
                      type="button"
                      data-square={sq}
                      onClick={() => handleSquareClick(sq)}
                      onPointerDown={(e) => {
                        if (!canHumanInteract) return;
                        if (
                          currentSnap.pendingDoubleJumpSquare &&
                          sq !== currentSnap.pendingDoubleJumpSquare
                        ) {
                          return;
                        }
                        if (piece && piece.color === activeTurn) {
                          if (selectedSquare !== sq) {
                            justSelectedOnPointerDownRef.current = sq;
                            soundFX.playTap();
                            setSelectedSquare(sq);
                          } else {
                            justSelectedOnPointerDownRef.current = null;
                          }
                          dragOriginRef.current = {
                            from: sq,
                            piece: { type: piece.type, color: piece.color },
                            startX: e.clientX,
                            startY: e.clientY,
                            dragging: false,
                          };
                        } else {
                          justSelectedOnPointerDownRef.current = null;
                        }
                      }}
                      aria-label={`Square ${sq}${piece ? ` ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}` : ''}`}
                      className={`relative flex items-center justify-center p-1 touch-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[#F5C451] ${
                        isLight ? 'bg-[#346E57]' : 'bg-[#0C1914]'
                      }`}
                    >
                      {/* Last move highlight */}
                      {isLastMove && (
                        <span
                          className="pointer-events-none absolute inset-0 bg-[#F5C451]/25"
                          aria-hidden="true"
                        />
                      )}

                      {/* Selected square highlight (Warm Gold) */}
                      {isSelected && (
                        <span
                          className="pointer-events-none absolute inset-0 bg-[#F5C451]/45 ring-2 ring-inset ring-[#F5C451]"
                          aria-hidden="true"
                        />
                      )}

                      {/* King in Check glow */}
                      {isKingInCheck && (
                        <span
                          className="pointer-events-none absolute inset-0 bg-red-600/55 ring-2 ring-inset ring-red-300"
                          aria-hidden="true"
                        />
                      )}

                      {/* Coordinate labels on edge squares */}
                      {fIdx === 0 && (
                        <span
                          className={`pointer-events-none absolute top-0.5 left-1 font-mono-tabular text-[9px] font-bold leading-none ${
                            isLight ? 'text-[#0C1914]/75' : 'text-emerald-200/55'
                          }`}
                        >
                          {rank}
                        </span>
                      )}
                      {rIdx === 7 && (
                        <span
                          className={`pointer-events-none absolute right-1 bottom-0.5 font-mono-tabular text-[9px] font-bold leading-none ${
                            isLight ? 'text-[#0C1914]/75' : 'text-emerald-200/55'
                          }`}
                        >
                          {file}
                        </span>
                      )}

                      {/* Piece SVG */}
                      {piece && !isDraggedSource && (
                        <div className="relative z-[2] h-[88%] w-[88%] transition-transform duration-100">
                          <ChessPieceSVG type={piece.type} color={piece.color} />
                        </div>
                      )}

                      {/* Chess.com-style Legal Move Dot (Empty Square) */}
                      {target && !target.isCapture && (
                        <span
                          className={`pointer-events-none absolute z-[3] h-[30%] w-[30%] rounded-full transition-transform ${
                            target.isChaosSideStep
                              ? 'bg-[#F5C451]/85 ring-2 ring-[#051610]/65'
                              : 'bg-white/35 shadow-[0_0_0_1px_rgba(0,0,0,0.22)]'
                          }`}
                          aria-hidden="true"
                        />
                      )}

                      {/* Chess.com-style Capture Corner & Ring Highlight */}
                      {target && target.isCapture && (
                        <>
                          <span
                            className="pointer-events-none absolute inset-[3px] z-[3] rounded-full border-[3.5px] border-red-400/90 shadow-[0_0_10px_rgba(239,68,68,0.65)]"
                            aria-hidden="true"
                          />
                          <span
                            className="pointer-events-none absolute top-0 left-0 z-[3] h-2.5 w-2.5 border-t-[3px] border-l-[3px] border-[#F5C451]"
                            aria-hidden="true"
                          />
                          <span
                            className="pointer-events-none absolute top-0 right-0 z-[3] h-2.5 w-2.5 border-t-[3px] border-r-[3px] border-[#F5C451]"
                            aria-hidden="true"
                          />
                          <span
                            className="pointer-events-none absolute bottom-0 left-0 z-[3] h-2.5 w-2.5 border-b-[3px] border-l-[3px] border-[#F5C451]"
                            aria-hidden="true"
                          />
                          <span
                            className="pointer-events-none absolute right-0 bottom-0 z-[3] h-2.5 w-2.5 border-r-[3px] border-b-[3px] border-[#F5C451]"
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Pawn Promotion Modal Overlay */}
            {pendingPromotion && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Choose pawn promotion piece"
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
              >
                <div className="glass-panel w-full max-w-xs rounded-2xl p-4 text-center shadow-2xl">
                  <h3 className="font-display text-2xl font-bold text-white">
                    Promote Pawn
                  </h3>
                  <p className="mt-1 text-xs text-slate-300">
                    Choose a piece for {pendingPromotion.to.toUpperCase()}
                  </p>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {(['q', 'r', 'b', 'n'] as const).map((promo) => (
                      <button
                        key={promo}
                        type="button"
                        onClick={() =>
                          commitMove({
                            from: pendingPromotion.from,
                            to: pendingPromotion.to,
                            promotion: promo,
                            isRank7Rush: pendingPromotion.isRank7Rush,
                          })
                        }
                        aria-label={`Promote to ${promo}`}
                        className="flex aspect-square min-h-[52px] items-center justify-center rounded-xl border border-white/15 bg-emerald-950/70 p-2 transition hover:border-[#F5C451] hover:bg-emerald-800/60"
                      >
                        <ChessPieceSVG type={promo} color={pendingPromotion.color} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating Dragged Piece */}
          {dragState && (
            <div
              className="pointer-events-none fixed z-50 h-14 w-14 -translate-x-1/2 -translate-y-1/2"
              style={{ left: dragState.x, top: dragState.y }}
              aria-hidden="true"
            >
              <ChessPieceSVG type={dragState.piece.type} color={dragState.piece.color} />
            </div>
          )}

          {/* Bottom Player Bar */}
          <div
            className={`mt-2.5 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition ${
              activeTurn === bottomColor && !matchResult
                ? 'border-emerald-400/60 bg-emerald-500/15'
                : 'border-white/10 bg-black/30'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    bottomColor === 'w'
                      ? 'bg-slate-100 ring-1 ring-slate-400'
                      : 'bg-slate-900 ring-1 ring-emerald-400'
                  }`}
                />
                <span className="truncate text-xs font-bold text-white sm:text-sm">
                  {bottomName}
                </span>
                {inCheck && activeTurn === bottomColor && !matchResult && (
                  <span className="text-[11px] font-extrabold text-red-400 uppercase">
                    Check!
                  </span>
                )}
              </div>
              <div className="mt-1 flex min-h-[18px] flex-wrap items-center gap-0.5">
                {bottomCaptured.map((p, idx) => (
                  <div key={`bot-cap-${idx}`} className="h-4 w-4">
                    <ChessPieceSVG type={p} color={bottomColor === 'w' ? 'b' : 'w'} />
                  </div>
                ))}
                {bottomAdv > 0 && (
                  <span className="font-mono-tabular ml-1 text-[11px] font-bold text-[#F5C451]">
                    +{bottomAdv}
                  </span>
                )}
              </div>
            </div>

            {bottomClock !== null && (
              <div
                className={`font-mono-tabular flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-bold ${
                  activeTurn === bottomColor && !matchResult
                    ? 'border-[#F5C451]/60 bg-[#F5C451]/15 text-[#F5C451]'
                    : 'border-white/10 bg-black/40 text-slate-300'
                }`}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{formatClock(bottomClock)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Settings, Chaos Cards, Move List & Post-Match */}
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-wide text-white">
                  {flavor === 'chaos' ? 'Chaos Modifier Chess' : 'Classic Blitz Chess'}
                </h2>
                <p className="text-xs text-slate-300">
                  {matchResult
                    ? matchResult.reason
                    : activeTurn === 'w'
                      ? `${whiteDisplayName}'s Turn (White)`
                      : `${blackDisplayName}'s Turn (Black)`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F5C451]">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Chess Wins:</span>
                <strong className="font-mono-tabular text-white">{chessWins}</strong>
              </div>
            </div>

            {/* Chaos Modifiers Dealt Card */}
            {flavor === 'chaos' && (
              <div className="mt-4 space-y-2 rounded-xl border border-[#F5C451]/35 bg-[#F5C451]/10 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#F5C451]">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>2 Active Chaos Twists</span>
                  </div>
                  {!hasMovesYet && (
                    <button
                      type="button"
                      onClick={() => startNewMatch({ redealChaos: true })}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200 hover:underline underline-offset-4"
                    >
                      <Shuffle className="h-3 w-3" aria-hidden="true" />
                      <span>Re-Deal</span>
                    </button>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {chaosModifiers.map((mod) => (
                    <div
                      key={mod.id}
                      className="rounded-lg border border-white/10 bg-black/35 p-2.5"
                    >
                      <div className="text-xs font-bold text-white">{mod.title}</div>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
                        {mod.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Match Controls: Time Control / AI Difficulty / Pass & Play Auto-Flip */}
            <div className="mt-4 space-y-3">
              {!(flavor === 'chaos' && activeModifierIds.includes('sudden_death_60')) && (
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400">
                    Time Control
                  </span>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'blitz3', label: '3 Min Blitz' },
                        { id: 'rapid5', label: '5 Min Rapid' },
                        { id: 'casual', label: 'Untimed' },
                      ] as const
                    ).map((tc) => (
                      <button
                        key={tc.id}
                        type="button"
                        onClick={() => startNewMatch({ nextTime: tc.id })}
                        className={`min-h-[38px] rounded-lg border px-2 text-xs font-bold transition ${
                          timeControl === tc.id
                            ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                            : 'border-white/10 bg-black/25 text-slate-300 hover:text-white'
                        }`}
                      >
                        {tc.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {opponentMode === 'ai' ? (
                <div>
                  <span className="block text-[11px] font-semibold text-slate-400">
                    Minimax AI Strength
                  </span>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => {
                          soundFX.playTap();
                          setDifficulty(lvl);
                        }}
                        className={`min-h-[38px] rounded-lg border px-2 text-xs font-bold capitalize transition ${
                          difficulty === lvl
                            ? 'border-[#F5C451]/70 bg-[#F5C451]/20 text-[#F5C451]'
                            : 'border-white/10 bg-black/25 text-slate-300 hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                  <div>
                    <div className="text-xs font-bold text-white">Auto-Flip Board</div>
                    <div className="text-[11px] text-slate-400">
                      Rotates face-to-face each turn
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playTap();
                      setAutoFlipPassPlay((v) => !v);
                    }}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                      autoFlipPassPlay
                        ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/45'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {autoFlipPassPlay ? (
                      <>
                        <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Auto-Flip On</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Rotation Locked</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons: Undo (vs AI Casual) + New Game */}
            <div className="mt-4 flex gap-2">
              {opponentMode === 'ai' && timeControl === 'casual' && !isTimed && (
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={handleUndoCasualAI}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/15 disabled:opacity-40"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Undo Move</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => startNewMatch({ redealChaos: flavor === 'chaos' })}
                className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/15"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>New Match</span>
              </button>
            </div>

            {/* Move History */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>Move History</span>
                <span className="font-mono-tabular">
                  {Math.ceil((historyStack.length - 1) / 2)} moves
                </span>
              </div>
              <div
                ref={moveListRef}
                className="mt-1.5 h-32 overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-2.5 text-xs"
              >
                {moveRows.length === 0 ? (
                  <p className="py-8 text-center text-slate-500">
                    Tap or drag a White piece to begin.
                  </p>
                ) : (
                  <div className="grid grid-cols-[32px_1fr_1fr] gap-y-1 font-mono-tabular">
                    {moveRows.map((row) => (
                      <React.Fragment key={row.moveNum}>
                        <span className="text-slate-500">{row.moveNum}.</span>
                        <span className="font-semibold text-white">{row.white}</span>
                        <span className="text-emerald-200">{row.black ?? ''}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Post-Match Result & WhatsApp Share */}
          {matchResult && (
            <div className="glass-panel space-y-4 rounded-2xl p-6 shadow-2xl">
              <div>
                <div className="flex items-center gap-2 text-[#F5C451]">
                  <Award className="h-5 w-5" aria-hidden="true" />
                  <span className="text-xs font-bold tracking-wider uppercase">
                    Match Over
                  </span>
                </div>
                <h3 className="font-display mt-1 text-3xl font-extrabold text-white">
                  {matchResult.title}
                </h3>
                <p className="mt-1 text-sm text-slate-300">{matchResult.reason}</p>
              </div>

              <MatchPointsBanner breakdown={lastPointsBreakdown} />

              <WhatsAppChallengeButton
                username={playerName}
                countryFlag={countryFlag}
                gameTitle={`Royal & Chaos Chess (${flavor === 'chaos' ? 'Chaos Mode' : 'Classic Blitz'})`}
                scoreSummary={`${matchResult.title} in ${Math.ceil(
                  (historyStack.length - 1) / 2
                )} moves`}
                scoreToBeat={`${chessWins + (matchResult.winnerSide === 'w' ? 1 : 0)} Chess wins`}
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => startNewMatch({ redealChaos: flavor === 'chaos' })}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#F5C451] px-4 py-2.5 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472]"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Rematch</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToHub}
                  className="min-h-[46px] rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15"
                >
                  Arcade Hub
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
