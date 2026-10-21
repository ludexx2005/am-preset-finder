import React, { useEffect, useState } from 'react';
import { AmLogoSvg } from './AmLogoWatermark';

const INITIAL_STATUS_MESSAGES = [
  'Memuat modul ekstraktor 5MB & XML...',
  'Menyiapkan pemindai QR Code...',
  'Menghubungkan mesin pencari preset & komentar...',
  'Siap mengekstrak tautan preset Alight Motion!',
] as const;

const SEARCH_OVERLAY_MESSAGES = [
  'Memuat modul ekstraktor 5MB & XML...',
  'Memindai deskripsi, caption & suara video...',
  'Menyiapkan pemindai QR Code...',
  'Mengekstrak tautan preset Alight Motion...',
] as const;

interface InitialLoadingScreenProps {
  /** Total duration in ms before starting the smooth fade-out (default: 1650ms, within 1.5 - 2s) */
  durationMs?: number;
  onFinished?: () => void;
}

/**
 * Full-screen Initial Loading Screen (#0b0f19 dark theme with #00e5ff & #3b82f6 accents).
 * Displays for 1.5 - 2 seconds on initial page load with a glowing spinner, pulsing logo,
 * dynamic status text, smooth progress bar, and smooth fade-out transition.
 */
export const InitialLoadingScreen: React.FC<InitialLoadingScreenProps> = ({
  durationMs = 1650,
  onFinished,
}) => {
  const [progress, setProgress] = useState<number>(8);
  const [statusIndex, setStatusIndex] = useState<number>(0);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isUnmounted, setIsUnmounted] = useState<boolean>(false);

  useEffect(() => {
    const startTime = performance.now();
    let rafId: number | null = null;

    const updateProgress = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(1, elapsed / durationMs);
      // Smooth ease-out curve from 8% to 100%
      const easedPercent = Math.round(8 + 92 * (1 - Math.pow(1 - ratio, 2.2)));
      setProgress(easedPercent);

      const nextIdx = Math.min(
        INITIAL_STATUS_MESSAGES.length - 1,
        Math.floor(ratio * INITIAL_STATUS_MESSAGES.length)
      );
      setStatusIndex(nextIdx);

      if (ratio < 1) {
        rafId = window.requestAnimationFrame(updateProgress);
      }
    };

    rafId = window.requestAnimationFrame(updateProgress);

    const fadeTimer = window.setTimeout(() => {
      setProgress(100);
      setStatusIndex(INITIAL_STATUS_MESSAGES.length - 1);
      setIsFadingOut(true);
    }, durationMs);

    const unmountTimer = window.setTimeout(() => {
      setIsUnmounted(true);
      onFinished?.();
    }, durationMs + 320);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.clearTimeout(fadeTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [durationMs, onFinished]);

  if (isUnmounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Memuat aplikasi AM Preset Finder"
      data-testid="initial-loading-screen"
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 bg-[#0b0f19] text-[#f1f5f9] select-none transition-opacity duration-300 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Pure-CSS Radial Glow Background (Lightweight 60fps, Zero Heavy Blur Filter) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(0,229,255,0.14)_0%,rgba(59,130,246,0.08)_32%,transparent_68%)]"
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center space-y-6">
        {/* Glowing Dual-Ring Spinner + Pulsing Logo Centerpiece */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
          {/* Outer Subtle Radial Halo */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.22)_0%,rgba(59,130,246,0.10)_50%,transparent_75%)]"
          />

          {/* Outer Rotating Glowing Cyan/Blue Ring */}
          <div
            aria-hidden="true"
            className="w-full h-full rounded-full border-[3px] border-[#3b82f6]/20 border-t-[#00e5ff] border-r-[#3b82f6] animate-spin shadow-[0_0_24px_rgba(0,229,255,0.35)]"
          />

          {/* Inner Counter-Rotating Accent Ring */}
          <div
            aria-hidden="true"
            style={{ animationDirection: 'reverse', animationDuration: '1.8s' }}
            className="absolute inset-2.5 rounded-full border-2 border-[#00e5ff]/15 border-b-[#00e5ff] border-l-[#3b82f6] animate-spin"
          />

          {/* Pulsing Core Logo */}
          <div className="absolute inset-5 rounded-full bg-[#0b0f19]/95 border border-[#00e5ff]/30 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_0_18px_rgba(0,229,255,0.25)] animate-loading-logo-pulse">
            <AmLogoSvg className="w-9 h-9 sm:w-10 sm:h-10" />
          </div>
        </div>

        {/* Title & Dynamic Cycling Status Text */}
        <div className="space-y-2 w-full">
          <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white">
            <span className="bg-gradient-to-r from-[#00e5ff] via-[#38bdf8] to-[#3b82f6] bg-clip-text text-transparent">
              AM Preset Finder
            </span>
          </h2>

          <div className="min-h-[24px] flex items-center justify-center">
            <p
              key={statusIndex}
              data-testid="initial-loading-status-text"
              className="text-xs sm:text-sm text-[#94a3b8] font-medium animate-state-pop"
            >
              {INITIAL_STATUS_MESSAGES[statusIndex]}
            </p>
          </div>
        </div>

        {/* Smooth Glowing Progress Bar */}
        <div className="w-full max-w-[280px] space-y-2">
          <div className="w-full h-2 rounded-full bg-slate-900/95 border border-[#00e5ff]/20 overflow-hidden p-0.5">
            <div
              data-testid="initial-loading-progress-bar"
              style={{ width: `${progress}%` }}
              className="h-full rounded-full bg-gradient-to-r from-[#00e5ff] via-[#38bdf8] to-[#3b82f6] shadow-[0_0_12px_rgba(0,229,255,0.65)] transition-[width] duration-150 ease-out"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#94a3b8]">
            <span className="text-[#00e5ff]">5MB · XML · QR Scanner</span>
            <span className="text-[#3b82f6] font-semibold">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SearchLoadingOverlayProps {
  isOpen: boolean;
  /** Optional custom status text from the active scanner (e.g. step name or query) */
  customStatusText?: string;
  /** Optional subtitle or target label being extracted */
  targetLabel?: string;
}

/**
 * Overlay Loading Screen displayed when the user clicks "Cari" / "Cari Preset" to extract preset links.
 * Uses #0b0f19 dark theme with #00e5ff and #3b82f6 glowing spinner, pulsing logo, dynamic status text,
 * and smooth progress bar.
 */
export const SearchLoadingOverlay: React.FC<SearchLoadingOverlayProps> = ({
  isOpen,
  customStatusText,
  targetLabel,
}) => {
  const [statusIndex, setStatusIndex] = useState<number>(0);
  const [progress, setProgress] = useState<number>(15);

  useEffect(() => {
    if (!isOpen) {
      setStatusIndex(0);
      setProgress(15);
      return;
    }

    const statusInterval = window.setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % SEARCH_OVERLAY_MESSAGES.length);
    }, 650);

    const progressInterval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        return Math.min(92, prev + Math.max(3, Math.round((95 - prev) * 0.18)));
      });
    }, 180);

    return () => {
      window.clearInterval(statusInterval);
      window.clearInterval(progressInterval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const activeMessage =
    customStatusText && customStatusText.trim()
      ? customStatusText
      : SEARCH_OVERLAY_MESSAGES[statusIndex];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Mengekstrak tautan preset Alight Motion"
      data-testid="search-loading-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b0f19]/92 animate-modal-backdrop"
    >
      {/* Ambient Radial Glow Behind Card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.14)_0%,rgba(59,130,246,0.08)_35%,transparent_70%)]"
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#0b0f19] border border-[#00e5ff]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_50px_rgba(0,0,0,0.85)] p-6 sm:p-7 flex flex-col items-center text-center space-y-5 animate-modal-panel overflow-hidden">
        {/* Top Corner Subtle Radial Highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,229,255,0.12)_0%,rgba(59,130,246,0.06)_45%,transparent_80%)]"
        />

        {/* Glowing Dual-Ring Spinner + Pulsing Logo */}
        <div className="relative z-10 w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.22)_0%,rgba(59,130,246,0.10)_55%,transparent_75%)]"
          />

          <div
            aria-hidden="true"
            className="w-full h-full rounded-full border-[3px] border-[#3b82f6]/20 border-t-[#00e5ff] border-r-[#3b82f6] animate-spin shadow-[0_0_20px_rgba(0,229,255,0.35)]"
          />

          <div
            aria-hidden="true"
            style={{ animationDirection: 'reverse', animationDuration: '1.7s' }}
            className="absolute inset-2 rounded-full border-2 border-[#00e5ff]/15 border-b-[#00e5ff] border-l-[#3b82f6] animate-spin"
          />

          <div className="absolute inset-4 rounded-full bg-[#0b0f19] border border-[#00e5ff]/30 flex items-center justify-center shadow-[0_0_14px_rgba(0,229,255,0.25)] animate-loading-logo-pulse">
            <AmLogoSvg className="w-8 h-8" />
          </div>
        </div>

        {/* Title & Dynamic Cycling Status Text */}
        <div className="relative z-10 space-y-1.5 w-full min-w-0">
          <div className="text-xs font-mono uppercase tracking-wider text-[#00e5ff]">
            Ekstraktor Preset Aktif
          </div>

          <h3 className="text-lg sm:text-xl font-bold font-display tracking-tight text-white">
            <span className="bg-gradient-to-r from-[#00e5ff] via-[#38bdf8] to-[#3b82f6] bg-clip-text text-transparent">
              AM Preset Finder
            </span>
          </h3>

          {targetLabel && (
            <p className="text-xs font-mono text-[#3b82f6] truncate max-w-full px-2">
              {targetLabel}
            </p>
          )}

          <div className="min-h-[22px] pt-1 flex items-center justify-center">
            <p
              key={activeMessage}
              data-testid="search-overlay-status-text"
              className="text-xs sm:text-sm text-[#e2e8f0] font-medium animate-state-pop"
            >
              {activeMessage}
            </p>
          </div>
        </div>

        {/* Smooth Progress Bar */}
        <div className="relative z-10 w-full space-y-2">
          <div className="w-full h-2 rounded-full bg-slate-900/95 border border-[#00e5ff]/25 overflow-hidden p-0.5">
            <div
              style={{ width: `${progress}%` }}
              className="h-full rounded-full bg-gradient-to-r from-[#00e5ff] via-[#38bdf8] to-[#3b82f6] shadow-[0_0_12px_rgba(0,229,255,0.65)] transition-[width] duration-200 ease-out"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#94a3b8]">
            <span className="text-[#00e5ff]">Mengekstrak Tautan...</span>
            <span className="text-[#3b82f6] font-semibold">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
