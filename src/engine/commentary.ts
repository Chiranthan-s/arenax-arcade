import { PowerUpType } from '../types/game';

interface CommentaryContext {
  batterName: string;
  bowlerName: string;
  runsScored: number;
  basePick: number;
  isWicket: boolean;
  savedByFreeHit: boolean;
  powerUpUsed: PowerUpType | null;
  aiReadPattern?: boolean;
  newTotal: number;
  prevTotal: number;
  target: number | null;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateCommentary(ctx: CommentaryContext): string {
  const {
    batterName,
    bowlerName,
    runsScored,
    isWicket,
    savedByFreeHit,
    powerUpUsed,
    aiReadPattern,
    newTotal,
    prevTotal,
    target,
  } = ctx;

  if (savedByFreeHit) {
    return pickRandom([
      `SAME NUMBER — SAVED BY FREE HIT! ${batterName} survives with a grin!`,
      `${bowlerName} appeals... NO BALL! Free Hit rescues ${batterName}!`,
      `Deadly trap from ${bowlerName}, but the Free Hit shield holds firm!`,
    ]);
  }

  if (isWicket) {
    if (aiReadPattern) {
      return pickRandom([
        `OUT! ${bowlerName} read your pattern like an open book! Clean bowled!`,
        `TRAPPED! ${bowlerName} anticipated that exact number — timber!`,
        `CLEAN BOWLED! Straight through the gate after a clever read!`,
      ]);
    }
    return pickRandom([
      `CLEAN BOWLED! Straight through the gate — stumps flying!`,
      `CAUGHT AT SLIP! ${batterName} edges one straight into the trap!`,
      `TIMBER! Middle stump cartwheeling across the turf!`,
      `GOT HIM! ${bowlerName} nails the exact number — huge breakthrough!`,
    ]);
  }

  if (target !== null && newTotal >= target) {
    return pickRandom([
      `TARGET CHASED! ${batterName} seals a thrilling victory!`,
      `GAME OVER! Sealed in style under the floodlights!`,
      `WHAT A FINISH! ${batterName} crosses the line with authority!`,
    ]);
  }

  if (prevTotal < 50 && newTotal >= 50) {
    return `FIFTY UP for ${batterName}! Raises the bat to a roaring stadium!`;
  }

  if (powerUpUsed === 'double_runs' && runsScored >= 10) {
    return pickRandom([
      `DOUBLE DELIGHT! ${runsScored} MASSIVE RUNS off a single ball!`,
      `2X POWER SURGE! ${batterName} launches it out of the stadium for ${runsScored}!`,
    ]);
  }

  if (powerUpUsed === 'double_runs' && runsScored >= 8) {
    return `2X RUNS CASHED IN! Crisp stroke rockets away for ${runsScored}!`;
  }

  if (runsScored >= 6) {
    return pickRandom([
      `MASSIVE SIX into the top tier! The crowd goes wild!`,
      `CLEARS THE FLOODLIGHTS! Pure timing off the sweet spot!`,
      `BOOM! Dispatched high over long-on for a maximum!`,
      `INTO THE SECOND DECK! Brutal strike from ${batterName}!`,
    ]);
  }

  if (runsScored === 4) {
    return pickRandom([
      `CRACKING COVER DRIVE! Races across the turf for four!`,
      `Pierces the gap like a bullet — FOUR runs!`,
      `Whipped off the pads to the boundary rope!`,
      `Pure class! Timed to perfection for four!`,
    ]);
  }

  if (runsScored === 5) {
    return pickRandom([
      `Clever five! Overthrows and smart running keep the pressure on!`,
      `Five valuable runs — ${bowlerName} can't contain ${batterName}!`,
    ]);
  }

  if (runsScored === 3) {
    return pickRandom([
      `Three hard-run yards! Sharp calling between the wickets!`,
      `Placed deep into the outfield — they hustle back for three!`,
    ]);
  }

  if (runsScored === 2) {
    return pickRandom([
      `Nudged neatly into the gap for a quick brace!`,
      `Soft hands, easy two runs added to the board!`,
    ]);
  }

  return pickRandom([
    `Quick single! Keeps the scoreboard ticking over.`,
    `Dabbed to third man for one — smart rotation of strike.`,
    `Tucked away cleanly for a single run.`,
  ]);
}
