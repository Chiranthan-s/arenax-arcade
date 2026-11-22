export type RankTier = 'Rookie' | 'Challenger' | 'Pro' | 'Legend';

export const ARENA_POINT_VALUES = {
  WIN: 100,
  DRAW: 40,
  COMPLETION: 15,
  SPECIAL_BONUS: 25,
} as const;

export interface RankTierConfig {
  tier: RankTier;
  minPoints: number;
  maxPoints: number | null;
  textClass: string;
  accentBgClass: string;
  barClass: string;
}

export const RANK_TIERS: RankTierConfig[] = [
  {
    tier: 'Rookie',
    minPoints: 0,
    maxPoints: 299,
    textClass: 'text-slate-200',
    accentBgClass: 'border-slate-400/35 bg-slate-500/15 text-slate-200',
    barClass: 'bg-slate-300',
  },
  {
    tier: 'Challenger',
    minPoints: 300,
    maxPoints: 799,
    textClass: 'text-cyan-300',
    accentBgClass: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
    barClass: 'bg-cyan-400',
  },
  {
    tier: 'Pro',
    minPoints: 800,
    maxPoints: 1599,
    textClass: 'text-emerald-300',
    accentBgClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
    barClass: 'bg-emerald-400',
  },
  {
    tier: 'Legend',
    minPoints: 1600,
    maxPoints: null,
    textClass: 'text-[#F5C451]',
    accentBgClass: 'border-[#F5C451]/50 bg-[#F5C451]/15 text-[#F5C451]',
    barClass: 'bg-[#F5C451]',
  },
];

export interface RankInfo {
  tier: RankTier;
  points: number;
  nextTier: RankTier | null;
  nextThreshold: number | null;
  pointsToNext: number;
  progressPct: number;
  textClass: string;
  accentBgClass: string;
  barClass: string;
}

export function getRankInfo(points: number): RankInfo {
  const safePts = Math.max(0, Math.floor(points));
  let idx = 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (safePts >= RANK_TIERS[i].minPoints) {
      idx = i;
      break;
    }
  }

  const current = RANK_TIERS[idx];
  const next = idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;

  if (!next) {
    return {
      tier: current.tier,
      points: safePts,
      nextTier: null,
      nextThreshold: null,
      pointsToNext: 0,
      progressPct: 100,
      textClass: current.textClass,
      accentBgClass: current.accentBgClass,
      barClass: current.barClass,
    };
  }

  const span = next.minPoints - current.minPoints;
  const gainedInTier = safePts - current.minPoints;
  const progressPct = Math.min(100, Math.max(0, Math.round((gainedInTier / span) * 100)));

  return {
    tier: current.tier,
    points: safePts,
    nextTier: next.tier,
    nextThreshold: next.minPoints,
    pointsToNext: Math.max(0, next.minPoints - safePts),
    progressPct,
    textClass: current.textClass,
    accentBgClass: current.accentBgClass,
    barClass: current.barClass,
  };
}

export interface MatchPointsBreakdown {
  outcome: 'win' | 'draw' | 'loss';
  resultPoints: number;
  completionPoints: number;
  bonusCount: number;
  bonusPoints: number;
  bonusLabel: string | null;
  totalEarned: number;
}

export function calculateMatchPoints(params: {
  outcome: 'win' | 'draw' | 'loss';
  bonusCount?: number;
  bonusLabel?: string;
}): MatchPointsBreakdown {
  const resultPoints =
    params.outcome === 'win'
      ? ARENA_POINT_VALUES.WIN
      : params.outcome === 'draw'
        ? ARENA_POINT_VALUES.DRAW
        : 0;
  const completionPoints = ARENA_POINT_VALUES.COMPLETION;
  const count = Math.max(0, Math.floor(params.bonusCount || 0));
  const bonusPoints = count * ARENA_POINT_VALUES.SPECIAL_BONUS;
  const totalEarned = resultPoints + completionPoints + bonusPoints;

  return {
    outcome: params.outcome,
    resultPoints,
    completionPoints,
    bonusCount: count,
    bonusPoints,
    bonusLabel: count > 0 ? params.bonusLabel || 'Special Bonus' : null,
    totalEarned,
  };
}
