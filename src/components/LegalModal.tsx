import React, { useEffect } from 'react';
import { X, ExternalLink, Shield, FileText, User } from 'lucide-react';

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

  if (!activeDoc) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-state-enter"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl glass-panel border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-state-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-900/90 border border-white/10">
            <button
              type="button"
              onClick={() => onSelectDoc('tos')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeDoc === 'tos'
                  ? 'bg-[#00E5A3] text-slate-950 animate-state-pop'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Terms of Service</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectDoc('privacy')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeDoc === 'privacy'
                  ? 'bg-[#00E5A3] text-slate-950 animate-state-pop'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Privacy Policy</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dokumen legal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div
          key={activeDoc}
          className="p-6 overflow-y-auto space-y-5 text-sm text-slate-300 leading-relaxed animate-state-enter"
        >
          {activeDoc === 'tos' ? (
            <>
              <div>
                <h2
                  id="legal-modal-title"
                  className="text-xl font-bold text-white font-display"
                >
                  Terms of Service (Ketentuan Layanan)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Berlaku efektif untuk pengguna web AM Preset Finder
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">
                  1. Deskripsi Layanan
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  AM Preset Finder adalah alat bantu berbasis web untuk mendeteksi, memfilter, dan mengekstrak tautan preset Alight Motion (format 5MB <code className="text-[#00E5A3]">alight.link</code> / <code className="text-[#00E5A3]">alightcreative.com</code>, file XML Google Drive / MediaFire, serta kode QR di dalam video atau tangkapan layar) dari tautan publik TikTok, Instagram, dan YouTube.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">
                  2. Penggunaan yang Diizinkan & Hak Cipta Kreator
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Seluruh preset, video, dan karya kreatif yang diekstrak melalui layanan ini tetap menjadi hak milik masing-masing kreator aslinya. Pengguna diharapkan tetap memberikan apresiasi dan kredit kepada kreator preset saat menggunakan preset tersebut.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">
                  3. Profil Pengembang & Hak Cipta Aplikasi
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Aplikasi web AM Preset Finder dirancang dan dikembangkan oleh{' '}
                  <strong className="text-white">Dimas Kurniawan</strong>. Seluruh antarmuka dan kode sistem aplikasi dilindungi hak cipta.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 space-y-2.5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-[#00E5A3]" aria-hidden="true" />
                  <span>4. Kontak & Dukungan Resmi</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Jika Anda memiliki pertanyaan terkait Ketentuan Layanan, pelaporan tautan, atau masukan pengembangan fitur, silakan hubungi pengembang melalui kontak resmi berikut:
                </p>
                <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
                  <div className="text-slate-300">
                    Pengembang:{' '}
                    <strong className="text-white">Dimas Kurniawan</strong>
                  </div>
                  <span aria-hidden="true" className="hidden sm:inline text-slate-600">
                    ·
                  </span>
                  <a
                    href={TIKTOK_CONTACT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00E5A3] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <span>TikTok @ludexkurniawan</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                  <span aria-hidden="true" className="hidden sm:inline text-slate-600">
                    ·
                  </span>
                  <a
                    href={WHATSAPP_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00E5A3] font-semibold hover:underline inline-flex items-center gap-1"
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
                  className="text-xl font-bold text-white font-display"
                >
                  Privacy Policy (Kebijakan Privasi)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Komitmen perlindungan data dan privasi pengguna AM Preset Finder
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">
                  1. Penyimpanan Data Lokal (LocalStorage)
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Riwayat pencarian dan ekstraksi preset Anda disimpan secara eksklusif di penyimpanan lokal peramban (<code className="text-[#00E5A3]">localStorage</code>) pada perangkat Anda sendiri. Kami tidak menyimpan riwayat ekstraksi pribadi Anda di basis data eksternal, dan Anda dapat menghapusnya kapan saja melalui tombol <strong>Hapus Riwayat</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">
                  2. Pemindaian Gambar & Frame Video QR
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Gambar tangkapan layar kode QR yang Anda unggah dari galeri diproses secara langsung di peramban menggunakan HTML5 Canvas dan pustaka <code className="text-[#00E5A3]">jsQR</code> tanpa diunggah atau disimpan ke server mana pun.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">
                  3. Integrasi API Publik
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Saat Anda memasukkan tautan video publik TikTok, Instagram, atau YouTube, aplikasi mengambil metadata publik (judul, deskripsi, caption, daftar komentar publik, dan stream video) serta meresolve redirect shortlink <code className="text-[#00E5A3]">alight.link</code> agar dapat dibuka dengan benar di Alight Motion.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
                <h3 className="text-sm font-semibold text-white">
                  4. Kontak Privasi Pengembang
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Pengembang: <strong className="text-white">Dimas Kurniawan</strong> · Kontak TikTok:{' '}
                  <a
                    href={TIKTOK_CONTACT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00E5A3] font-semibold hover:underline"
                  >
                    @ludexkurniawan
                  </a>{' '}
                  · Dukungan Komunitas:{' '}
                  <a
                    href={WHATSAPP_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00E5A3] font-semibold hover:underline"
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
        <div className="px-6 py-3.5 border-t border-white/10 bg-slate-950/60 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400">
            © {new Date().getFullYear()} AM Preset Finder · Dimas Kurniawan
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#00E5A3] text-slate-950 font-semibold text-xs hover:bg-[#00cca0] transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
