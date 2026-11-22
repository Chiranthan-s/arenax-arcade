import { Chess, Color, Move, PieceSymbol, Square } from 'chess.js';

export type ChessFlavor = 'classic' | 'chaos';
export type AIDifficulty = 'easy' | 'medium' | 'hard';
export type TimeControlId = 'blitz3' | 'rapid5' | 'casual';

export type ChaosModifierId =
  | 'side_step_pawns'
  | 'double_jump_knights'
  | 'sudden_death_60'
  | 'promotion_rush';

export interface ChaosModifierInfo {
  id: ChaosModifierId;
  title: string;
  description: string;
}

export const CHAOS_MODIFIERS: ChaosModifierInfo[] = [
  {
    id: 'side_step_pawns',
    title: 'Side-Step Pawns',
    description: 'Pawns can also slide 1 empty square horizontally left or right.',
  },
  {
    id: 'double_jump_knights',
    title: 'Double-Jump Knights',
    description: 'Once per game, after moving a Knight safely, take an extra Knight jump.',
  },
  {
    id: 'sudden_death_60',
    title: 'Sudden Death 60s',
    description: 'Both players start on a high-pressure 60-second blitz clock.',
  },
  {
    id: 'promotion_rush',
    title: 'Rank-7 Promotion Rush',
    description: 'Pawns promote immediately when reaching the 7th rank (2nd for Black).',
  },
];

export function dealChaosModifiers(): ChaosModifierInfo[] {
  const pool = [...CHAOS_MODIFIERS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 2);
}

export interface LegalTarget {
  from: Square;
  to: Square;
  isCapture: boolean;
  isChaosSideStep?: boolean;
  promotionRequired?: boolean;
  sanHint?: string;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export function findKingSquare(chess: Chess, color: Color): Square | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (cell && cell.type === 'k' && cell.color === color) {
        return cell.square;
      }
    }
  }
  return null;
}

export function getSideStepPawnTargets(
  chess: Chess,
  from: Square,
  color: Color
): LegalTarget[] {
  const piece = chess.get(from);
  if (!piece || piece.type !== 'p' || piece.color !== color) return [];

  const fileIdx = FILES.indexOf(from[0] as (typeof FILES)[number]);
  const rank = from[1];
  const opp: Color = color === 'w' ? 'b' : 'w';
  const results: LegalTarget[] = [];

  for (const df of [-1, 1]) {
    const nf = fileIdx + df;
    if (nf < 0 || nf > 7) continue;
    const to = `${FILES[nf]}${rank}` as Square;
    if (chess.get(to)) continue; // Empty square only

    // Simulate move to verify own King is not left in check
    const clone = new Chess(chess.fen());
    clone.remove(from);
    clone.put({ type: 'p', color }, to);
    const kingSq = findKingSquare(clone, color);
    if (kingSq && clone.isAttacked(kingSq, opp)) continue;

    results.push({
      from,
      to,
      isCapture: false,
      isChaosSideStep: true,
      promotionRequired: false,
      sanHint: `${from}→${to}`,
    });
  }
  return results;
}

export function applySideStepPawnMove(
  fen: string,
  from: Square,
  to: Square
): { nextFen: string; san: string; isCheck: boolean; isCheckmate: boolean; isDraw: boolean } {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece) {
    throw new Error('Missing pawn for side-step move');
  }
  const color = piece.color;
  chess.remove(from);
  chess.put({ type: 'p', color }, to);

  const parts = chess.fen().split(' ');
  parts[1] = color === 'w' ? 'b' : 'w';
  parts[3] = '-'; // Clear en passant
  parts[4] = '0'; // Pawn move resets halfmove clock
  if (color === 'b') {
    parts[5] = String(Number(parts[5]) + 1);
  }
  const nextFen = parts.join(' ');
  const after = new Chess(nextFen);
  const isCheck = after.isCheck();
  const isCheckmate = after.isCheckmate();
  const isDraw = after.isDraw();
  const suffix = isCheckmate ? '#' : isCheck ? '+' : '';

  return {
    nextFen,
    san: `${from[0]}→${to}${suffix}`,
    isCheck,
    isCheckmate,
    isDraw,
  };
}

export function applyRank7Promotion(
  fen: string,
  square: Square,
  color: Color,
  promoPiece: Exclude<PieceSymbol, 'p' | 'k'>
): { nextFen: string; isCheck: boolean; isCheckmate: boolean; isDraw: boolean } {
  const chess = new Chess(fen);
  chess.remove(square);
  chess.put({ type: promoPiece, color }, square);
  const nextFen = chess.fen();
  return {
    nextFen,
    isCheck: chess.isCheck(),
    isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(),
  };
}

export function flipTurnForDoubleJump(fen: string, activeColor: Color): string {
  const parts = fen.split(' ');
  parts[1] = activeColor;
  parts[3] = '-';
  return parts.join(' ');
}

export function getLegalTargetsForSquare(
  chess: Chess,
  square: Square,
  activeModifiers: ChaosModifierId[],
  pendingDoubleJumpSquare: Square | null
): LegalTarget[] {
  if (pendingDoubleJumpSquare && square !== pendingDoubleJumpSquare) {
    return [];
  }

  const piece = chess.get(square);
  if (!piece || piece.color !== chess.turn()) return [];

  const standardMoves = chess.moves({ verbose: true, square });
  const byTo = new Map<Square, LegalTarget>();

  const rushEnabled = activeModifiers.includes('promotion_rush');
  const rushRank = piece.color === 'w' ? '7' : '2';

  for (const m of standardMoves) {
    const existing = byTo.get(m.to);
    const needsPromo = Boolean(m.promotion) || (rushEnabled && piece.type === 'p' && m.to[1] === rushRank);
    if (!existing) {
      byTo.set(m.to, {
        from: m.from,
        to: m.to,
        isCapture: m.isCapture(),
        promotionRequired: needsPromo,
        sanHint: m.san,
      });
    }
  }

  if (activeModifiers.includes('side_step_pawns') && !pendingDoubleJumpSquare) {
    for (const st of getSideStepPawnTargets(chess, square, piece.color)) {
      if (!byTo.has(st.to)) {
        byTo.set(st.to, st);
      }
    }
  }

  return Array.from(byTo.values());
}

// ==================== MINIMAX AI WITH ALPHA-BETA PRUNING ====================

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 27, 27, 10, 5, 5],
  [0, 0, 0, 24, 24, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -22, -22, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0],
];

const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

function getPositionalBonus(type: PieceSymbol, r: number, f: number, color: Color): number {
  const row = color === 'w' ? r : 7 - r;
  switch (type) {
    case 'p':
      return PAWN_PST[row][f];
    case 'n':
      return KNIGHT_PST[row][f];
    case 'b':
      return BISHOP_PST[row][f];
    case 'r':
      return ROOK_PST[row][f];
    case 'q':
      return QUEEN_PST[row][f];
    case 'k':
      return KING_PST[row][f];
  }
}

/**
 * Evaluates board from White's perspective (+ = White advantage, - = Black advantage).
 */
export function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (!cell) continue;
      const val = PIECE_VALUES[cell.type] + getPositionalBonus(cell.type, r, f, cell.color);
      score += cell.color === 'w' ? val : -val;
    }
  }
  if (chess.isCheck()) {
    score += chess.turn() === 'w' ? -35 : 35;
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const scoreA =
      (a.captured ? PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece] : 0) +
      (a.promotion ? 800 : 0);
    const scoreB =
      (b.captured ? PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece] : 0) +
      (b.promotion ? 800 : 0);
    return scoreB - scoreA;
  });
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingWhite: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    const base = evaluateBoard(chess);
    // Prefer faster checkmates
    if (base > 90000) return base + depth * 10;
    if (base < -90000) return base - depth * 10;
    return base;
  }

  const moves = orderMoves(chess.moves({ verbose: true }));
  if (maximizingWhite) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const ev = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      if (ev > maxEval) maxEval = ev;
      if (ev > alpha) alpha = ev;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const ev = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      if (ev < minEval) minEval = ev;
      if (ev < beta) beta = ev;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export interface ChosenAIMove {
  type: 'standard' | 'sidestep';
  from: Square;
  to: Square;
  promotion?: Exclude<PieceSymbol, 'p' | 'k'>;
}

export function chooseBestAIMove(
  fen: string,
  difficulty: AIDifficulty,
  activeModifiers: ChaosModifierId[],
  pendingKnightSquare: Square | null
): ChosenAIMove | null {
  const chess = new Chess(fen);
  const aiColor = chess.turn();
  const maximizing = aiColor === 'w';

  const standardMoves = orderMoves(
    pendingKnightSquare
      ? chess.moves({ verbose: true, square: pendingKnightSquare })
      : chess.moves({ verbose: true })
  );

  if (standardMoves.length === 0 && !activeModifiers.includes('side_step_pawns')) {
    return null;
  }

  // Easy AI mixes tactical best moves with occasional casual moves
  if (difficulty === 'easy' && standardMoves.length > 0 && Math.random() < 0.45) {
    const pick = standardMoves[Math.floor(Math.random() * standardMoves.length)];
    return {
      type: 'standard',
      from: pick.from,
      to: pick.to,
      promotion: (pick.promotion as Exclude<PieceSymbol, 'p' | 'k'>) || undefined,
    };
  }

  const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  let bestScore = maximizing ? -Infinity : Infinity;
  let bestChoice: ChosenAIMove | null = null;

  for (const m of standardMoves) {
    chess.move(m);
    const val = minimax(chess, depth - 1, -Infinity, Infinity, !maximizing);
    chess.undo();

    // Small tie-breaker jitter so games feel varied
    const jitter = (Math.random() - 0.5) * (difficulty === 'hard' ? 4 : 12);
    const scored = val + jitter;

    if ((maximizing && scored > bestScore) || (!maximizing && scored < bestScore)) {
      bestScore = scored;
      bestChoice = {
        type: 'standard',
        from: m.from,
        to: m.to,
        promotion: (m.promotion as Exclude<PieceSymbol, 'p' | 'k'>) || undefined,
      };
    }
  }

  // Evaluate Chaos Side-Step Pawn moves if enabled
  if (activeModifiers.includes('side_step_pawns') && !pendingKnightSquare) {
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f];
        if (!cell || cell.type !== 'p' || cell.color !== aiColor) continue;
        const sideSteps = getSideStepPawnTargets(chess, cell.square, aiColor);
        for (const st of sideSteps) {
          const { nextFen } = applySideStepPawnMove(fen, st.from, st.to);
          const nextChess = new Chess(nextFen);
          const val = minimax(nextChess, Math.max(0, depth - 1), -Infinity, Infinity, !maximizing);
          if ((maximizing && val > bestScore) || (!maximizing && val < bestScore)) {
            bestScore = val;
            bestChoice = {
              type: 'sidestep',
              from: st.from,
              to: st.to,
            };
          }
        }
      }
    }
  }

  return bestChoice;
}
