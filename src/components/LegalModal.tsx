import React, { useEffect, useState, useRef } from 'react';
import { X, ExternalLink, Shield, FileText, User } from 'lucide-react';
import { CardCornerWatermark } from './AmLogoWatermark';
import { liquidPointerHandlers } from '../utils/liquidGlass';

export type LegalDocType = 'tos' | 'privacy';

interface LegalModalProps {
  activeDoc: LegalDocType | null;
  onSelectDoc: (doc: LegalDocType) => void;
  onClose: () => void;
}

export const WHATSAPP_CHANNEL_URL =
  'https://whatsapp.com/channel/0029VaeS7DaCxoAsiwTfcz2P';
export const TIKTOK_CONTACT_URL = 'https://www.tiktok.com/@ludexkurniawan';

export const LegalModal: React.FC<LegalModalProps> = ({
  activeDoc,
  onSelectDoc,
  onClose,
}) => {
  const [isSlidingDoc, setIsSlidingDoc] = useState(false);
  const docTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeDoc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDoc, onClose]);

  useEffect(() => {
    return () => {
      if (docTimerRef.current !== null) {
        window.clearTimeout(docTimerRef.current);
      }
    };
  }, []);

  if (!activeDoc) return null;

  const handleSwitchDoc = (next: LegalDocType) => {
    setIsSlidingDoc(true);
    if (docTimerRef.current !== null) {
      window.clearTimeout(docTimerRef.current);
    }
    docTimerRef.current = window.setTimeout(() => {
      setIsSlidingDoc(false);
    }, 300);
    onSelectDoc(next);
  };

  const activeDocIdx = activeDoc === 'privacy' ? 1 : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-6 bg-slate-950/90 animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        {...liquidPointerHandlers}
        className="w-full max-w-2xl rounded-2xl glass-panel overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[85vh] animate-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <CardCornerWatermark />

        {/* Modal Header */}
        <div className="relative z-10 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
          <div
            {...liquidPointerHandlers}
            className="p-1 rounded-xl glass-subpanel flex-1 sm:flex-initial"
          >
            <div className="relative grid grid-cols-2 items-center">
              <div
                aria-hidden="true"
                style={{
                  width: 'calc(100% / 2)',
                  transform: `translate3d(calc(${activeDocIdx} * 100%), 0, 0) scale(${
                    isSlidingDoc ? 1.02 : 1
                  })`,
                }}
                className="sliding-liquid-pill absolute inset-y-0 left-0 rounded-lg z-0"
              />
              <button
                type="button"
                {...liquidPointerHandlers}
                onClick={() => handleSwitchDoc('tos')}
                className={`relative z-10 min-h-[36px] px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-transparent active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeDoc === 'tos'
                    ? 'text-[#f1f5f9]'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0 text-[#2dd4bf]" aria-hidden="true" />
                <span>Terms of Service</span>
              </button>
              <button
                type="button"
                {...liquidPointerHandlers}
                onClick={() => handleSwitchDoc('privacy')}
                className={`relative z-10 min-h-[36px] px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-transparent active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeDoc === 'privacy'
                    ? 'text-[#f1f5f9]'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0 text-[#38bdf8]" aria-hidden="true" />
                <span>Privacy Policy</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            {...liquidPointerHandlers}
            onClick={onClose}
            aria-label="Tutup dokumen legal"
            className="liquid-btn-secondary w-9 h-9 rounded-xl active:scale-95 text-[#94a3b8] hover:text-[#f1f5f9] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div
          key={activeDoc}
          className="relative z-10 p-4 sm:p-6 overflow-y-auto touch-scroll-smooth space-y-5 text-sm text-[#f1f5f9] leading-relaxed animate-state-enter"
        >
          {activeDoc === 'tos' ? (
            <>
              <div>
                <h2
                  id="legal-modal-title"
                  className="text-xl font-bold text-[#f1f5f9] font-display"
                >
                  Terms of Service (Ketentuan Layanan)
                </h2>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Berlaku efektif untuk pengguna web AM Preset Finder
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">
                  1. Deskripsi Layanan
                </h3>
                <p className="text-xs sm:text-sm text-[#94a3b8]">
                  AM Preset Finder adalah alat bantu berbasis web untuk mendeteksi, memfilter, dan mengekstrak tautan preset Alight Motion (format 5MB <code className="text-[#2dd4bf]">alight.link</code> / <code className="text-[#38bdf8]">alightcreative.com</code>, file XML Google Drive / MediaFire, serta kode QR di dalam video atau tangkapan layar) dari tautan publik TikTok, Instagram, dan YouTube.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">
                  2. Penggunaan yang Diizinkan & Hak Cipta Kreator
                </h3>
                <p className="text-xs sm:text-sm text-[#94a3b8]">
                  Seluruh preset, video, dan karya kreatif yang diekstrak melalui layanan ini tetap menjadi hak milik masing-masing kreator aslinya. Pengguna diharapkan tetap memberikan apresiasi dan kredit kepada kreator preset saat menggunakan preset tersebut.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">
                  3. Profil Pengembang & Hak Cipta Aplikasi
                </h3>
                <p className="text-xs sm:text-sm text-[#94a3b8]">
                  Aplikasi web AM Preset Finder dirancang dan dikembangkan oleh{' '}
                  <strong className="text-[#f1f5f9]">Dimas Kurniawan</strong>. Seluruh antarmuka dan kode sistem aplikasi dilindungi hak cipta.
                </p>
              </div>

              <div
                {...liquidPointerHandlers}
                className="p-4 rounded-xl glass-subpanel space-y-2.5"
              >
                <h3 className="text-sm font-semibold text-[#f1f5f9] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#2dd4bf]" aria-hidden="true" />
                  <span>4. Kontak & Dukungan Resmi</span>
                </h3>
                <p className="text-xs sm:text-sm text-[#94a3b8]">
                  Jika Anda memiliki pertanyaan terkait Ketentuan Layanan, pelaporan tautan, atau masukan pengembangan fitur, silakan hubungi pengembang melalui kontak resmi berikut:
                </p>
                <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
                  <div className="text-[#94a3b8]">
                    Pengembang:{' '}
                    <strong className="text-[#f1f5f9]">Dimas Kurniawan</strong>
                  </div>
                  <span aria-hidden="true" className="hidden sm:inline text-[#94a3b8]">
                    ·
                  </span>
                  <a
                    href={TIKTOK_CONTACT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2dd4bf] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <span>TikTok @ludexkurniawan</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                  <span aria-hidden="true" className="hidden sm:inline text-[#94a3b8]">
                    ·
                  </span>
                  <a
                    href={WHATSAPP_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#38bdf8] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <span>Saluran WhatsApp</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2
                  id="legal-modal-title"
                  className="text-xl font-bold text-[#f1f5f9] font-display"
                >
                  Privacy Policy (Kebijakan Privasi)
                </h2>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Komitmen perlindungan data dan privasi pengguna AM Preset Finder
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">
                  1. Penyimpanan Data Lokal (LocalStorage)
                </h3>
                <p className="text-xs sm:text-sm text-[#94a3b8]">
                  Riwayat pencarian dan ekstraksi preset Anda disimpan secara eksklusif di penyimpanan lokal peramban (<code className="text-[#2dd4bf]">localStorage</code>) pada perangkat Anda sendiri. Kami tidak menyimpan riwayat ekstraksi pribadi Anda di basis data eksternal, dan Anda dapat menghapusnya kapan saja melalui tombol <strong className="text-[#f1f5f9]">Hapus Riwayat</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">
                  2. Pemindaian Gambar & Frame Video QR
                </h3>
                <p className="text-xs sm:text-sm text-[#94a3b8]">
                  Gambar tangkapan layar kode QR yang Anda unggah dari galeri diproses secara langsung di peramban menggunakan HTML5 Canvas dan pustaka <code className="text-[#2dd4bf]">jsQR</code> tanpa diunggah atau disimpan ke server mana pun.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">
                  3. Integrasi API Publik
                </h3>
                <p className="text-xs sm:text-sm text-[#94a3b8]">
                  Saat Anda memasukkan tautan video publik TikTok, Instagram, atau YouTube, aplikasi mengambil metadata publik (judul, deskripsi, caption, daftar komentar publik, dan stream video) serta meresolve redirect shortlink <code className="text-[#2dd4bf]">alight.link</code> agar dapat dibuka dengan benar di Alight Motion.
                </p>
              </div>

              <div
                {...liquidPointerHandlers}
                className="p-4 rounded-xl glass-subpanel space-y-2"
              >
                <h3 className="text-sm font-semibold text-[#f1f5f9]">
                  4. Kontak Privasi Pengembang
                </h3>
                <p className="text-xs sm:text-sm text-[#94a3b8]">
                  Pengembang: <strong className="text-[#f1f5f9]">Dimas Kurniawan</strong> · Kontak TikTok:{' '}
                  <a
                    href={TIKTOK_CONTACT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2dd4bf] font-semibold hover:underline"
                  >
                    @ludexkurniawan
                  </a>{' '}
                  · Dukungan Komunitas:{' '}
                  <a
                    href={WHATSAPP_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#38bdf8] font-semibold hover:underline"
                  >
                    Saluran WhatsApp Resmi
                  </a>
                  .
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="relative z-10 px-4 sm:px-6 py-3.5 border-t border-white/[0.08] bg-[#111317]/65 flex items-center justify-between gap-4">
          <span className="text-xs text-[#94a3b8]">
            © {new Date().getFullYear()} AM Preset Finder · Dimas Kurniawan
          </span>
          <button
            type="button"
            {...liquidPointerHandlers}
            onClick={onClose}
            className="liquid-btn-primary px-4 py-2 rounded-xl font-semibold text-xs active:scale-95 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
