import React, { useState } from 'react';
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
} from 'lucide-react';
import { ExtractedPresetLink } from '../utils/presetParser';
import { copyFullUrlToClipboard } from '../utils/clipboard';

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
}

export const PresetHistorySection: React.FC<PresetHistorySectionProps> = ({
  history,
  onDeleteRecord,
  onClearAll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'url' | 'text' | 'qr-image'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  return (
    <section id="riwayat-preset" className="pt-2">
      <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-[#00E5A3] shrink-0" aria-hidden="true" />
              <span>Riwayat Preset Tersimpan</span>
              <span className="text-xs font-mono tabular-nums text-slate-400 font-normal">
                ({history.length})
              </span>
            </h2>
            <p className="hidden sm:block text-xs text-slate-400 mt-0.5">
              Tersimpan otomatis di peramban Anda untuk akses cepat kembali.
            </p>
          </div>

          {history.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search
                  className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari riwayat..."
                  aria-label="Cari riwayat preset"
                  className="min-h-[40px] pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/90 border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#00E5A3] w-full sm:w-48"
                />
              </div>

              <button
                type="button"
                onClick={onClearAll}
                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Hapus</span>
              </button>
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div className="pt-3 border-t border-white/[0.08] text-xs text-slate-400 flex items-center justify-between gap-2">
            <span>Belum ada riwayat preset pada sesi peramban ini.</span>
            <span className="font-mono tabular-nums shrink-0">0 entri</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-3 border-t border-white/[0.08]">
              <div className="grid grid-cols-4 sm:flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-white/[0.08] w-full sm:w-auto">
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
                    onClick={() => setModeFilter(tab.id)}
                    className={`min-h-[36px] px-2 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-colors flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer ${
                      modeFilter === tab.id
                        ? 'bg-[#00E5A3] text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-400 font-mono tabular-nums text-right sm:text-left">
                {filteredHistory.length} dari {history.length} riwayat
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Tidak ada riwayat yang cocok dengan kata kunci pencarian.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.08]">
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
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-semibold text-[#00E5A3]">
                            {record.sourceMode === 'url'
                              ? 'URL Video'
                              : record.sourceMode === 'text'
                              ? 'Filter Komentar'
                              : 'Scan Gambar QR'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-300">{record.authorHandle}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatTimestamp(record.createdAtIso)}
                          </span>
                        </div>

                        <h3 className="text-xs sm:text-sm font-semibold text-white truncate">
                          {record.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                          {record.qrLink && (
                            <a
                              href={record.qrLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-[#00E5A3] hover:underline flex items-center gap-1 min-w-0"
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
                              className="text-xs font-mono text-slate-300 hover:text-[#00E5A3] hover:underline flex items-center gap-1 min-w-0"
                            >
                              {l.category === '5mb' ? (
                                <Sparkles className="w-3 h-3 text-[#00E5A3] shrink-0" aria-hidden="true" />
                              ) : (
                                <FileCode2 className="w-3 h-3 text-sky-400 shrink-0" aria-hidden="true" />
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
                              className="flex-1 lg:flex-initial min-h-[40px] px-3.5 py-2 rounded-xl bg-[#00E5A3] text-slate-950 hover:bg-[#00cca0] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                            >
                              <span>Buka Preset</span>
                              <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                            </a>

                            <button
                              type="button"
                              onClick={() => handleCopy(record.id, primaryLink)}
                              aria-label={`Salin link utama untuk ${record.title}`}
                              className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {copiedKey === record.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-[#00E5A3]" aria-hidden="true" />
                                  <span>Tersalin</span>
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
                          onClick={() => onDeleteRecord(record.id)}
                          aria-label={`Hapus riwayat ${record.title}`}
                          className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
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
