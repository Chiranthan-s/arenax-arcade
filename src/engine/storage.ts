import { CareerStats } from '../types/game';

const STATS_KEY = 'gully_clash_career_stats_v1';

const DEFAULT_STATS: CareerStats = {
  matchesPlayed: 0,
  wins: 0,
  highestScore: 0,
  sixesHit: 0,
  currentStreak: 0,
  bestStreak: 0,
};

export function loadCareerStats(): CareerStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw) as Partial<CareerStats>;
    return {
      matchesPlayed: Number(parsed.matchesPlayed) || 0,
      wins: Number(parsed.wins) || 0,
      highestScore: Number(parsed.highestScore) || 0,
      sixesHit: Number(parsed.sixesHit) || 0,
      currentStreak: Number(parsed.currentStreak) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveCareerStats(stats: CareerStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage errors in private browsing
  }
}

export function recordMatchStats(params: {
  won: boolean;
  tied: boolean;
  playerRuns: number;
  playerSixes: number;
}): CareerStats {
  const current = loadCareerStats();
  const nextStreak = params.won ? current.currentStreak + 1 : params.tied ? current.currentStreak : 0;
  const updated: CareerStats = {
    matchesPlayed: current.matchesPlayed + 1,
    wins: current.wins + (params.won ? 1 : 0),
    highestScore: Math.max(current.highestScore, params.playerRuns),
    sixesHit: current.sixesHit + params.playerSixes,
    currentStreak: nextStreak,
    bestStreak: Math.max(current.bestStreak, nextStreak),
  };
  saveCareerStats(updated);
  return updated;
}

export function resetCareerStats(): CareerStats {
  const clean = { ...DEFAULT_STATS };
  saveCareerStats(clean);
  return clean;
}
