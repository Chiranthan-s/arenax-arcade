import { HandNumber, InningsState, PowerUpType } from '../types/game';

const ALL_HANDS: HandNumber[] = [1, 2, 3, 4, 5, 6];

export class SmartAIOpponent {
  private userBatHistory: HandNumber[] = [];
  private userBowlHistory: HandNumber[] = [];

  public reset(): void {
    this.userBatHistory = [];
    this.userBowlHistory = [];
  }

  public recordUserBat(num: HandNumber): void {
    this.userBatHistory.push(num);
  }

  public recordUserBowl(num: HandNumber): void {
    this.userBowlHistory.push(num);
  }

  /**
   * Weighted random pick from probability weights
   */
  private sampleWeighted(weights: Record<HandNumber, number>): HandNumber {
    const total = ALL_HANDS.reduce((sum, n) => sum + Math.max(0.01, weights[n]), 0);
    let r = Math.random() * total;
    for (const n of ALL_HANDS) {
      r -= Math.max(0.01, weights[n]);
      if (r <= 0) return n;
    }
    return 4;
  }

  /**
   * AI is BOWLING against the user.
   * Goal: Match the user's pick to take a wicket (unless Free Hit is active).
   */
  public chooseBowlDelivery(
    innings: InningsState,
    userPowerUp: PowerUpType | null
  ): { pick: HandNumber; predictedPattern: boolean } {
    // Base weights (human players in hand cricket naturally favor 4, 6, 2, 1 slightly more than 3 or 5)
    const weights: Record<HandNumber, number> = {
      1: 1.0,
      2: 1.1,
      3: 0.9,
      4: 1.3,
      5: 0.85,
      6: 1.35,
    };

    const hist = this.userBatHistory;
    let usedPattern = false;

    if (hist.length >= 2) {
      usedPattern = true;
      // 1. Recency-weighted frequency analysis
      hist.forEach((val, idx) => {
        const recency = (idx + 1) / hist.length; // 0..1
        weights[val] += 0.65 * recency;
      });

      const last = hist[hist.length - 1];
      const prev = hist[hist.length - 2];

      // 2. Markov transition: what does user tend to play right after `last`?
      for (let i = 0; i < hist.length - 1; i++) {
        if (hist[i] === last) {
          weights[hist[i + 1]] += 1.4;
        }
      }

      // 3. Streak check: if user repeated `last` twice, they often switch or push one more
      if (last === prev) {
        weights[last] += 0.9;
      }
    }

    // 4. Situational awareness
    const ballsLeft = innings.maxBalls !== null ? innings.maxBalls - innings.ballsBowled : null;
    const runsNeeded = innings.target !== null ? innings.target - innings.runs : null;

    if (userPowerUp === 'double_runs') {
      // User armed 2x Runs — highly likely to swing for 4, 5, or 6!
      weights[6] += 2.2;
      weights[4] += 1.5;
      weights[5] += 0.9;
    }

    if (userPowerUp === 'free_hit') {
      // Cannot get out on Free Hit, AI doesn't gain anything from matching,
      // but tries to bait user into weird rhythm.
      weights[6] += 1.2;
    }

    if (ballsLeft !== null && runsNeeded !== null) {
      const rpb = runsNeeded / Math.max(1, ballsLeft);
      if (rpb >= 5) {
        weights[6] += 2.8;
        weights[5] += 1.2;
      } else if (rpb >= 3.5) {
        weights[4] += 1.6;
        weights[6] += 1.8;
      } else if (runsNeeded <= 2 && ballsLeft <= 2) {
        weights[1] += 1.5;
        weights[2] += 1.4;
      }
    }

    // Controlled 20% randomness floor so AI feels sharp & human, not robotic
    if (Math.random() < 0.2) {
      const randPick = ALL_HANDS[Math.floor(Math.random() * ALL_HANDS.length)];
      return { pick: randPick, predictedPattern: false };
    }

    const pick = this.sampleWeighted(weights);
    // Flag pattern read if pick was one of top 2 weighted numbers
    const sorted = [...ALL_HANDS].sort((a, b) => weights[b] - weights[a]);
    const predictedPattern = usedPattern && (pick === sorted[0] || pick === sorted[1]);
    return { pick, predictedPattern };
  }

  /**
   * AI is BATTING against the user.
   * Goal: Score high runs while AVOIDING the user's likely bowling pick.
   */
  public chooseBatShot(innings: InningsState): {
    pick: HandNumber;
    powerUp: PowerUpType | null;
  } {
    // Expected runs vs danger of getting caught by user's bowling patterns
    const bowlFreq: Record<HandNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const hist = this.userBowlHistory;
    hist.forEach((val, idx) => {
      const recency = 0.5 + (idx + 1) / Math.max(1, hist.length);
      bowlFreq[val] += recency;
    });

    const totalBowlWeight = Math.max(
      1,
      ALL_HANDS.reduce((s, n) => s + bowlFreq[n], 0)
    );

    const ballsLeft = innings.maxBalls !== null ? innings.maxBalls - innings.ballsBowled : null;
    const runsNeeded = innings.target !== null ? innings.target - innings.runs : null;
    const wicketsLeft = innings.maxWickets - innings.wickets;

    // Decide whether AI uses a tactical Power-Up card
    let powerUp: PowerUpType | null = null;
    const canFreeHit = !innings.powerUps.freeHitUsed;
    const canDouble = !innings.powerUps.doubleRunsUsed;

    if (canFreeHit && ((ballsLeft === 1 && runsNeeded !== null && runsNeeded > 0) || (wicketsLeft === 1 && innings.ballsBowled >= 2 && Math.random() < 0.45))) {
      powerUp = 'free_hit';
    } else if (canDouble && (wicketsLeft > 1 || (ballsLeft !== null && ballsLeft <= 3) || Math.random() < 0.28)) {
      powerUp = 'double_runs';
    }

    // Score each candidate shot
    const weights: Record<HandNumber, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
    const aggression =
      ballsLeft !== null && runsNeeded !== null
        ? Math.min(2.2, Math.max(0.6, runsNeeded / Math.max(1, ballsLeft) / 3))
        : wicketsLeft === 1
          ? 0.85
          : 1.2;

    for (const n of ALL_HANDS) {
      const danger = bowlFreq[n] / totalBowlWeight; // 0..1 probability user throws n
      const reward = n * aggression;
      // If user frequently bowls 6 to trap AI, danger penalty drops weight of 6
      const safetyMultiplier = powerUp === 'free_hit' ? 1 : Math.max(0.15, 1.15 - danger * 2.4);
      weights[n] = Math.max(0.12, reward * safetyMultiplier);
    }

    // Avoid repeating the exact same shot if user just bowled close to it
    if (hist.length > 0) {
      const lastUserBowl = hist[hist.length - 1];
      if (powerUp !== 'free_hit') {
        weights[lastUserBowl] *= 0.65;
      }
    }

    // If chasing exact runs <= 4 with plenty of balls, favor safe winning shot
    if (runsNeeded !== null && runsNeeded > 0 && runsNeeded <= 4 && wicketsLeft === 1) {
      weights[runsNeeded as HandNumber] *= 1.5;
    }

    const pick = this.sampleWeighted(weights);
    return { pick, powerUp };
  }
}
