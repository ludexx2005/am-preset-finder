import React, { useEffect } from 'react';
import {
  X,
  Heart,
  ExternalLink,
  Sparkles,
  QrCode,
  MessageSquareText,
  ArrowRight,
} from 'lucide-react';
import {
  WHATSAPP_CHANNEL_URL,
  TIKTOK_CONTACT_URL,
} from './LegalModal';

export const SOCIABUZZ_SUPPORT_URL =
  'https://sociabuzz.com/ludex_neuvilette/tribe';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      data-testid="welcome-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        data-testid="welcome-modal-card"
        className="relative w-full max-w-[348px] sm:max-w-lg max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl glass-panel border border-white/15 shadow-2xl animate-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Liquid Glass Decorative Top Glow */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-64 sm:w-80 h-36 sm:h-44 rounded-full bg-gradient-to-b from-[#00E5A3]/25 via-[#2DD4BF]/10 to-transparent blur-2xl"
          aria-hidden="true"
        />

        {/* Top Header Bar (Flexbox) */}
        <div className="relative z-10 px-4 sm:px-6 pt-3.5 sm:pt-5 pb-2 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] sm:text-xs font-mono text-[#00E5A3] tracking-wide truncate">
            AM Preset Finder · Beri Dukungan
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup popup selamat datang"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Modal Body (Flexbox + Flexible CSS Grid) */}
        <div className="relative z-10 px-4 sm:px-6 py-2 sm:py-3 flex-1 overflow-y-auto touch-scroll-smooth flex flex-col gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-2">
            <h2
              id="welcome-modal-title"
              className="text-base sm:text-2xl font-bold text-white font-display tracking-tight leading-snug [text-wrap:balance]"
            >
              Selamat Datang di AM Preset Finder
            </h2>
            <p className="text-[11px] sm:text-sm text-slate-300 leading-relaxed">
              Ekstrak tautan preset <strong>Alight Motion</strong> (5MB, XML &
              Kode QR) dari video serta komentar{' '}
              <strong>TikTok, Instagram, dan YouTube</strong> secara instan.
            </p>
          </div>

          {/* 3 Highlight Pillars — Flexible 3-Column CSS Grid on Mobile & Desktop */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
            <div className="glass-subpanel rounded-xl p-2 sm:p-3 flex flex-col items-center sm:items-start justify-center text-center sm:text-left gap-1">
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold text-[#00E5A3] whitespace-nowrap">
                <Sparkles
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>5MB & XML</span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-400 leading-relaxed">
                Otomatis meresolve tautan pendek ke format asli Alight Motion.
              </p>
            </div>

            <div className="glass-subpanel rounded-xl p-2 sm:p-3 flex flex-col items-center sm:items-start justify-center text-center sm:text-left gap-1">
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold text-[#00E5A3] whitespace-nowrap">
                <MessageSquareText
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>Komentar</span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-400 leading-relaxed">
                Deteksi tautan preset hingga ke balasan komentar kreator.
              </p>
            </div>

            <div className="glass-subpanel rounded-xl p-2 sm:p-3 flex flex-col items-center sm:items-start justify-center text-center sm:text-left gap-1">
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold text-[#00E5A3] whitespace-nowrap">
                <QrCode className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Dekode QR</span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-400 leading-relaxed">
                Pindai kode QR langsung dari frame video maupun gambar galeri.
              </p>
            </div>
          </div>

          {/* Developer & 'Beri Dukungan' (SociaBuzz Tribe) Spotlight Box */}
          <div className="glass-subpanel rounded-xl p-3 sm:p-4 border border-[#00E5A3]/30 bg-gradient-to-br from-[#00E5A3]/[0.08] via-slate-900/70 to-slate-950/85 flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
              <span className="font-semibold text-white truncate">
                Dukung Pengembangan Aplikasi
              </span>
              <span className="font-mono text-[#00E5A3] whitespace-nowrap shrink-0">
                Dimas Kurniawan
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
              Aplikasi ini gratis untuk komunitas kreator. Apresiasi & dukung
              pengembang melalui <strong>SociaBuzz Tribe</strong>.
            </p>
            <div className="pt-1 border-t border-white/[0.08] flex items-center justify-between sm:justify-start gap-2 sm:gap-3 text-[11px] text-slate-400">
              <a
                href={TIKTOK_CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#00E5A3] transition-colors inline-flex items-center gap-1 font-mono truncate"
              >
                <span>@ludexkurniawan</span>
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <a
                href={WHATSAPP_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#00E5A3] transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>Saluran WhatsApp</span>
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        {/* Sticky Bottom CTA Footer: Flexible 2-Column Grid on Mobile, Flexbox on Desktop */}
        <div className="relative z-10 px-4 sm:px-6 pt-2 pb-4 sm:pb-5 border-t border-white/[0.06] bg-slate-950/40 grid grid-cols-2 sm:flex items-center gap-2 sm:gap-2.5 shrink-0">
          <a
            href={SOCIABUZZ_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="welcome-support-button"
            className="sm:flex-1 min-h-[42px] sm:min-h-[46px] px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#00E5A3] text-slate-950 hover:bg-[#00cca0] font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Heart
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current shrink-0"
              aria-hidden="true"
            />
            <span>Beri Dukungan</span>
            <ExternalLink
              className="w-3.5 h-3.5 hidden sm:inline shrink-0"
              aria-hidden="true"
            />
          </a>

          <button
            type="button"
            onClick={onClose}
            data-testid="welcome-continue-button"
            className="min-h-[42px] sm:min-h-[46px] px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-slate-800/95 hover:bg-slate-700 border border-white/10 text-slate-100 hover:text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>
              Mulai <span className="hidden sm:inline">Cari </span>Preset
            </span>
            <ArrowRight
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00E5A3] shrink-0"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </div>
  );
};
