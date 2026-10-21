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
import { CardCornerWatermark } from './AmLogoWatermark';
import { liquidPointerHandlers } from '../utils/liquidGlass';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-6 bg-slate-950/90 animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        data-testid="welcome-modal-card"
        {...liquidPointerHandlers}
        className="relative w-full max-w-[348px] sm:max-w-lg max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl glass-panel animate-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <CardCornerWatermark />

        {/* Top Header Bar */}
        <div className="relative z-10 px-4 sm:px-6 pt-3.5 sm:pt-5 pb-2 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/favicon.png"
              alt=""
              aria-hidden="true"
              className="w-5 h-5 rounded-full object-cover border border-white/10 shrink-0"
            />
            <span className="text-[11px] sm:text-xs font-mono text-[#2dd4bf] tracking-wide truncate">
              AM Preset Finder · Beri Dukungan
            </span>
          </div>

          <button
            type="button"
            {...liquidPointerHandlers}
            onClick={onClose}
            aria-label="Tutup popup selamat datang"
            className="liquid-btn-secondary w-8 h-8 sm:w-9 sm:h-9 rounded-xl active:scale-95 text-[#94a3b8] hover:text-[#f1f5f9] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="relative z-10 px-4 sm:px-6 py-2 sm:py-3 flex-1 overflow-y-auto touch-scroll-smooth flex flex-col gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-2">
            <h2
              id="welcome-modal-title"
              className="text-base sm:text-2xl font-bold text-[#f1f5f9] font-display tracking-tight leading-snug [text-wrap:balance]"
            >
              Selamat Datang di{' '}
              <span className="text-liquid-gradient">AM Preset Finder</span>
            </h2>
            <p className="text-[11px] sm:text-sm text-[#94a3b8] leading-relaxed">
              Ekstrak tautan preset <strong className="text-[#f1f5f9]">Alight Motion</strong> (5MB, XML &
              Kode QR) dari video serta komentar{' '}
              <strong className="text-[#f1f5f9]">TikTok, Instagram, dan YouTube</strong> secara instan.
            </p>
          </div>

          {/* 3 Highlight Pillars */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
            <div
              {...liquidPointerHandlers}
              className="glass-subpanel rounded-xl p-2 sm:p-3 flex flex-col items-center sm:items-start justify-center text-center sm:text-left gap-1"
            >
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold text-[#2dd4bf] whitespace-nowrap">
                <Sparkles
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>5MB & XML</span>
              </div>
              <p className="hidden sm:block text-[11px] text-[#94a3b8] leading-relaxed">
                Otomatis meresolve tautan pendek ke format asli Alight Motion.
              </p>
            </div>

            <div
              {...liquidPointerHandlers}
              className="glass-subpanel rounded-xl p-2 sm:p-3 flex flex-col items-center sm:items-start justify-center text-center sm:text-left gap-1"
            >
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold text-[#38bdf8] whitespace-nowrap">
                <MessageSquareText
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>Komentar</span>
              </div>
              <p className="hidden sm:block text-[11px] text-[#94a3b8] leading-relaxed">
                Deteksi tautan preset hingga ke balasan komentar kreator.
              </p>
            </div>

            <div
              {...liquidPointerHandlers}
              className="glass-subpanel rounded-xl p-2 sm:p-3 flex flex-col items-center sm:items-start justify-center text-center sm:text-left gap-1"
            >
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold text-[#10b981] whitespace-nowrap">
                <QrCode className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Dekode QR</span>
              </div>
              <p className="hidden sm:block text-[11px] text-[#94a3b8] leading-relaxed">
                Pindai kode QR langsung dari frame video maupun gambar galeri.
              </p>
            </div>
          </div>

          {/* Developer & Beri Dukungan Spotlight Box */}
          <div
            {...liquidPointerHandlers}
            className="glass-subpanel rounded-xl p-3 sm:p-4 flex flex-col gap-1.5 sm:gap-2"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
              <span className="font-semibold text-[#f1f5f9] truncate">
                Dukung Pengembangan Aplikasi
              </span>
              <span className="font-mono text-[#2dd4bf] whitespace-nowrap shrink-0">
                Dimas Kurniawan
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#94a3b8] leading-relaxed">
              Aplikasi ini gratis untuk komunitas kreator. Apresiasi & dukung
              pengembang melalui <strong className="text-[#f1f5f9]">SociaBuzz Tribe</strong>.
            </p>
            <div className="pt-1 border-t border-white/[0.08] flex items-center justify-between sm:justify-start gap-2 sm:gap-3 text-[11px] text-[#94a3b8]">
              <a
                href={TIKTOK_CONTACT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#2dd4bf] transition-colors inline-flex items-center gap-1 font-mono truncate"
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
                className="hover:text-[#38bdf8] transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>Saluran WhatsApp</span>
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        {/* Sticky Bottom CTA Footer */}
        <div className="relative z-10 px-4 sm:px-6 pt-2 pb-4 sm:pb-5 border-t border-white/[0.08] bg-[#111317]/65 grid grid-cols-2 sm:flex items-center gap-2 sm:gap-2.5 shrink-0">
          <a
            href={SOCIABUZZ_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="welcome-support-button"
            {...liquidPointerHandlers}
            className="liquid-btn-primary sm:flex-1 min-h-[42px] sm:min-h-[46px] px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl active:scale-95 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Heart
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2dd4bf] shrink-0"
              aria-hidden="true"
            />
            <span>Beri Dukungan</span>
            <ExternalLink
              className="w-3.5 h-3.5 hidden sm:inline text-[#38bdf8] shrink-0"
              aria-hidden="true"
            />
          </a>

          <button
            type="button"
            onClick={onClose}
            data-testid="welcome-continue-button"
            {...liquidPointerHandlers}
            className="liquid-btn-secondary min-h-[42px] sm:min-h-[46px] px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl active:scale-95 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>
              Mulai <span className="hidden sm:inline">Cari </span>Preset
            </span>
            <ArrowRight
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2dd4bf] shrink-0"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </div>
  );
};
