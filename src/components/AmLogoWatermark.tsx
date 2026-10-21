import React, { useId } from 'react';

interface AmLogoSvgProps {
  className?: string;
}

/**
 * Custom vector SVG reproduction of the AM Preset Finder logo:
 * - Magnifying glass lens & 45-degree handle
 * - Alight Motion flowing S-wave / crescent curve inside the lens (Teal-Emerald #10b981 / #2dd4bf to Cyan-Blue #38bdf8 / #0284c7)
 * - 4-pointed sparkle star in the center of the lens
 */
export const AmLogoSvg: React.FC<AmLogoSvgProps> = ({
  className = 'w-full h-full',
}) => {
  const uid = useId().replace(/:/g, '');
  const ringGradId = `am-ring-${uid}`;
  const handleGradId = `am-handle-${uid}`;
  const waveOuterGradId = `am-wave-outer-${uid}`;
  const waveInnerGradId = `am-wave-inner-${uid}`;
  const starGradId = `am-star-${uid}`;

  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Magnifying Glass Ring Gradient: Teal-Emerald on top-left to brushed silver-slate on right/bottom */}
        <linearGradient
          id={ringGradId}
          x1="48"
          y1="44"
          x2="176"
          y2="172"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="28%" stopColor="#2dd4bf" />
          <stop offset="58%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Handle Gradient */}
        <linearGradient
          id={handleGradId}
          x1="154"
          y1="154"
          x2="206"
          y2="206"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>

        {/* Alight Motion Wave Primary Gradient (Teal-Emerald to Cyan-Blue) */}
        <linearGradient
          id={waveOuterGradId}
          x1="34"
          y1="142"
          x2="164"
          y2="76"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="32%" stopColor="#10b981" />
          <stop offset="65%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Alight Motion Wave Highlight Crescent (Soft Cyan-Blue to Teal) */}
        <linearGradient
          id={waveInnerGradId}
          x1="60"
          y1="96"
          x2="158"
          y2="128"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* 4-Point Center Sparkle Star Gradient */}
        <linearGradient
          id={starGradId}
          x1="102"
          y1="92"
          x2="134"
          y2="124"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
      </defs>

      {/* Magnifying Glass Handle */}
      <path
        d="M156 156L198 198"
        stroke={`url(#${handleGradId})`}
        strokeWidth="22"
        strokeLinecap="round"
      />
      <path
        d="M158 158L196 196"
        stroke="#f1f5f9"
        strokeOpacity="0.28"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Magnifying Glass Outer Rim (with subtle gap on left for wave entry) */}
      <path
        d="M66 82C77 57 102 42 130 45C165 49 190 80 186 115C182 150 151 175 116 171C92 168 72 153 63 132"
        stroke={`url(#${ringGradId})`}
        strokeWidth="16"
        strokeLinecap="round"
      />

      {/* Alight Motion Flowing Wave + Inner Crescent */}
      <path
        d="M28 144C42 152 54 142 62 120C70 98 78 86 91 86C104 86 111 103 119 121C127 139 143 145 156 132C169 119 169 92 152 77C137 64 114 64 98 76C114 58 143 58 161 75C181 94 180 128 159 146C140 162 114 156 102 134C94 119 89 107 82 107C75 107 70 120 62 138C52 159 36 162 28 144Z"
        fill={`url(#${waveOuterGradId})`}
      />

      {/* Secondary Luminous Wave Highlight Layer */}
      <path
        d="M42 146C51 144 58 132 65 115C72 97 79 90 89 90C99 90 106 104 114 120C123 138 141 142 153 129C164 117 163 94 148 80C136 69 117 68 103 76C117 63 141 64 156 78C173 94 172 123 155 138C139 152 117 146 107 126C99 111 94 102 87 102C80 102 74 114 66 131C58 147 48 150 42 146Z"
        fill={`url(#${waveInnerGradId})`}
        fillOpacity="0.82"
      />

      {/* 4-Pointed Sparkle Star in the Center of the Lens */}
      <path
        d="M118 84C119.8 97.5 122.5 100.2 136 102C122.5 103.8 119.8 106.5 118 120C116.2 106.5 113.5 103.8 100 102C113.5 100.2 116.2 97.5 118 84Z"
        fill={`url(#${starGradId})`}
      />
    </svg>
  );
};

/**
 * 2a) Hero / Main View Large Background Watermark
 * Positioned on the right/center behind the main hero heading with:
 * opacity: 0.05, filter: grayscale(20%) contrast(120%), pointer-events: none, and radial mask fade.
 */
export const HeroLogoWatermark: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 overflow-hidden z-0"
    >
      <div
        data-testid="hero-logo-watermark"
        className="hero-logo-watermark select-none"
      >
        <AmLogoSvg className="w-full h-full" />
      </div>
    </div>
  );
};

/**
 * 2b) Card Bottom-Right Corner Watermark
 * Positioned at right: -20px; bottom: -20px; opacity: 0.04; pointer-events: none; overflow: hidden
 */
export const CardCornerWatermark: React.FC<{ sizeClass?: string }> = ({
  sizeClass = 'w-44 h-44 sm:w-52 sm:h-52',
}) => {
  return (
    <div
      aria-hidden="true"
      data-testid="card-corner-watermark"
      className={`card-corner-watermark select-none ${sizeClass}`}
    >
      <AmLogoSvg className="w-full h-full" />
    </div>
  );
};
