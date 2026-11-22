export type HandNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type GameMode = 'blitz' | 'classic' | 'passplay';

export type PowerUpType = 'free_hit' | 'double_runs';

export type MatchPhase =
  | 'HOME'
  | 'SETUP'
  | 'TOSS'
  | 'PLAYING'
  | 'HANDOFF'
  | 'REVEAL_PAUSE'
  | 'INNINGS_BREAK'
  | 'MATCH_OVER';

export type SideId = 'p1' | 'p2';

export interface PowerUpInventory {
  freeHitUsed: boolean;
  doubleRunsUsed: boolean;
}

export interface BallOutcome {
  ballNumber: number;
  batterPick: HandNumber;
  bowlerPick: HandNumber;
  runsScored: number;
  isWicket: boolean;
  savedByFreeHit: boolean;
  powerUpUsed: PowerUpType | null;
  aiReadPattern?: boolean;
  label: string; // e.g. '6', '12', '4', 'W', 'FH'
  commentary: string;
}

export interface InningsState {
  inningsNumber: 1 | 2;
  battingSide: SideId;
  bowlingSide: SideId;
  runs: number;
  wickets: number;
  maxWickets: number;
  ballsBowled: number;
  maxBalls: number | null; // 6 for Super Over Blitz, null for Classic
  target: number | null; // Set in 2nd innings (1st innings runs + 1)
  powerUps: PowerUpInventory;
  history: BallOutcome[];
}

export interface MatchConfig {
  mode: GameMode;
  maxWickets: 1 | 3;
  maxBalls: number | null;
  p1Name: string;
  p2Name: string;
  isVsAI: boolean;
}

export interface CareerStats {
  matchesPlayed: number;
  wins: number;
  highestScore: number;
  sixesHit: number;
  currentStreak: number;
  bestStreak: number;
}
