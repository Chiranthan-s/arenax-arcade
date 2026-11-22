import React, { useEffect, useRef } from 'react';

interface ConfettiBurstProps {
  triggerKey: number;
  intensity?: 'six' | 'win';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vr: number;
  color: string;
  alpha: number;
}

const COLORS = ['#F5C451', '#FFE082', '#22C55E', '#FFFFFF', '#EAB308'];

export const ConfettiBurst: React.FC<ConfettiBurstProps> = ({
  triggerKey,
  intensity = 'six',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (triggerKey <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = intensity === 'win' ? 95 : 46;
    const originX = width / 2;
    const originY = intensity === 'win' ? height * 0.36 : height * 0.42;

    const particles: Particle[] = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (intensity === 'win' ? 5 : 3.5) + Math.random() * 8.5;
      return {
        x: originX + (Math.random() - 0.5) * 80,
        y: originY + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (intensity === 'win' ? 4.5 : 3.5),
        size: 5 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 1,
      };
    });

    let rafId = 0;
    const startTime = performance.now();
    const maxDuration = intensity === 'win' ? 2300 : 1400;

    const frame = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      let alive = 0;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.26;
        p.vx *= 0.985;
        p.rotation += p.vr;
        p.alpha = Math.max(0, 1 - elapsed / maxDuration);

        if (p.alpha > 0.02 && p.y < height + 40) {
          alive++;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3);
          ctx.restore();
        }
      }

      if (alive > 0 && elapsed < maxDuration) {
        rafId = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, width, height);
    };
  }, [triggerKey, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      aria-hidden="true"
    />
  );
};
