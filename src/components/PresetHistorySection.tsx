import React, { useState, useRef, useEffect } from 'react';
import {
  History,
  Search,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  FileCode2,
  QrCode,
  EyeOff,
} from 'lucide-react';
import { ExtractedPresetLink } from '../utils/presetParser';
import { copyFullUrlToClipboard } from '../utils/clipboard';
import { CardCornerWatermark } from './AmLogoWatermark';
import { liquidPointerHandlers } from '../utils/liquidGlass';

export interface PresetHistoryRecord {
  id: string;
  title: string;
  authorHandle: string;
  sourceMode: 'url' | 'text' | 'qr-image';
  sourceUrl?: string;
  createdAtIso: string;
  links: ExtractedPresetLink[];
  qrLink?: string;
}

interface PresetHistorySectionProps {
  history: PresetHistoryRecord[];
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
  onCloseHistory?: () => void;
}

const HISTORY_MODES = ['all', 'url', 'text', 'qr-image'] as const;

export const PresetHistorySection: React.FC<PresetHistorySectionProps> = ({
  history,
  onDeleteRecord,
  onClearAll,
  onCloseHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'url' | 'text' | 'qr-image'>('all');
  const [isSlidingMode, setIsSlidingMode] = useState(false);
  const modeTimerRef = useRef<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleSelectMode = (next: 'all' | 'url' | 'text' | 'qr-image') => {
    setIsSlidingMode(true);
    if (modeTimerRef.current !== null) {
      window.clearTimeout(modeTimerRef.current);
    }
    modeTimerRef.current = window.setTimeout(() => {
      setIsSlidingMode(false);
    }, 300);
    setModeFilter(next);
  };

  useEffect(() => {
    return () => {
      if (modeTimerRef.current !== null) {
        window.clearTimeout(modeTimerRef.current);
      }
    };
  }, []);

  const filteredHistory = history.filter((item) => {
    const matchesMode = modeFilter === 'all' || item.sourceMode === modeFilter;
    if (!matchesMode) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const inTitle = item.title.toLowerCase().includes(q);
    const inAuthor = item.authorHandle.toLowerCase().includes(q);
    const inLinks = item.links.some((l) => l.url.toLowerCase().includes(q));
    const inQr = item.qrLink?.toLowerCase().includes(q) ?? false;
    return inTitle || inAuthor || inLinks || inQr;
  });

  const handleCopy = async (key: string, text: string) => {
    await copyFullUrlToClipboard(text);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2200);
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const activeModeIdx = Math.max(0, HISTORY_MODES.indexOf(modeFilter));

  return (
    <section id="riwayat-preset" className="pt-2 animate-results-reveal">
      <div
        {...liquidPointerHandlers}
        className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-hidden"
      >
        <CardCornerWatermark />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-[#f1f5f9] flex items-center gap-2">
                <History className="w-4 h-4 text-[#2dd4bf] shrink-0" aria-hidden="true" />
                <span>Riwayat Preset Tersimpan</span>
                <span className="text-xs font-mono tabular-nums text-[#94a3b8] font-normal">
                  ({history.length})
                </span>
              </h2>
              <p className="hidden sm:block text-xs text-[#94a3b8] mt-0.5">
                Tersimpan otomatis di peramban Anda untuk akses cepat kembali.
              </p>
            </div>

            {onCloseHistory && (
              <button
                type="button"
                {...liquidPointerHandlers}
                onClick={onCloseHistory}
                className="sm:hidden text-xs text-[#94a3b8] hover:text-[#2dd4bf] active:scale-95 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sembunyikan</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {history.length > 0 && (
              <>
                <div className="relative flex-1 sm:flex-initial">
                  <Search
                    className="w-3.5 h-3.5 text-[#38bdf8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    {...liquidPointerHandlers}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari riwayat..."
                    aria-label="Cari riwayat preset"
                    className="liquid-input min-h-[40px] pl-8 pr-3 py-1.5 rounded-xl text-xs text-[#f1f5f9] placeholder:text-[#94a3b8]/75 w-full sm:w-48"
                  />
                </div>

                <button
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={onClearAll}
                  className="liquid-btn-secondary min-h-[40px] px-3 py-1.5 rounded-xl hover:bg-rose-500/25 active:scale-95 text-rose-200 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Hapus</span>
                </button>
              </>
            )}

            {onCloseHistory && (
              <button
                type="button"
                {...liquidPointerHandlers}
                onClick={onCloseHistory}
                className="hidden sm:inline-flex liquid-btn-secondary min-h-[40px] px-3 py-1.5 rounded-xl active:scale-95 text-[#94a3b8] hover:text-[#f1f5f9] text-xs font-medium items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Tutup Riwayat</span>
              </button>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="relative z-10 pt-3 border-t border-white/[0.08] text-xs text-[#94a3b8] flex items-center justify-between gap-2">
            <span>Belum ada riwayat preset pada sesi peramban ini.</span>
            <span className="font-mono tabular-nums shrink-0">0 entri</span>
          </div>
        ) : (
          <>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-3 border-t border-white/[0.08]">
              <div
                {...liquidPointerHandlers}
                className="p-1 rounded-xl glass-subpanel w-full sm:w-auto"
              >
                <div className="relative grid grid-cols-4 items-center">
                  <div
                    aria-hidden="true"
                    style={{
                      width: 'calc(100% / 4)',
                      transform: `translate3d(calc(${activeModeIdx} * 100%), 0, 0) scale(${
                        isSlidingMode ? 1.02 : 1
                      })`,
                    }}
                    className="sliding-liquid-pill absolute inset-y-0 left-0 rounded-lg z-0"
                  />
                  {(
                    [
                      { id: 'all', label: 'Semua' },
                      { id: 'url', label: 'Video' },
                      { id: 'text', label: 'Komentar' },
                      { id: 'qr-image', label: 'Kode QR' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={() => handleSelectMode(tab.id)}
                      className={`relative z-10 min-h-[36px] px-2 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-medium bg-transparent active:scale-95 flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer ${
                        modeFilter === tab.id
                          ? 'text-[#f1f5f9] font-semibold'
                          : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-[#94a3b8] font-mono tabular-nums text-right sm:text-left">
                {filteredHistory.length} dari {history.length} riwayat
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <p className="relative z-10 text-xs text-[#94a3b8] py-4 text-center">
                Tidak ada riwayat yang cocok dengan kata kunci pencarian.
              </p>
            ) : (
              <div className="relative z-10 divide-y divide-white/[0.08]">
                {filteredHistory.map((record) => {
                  const primaryLink =
                    record.qrLink ||
                    record.links.find((l) => l.category === '5mb')?.resolvedUrl ||
                    record.links.find((l) => l.category === '5mb')?.url ||
                    record.links[0]?.resolvedUrl ||
                    record.links[0]?.url ||
                    '';

                  return (
                    <div
                      key={record.id}
                      className="py-3.5 first:pt-1 last:pb-1 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#94a3b8]">
                          <span className="font-semibold text-[#2dd4bf]">
                            {record.sourceMode === 'url'
                              ? 'URL Video'
                              : record.sourceMode === 'text'
                              ? 'Filter Komentar'
                              : 'Scan Gambar QR'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#38bdf8]">{record.authorHandle}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatTimestamp(record.createdAtIso)}
                          </span>
                        </div>

                        <h3 className="text-xs sm:text-sm font-semibold text-[#f1f5f9] truncate">
                          {record.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                          {record.qrLink && (
                            <a
                              href={record.qrLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-[#2dd4bf] hover:underline flex items-center gap-1 min-w-0"
                            >
                              <QrCode className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span className="url-wrap-box">{record.qrLink}</span>
                            </a>
                          )}
                          {record.links.slice(0, 2).map((l) => (
                            <a
                              key={l.id}
                              href={l.resolvedUrl || l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-[#94a3b8] hover:text-[#2dd4bf] hover:underline flex items-center gap-1 min-w-0"
                            >
                              {l.category === '5mb' ? (
                                <Sparkles className="w-3 h-3 text-[#2dd4bf] shrink-0" aria-hidden="true" />
                              ) : (
                                <FileCode2 className="w-3 h-3 text-[#38bdf8] shrink-0" aria-hidden="true" />
                              )}
                              <span className="url-wrap-box">{l.resolvedUrl || l.url}</span>
                            </a>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto">
                        {primaryLink && (
                          <>
                            <a
                              href={primaryLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              {...liquidPointerHandlers}
                              className="liquid-btn-primary flex-1 lg:flex-initial min-h-[40px] px-3.5 py-2 rounded-xl active:scale-95 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                            >
                              <span>Buka Preset</span>
                              <ExternalLink className="w-3 h-3 text-[#38bdf8] shrink-0" aria-hidden="true" />
                            </a>

                            <button
                              type="button"
                              {...liquidPointerHandlers}
                              onClick={() => handleCopy(record.id, primaryLink)}
                              aria-label={`Salin link utama untuk ${record.title}`}
                              className="liquid-btn-secondary min-h-[40px] px-3 py-2 rounded-xl active:scale-95 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {copiedKey === record.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-[#10b981]" aria-hidden="true" />
                                  <span className="text-[#2dd4bf]">Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Salin</span>
                                </>
                              )}
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          {...liquidPointerHandlers}
                          onClick={() => onDeleteRecord(record.id)}
                          aria-label={`Hapus riwayat ${record.title}`}
                          className="liquid-btn-secondary min-h-[40px] min-w-[40px] p-2 rounded-xl hover:bg-rose-500/25 active:scale-95 text-[#94a3b8] hover:text-rose-200 flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
