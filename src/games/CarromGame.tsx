import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Award, Crown, RotateCcw, Sparkles, Trophy, Users, Cpu } from 'lucide-react';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { MatchPointsBanner } from '../components/MatchPointsBanner';
import { WhatsAppChallengeButton } from '../components/WhatsAppChallengeButton';
import { MatchPointsBreakdown } from '../engine/rankings';
import { soundFX } from '../engine/soundFX';

interface CarromGameProps {
  playerName: string;
  countryFlag: string;
  carromWins: number;
  queenCaptures: number;
  onMatchComplete: (result: {
    outcome: 'win' | 'loss';
    queenCovers: number;
  }) => MatchPointsBreakdown;
  onQueenCaptured: () => void;
  onBackToHub: () => void;
}

type CoinColor = 'white' | 'black' | 'queen' | 'striker';
type CarromMode = 'ai' | 'passplay';
type TurnSide = 'p1' | 'p2';

interface Disc {
  id: string;
  color: CoinColor;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  mass: number;
  pocketed: boolean;
}

interface PocketDropAnim {
  color: CoinColor;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  r: number;
  progress: number; // 0..1
}

const BOARD = 460;
const MARGIN = 26;
const POCKET_R = 19;
const COIN_R = 11.5;
const STRIKER_R = 15.5;
const FRICTION = 0.985;
const STOP_EPS = 0.13;
const BASELINE_MIN_X = 96;
const BASELINE_MAX_X = BOARD - 96;

const POCKETS = [
  { x: MARGIN + 15, y: MARGIN + 15 },
  { x: BOARD - MARGIN - 15, y: MARGIN + 15 },
  { x: MARGIN + 15, y: BOARD - MARGIN - 15 },
  { x: BOARD - MARGIN - 15, y: BOARD - MARGIN - 15 },
];

/**
 * Authentic 19-coin hexagonal break rack:
 * 1 Red Queen at center + 6 inner ring + 12 outer ring = 9 White + 9 Black + 1 Red Queen
 */
function createAuthenticRack(): Disc[] {
  const cx = BOARD / 2;
  const cy = BOARD / 2;
  const discs: Disc[] = [
    {
      id: 'queen',
      color: 'queen',
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      r: COIN_R,
      mass: 1,
      pocketed: false,
    },
  ];

  const step = COIN_R * 2.08;
  // Inner ring: 6 coins alternating white & black
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    discs.push({
      id: `inner-${i}`,
      color: i % 2 === 0 ? 'white' : 'black',
      x: cx + Math.cos(angle) * step,
      y: cy + Math.sin(angle) * step,
      vx: 0,
      vy: 0,
      r: COIN_R,
      mass: 1,
      pocketed: false,
    });
  }

  // Outer ring: 12 coins (6 corners + 6 edge midpoints => 6 white, 6 black => total 9 white, 9 black)
  let whiteAssigned = 3;
  let blackAssigned = 3;
  for (let i = 0; i < 12; i++) {
    const isCorner = i % 2 === 0;
    const cornerIdx = Math.floor(i / 2);
    const a1 = (cornerIdx * Math.PI) / 3 - Math.PI / 2;
    const a2 = ((cornerIdx + 1) * Math.PI) / 3 - Math.PI / 2;

    let x: number;
    let y: number;
    if (isCorner) {
      x = cx + Math.cos(a1) * (step * 2);
      y = cy + Math.sin(a1) * (step * 2);
    } else {
      x =
        cx +
        (Math.cos(a1) * step * 2 + Math.cos(a2) * step * 2) / 2;
      y =
        cy +
        (Math.sin(a1) * step * 2 + Math.sin(a2) * step * 2) / 2;
    }

    let color: 'white' | 'black';
    if (isCorner) {
      color = 'white';
      whiteAssigned++;
    } else if (blackAssigned < 9) {
      color = 'black';
      blackAssigned++;
    } else {
      color = 'white';
      whiteAssigned++;
    }

    discs.push({
      id: `outer-${i}`,
      color,
      x,
      y,
      vx: 0,
      vy: 0,
      r: COIN_R,
      mass: 1,
      pocketed: false,
    });
  }

  // Heavy Striker on bottom baseline
  discs.push({
    id: 'striker',
    color: 'striker',
    x: cx,
    y: BOARD - 84,
    vx: 0,
    vy: 0,
    r: STRIKER_R,
    mass: 2.1,
    pocketed: false,
  });

  return discs;
}

export const CarromGame: React.FC<CarromGameProps> = ({
  playerName,
  countryFlag,
  carromWins,
  queenCaptures,
  onMatchComplete,
  onQueenCaptured,
  onBackToHub,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const discsRef = useRef<Disc[]>(createAuthenticRack());
  const dropAnimsRef = useRef<PocketDropAnim[]>([]);
  const movingRef = useRef<boolean>(false);
  const turnRef = useRef<TurnSide>('p1');
  const modeRef = useRef<CarromMode>('ai');
  const queenStateRef = useRef<'center' | 'pending_p1' | 'pending_p2' | 'covered_p1' | 'covered_p2'>('center');
  const dragRef = useRef<{
    mode: 'none' | 'slide' | 'aim';
    curX: number;
    curY: number;
  }>({ mode: 'none', curX: 0, curY: 0 });
  const pocketedThisTurnRef = useRef<CoinColor[]>([]);
  const matchEndRecordedRef = useRef<boolean>(false);
  const p1QueenCoversRef = useRef<number>(0);

  const [gameMode, setGameMode] = useState<CarromMode>('ai');
  const [turn, setTurn] = useState<TurnSide>('p1');
  const [strikerX, setStrikerX] = useState<number>(BOARD / 2);
  const [p1Score, setP1Score] = useState<number>(0);
  const [p2Score, setP2Score] = useState<number>(0);
  const [whiteLeft, setWhiteLeft] = useState<number>(9);
  const [blackLeft, setBlackLeft] = useState<number>(9);
  const [queenStatus, setQueenStatus] = useState<string>('On Board (+3 Cover Bonus)');
  const [statusText, setStatusText] = useState<string>(
    'Slide striker or tap baseline, then drag back from striker to shoot!'
  );
  const [winner, setWinner] = useState<TurnSide | null>(null);
  const [lastPointsBreakdown, setLastPointsBreakdown] = useState<MatchPointsBreakdown | null>(null);
  const [confettiKey, setConfettiKey] = useState<number>(0);
  const [shakeKey, setShakeKey] = useState<number>(0);

  const p2Label = gameMode === 'ai' ? 'Smart AI' : 'Player 2';

  const baselineY = (side: TurnSide) => (side === 'p1' ? BOARD - 84 : 84);

  const placeStrikerSafely = useCallback((desiredX: number, side: TurnSide) => {
    const y = baselineY(side);
    let x = Math.max(BASELINE_MIN_X, Math.min(BASELINE_MAX_X, desiredX));
    const coins = discsRef.current.filter((d) => !d.pocketed && d.color !== 'striker');

    for (let step = 0; step < 22; step++) {
      const overlap = coins.some(
        (c) => Math.hypot(c.x - x, c.y - y) < c.r + STRIKER_R + 2.5
      );
      if (!overlap) break;
      x =
        BASELINE_MIN_X +
        ((x - BASELINE_MIN_X + 22) % (BASELINE_MAX_X - BASELINE_MIN_X));
    }

    const striker = discsRef.current.find((d) => d.color === 'striker');
    if (striker) {
      striker.x = x;
      striker.y = y;
      striker.vx = 0;
      striker.vy = 0;
      striker.pocketed = false;
    }
    setStrikerX(x);
  }, []);

  const returnQueenToCenter = useCallback(() => {
    const queen = discsRef.current.find((d) => d.color === 'queen');
    if (!queen) return;
    let qx = BOARD / 2;
    let qy = BOARD / 2;
    const coins = discsRef.current.filter((d) => !d.pocketed && d.color !== 'queen');
    for (let ring = 0; ring < 5; ring++) {
      const rOffset = ring * (COIN_R * 2.2);
      const testX = BOARD / 2 + rOffset;
      const testY = BOARD / 2;
      if (!coins.some((c) => Math.hypot(c.x - testX, c.y - testY) < c.r + COIN_R + 2)) {
        qx = testX;
        qy = testY;
        break;
      }
    }
    queen.pocketed = false;
    queen.x = qx;
    queen.y = qy;
    queen.vx = 0;
    queen.vy = 0;
  }, []);

  const resetMatch = useCallback(
    (nextMode: CarromMode = modeRef.current) => {
      soundFX.playTap();
      modeRef.current = nextMode;
      setGameMode(nextMode);
      discsRef.current = createAuthenticRack();
      dropAnimsRef.current = [];
      movingRef.current = false;
      turnRef.current = 'p1';
      queenStateRef.current = 'center';
      matchEndRecordedRef.current = false;
      p1QueenCoversRef.current = 0;
      pocketedThisTurnRef.current = [];
      setTurn('p1');
      setStrikerX(BOARD / 2);
      setP1Score(0);
      setP2Score(0);
      setWhiteLeft(9);
      setBlackLeft(9);
      setQueenStatus('On Board (+3 Cover Bonus)');
      setWinner(null);
      setLastPointsBreakdown(null);
      setStatusText(
        nextMode === 'ai'
          ? 'Break the 19-coin rack! Drag back from striker to shoot White coins.'
          : `${playerName} breaks first (White coins) vs Player 2 (Black coins).`
      );
    },
    [playerName]
  );

  const executeAIShot = useCallback(() => {
    if (movingRef.current || turnRef.current !== 'p2' || modeRef.current !== 'ai') return;
    const targets = discsRef.current.filter(
      (d) =>
        !d.pocketed &&
        (d.color === 'black' ||
          (d.color === 'queen' && queenStateRef.current === 'center'))
    );
    if (targets.length === 0) return;

    let bestStrikerX = BOARD / 2;
    let bestVx = 0;
    let bestVy = 11;
    let bestScore = -Infinity;

    for (const coin of targets) {
      for (const pocket of POCKETS) {
        const dx = pocket.x - coin.x;
        const dy = pocket.y - coin.y;
        const distToPocket = Math.hypot(dx, dy);
        if (distToPocket < 1) continue;

        const ux = dx / distToPocket;
        const uy = dy / distToPocket;
        const ghostX = coin.x - ux * (COIN_R + STRIKER_R);
        const ghostY = coin.y - uy * (COIN_R + STRIKER_R);

        for (const candX of [115, 160, 205, 230, 255, 300, 345]) {
          const sy = baselineY('p2');
          const sdx = ghostX - candX;
          const sdy = ghostY - sy;
          const sDist = Math.hypot(sdx, sdy);
          if (sDist < 12) continue;

          const cos = (sdx * ux + sdy * uy) / sDist;
          if (cos < 0.22) continue;

          // Check rough blocker penalty
          const blocked = discsRef.current.some((other) => {
            if (other.pocketed || other.id === coin.id || other.color === 'striker') {
              return false;
            }
            const t =
              ((other.x - candX) * sdx + (other.y - sy) * sdy) / (sDist * sDist);
            if (t <= 0.08 || t >= 0.92) return false;
            const px = candX + t * sdx;
            const py = sy + t * sdy;
            return Math.hypot(other.x - px, other.y - py) < COIN_R + STRIKER_R - 2;
          });

          const score =
            cos * 135 - distToPocket * 0.14 - sDist * 0.08 - (blocked ? 75 : 0);
          if (score > bestScore) {
            bestScore = score;
            bestStrikerX = candX;
            const power = Math.min(18.5, Math.max(9.5, (sDist + distToPocket) * 0.044));
            bestVx = (sdx / sDist) * power;
            bestVy = (sdy / sDist) * power;
          }
        }
      }
    }

    // Fallback direct hit into rack or nearest target
    if (bestScore === -Infinity) {
      const target = targets[0];
      const sy = baselineY('p2');
      const dx = target.x - BOARD / 2;
      const dy = target.y - sy;
      const dist = Math.max(1, Math.hypot(dx, dy));
      bestVx = (dx / dist) * 14.5;
      bestVy = (dy / dist) * 14.5;
    }

    placeStrikerSafely(bestStrikerX, 'p2');
    const striker = discsRef.current.find((d) => d.color === 'striker');
    if (striker) {
      const jitter = (Math.random() - 0.5) * 0.45;
      striker.vx = bestVx + jitter;
      striker.vy = bestVy;
      pocketedThisTurnRef.current = [];
      movingRef.current = true;
      soundFX.playCarromClack(0.95);
      setStatusText('Smart AI takes its shot!');
    }
  }, [placeStrikerSafely]);

  // 60fps Sub-stepped Physics & Rendering Loop
  useEffect(() => {
    let rafId = 0;

    const finalizeTurn = () => {
      const pocketed = pocketedThisTurnRef.current;
      pocketedThisTurnRef.current = [];
      const curTurn = turnRef.current;
      const ownColor: CoinColor = curTurn === 'p1' ? 'white' : 'black';
      const oppColor: CoinColor = curTurn === 'p1' ? 'black' : 'white';

      const ownCount = pocketed.filter((c) => c === ownColor).length;
      const oppCount = pocketed.filter((c) => c === oppColor).length;
      const strikerFoul = pocketed.includes('striker');
      const pocketedQueenNow = pocketed.includes('queen');

      // Score own & opponent pocketed coins (+1 each coin, Queen cover = +3 bonus)
      if (curTurn === 'p1') {
        if (ownCount > 0) setP1Score((s) => s + ownCount);
        if (oppCount > 0) setP2Score((s) => s + oppCount);
      } else {
        if (ownCount > 0) setP2Score((s) => s + ownCount);
        if (oppCount > 0) setP1Score((s) => s + oppCount);
      }

      let queenMessage = '';

      // Queen Cover Rule Resolution
      if (queenStateRef.current === 'pending_p1' || queenStateRef.current === 'pending_p2') {
        const pendingOwner = queenStateRef.current === 'pending_p1' ? 'p1' : 'p2';
        if (pendingOwner === curTurn) {
          if (ownCount > 0 && !strikerFoul) {
            queenStateRef.current = curTurn === 'p1' ? 'covered_p1' : 'covered_p2';
            if (curTurn === 'p1') {
              p1QueenCoversRef.current += 1;
              setP1Score((s) => s + 3);
              onQueenCaptured();
              setShakeKey((k) => k + 1);
            } else {
              setP2Score((s) => s + 3);
            }
            setQueenStatus(
              `Covered by ${curTurn === 'p1' ? playerName : modeRef.current === 'ai' ? 'Smart AI' : 'Player 2'} (+3)`
            );
            queenMessage = ' Queen COVERED (+3 bonus)!';
          } else {
            queenStateRef.current = 'center';
            returnQueenToCenter();
            setQueenStatus('On Board (+3 Cover Bonus)');
            queenMessage = ' Queen not covered — returned to center.';
          }
        }
      } else if (pocketedQueenNow) {
        if (strikerFoul) {
          queenStateRef.current = 'center';
          returnQueenToCenter();
          setQueenStatus('On Board (+3 Cover Bonus)');
          queenMessage = ' Striker foul! Queen returned to center.';
        } else if (ownCount > 0) {
          // Covered in the exact same shot!
          queenStateRef.current = curTurn === 'p1' ? 'covered_p1' : 'covered_p2';
          if (curTurn === 'p1') {
            p1QueenCoversRef.current += 1;
            setP1Score((s) => s + 3);
            onQueenCaptured();
            setShakeKey((k) => k + 1);
          } else {
            setP2Score((s) => s + 3);
          }
          setQueenStatus(
            `Covered by ${curTurn === 'p1' ? playerName : modeRef.current === 'ai' ? 'Smart AI' : 'Player 2'} (+3)`
          );
          queenMessage = ' Queen pocketed & COVERED (+3 bonus)!';
        } else {
          queenStateRef.current = curTurn === 'p1' ? 'pending_p1' : 'pending_p2';
          setQueenStatus(
            `Pending Cover (${curTurn === 'p1' ? playerName : modeRef.current === 'ai' ? 'Smart AI' : 'Player 2'})`
          );
          queenMessage = ' Queen pocketed! Sink your own coin next to cover (+3).';
        }
      }

      // Penalty on striker foul: return 1 own coin if any already pocketed, or lose turn
      const remWhite = discsRef.current.filter(
        (d) => !d.pocketed && d.color === 'white'
      ).length;
      const remBlack = discsRef.current.filter(
        (d) => !d.pocketed && d.color === 'black'
      ).length;
      setWhiteLeft(remWhite);
      setBlackLeft(remBlack);

      // Check victory (all 9 white or all 9 black cleared, and queen not left pending)
      if (remWhite === 0 || remBlack === 0) {
        if (queenStateRef.current === 'pending_p1' || queenStateRef.current === 'pending_p2') {
          queenStateRef.current = 'center';
          returnQueenToCenter();
          setQueenStatus('On Board (+3 Cover Bonus)');
        }
        const winSide: TurnSide = remWhite === 0 ? 'p1' : 'p2';
        setWinner(winSide);
        const winName =
          winSide === 'p1'
            ? playerName
            : modeRef.current === 'ai'
              ? 'Smart AI'
              : 'Player 2';
        setStatusText(`${winName} cleared the board and won Neon Carrom Striker!`);

        if (!matchEndRecordedRef.current) {
          matchEndRecordedRef.current = true;
          if (winSide === 'p1') {
            soundFX.playVictoryFanfare();
            setConfettiKey((k) => k + 1);
            setShakeKey((k) => k + 1);
          } else if (modeRef.current === 'passplay') {
            soundFX.playVictoryFanfare();
            setConfettiKey((k) => k + 1);
          } else {
            soundFX.playDefeatBuzzer();
          }
          const earned = onMatchComplete({
            outcome: winSide === 'p1' ? 'win' : 'loss',
            queenCovers: p1QueenCoversRef.current,
          });
          setLastPointsBreakdown(earned);
        }
        return;
      }

      const keepTurn =
        !strikerFoul && (ownCount > 0 || (pocketedQueenNow && queenStateRef.current !== 'center'));
      const nextTurn: TurnSide = keepTurn ? curTurn : curTurn === 'p1' ? 'p2' : 'p1';

      const curActor =
        curTurn === 'p1'
          ? playerName
          : modeRef.current === 'ai'
            ? 'Smart AI'
            : 'Player 2';
      const nextActor =
        nextTurn === 'p1'
          ? playerName
          : modeRef.current === 'ai'
            ? 'Smart AI'
            : 'Player 2';

      if (strikerFoul) {
        setStatusText(`Striker pocketed! Foul by ${curActor}.${queenMessage} ${nextActor}'s turn.`);
      } else if (keepTurn) {
        setStatusText(`${curActor} keeps the turn!${queenMessage}`);
      } else {
        setStatusText(`${nextActor}'s turn.${queenMessage}`);
      }

      turnRef.current = nextTurn;
      setTurn(nextTurn);
      placeStrikerSafely(BOARD / 2, nextTurn);

      if (nextTurn === 'p2' && modeRef.current === 'ai') {
        window.setTimeout(() => {
          executeAIShot();
        }, 700);
      }
    };

    const stepPhysics = () => {
      const discs = discsRef.current;
      const SUBSTEPS = 2;
      let anyMoving = false;

      for (let step = 0; step < SUBSTEPS; step++) {
        for (const d of discs) {
          if (d.pocketed) continue;
          d.x += d.vx / SUBSTEPS;
          d.y += d.vy / SUBSTEPS;

          const minB = MARGIN + d.r;
          const maxB = BOARD - MARGIN - d.r;
          if (d.x < minB) {
            d.x = minB;
            d.vx = Math.abs(d.vx) * 0.84;
            soundFX.playCarromClack(0.35);
          } else if (d.x > maxB) {
            d.x = maxB;
            d.vx = -Math.abs(d.vx) * 0.84;
            soundFX.playCarromClack(0.35);
          }
          if (d.y < minB) {
            d.y = minB;
            d.vy = Math.abs(d.vy) * 0.84;
            soundFX.playCarromClack(0.35);
          } else if (d.y > maxB) {
            d.y = maxB;
            d.vy = -Math.abs(d.vy) * 0.84;
            soundFX.playCarromClack(0.35);
          }

          // Pocket capture check
          for (const p of POCKETS) {
            if (Math.hypot(d.x - p.x, d.y - p.y) < POCKET_R - 1) {
              d.pocketed = true;
              d.vx = 0;
              d.vy = 0;
              pocketedThisTurnRef.current.push(d.color);
              dropAnimsRef.current.push({
                color: d.color,
                x: d.x,
                y: d.y,
                targetX: p.x,
                targetY: p.y,
                r: d.r,
                progress: 0,
              });
              soundFX.playCarromPocket();
              break;
            }
          }
        }

        // Elastic rigid-body disc collisions
        for (let i = 0; i < discs.length; i++) {
          const a = discs[i];
          if (a.pocketed) continue;
          for (let j = i + 1; j < discs.length; j++) {
            const b = discs[j];
            if (b.pocketed) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minDist = a.r + b.r;
            if (dist > 0 && dist < minDist) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = minDist - dist;
              const totalMass = a.mass + b.mass;
              a.x -= nx * overlap * (b.mass / totalMass);
              a.y -= ny * overlap * (b.mass / totalMass);
              b.x += nx * overlap * (a.mass / totalMass);
              b.y += ny * overlap * (a.mass / totalMass);

              const rvx = b.vx - a.vx;
              const rvy = b.vy - a.vy;
              const velAlongNormal = rvx * nx + rvy * ny;
              if (velAlongNormal < 0) {
                const restitution = 0.89;
                const jImpulse =
                  (-(1 + restitution) * velAlongNormal) / (1 / a.mass + 1 / b.mass);
                a.vx -= (jImpulse / a.mass) * nx;
                a.vy -= (jImpulse / a.mass) * ny;
                b.vx += (jImpulse / b.mass) * nx;
                b.vy += (jImpulse / b.mass) * ny;
                if (Math.abs(velAlongNormal) > 0.75) {
                  soundFX.playCarromClack(Math.min(1, Math.abs(velAlongNormal) / 14));
                }
              }
            }
          }
        }
      }

      // Apply felt friction once per frame
      for (const d of discs) {
        if (d.pocketed) continue;
        d.vx *= FRICTION;
        d.vy *= FRICTION;
        if (Math.hypot(d.vx, d.vy) < STOP_EPS) {
          d.vx = 0;
          d.vy = 0;
        } else {
          anyMoving = true;
        }
      }

      if (movingRef.current && !anyMoving) {
        movingRef.current = false;
        finalizeTurn();
      }
    };

    const drawBoard = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== BOARD * dpr) {
        canvas.width = BOARD * dpr;
        canvas.height = BOARD * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Outer cyber-wood frame with neon cyan trim
      ctx.fillStyle = '#20110b';
      ctx.fillRect(0, 0, BOARD, BOARD);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, BOARD - 4, BOARD - 4);

      // Inner warm wooden surface
      const grad = ctx.createRadialGradient(
        BOARD / 2,
        BOARD / 2,
        24,
        BOARD / 2,
        BOARD / 2,
        BOARD * 0.7
      );
      grad.addColorStop(0, '#462717');
      grad.addColorStop(1, '#29150c');
      ctx.fillStyle = grad;
      ctx.fillRect(MARGIN, MARGIN, BOARD - MARGIN * 2, BOARD - MARGIN * 2);

      // Inner neon magenta hairline
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.42)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(MARGIN + 2, MARGIN + 2, BOARD - MARGIN * 2 - 4, BOARD - MARGIN * 2 - 4);

      // Center Break Circles
      ctx.beginPath();
      ctx.arc(BOARD / 2, BOARD / 2, 58, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 196, 81, 0.34)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(BOARD / 2, BOARD / 2, 15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
      ctx.stroke();

      // Diagonal foul/guide arrows toward pockets
      for (const p of POCKETS) {
        const dx = BOARD / 2 - p.x;
        const dy = BOARD / 2 - p.y;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        ctx.beginPath();
        ctx.moveTo(p.x + ux * 36, p.y + uy * 36);
        ctx.lineTo(p.x + ux * 112, p.y + uy * 112);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Baselines (Top & Bottom)
      [
        { y: 84, active: turnRef.current === 'p2', color: '#EC4899' },
        { y: BOARD - 84, active: turnRef.current === 'p1', color: '#22D3EE' },
      ].forEach((b) => {
        ctx.beginPath();
        ctx.moveTo(BASELINE_MIN_X, b.y);
        ctx.lineTo(BASELINE_MAX_X, b.y);
        ctx.strokeStyle = b.active ? b.color : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = b.active ? 2.5 : 1.5;
        ctx.stroke();

        for (const endX of [BASELINE_MIN_X, BASELINE_MAX_X]) {
          ctx.beginPath();
          ctx.arc(endX, b.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = b.active ? b.color : 'rgba(236, 72, 153, 0.5)';
          ctx.fill();
        }
      });

      // Corner Pockets
      for (const p of POCKETS) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2);
        ctx.fillStyle = '#07050c';
        ctx.fill();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Pocket-Drop Animations
      const nextDrops: PocketDropAnim[] = [];
      for (const anim of dropAnimsRef.current) {
        anim.progress += 0.085;
        if (anim.progress < 1) {
          nextDrops.push(anim);
          const t = anim.progress;
          const ax = anim.x + (anim.targetX - anim.x) * t;
          const ay = anim.y + (anim.targetY - anim.y) * t;
          const ar = anim.r * (1 - t * 0.72);
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.beginPath();
          ctx.arc(ax, ay, ar, 0, Math.PI * 2);
          ctx.fillStyle =
            anim.color === 'white'
              ? '#F8FAFC'
              : anim.color === 'black'
                ? '#1E293B'
                : anim.color === 'queen'
                  ? '#EF4444'
                  : '#22D3EE';
          ctx.fill();
          ctx.restore();
        }
      }
      dropAnimsRef.current = nextDrops;

      // Dotted Slingshot Aim Trajectory Line
      const striker = discsRef.current.find((d) => d.color === 'striker');
      if (dragRef.current.mode === 'aim' && striker && !striker.pocketed) {
        const dx = striker.x - dragRef.current.curX;
        const dy = striker.y - dragRef.current.curY;
        const pull = Math.min(115, Math.hypot(dx, dy));
        if (pull > 10) {
          const angle = Math.atan2(dy, dx);
          const rayLen = pull * 2.1;
          const endX = striker.x + Math.cos(angle) * rayLen;
          const endY = striker.y + Math.sin(angle) * rayLen;

          // Pull-back tension line
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(striker.x, striker.y);
          ctx.lineTo(
            striker.x - Math.cos(angle) * pull,
            striker.y - Math.sin(angle) * pull
          );
          ctx.strokeStyle = 'rgba(245, 196, 81, 0.75)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Dotted forward aim trajectory
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(striker.x, striker.y);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = '#22D3EE';
          ctx.lineWidth = 2.8;
          ctx.stroke();
          ctx.restore();

          // Power aura ring
          ctx.beginPath();
          ctx.arc(striker.x, striker.y, striker.r + 5 + (pull / 115) * 11, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Render Discs
      for (const d of discsRef.current) {
        if (d.pocketed) continue;
        ctx.save();
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);

        if (d.color === 'white') {
          ctx.fillStyle = '#F1F5F9';
          ctx.shadowColor = 'rgba(34, 211, 238, 0.4)';
          ctx.shadowBlur = 7;
        } else if (d.color === 'black') {
          ctx.fillStyle = '#1E1B2E';
          ctx.shadowColor = 'rgba(236, 72, 153, 0.45)';
          ctx.shadowBlur = 7;
        } else if (d.color === 'queen') {
          ctx.fillStyle = '#EF4444';
          ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
          ctx.shadowBlur = 12;
        } else {
          ctx.fillStyle = '#22D3EE';
          ctx.shadowColor = 'rgba(34, 211, 238, 0.9)';
          ctx.shadowBlur = 14;
        }
        ctx.fill();

        ctx.lineWidth = d.color === 'striker' ? 2.8 : 1.8;
        ctx.strokeStyle =
          d.color === 'white'
            ? '#38BDF8'
            : d.color === 'black'
              ? '#EC4899'
              : d.color === 'queen'
                ? '#FCA5A5'
                : '#F8FAFC';
        ctx.stroke();

        // Inner carrom ring motif
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 0.52, 0, Math.PI * 2);
        ctx.strokeStyle =
          d.color === 'white' ? 'rgba(14, 165, 233, 0.45)' : 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.restore();
      }
    };

    const tick = () => {
      if (movingRef.current) {
        stepPhysics();
      }
      drawBoard();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    executeAIShot,
    onMatchComplete,
    onQueenCaptured,
    placeStrikerSafely,
    playerName,
    returnQueenToCenter,
  ]);

  const getBoardCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: BOARD / 2, y: BOARD / 2 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * BOARD,
      y: ((e.clientY - rect.top) / rect.height) * BOARD,
    };
  };

  const canHumanInteract =
    !movingRef.current &&
    !winner &&
    (turnRef.current === 'p1' || modeRef.current === 'passplay');

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canHumanInteract) return;
    const striker = discsRef.current.find((d) => d.color === 'striker');
    if (!striker || striker.pocketed) return;

    const pt = getBoardCoords(e);
    const activeY = baselineY(turnRef.current);

    // Touching the striker arms the slingshot aim
    if (Math.hypot(pt.x - striker.x, pt.y - striker.y) <= striker.r + 22) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { mode: 'aim', curX: pt.x, curY: pt.y };
      return;
    }

    // Touching along the active baseline slides the striker horizontally
    if (Math.abs(pt.y - activeY) <= 28) {
      e.currentTarget.setPointerCapture(e.pointerId);
      placeStrikerSafely(pt.x, turnRef.current);
      dragRef.current = { mode: 'slide', curX: pt.x, curY: pt.y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.mode === 'none') return;
    const pt = getBoardCoords(e);
    if (dragRef.current.mode === 'slide') {
      placeStrikerSafely(pt.x, turnRef.current);
    } else {
      dragRef.current.curX = pt.x;
      dragRef.current.curY = pt.y;
    }
  };

  const handlePointerUp = () => {
    if (dragRef.current.mode === 'none') return;
    const prevMode = dragRef.current.mode;
    const { curX, curY } = dragRef.current;
    dragRef.current.mode = 'none';

    if (prevMode !== 'aim') return;

    const striker = discsRef.current.find((d) => d.color === 'striker');
    if (!striker || movingRef.current) return;

    const dx = striker.x - curX;
    const dy = striker.y - curY;
    const pull = Math.hypot(dx, dy);
    if (pull < 10) return;

    const power = Math.min(20, (pull / 115) * 20);
    striker.vx = (dx / pull) * power;
    striker.vy = (dy / pull) * power;
    pocketedThisTurnRef.current = [];
    movingRef.current = true;
    soundFX.playCarromClack(0.95);
    setStatusText('Strike!');
  };

  return (
    <div
      key={shakeKey > 0 ? `carrom-shake-${shakeKey}` : 'carrom-root'}
      className={`space-y-4 ${shakeKey > 0 ? 'animate-stadium-shake' : ''}`}
    >
      <ConfettiBurst triggerKey={confettiKey} intensity="win" />

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

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-black/40 p-1">
          <button
            type="button"
            onClick={() => resetMatch('ai')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
              gameMode === 'ai'
                ? 'bg-cyan-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
            <span>vs Smart AI</span>
          </button>
          <button
            type="button"
            onClick={() => resetMatch('passplay')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
              gameMode === 'passplay'
                ? 'bg-pink-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>2P Pass &amp; Play</span>
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-start">
        {/* Neon Carrom Board Canvas */}
        <div className="glass-panel mx-auto w-full max-w-[460px] rounded-2xl p-3 shadow-2xl">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="aspect-square w-full touch-none rounded-xl cursor-crosshair"
            aria-label="Neon Carrom Striker Board"
          />

          {/* Baseline Slider */}
          <div className="mt-3 space-y-1.5 px-1">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>Slide Striker (or Drag on Baseline)</span>
              <span className={turn === 'p1' ? 'font-bold text-cyan-300' : 'font-bold text-pink-300'}>
                {winner
                  ? 'Match Over'
                  : turn === 'p1'
                    ? `${playerName}'s Turn`
                    : `${p2Label}'s Turn`}
              </span>
            </div>
            <input
              type="range"
              min={BASELINE_MIN_X}
              max={BASELINE_MAX_X}
              value={strikerX}
              disabled={!canHumanInteract}
              onChange={(e) => placeStrikerSafely(Number(e.target.value), turnRef.current)}
              className="h-2.5 w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
              aria-label="Position carrom striker horizontally"
            />
          </div>
        </div>

        {/* Right Scoreboard, Profile Carrom Stats & Instructions */}
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <h2 className="font-display text-2xl font-bold tracking-wide text-white">
                Neon Carrom Striker
              </h2>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-300">
                <Crown className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                <span>{queenStatus}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div
                className={`rounded-xl border p-3.5 transition ${
                  turn === 'p1' && !winner
                    ? 'border-cyan-400/70 bg-cyan-500/15'
                    : 'border-white/10 bg-black/25'
                }`}
              >
                <div className="text-xs font-semibold text-cyan-300 truncate">
                  {playerName} (White)
                </div>
                <div className="font-mono-tabular mt-1 text-3xl font-extrabold text-white">
                  {p1Score}
                </div>
                <div className="mt-1 text-[11px] text-slate-300">
                  Coins left: <span className="font-mono-tabular font-bold">{whiteLeft}/9</span>
                </div>
              </div>

              <div
                className={`rounded-xl border p-3.5 transition ${
                  turn === 'p2' && !winner
                    ? 'border-pink-400/70 bg-pink-500/15'
                    : 'border-white/10 bg-black/25'
                }`}
              >
                <div className="text-xs font-semibold text-pink-300 truncate">
                  {p2Label} (Black)
                </div>
                <div className="font-mono-tabular mt-1 text-3xl font-extrabold text-white">
                  {p2Score}
                </div>
                <div className="mt-1 text-[11px] text-slate-300">
                  Coins left: <span className="font-mono-tabular font-bold">{blackLeft}/9</span>
                </div>
              </div>
            </div>

            <p
              aria-live="polite"
              className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs leading-relaxed text-slate-200 sm:text-sm"
            >
              {statusText}
            </p>

            {/* Saved User Carrom Record */}
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-[#F5C451]" aria-hidden="true" />
                <span>Carrom Wins:</span>
                <strong className="font-mono-tabular text-white">{carromWins}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                <span>Queens Covered:</span>
                <strong className="font-mono-tabular text-white">{queenCaptures}</strong>
              </span>
            </div>
          </div>

          {winner ? (
            <div className="glass-panel rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 text-[#F5C451]">
                <Award className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-bold tracking-wider uppercase">Match Complete</span>
              </div>
              <h3 className="font-display mt-1 text-3xl font-extrabold text-white">
                {winner === 'p1' ? `${playerName} Wins!` : `${p2Label} Wins!`}
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                Final Points: {playerName} {p1Score} – {p2Score} {p2Label}
              </p>

              <div className="mt-4">
                <MatchPointsBanner breakdown={lastPointsBreakdown} />
              </div>

              <div className="mt-4">
                <WhatsAppChallengeButton
                  username={playerName}
                  countryFlag={countryFlag}
                  gameTitle="Neon Carrom Striker"
                  scoreSummary={`${playerName} ${p1Score} – ${p2Score} ${p2Label} (${queenStatus})`}
                  scoreToBeat={`${Math.max(p1Score, p2Score) + 1} Carrom pts`}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => resetMatch(gameMode)}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Play Again</span>
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
          ) : (
            <div className="glass-panel rounded-2xl p-5 text-xs leading-relaxed text-slate-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Sparkles className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  <span>Carrom Rules &amp; Controls</span>
                </div>
                <button
                  type="button"
                  onClick={() => resetMatch(gameMode)}
                  className="font-semibold text-cyan-300 hover:underline underline-offset-4"
                >
                  Reset Board
                </button>
              </div>
              <ul className="mt-2.5 space-y-1.5">
                <li>
                  1. Slide the striker using the bottom slider or by dragging directly on your
                  baseline.
                </li>
                <li>
                  2. Pull back from the striker like a slingshot to aim the dotted trajectory line
                  and release to fire.
                </li>
                <li>
                  3. Pocket the <strong>Red Queen</strong> then sink one of your own coins on the
                  same or next shot to cover it for <strong>+3 bonus points</strong>!
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
