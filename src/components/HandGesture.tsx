import React from 'react';
import { HandNumber } from '../types/game';

interface HandGestureProps {
  value: HandNumber | 0;
  side?: 'batter' | 'bowler' | 'neutral';
  size?: number;
  mirror?: boolean;
  className?: string;
}

/**
 * Crisp custom SVG hand cricket gestures:
 * 0 = Ready closed fist
 * 1 = Index finger up
 * 2 = Index + Middle (V-sign)
 * 3 = Index + Middle + Ring
 * 4 = Four fingers up, thumb tucked
 * 5 = Open palm, all 5 fingers
 * 6 = Classic Hand Cricket Thumb-Up (fist + thumb extended)
 */
export const HandGesture: React.FC<HandGestureProps> = ({
  value,
  side = 'neutral',
  size = 88,
  mirror = false,
  className = '',
}) => {
  const accentStroke =
    side === 'batter'
      ? '#F5C451'
      : side === 'bowler'
        ? '#34D399'
        : '#CBD5E1';

  const cuffFill =
    side === 'batter'
      ? '#B45309'
      : side === 'bowler'
        ? '#047857'
        : '#1E293B';

  const skinFill = '#F4D2B5';
  const skinShadow = '#E2B48E';
  const outline = '#10241B';

  // Finger visibility flags
  const thumbUp = value === 5 || value === 6;
  const indexUp = value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
  const middleUp = value === 2 || value === 3 || value === 4 || value === 5;
  const ringUp = value === 3 || value === 4 || value === 5;
  const pinkyUp = value === 4 || value === 5;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
    >
      {/* Wrist & Stadium Cuff */}
      <rect
        x="38"
        y="94"
        width="44"
        height="20"
        rx="6"
        fill={cuffFill}
        stroke={accentStroke}
        strokeWidth="2.5"
      />
      <line x1="45" y1="101" x2="75" y2="101" stroke={accentStroke} strokeWidth="2" strokeLinecap="round" opacity="0.7" />

      {/* Extended Fingers */}
      {/* Index Finger */}
      {indexUp && (
        <rect
          x="35"
          y="16"
          width="13"
          height="46"
          rx="6.5"
          fill={skinFill}
          stroke={outline}
          strokeWidth="2.6"
        />
      )}

      {/* Middle Finger */}
      {middleUp && (
        <rect
          x="50"
          y="10"
          width="13"
          height="52"
          rx="6.5"
          fill={skinFill}
          stroke={outline}
          strokeWidth="2.6"
        />
      )}

      {/* Ring Finger */}
      {ringUp && (
        <rect
          x="65"
          y="15"
          width="13"
          height="47"
          rx="6.5"
          fill={skinFill}
          stroke={outline}
          strokeWidth="2.6"
        />
      )}

      {/* Pinky Finger */}
      {pinkyUp && (
        <rect
          x="80"
          y="26"
          width="11.5"
          height="38"
          rx="5.75"
          fill={skinFill}
          stroke={outline}
          strokeWidth="2.6"
        />
      )}

      {/* Palm Base */}
      <rect
        x="33"
        y="50"
        width="57"
        height="48"
        rx="16"
        fill={skinFill}
        stroke={outline}
        strokeWidth="2.6"
      />

      {/* Curled Finger Knuckles (when folded) */}
      {!indexUp && (
        <rect x="35" y="47" width="13.5" height="22" rx="6.5" fill={skinShadow} stroke={outline} strokeWidth="2.4" />
      )}
      {!middleUp && (
        <rect x="49.5" y="47" width="13.5" height="23" rx="6.5" fill={skinShadow} stroke={outline} strokeWidth="2.4" />
      )}
      {!ringUp && (
        <rect x="64" y="47" width="13.5" height="22" rx="6.5" fill={skinShadow} stroke={outline} strokeWidth="2.4" />
      )}
      {!pinkyUp && (
        <rect x="78" y="49" width="12" height="20" rx="6" fill={skinShadow} stroke={outline} strokeWidth="2.4" />
      )}

      {/* Thumb */}
      {thumbUp ? (
        // Extended thumb (for 5 open palm or 6 thumb-up)
        <path
          d={
            value === 6
              ? 'M34 62 C22 52 16 32 23 21 C29 13 38 19 39 33 L42 54 Z'
              : 'M34 72 C20 64 13 50 18 40 C23 32 32 37 36 49 L40 66 Z'
          }
          fill={skinFill}
          stroke={outline}
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
      ) : (
        // Tucked thumb across palm
        <path
          d="M32 63 C32 58 37 56 44 58 L59 64 C64 66 64 73 58 75 L41 75 C35 75 32 70 32 63 Z"
          fill={skinFill}
          stroke={outline}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}

      {/* Palm crease detail */}
      <path
        d="M46 82 Q60 76 74 82"
        stroke={outline}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.22"
      />
    </svg>
  );
};
