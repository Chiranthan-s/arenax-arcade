import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Cpu,
  Lock,
  RotateCcw,
  Shield,
  Target,
  Users,
} from 'lucide-react';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { MatchPointsBanner } from '../components/MatchPointsBanner';
import { WhatsAppChallengeButton } from '../components/WhatsAppChallengeButton';
import { MatchPointsBreakdown } from '../engine/rankings';
import { soundFX } from '../engine/soundFX';

interface FootballPenaltyGameProps {
  playerName: string;
  countryFlag: string;
  penaltyWins: number;
  onMatchComplete: (result: {
    outcome: 'win' | 'loss';
    topCornerGoals: number;
  }) => MatchPointsBreakdown;
  onBackToHub: () => void;
}

type PenaltyMode = 'ai' | 'passplay';
type DiveDir = 'left' | 'center' | 'right';
type KickOutcome = 'goal' | 'saved' | 'blocked' | 'miss';

interface ShotParams {
  vx0: number;
  vy0: number;
  spin: number;
}

interface BallFlight {
  active: boolean;
  wx: number;
  wy: number;
  wz: number;
  vx: number;
  vy: number;
  spin: number;
  wallChecked: boolean;
  resolved: boolean;
  trail: Array<{ x: number; y: number; r: number }>;
}

const W = 520;
const H = 360;

function project(wx: number, wy: number, wz: number) {
  const persp = 1 / (1 + wz * 1.15);
  return {
    x: W / 2 + wx * 230 * persp,
    y: 308 - wz * 172 - wy * 140 * persp,
    persp,
  };
}

export const FootballPenaltyGame: React.FC<FootballPenaltyGameProps> = ({
  playerName,
  countryFlag,
  penaltyWins,
  onMatchComplete,
  onBackToHub,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<PenaltyMode>('ai');
  const [shooterSide, setShooterSide] = useState<'p1' | 'p2'>('p1');
  const [p1Kicks, setP1Kicks] = useState<KickOutcome[]>([]);
  const [p2Kicks, setP2Kicks] = useState<KickOutcome[]>([]);
  const [winner, setWinner] = useState<'p1' | 'p2' | null>(null);
  const [lastPointsBreakdown, setLastPointsBreakdown] = useState<MatchPointsBreakdown | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [commentary, setCommentary] = useState<string>(
    'Swipe upward from the ball & curve mid-swipe to bend it into the top corner!'
  );
  const [bannerOutcome, setBannerOutcome] = useState<string | null>(null);

  // Pass & Play secret lock stage
  const [ppStage, setPpStage] = useState<'SHOOT' | 'HANDOFF' | 'KEEP' | 'ANIMATING'>('SHOOT');
  const pendingShotRef = useRef<ShotParams | null>(null);

  // Animation & Physics Refs
  const flightRef = useRef<BallFlight>({
    active: false,
    wx: 0,
    wy: 0.08,
    wz: 0,
    vx: 0,
    vy: 0,
    spin: 0,
    wallChecked: false,
    resolved: false,
    trail: [],
  });
  const keeperAnimRef = useRef<{
    dir: DiveDir;
    progress: number;
    active: boolean;
  }>({ dir: 'center', progress: 0, active: false });
  const netRippleRef = useRef<number>(0);
  const wallPosRef = useRef<{ active: boolean; x: number; dir: number }>({
    active: false,
    x: 0,
    dir: 1,
  });
  const swipePtsRef = useRef<Array<{ x: number; y: number }>>([]);
  const swipingRef = useRef<boolean>(false);
  const busyRef = useRef<boolean>(false);
  const winRecordedRef = useRef<boolean>(false);
  const p1TopCornersRef = useRef<number>(0);

  // Smart AI tracking
  const userShotZonesRef = useRef<DiveDir[]>([]);
  const userDiveZonesRef = useRef<DiveDir[]>([]);

  // Mirror state refs for RAF callbacks
  const p1KicksRef = useRef<KickOutcome[]>([]);
  const p2KicksRef = useRef<KickOutcome[]>([]);
  const shooterSideRef = useRef<'p1' | 'p2'>('p1');
  const modeRef = useRef<PenaltyMode>('ai');

  const p2Name = mode === 'ai' ? 'Euro AI XI' : 'Player 2';
  const currentRound = Math.min(p1Kicks.length, p2Kicks.length) + 1;
  const wallEnabled = currentRound >= 3;

  useEffect(() => {
    wallPosRef.current.active = wallEnabled;
  }, [wallEnabled]);

  const evaluateWinner = useCallback((k1: KickOutcome[], k2: KickOutcome[]): 'p1' | 'p2' | null => {
    const g1 = k1.filter((x) => x === 'goal').length;
    const g2 = k2.filter((x) => x === 'goal').length;
    const n1 = k1.length;
    const n2 = k2.length;

    if (n1 <= 5 && n2 <= 5) {
      const rem1 = 5 - n1;
      const rem2 = 5 - n2;
      if (g1 > g2 + rem2) return 'p1';
      if (g2 > g1 + rem1) return 'p2';
      if (n1 === 5 && n2 === 5 && g1 !== g2) {
        return g1 > g2 ? 'p1' : 'p2';
      }
      return null;
    }

    // Sudden Death after 5 kicks each
    if (n1 === n2 && g1 !== g2) {
      return g1 > g2 ? 'p1' : 'p2';
    }
    return null;
  }, []);

  const resetMatch = useCallback((nextMode: PenaltyMode = modeRef.current) => {
    soundFX.playTap();
    modeRef.current = nextMode;
    setMode(nextMode);
    p1KicksRef.current = [];
    p2KicksRef.current = [];
    shooterSideRef.current = 'p1';
    winRecordedRef.current = false;
    p1TopCornersRef.current = 0;
    busyRef.current = false;
    pendingShotRef.current = null;
    userShotZonesRef.current = [];
    userDiveZonesRef.current = [];
    flightRef.current = {
      active: false,
      wx: 0,
      wy: 0.08,
      wz: 0,
      vx: 0,
      vy: 0,
      spin: 0,
      wallChecked: false,
      resolved: false,
      trail: [],
    };
    keeperAnimRef.current = { dir: 'center', progress: 0, active: false };
    netRippleRef.current = 0;

    setShooterSide('p1');
    setP1Kicks([]);
    setP2Kicks([]);
    setWinner(null);
    setLastPointsBreakdown(null);
    setBannerOutcome(null);
    setPpStage('SHOOT');
    setCommentary(
      nextMode === 'ai'
        ? `${playerName} shoots first! Swipe up from the ball & bend it past the keeper.`
        : `${playerName} shoots first! Swipe secretly, then pass to Player 2 to dive.`
    );
  }, [playerName]);

  const chooseSmartAIDive = useCallback((): DiveDir => {
    const hist = userShotZonesRef.current;
    const weights: Record<DiveDir, number> = { left: 1, center: 0.8, right: 1 };
    hist.forEach((d, idx) => {
      weights[d] += 0.8 + (idx + 1) / Math.max(1, hist.length);
    });
    const dirs: DiveDir[] = ['left', 'center', 'right'];
    const total = dirs.reduce((s, d) => s + weights[d], 0);
    let r = Math.random() * total;
    for (const d of dirs) {
      r -= weights[d];
      if (r <= 0) return d;
    }
    return 'left';
  }, []);

  const chooseSmartAIShot = useCallback((): ShotParams => {
    const hist = userDiveZonesRef.current;
    const counts: Record<DiveDir, number> = { left: 1, center: 1, right: 1 };
    hist.forEach((d) => {
      counts[d] += 1;
    });
    // Bias away from player's most frequent dive
    const dirs: DiveDir[] = ['left', 'center', 'right'];
    const sorted = [...dirs].sort((a, b) => counts[a] - counts[b]);
    const targetDir = Math.random() < 0.72 ? sorted[0] : sorted[1];

    const targetX =
      targetDir === 'left'
        ? -0.68 - Math.random() * 0.16
        : targetDir === 'right'
          ? 0.68 + Math.random() * 0.16
          : (Math.random() - 0.5) * 0.22;

    // If wall active, curve around the wall!
    const spin = wallPosRef.current.active
      ? targetDir === 'left'
        ? -1.25
        : targetDir === 'right'
          ? 1.25
          : (Math.random() > 0.5 ? 1.1 : -1.1)
      : (Math.random() - 0.5) * 0.9;

    const vx0 = targetX - spin * 0.48;
    const vy0 = 0.88 + Math.random() * 0.42;
    return { vx0, vy0, spin };
  }, []);

  const launchKickAnimation = useCallback(
    (shot: ShotParams, keeperDive: DiveDir) => {
      busyRef.current = true;
      setBannerOutcome(null);
      soundFX.playWhistle();

      window.setTimeout(() => {
        soundFX.playKick();
        if (Math.abs(shot.spin) > 0.2) {
          soundFX.playCurveWhoosh(Math.abs(shot.spin));
        }
        flightRef.current = {
          active: true,
          wx: 0,
          wy: 0.08,
          wz: 0,
          vx: shot.vx0,
          vy: shot.vy0,
          spin: shot.spin,
          wallChecked: false,
          resolved: false,
          trail: [],
        };
        keeperAnimRef.current = {
          dir: keeperDive,
          progress: 0,
          active: true,
        };
      }, 150);
    },
    []
  );

  // Triggered when a kick finishes (goal, saved, blocked, miss)
  const handleKickResolved = useCallback(
    (outcome: KickOutcome, label: string, details: string, isTopCorner: boolean = false) => {
      const shooter = shooterSideRef.current;
      const nextP1 = shooter === 'p1' ? [...p1KicksRef.current, outcome] : p1KicksRef.current;
      const nextP2 = shooter === 'p2' ? [...p2KicksRef.current, outcome] : p2KicksRef.current;

      p1KicksRef.current = nextP1;
      p2KicksRef.current = nextP2;
      setP1Kicks(nextP1);
      setP2Kicks(nextP2);
      setBannerOutcome(label);
      setCommentary(details);

      if (outcome === 'goal') {
        if (shooter === 'p1' && isTopCorner) {
          p1TopCornersRef.current += 1;
        }
        netRippleRef.current = 1;
        setShakeKey((k) => k + 1);
        soundFX.playNetSwish();
        soundFX.playCrowdCheer('big');
      } else {
        soundFX.playSave();
      }

      const winSide = evaluateWinner(nextP1, nextP2);
      if (winSide) {
        setWinner(winSide);
        busyRef.current = false;
        if (!winRecordedRef.current) {
          winRecordedRef.current = true;
          if (winSide === 'p1') {
            soundFX.playVictoryFanfare();
            setConfettiKey((k) => k + 1);
          } else if (modeRef.current === 'passplay') {
            soundFX.playVictoryFanfare();
            setConfettiKey((k) => k + 1);
          } else {
            soundFX.playDefeatBuzzer();
          }
          const earned = onMatchComplete({
            outcome: winSide === 'p1' ? 'win' : 'loss',
            topCornerGoals: p1TopCornersRef.current,
          });
          setLastPointsBreakdown(earned);
        }
        return;
      }

      window.setTimeout(() => {
        const nextShooter: 'p1' | 'p2' = shooter === 'p1' ? 'p2' : 'p1';
        shooterSideRef.current = nextShooter;
        setShooterSide(nextShooter);
        flightRef.current.active = false;
        flightRef.current.wx = 0;
        flightRef.current.wy = 0.08;
        flightRef.current.wz = 0;
        flightRef.current.trail = [];
        keeperAnimRef.current = { dir: 'center', progress: 0, active: false };
        setBannerOutcome(null);
        busyRef.current = false;

        if (modeRef.current === 'ai') {
          setCommentary(
            nextShooter === 'p1'
              ? `${playerName} steps up! Swipe & curve to beat the keeper.`
              : `Defend your goal! Pick Left, Center, or Right to dive.`
          );
        } else {
          setPpStage('SHOOT');
          setCommentary(
            `${nextShooter === 'p1' ? playerName : 'Player 2'}'s kick! Swipe secretly, then hand over.`
          );
        }
      }, 1050);
    },
    [evaluateWinner, onMatchComplete, playerName]
  );

  // 60fps 3D-Perspective Canvas Render & Flight Loop
  useEffect(() => {
    let rafId = 0;

    const frame = () => {
      // Animate moving wall in Round 3+
      if (wallPosRef.current.active && !flightRef.current.active) {
        wallPosRef.current.x += 0.011 * wallPosRef.current.dir;
        if (wallPosRef.current.x > 0.44) wallPosRef.current.dir = -1;
        if (wallPosRef.current.x < -0.44) wallPosRef.current.dir = 1;
      }

      // Advance keeper dive
      if (keeperAnimRef.current.active && keeperAnimRef.current.progress < 1) {
        keeperAnimRef.current.progress = Math.min(1, keeperAnimRef.current.progress + 0.075);
      }

      // Decay net ripple
      if (netRippleRef.current > 0) {
        netRippleRef.current = Math.max(0, netRippleRef.current - 0.03);
      }

      // Advance Ball 3D Flight with Magnus Spin
      const fl = flightRef.current;
      if (fl.active && !fl.resolved) {
        const dt = 0.036; // ~28 frames to reach goal (~460ms)
        fl.wz += dt;
        fl.vx += fl.spin * dt * 1.45; // Magnus lateral banana curve
        fl.wx += fl.vx * dt;
        fl.vy -= 0.72 * dt; // Gravity arc
        fl.wy = Math.max(0.06, fl.wy + fl.vy * dt);

        const proj = project(fl.wx, fl.wy, fl.wz);
        fl.trail.push({ x: proj.x, y: proj.y, r: Math.max(3, 12 * proj.persp) });
        if (fl.trail.length > 14) fl.trail.shift();

        // Check Moving Defender Wall at wz = 0.48
        if (wallPosRef.current.active && !fl.wallChecked && fl.wz >= 0.48) {
          fl.wallChecked = true;
          if (Math.abs(fl.wx - wallPosRef.current.x) < 0.24 && fl.wy < 0.72) {
            fl.resolved = true;
            fl.vx = -fl.vx * 0.4;
            fl.vy = 0.3;
            handleKickResolved(
              'blocked',
              'WALL BLOCK!',
              'Straight into the defender wall! Curve around it next time.'
            );
          }
        }

        // Check Goal Line at wz >= 1.0
        if (!fl.resolved && fl.wz >= 1.0) {
          fl.resolved = true;
          const insideWidth = Math.abs(fl.wx) <= 0.96;
          const insideHeight = fl.wy <= 0.99;

          if (!insideWidth || !insideHeight) {
            handleKickResolved(
              'miss',
              'OFF TARGET!',
              !insideWidth
                ? 'Bent too wide of the post!'
                : 'Blazed high over the crossbar!'
            );
          } else {
            const kDir = keeperAnimRef.current.dir;
            const keeperX = kDir === 'left' ? -0.62 : kDir === 'right' ? 0.62 : 0;
            const distFromKeeper = Math.abs(fl.wx - keeperX);
            const topCornerScreamer =
              Math.abs(fl.wx) > 0.72 && fl.wy > 0.68 && Math.abs(fl.spin) > 0.45;

            if (distFromKeeper < 0.35 && fl.wy < 0.86 && !topCornerScreamer) {
              handleKickResolved(
                'saved',
                'SAVED!',
                `Keeper guessed ${kDir.toUpperCase()} and parried it away!`
              );
            } else {
              const isTopCornerGoal = fl.wy > 0.65 && Math.abs(fl.wx) > 0.58;
              const cornerNote =
                isTopCornerGoal
                  ? 'UNSTOPPABLE TOP-CORNER BENDER!'
                  : Math.abs(fl.spin) > 0.55
                    ? 'WHAT A BANANA CURVE! Back of the net!'
                    : 'CLINICAL FINISH! Keeper has no chance!';
              handleKickResolved('goal', 'GOAL!', cornerNote, isTopCornerGoal);
            }
          }
        }
      }

      // ==================== RENDER 3D STADIUM CANVAS ====================
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          if (canvas.width !== W * dpr) {
            canvas.width = W * dpr;
            canvas.height = H * dpr;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          // Night Sky & Floodlights
          const sky = ctx.createLinearGradient(0, 0, 0, 145);
          sky.addColorStop(0, '#040a12');
          sky.addColorStop(1, '#092316');
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, W, 145);

          // Stadium Floodlight Towers
          for (const lx of [78, W - 78]) {
            const beam = ctx.createRadialGradient(lx, 20, 4, lx, 60, 150);
            beam.addColorStop(0, 'rgba(248, 250, 252, 0.32)');
            beam.addColorStop(1, 'rgba(248, 250, 252, 0)');
            ctx.fillStyle = beam;
            ctx.fillRect(lx - 150, 0, 300, 160);

            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(lx - 14, 16, 28, 7);
          }

          // European Turf Pitch Perspective
          const turf = ctx.createLinearGradient(0, 136, 0, H);
          turf.addColorStop(0, '#0e4a26');
          turf.addColorStop(1, '#146b38');
          ctx.fillStyle = turf;
          ctx.fillRect(0, 136, W, H - 136);

          // Mowed Pitch Stripes
          ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
          for (let i = 0; i < 6; i++) {
            const z0 = i * 0.17;
            const z1 = z0 + 0.085;
            const p0 = project(0, 0, z0);
            const p1 = project(0, 0, z1);
            ctx.fillRect(0, p1.y, W, p0.y - p1.y);
          }

          // Penalty Box Chalk Lines
          const boxBL = project(-1.42, 0, 0.25);
          const boxBR = project(1.42, 0, 0.25);
          const boxTL = project(-1.42, 0, 1.0);
          const boxTR = project(1.42, 0, 1.0);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(boxTL.x, boxTL.y);
          ctx.lineTo(boxBL.x, boxBL.y);
          ctx.lineTo(boxBR.x, boxBR.y);
          ctx.lineTo(boxTR.x, boxTR.y);
          ctx.stroke();

          // Goal Line
          ctx.beginPath();
          ctx.moveTo(0, 136);
          ctx.lineTo(W, 136);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.stroke();

          // Penalty Spot
          const spot = project(0, 0, 0);
          ctx.beginPath();
          ctx.ellipse(spot.x, spot.y + 4, 9, 4, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fill();

          // 3D Perspective Goal Frame & Net
          const gFLB = project(-1, 0, 1);
          const gFRB = project(1, 0, 1);
          const gFLT = project(-1, 1, 1);
          const gFRT = project(1, 1, 1);

          const ripple = Math.sin(netRippleRef.current * Math.PI * 5) * netRippleRef.current * 5;
          const gBLB = project(-1, 0, 1.18);
          const gBRB = project(1, 0, 1.18);
          const gBLT = project(-1, 1, 1.18);
          const gBRT = project(1, 1, 1.18);

          // Back net fill
          ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
          ctx.beginPath();
          ctx.moveTo(gFLT.x, gFLT.y);
          ctx.lineTo(gFRT.x, gFRT.y);
          ctx.lineTo(gFRB.x, gFRB.y);
          ctx.lineTo(gFLB.x, gFLB.y);
          ctx.closePath();
          ctx.fill();

          // Net Mesh Lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 1;
          for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const nxTop = gBLT.x + (gBRT.x - gBLT.x) * t;
            const nxBot = gBLB.x + (gBRB.x - gBLB.x) * t;
            ctx.beginPath();
            ctx.moveTo(nxTop + ripple * 0.4, gBLT.y);
            ctx.lineTo(nxBot, gBLB.y);
            ctx.stroke();
          }
          for (let j = 0; j <= 5; j++) {
            const t = j / 5;
            const ny = gBLT.y + (gBLB.y - gBLT.y) * t;
            ctx.beginPath();
            ctx.moveTo(gBLT.x, ny + ripple * 0.3);
            ctx.lineTo(gBRT.x, ny + ripple * 0.3);
            ctx.stroke();
          }

          // Side net triangles
          ctx.beginPath();
          ctx.moveTo(gFLT.x, gFLT.y);
          ctx.lineTo(gBLT.x, gBLT.y);
          ctx.lineTo(gBLB.x, gBLB.y);
          ctx.lineTo(gFLB.x, gFLB.y);
          ctx.moveTo(gFRT.x, gFRT.y);
          ctx.lineTo(gBRT.x, gBRT.y);
          ctx.lineTo(gBRB.x, gBRB.y);
          ctx.lineTo(gFRB.x, gFRB.y);
          ctx.stroke();

          // White Goal Posts & Crossbar
          ctx.strokeStyle = '#F8FAFC';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(gFLB.x, gFLB.y);
          ctx.lineTo(gFLT.x, gFLT.y);
          ctx.lineTo(gFRT.x, gFRT.y);
          ctx.lineTo(gFRB.x, gFRB.y);
          ctx.stroke();

          // Diving Goalkeeper
          const kAnim = keeperAnimRef.current;
          const kTargetWx = kAnim.dir === 'left' ? -0.62 : kAnim.dir === 'right' ? 0.62 : 0;
          const kWx = kAnim.active ? kTargetWx * kAnim.progress : 0;
          const kWy = kAnim.active && kAnim.dir !== 'center' ? 0.25 * Math.sin(kAnim.progress * Math.PI) : 0;
          const kp = project(kWx, kWy, 0.96);
          const tilt =
            kAnim.active && kAnim.dir === 'left'
              ? -0.55 * kAnim.progress
              : kAnim.active && kAnim.dir === 'right'
                ? 0.55 * kAnim.progress
                : 0;

          ctx.save();
          ctx.translate(kp.x, kp.y - 20 * kp.persp);
          ctx.rotate(tilt);
          // Torso
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(-10 * kp.persp, -14 * kp.persp, 20 * kp.persp, 26 * kp.persp);
          // Arms & Gloves
          ctx.strokeStyle = '#F8FAFC';
          ctx.lineWidth = 4 * kp.persp;
          ctx.beginPath();
          ctx.moveTo(-10 * kp.persp, -10 * kp.persp);
          ctx.lineTo(-22 * kp.persp, -18 * kp.persp);
          ctx.moveTo(10 * kp.persp, -10 * kp.persp);
          ctx.lineTo(22 * kp.persp, -18 * kp.persp);
          ctx.stroke();
          // Gloves
          ctx.fillStyle = '#F5C451';
          ctx.beginPath();
          ctx.arc(-23 * kp.persp, -19 * kp.persp, 4.5 * kp.persp, 0, Math.PI * 2);
          ctx.arc(23 * kp.persp, -19 * kp.persp, 4.5 * kp.persp, 0, Math.PI * 2);
          ctx.fill();
          // Head
          ctx.fillStyle = '#F4D2B5';
          ctx.beginPath();
          ctx.arc(0, -21 * kp.persp, 7 * kp.persp, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Moving Defender Wall (Round 3+)
          if (wallPosRef.current.active) {
            const wallCenter = wallPosRef.current.x;
            for (const offset of [-0.14, 0, 0.14]) {
              const wp = project(wallCenter + offset, 0, 0.48);
              ctx.save();
              ctx.translate(wp.x, wp.y);
              // Shadow
              ctx.fillStyle = 'rgba(0,0,0,0.35)';
              ctx.beginPath();
              ctx.ellipse(0, 2, 11 * wp.persp, 4 * wp.persp, 0, 0, Math.PI * 2);
              ctx.fill();
              // Kit
              ctx.fillStyle = '#EF4444';
              ctx.fillRect(-8 * wp.persp, -44 * wp.persp, 16 * wp.persp, 30 * wp.persp);
              // Shorts
              ctx.fillStyle = '#0F172A';
              ctx.fillRect(-8 * wp.persp, -14 * wp.persp, 16 * wp.persp, 12 * wp.persp);
              // Head
              ctx.fillStyle = '#F4D2B5';
              ctx.beginPath();
              ctx.arc(0, -51 * wp.persp, 6.5 * wp.persp, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }

          // Live Swipe Curve Ribbon
          if (swipingRef.current && swipePtsRef.current.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(swipePtsRef.current[0].x, swipePtsRef.current[0].y);
            for (let i = 1; i < swipePtsRef.current.length; i++) {
              ctx.lineTo(swipePtsRef.current[i].x, swipePtsRef.current[i].y);
            }
            ctx.strokeStyle = '#F5C451';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(245, 196, 81, 0.8)';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.restore();
          }

          // Magnus Ball Trail
          for (let i = 0; i < fl.trail.length; i++) {
            const pt = fl.trail[i];
            const alpha = ((i + 1) / fl.trail.length) * 0.45;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.r * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(245, 196, 81, ${alpha})`;
            ctx.fill();
          }

          // Football (at spot or in flight)
          const bProj = project(fl.wx, fl.wy, fl.wz);
          const bGround = project(fl.wx, 0, fl.wz);
          const br = Math.max(6, 15 * bProj.persp);

          // Ground shadow
          ctx.beginPath();
          ctx.ellipse(bGround.x, bGround.y + 2, br * 0.9, br * 0.35, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fill();

          // Ball sphere
          ctx.save();
          ctx.translate(bProj.x, bProj.y);
          ctx.beginPath();
          ctx.arc(0, 0, br, 0, Math.PI * 2);
          ctx.fillStyle = '#F8FAFC';
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#0F172A';
          ctx.stroke();
          // Pentagon core
          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.arc(0, 0, br * 0.36, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [handleKickResolved]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: W / 2, y: 308 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const canHumanSwipe =
    !winner &&
    !busyRef.current &&
    ((mode === 'ai' && shooterSide === 'p1') ||
      (mode === 'passplay' && ppStage === 'SHOOT'));

  const canHumanKeep =
    !winner &&
    !busyRef.current &&
    ((mode === 'ai' && shooterSide === 'p2') ||
      (mode === 'passplay' && ppStage === 'KEEP'));

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canHumanSwipe) return;
    const pt = getCanvasCoords(e);
    // Start swipe near lower half / ball area
    if (pt.y >= 175) {
      e.currentTarget.setPointerCapture(e.pointerId);
      swipingRef.current = true;
      swipePtsRef.current = [pt];
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!swipingRef.current) return;
    const pt = getCanvasCoords(e);
    swipePtsRef.current.push(pt);
  };

  const handlePointerUp = () => {
    if (!swipingRef.current) return;
    swipingRef.current = false;
    const pts = swipePtsRef.current;
    swipePtsRef.current = [];
    if (pts.length < 2) return;

    const first = pts[0];
    const last = pts[pts.length - 1];
    const dy = first.y - last.y; // Positive when swiping upward
    if (dy < 28) return;

    // Lateral target from chord
    const dx = last.x - first.x;
    const rawVx = Math.max(-1.65, Math.min(1.65, (dx / Math.max(80, dy)) * 1.45));

    // Mid-swipe bow curvature -> Magnus banana spin
    const mid = pts[Math.floor(pts.length / 2)];
    const chordXAtMid = (first.x + last.x) / 2;
    const bow = (mid.x - chordXAtMid) / 60; // Positive = bowed right -> curves LEFT
    const spin = Math.max(-1.55, Math.min(1.55, -bow * 1.55));

    // Elevation from swipe length
    const dist = Math.hypot(dx, dy);
    const vy0 = Math.max(0.45, Math.min(1.38, (dist / 170) * 1.15));

    const shot: ShotParams = {
      vx0: rawVx - spin * 0.32,
      vy0,
      spin,
    };

    const approxTargetX = shot.vx0 + shot.spin * 0.72;
    const shotZone: DiveDir =
      approxTargetX < -0.32 ? 'left' : approxTargetX > 0.32 ? 'right' : 'center';

    if (mode === 'ai') {
      const aiDive = chooseSmartAIDive();
      userShotZonesRef.current.push(shotZone);
      launchKickAnimation(shot, aiDive);
    } else {
      pendingShotRef.current = shot;
      setPpStage('HANDOFF');
      soundFX.playTap();
      setCommentary('Curve shot locked secretly! Pass phone to Goalkeeper.');
    }
  };

  const handleKeeperDivePick = (dive: DiveDir) => {
    if (!canHumanKeep) return;
    if (mode === 'ai') {
      userDiveZonesRef.current.push(dive);
      const aiShot = chooseSmartAIShot();
      launchKickAnimation(aiShot, dive);
    } else {
      const lockedShot = pendingShotRef.current;
      if (!lockedShot) return;
      pendingShotRef.current = null;
      setPpStage('ANIMATING');
      launchKickAnimation(lockedShot, dive);
    }
  };

  const p1Goals = p1Kicks.filter((k) => k === 'goal').length;
  const p2Goals = p2Kicks.filter((k) => k === 'goal').length;
  const p1Display = playerName;
  const p2Display = p2Name;
  const shooterDisplay = shooterSide === 'p1' ? p1Display : p2Display;
  const keeperDisplay = shooterSide === 'p1' ? p2Display : p1Display;

  return (
    <div
      key={shakeKey > 0 ? `penalty-shake-${shakeKey}` : 'penalty-root'}
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

        <div className="flex items-center gap-1 rounded-xl bg-black/40 p-1">
          <button
            type="button"
            onClick={() => resetMatch('ai')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
              mode === 'ai'
                ? 'bg-emerald-400 text-slate-950'
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
              mode === 'passplay'
                ? 'bg-[#F5C451] text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>2P Pass &amp; Play</span>
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        {/* Left 3D-Perspective Canvas Pitch */}
        <div className="glass-panel rounded-2xl p-4 shadow-2xl sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-white">
              {canHumanSwipe ? (
                <>
                  <Target className="h-4 w-4 text-[#F5C451]" aria-hidden="true" />
                  <span>{shooterDisplay} Shooting · Swipe &amp; Curve Upward</span>
                </>
              ) : canHumanKeep ? (
                <>
                  <Shield className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  <span>{keeperDisplay} Keeping · Choose Your Dive</span>
                </>
              ) : (
                <span>
                  Round {currentRound}
                  {currentRound > 5 ? ' (Sudden Death)' : '/5'}
                </span>
              )}
            </div>

            {wallEnabled && (
              <span className="text-xs font-semibold text-amber-300">
                Moving Wall Active
              </span>
            )}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/15">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="aspect-[13/9] w-full touch-none bg-[#04150b] cursor-grab active:cursor-grabbing"
              aria-label="Curve-Shot Penalty Duel 3D Stadium Canvas"
            />

            {/* Outcome Stamp */}
            {bannerOutcome && (
              <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center">
                <div className="animate-pop-score rounded-xl border border-white/25 bg-black/75 px-4 py-1.5 font-display text-2xl font-extrabold tracking-wider text-[#F5C451] shadow-xl backdrop-blur-sm">
                  {bannerOutcome}
                </div>
              </div>
            )}

            {/* Pass & Play Handoff Overlay */}
            {mode === 'passplay' && ppStage === 'HANDOFF' && !winner && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#04130b]/95 p-6 text-center backdrop-blur-md">
                <Lock className="h-10 w-10 text-[#F5C451]" aria-hidden="true" />
                <h3 className="font-display mt-3 text-3xl font-bold text-white">
                  Pass Phone to {keeperDisplay}
                </h3>
                <p className="mt-1.5 max-w-xs text-xs text-slate-300">
                  {shooterDisplay}&apos;s curve shot is locked in secretly!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playTap();
                    setPpStage('KEEP');
                    setCommentary(`${keeperDisplay}: Pick Left, Center, or Right to dive!`);
                  }}
                  className="mt-5 min-h-[46px] rounded-xl bg-[#F5C451] px-6 py-2.5 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472]"
                >
                  I&apos;m {keeperDisplay} — Ready to Keep
                </button>
              </div>
            )}
          </div>

          {/* Goalkeeper Controls */}
          {canHumanKeep && (
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {(['left', 'center', 'right'] as DiveDir[]).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => handleKeeperDivePick(dir)}
                  className="min-h-[48px] rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2.5 text-xs font-bold text-emerald-200 uppercase transition hover:bg-emerald-500/30 active:scale-[0.97] sm:text-sm"
                >
                  Dive {dir}
                </button>
              ))}
            </div>
          )}

          <p
            aria-live="polite"
            className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs leading-relaxed text-slate-200 sm:text-sm"
          >
            {commentary}
          </p>
        </div>

        {/* Right Shootout Board & Summary */}
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="font-display text-2xl font-bold tracking-wide text-white">
                5-Kick Shootout
              </h2>
              <span className="text-xs font-medium text-emerald-300">
                Penalty Wins: <strong className="font-mono-tabular text-white">{penaltyWins}</strong>
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {/* P1 Row */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-[#F5C451]">{p1Display}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {Array.from({ length: Math.max(5, p1Kicks.length) }).map((_, i) => {
                      const k = p1Kicks[i];
                      return (
                        <span
                          key={`p1k-${i}`}
                          className={`flex h-6 w-6 items-center justify-center rounded-md border text-[11px] font-bold ${
                            k === 'goal'
                              ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200'
                              : k
                                ? 'border-red-400 bg-red-500/25 text-red-200'
                                : 'border-white/15 bg-black/25 text-slate-500'
                          }`}
                        >
                          {k === 'goal' ? 'G' : k ? 'X' : '·'}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="font-display text-4xl font-extrabold text-white tabular-nums">
                  {p1Goals}
                </div>
              </div>

              <div className="h-px bg-white/10" />

              {/* P2 Row */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-200">{p2Display}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {Array.from({ length: Math.max(5, p2Kicks.length) }).map((_, i) => {
                      const k = p2Kicks[i];
                      return (
                        <span
                          key={`p2k-${i}`}
                          className={`flex h-6 w-6 items-center justify-center rounded-md border text-[11px] font-bold ${
                            k === 'goal'
                              ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200'
                              : k
                                ? 'border-red-400 bg-red-500/25 text-red-200'
                                : 'border-white/15 bg-black/25 text-slate-500'
                          }`}
                        >
                          {k === 'goal' ? 'G' : k ? 'X' : '·'}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="font-display text-4xl font-extrabold text-white tabular-nums">
                  {p2Goals}
                </div>
              </div>
            </div>
          </div>

          {winner ? (
            <div className="glass-panel space-y-4 rounded-2xl p-6 shadow-2xl">
              <div>
                <div className="flex items-center gap-2 text-[#F5C451]">
                  <Award className="h-5 w-5" aria-hidden="true" />
                  <span className="text-xs font-bold tracking-wider uppercase">Full Time</span>
                </div>
                <h3 className="font-display mt-1 text-3xl font-extrabold text-white">
                  {winner === 'p1' ? `${p1Display} Wins!` : `${p2Display} Wins!`}
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  Final Shootout Score: {p1Display} {p1Goals} – {p2Goals} {p2Display}
                </p>
              </div>

              <MatchPointsBanner breakdown={lastPointsBreakdown} />

              <WhatsAppChallengeButton
                username={playerName}
                countryFlag={countryFlag}
                gameTitle="Curve-Shot Penalty Duel"
                scoreSummary={`Score: ${p1Display} ${p1Goals} – ${p2Goals} ${p2Display}`}
                scoreToBeat={`${Math.max(p1Goals, p2Goals)} goals`}
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => resetMatch(mode)}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#F5C451] px-4 py-2.5 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472]"
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
              <div className="font-semibold text-white">Swipe-to-Bend Tip</div>
              <p className="mt-1.5">
                Touch near the penalty spot and swipe upward. Bow your finger left or right
                mid-swipe to apply <strong>Magnus banana spin</strong> and bend shots around the
                Round 3+ defender wall!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
