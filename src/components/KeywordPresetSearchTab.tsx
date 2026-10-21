import React, { useState, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Music,
  Eye,
  Heart,
  User,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  FileCode2,
  Link2,
  Loader2,
  AlertCircle,
  EyeOff,
} from 'lucide-react';
import {
  KeywordPresetSearchResultItem,
  searchPresetVideosByKeyword,
} from '../utils/tikwmApi';
import { ExtractedPresetLink } from '../utils/presetParser';
import { copyFullUrlToClipboard } from '../utils/clipboard';
import { CardCornerWatermark } from './AmLogoWatermark';
import { SearchLoadingOverlay } from './LoadingScreen';
import { liquidPointerHandlers } from '../utils/liquidGlass';

const QUICK_KEYWORD_CHIPS = [
  'Jedag Jedug',
  'Transisi Halus',
  'Lagu Viral TikTok',
  'Velocity',
  'Typography',
  'Slowmo',
  'Lagu Sad',
  'DJ Viral',
  '3D Transition',
] as const;

interface KeywordPresetSearchTabProps {
  onPresetFoundForHistory?: (item: KeywordPresetSearchResultItem) => void;
  onClearResetAll?: () => void;
}

function formatCompactCount(num: number): string {
  if (!num || num <= 0) return '—';
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return num.toLocaleString('id-ID');
}

export const KeywordPresetSearchTab: React.FC<KeywordPresetSearchTabProps> = ({
  onPresetFoundForHistory,
  onClearResetAll,
}) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [keyword, setKeyword] = useState<string>('');
  const [activeSearchedQuery, setActiveSearchedQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<KeywordPresetSearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCaptions, setExpandedCaptions] = useState<
    Record<string, boolean>
  >({});

  const handleResetToInitialIdle = useCallback(() => {
    setKeyword('');
    setActiveSearchedQuery('');
    setIsLoading(false);
    setErrorMsg(null);
    setResults([]);
    setHasSearched(false);
    setExpandedCaptions({});
    onClearResetAll?.();
    searchInputRef.current?.focus();
  }, [onClearResetAll]);

  const executeKeywordSearch = useCallback(
    async (targetKeyword: string) => {
      const trimmed = targetKeyword.trim();
      setErrorMsg(null);

      if (!trimmed) {
        setHasSearched(false);
        setResults([]);
        setErrorMsg(
          'Ketik kata kunci preset, nama lagu, atau nama kreator terlebih dahulu sebelum mencari.'
        );
        return;
      }

      setKeyword(trimmed);
      setActiveSearchedQuery(trimmed);
      setIsLoading(true);
      setHasSearched(false);
      setResults([]);

      try {
        const items = await searchPresetVideosByKeyword(trimmed);
        setResults(items);
        setHasSearched(true);
        setIsLoading(false);

        if (items.length > 0 && onPresetFoundForHistory) {
          onPresetFoundForHistory(items[0]);
        }
      } catch (err) {
        setIsLoading(false);
        setHasSearched(false);
        setResults([]);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat mencari preset berdasarkan kata kunci.'
        );
      }
    },
    [onPresetFoundForHistory]
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeKeywordSearch(keyword);
  };

  const handleChipClick = (chipText: string) => {
    setKeyword(chipText);
    executeKeywordSearch(chipText);
  };

  const handleCopyPresetLink = async (copyKey: string, url: string) => {
    await copyFullUrlToClipboard(url);
    setCopiedId(copyKey);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === copyKey ? null : prev));
    }, 2200);
  };

  const toggleCaptionExpand = (id: string) => {
    setExpandedCaptions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Strict conditional rendering flags:
  // Idle when not loading and either search hasn't run or input is empty
  const isIdle = !isLoading && (!hasSearched || !keyword.trim());
  const canShowResults = !isLoading && hasSearched && Boolean(keyword.trim());

  const renderCategoryBadge = (link: ExtractedPresetLink) => {
    const effectiveCategory = link.resolvedCategory || link.category;
    if (effectiveCategory === '5mb') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2dd4bf]">
          <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>Preset 5MB</span>
        </span>
      );
    }
    if (effectiveCategory === 'xml') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#38bdf8]">
          <FileCode2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>XML / Drive</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#94a3b8]">
        <Link2 className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>Shortlink AM</span>
      </span>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-8 min-w-0 max-w-full">
      {/* Main Search Card */}
      <div
        {...liquidPointerHandlers}
        className="glass-panel min-w-0 max-w-full rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-hidden"
      >
        <CardCornerWatermark />

        <form
          onSubmit={handleFormSubmit}
          className="relative z-10 space-y-3 sm:space-y-3.5 min-w-0 max-w-full"
          noValidate
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="keyword-preset-search-input"
              className="block text-xs sm:text-sm font-semibold text-[#f1f5f9]"
            >
              Cari Preset Berdasarkan Kata Kunci, Nama Lagu / Sound, atau Kreator
            </label>

            {canShowResults && (
              <button
                type="button"
                {...liquidPointerHandlers}
                onClick={handleResetToInitialIdle}
                className="text-xs text-[#94a3b8] hover:text-[#2dd4bf] active:scale-95 flex items-center gap-1.5 transition-colors cursor-pointer animate-state-pop"
              >
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sembunyikan Hasil</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 min-w-0 flex items-center w-full">
              <Search
                className="w-4 h-4 text-[#2dd4bf] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                id="keyword-preset-search-input"
                type="text"
                value={keyword}
                {...liquidPointerHandlers}
                onChange={(e) => {
                  const val = e.target.value;
                  setKeyword(val);
                  if (errorMsg) setErrorMsg(null);
                  if (!val.trim()) {
                    setHasSearched(false);
                    setResults([]);
                    onClearResetAll?.();
                  } else if (hasSearched) {
                    setHasSearched(false);
                    setResults([]);
                  }
                }}
                placeholder="Cari preset berdasarkan kata kunci, nama lagu, atau nama kreator..."
                className={`liquid-input w-full min-h-[46px] pl-10 ${
                  keyword ? 'pr-10' : 'pr-4'
                } py-2.5 sm:py-3 rounded-xl text-base sm:text-sm text-[#f1f5f9] placeholder:text-[#94a3b8]/75`}
              />
              {keyword && (
                <button
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={handleResetToInitialIdle}
                  aria-label="Reset pencarian kata kunci"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-white/10 active:scale-95 transition-[transform,opacity,background-color,color] duration-200 ease-out cursor-pointer animate-state-pop"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              {...liquidPointerHandlers}
              className="liquid-btn-primary transform-gpu min-h-[44px] sm:min-h-[46px] px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl active:scale-95 disabled:opacity-60 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <span
                  key="kw-searching"
                  className="animate-state-pop flex items-center gap-2"
                >
                  <Loader2
                    className="w-4 h-4 text-[#2dd4bf] animate-spin"
                    aria-hidden="true"
                  />
                  <span>Mencari link preset...</span>
                </span>
              ) : (
                <span
                  key="kw-idle"
                  className="animate-state-pop flex items-center gap-2"
                >
                  <Search
                    className="w-4 h-4 text-[#2dd4bf]"
                    aria-hidden="true"
                  />
                  <span>Cari Preset</span>
                </span>
              )}
            </button>
          </div>

          {/* Popular Keyword Chips */}
          <div className="pt-1 w-full min-w-0 max-w-full flex items-center gap-2 overflow-x-auto whitespace-nowrap flex-nowrap scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="text-[11px] font-medium text-[#94a3b8] shrink-0">
              Kata Kunci Populer:
            </span>
            {QUICK_KEYWORD_CHIPS.map((chip) => {
              const isSelected =
                keyword.trim().toLowerCase() === chip.toLowerCase();
              return (
                <button
                  key={chip}
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={() => handleChipClick(chip)}
                  className={`transform-gpu px-3 py-1.5 rounded-full text-xs font-medium transition-[transform,opacity,background-color,border-color,color] duration-200 ease-out shrink-0 whitespace-nowrap cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'liquid-btn-primary text-[#f1f5f9] border-[#2dd4bf]/45'
                      : 'liquid-btn-secondary text-[#94a3b8] hover:text-[#f1f5f9]'
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2 animate-expand-reveal"
            >
              <AlertCircle
                className="w-4 h-4 text-rose-400 shrink-0"
                aria-hidden="true"
              />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>

        {/* Petunjuk Pencarian Preset — ONLY shown in idle state before searching or after X reset */}
        {isIdle && (
          <div className="relative z-10 pt-2 border-t border-white/[0.08] space-y-2.5 animate-expand-reveal">
            <div className="text-xs font-semibold text-[#f1f5f9]">
              Petunjuk Pencarian Preset:
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
              <div
                {...liquidPointerHandlers}
                className="glass-subpanel transform-gpu p-3 sm:p-3.5 rounded-xl flex flex-col justify-center space-y-1 text-left"
              >
                <div className="text-xs font-semibold text-[#2dd4bf]">
                  1. Ketik Kata Kunci / Lagu
                </div>
                <p className="text-[11px] sm:text-xs text-[#94a3b8] leading-relaxed">
                  Ketik judul lagu, efek preset, nama kreator, atau klik salah
                  satu <strong className="text-[#f1f5f9]">Kata Kunci Populer</strong>{' '}
                  di atas.
                </p>
              </div>

              <div
                {...liquidPointerHandlers}
                className="glass-subpanel transform-gpu p-3 sm:p-3.5 rounded-xl flex flex-col justify-center space-y-1 text-left"
              >
                <div className="text-xs font-semibold text-[#38bdf8]">
                  2. Tekan Cari Preset
                </div>
                <p className="text-[11px] sm:text-xs text-[#94a3b8] leading-relaxed">
                  Sistem otomatis memindai video relevan dan mengekstrak link
                  preset Alight Motion (5MB, XML, atau Google Drive).
                </p>
              </div>

              <div
                {...liquidPointerHandlers}
                className="glass-subpanel transform-gpu p-3 sm:p-3.5 rounded-xl flex flex-col justify-center space-y-1 text-left"
              >
                <div className="text-xs font-semibold text-[#10b981]">
                  3. Buka Preset & 4. Salin Link
                </div>
                <p className="text-[11px] sm:text-xs text-[#94a3b8] leading-relaxed">
                  Lihat info sound, kreator, serta gunakan tombol{' '}
                  <strong className="text-[#f1f5f9]">Buka Preset</strong> atau{' '}
                  <strong className="text-[#f1f5f9]">Salin</strong> pada setiap
                  tautan.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overlay Loading Screen when extracting presets by keyword */}
      <SearchLoadingOverlay
        isOpen={isLoading}
        targetLabel={
          activeSearchedQuery
            ? `Kata Kunci: "${activeSearchedQuery}"`
            : undefined
        }
      />

      {/* Loading Indicator ("Mencari link preset...") */}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          {...liquidPointerHandlers}
          className="glass-panel transform-gpu rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-state-enter overflow-hidden"
        >
          <CardCornerWatermark />
          <div className="relative z-10 flex items-center gap-3">
            <Loader2
              className="w-5 h-5 text-[#2dd4bf] animate-spin shrink-0"
              aria-hidden="true"
            />
            <div>
              <div className="text-xs sm:text-sm font-semibold text-[#f1f5f9]">
                Mencari link preset untuk &ldquo;{activeSearchedQuery}&rdquo;...
              </div>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Memindai deskripsi video, informasi sound/lagu, dan tautan Alight
                Motion (alightcreative.com, XML, atau Google Drive).
              </p>
            </div>
          </div>
          <span className="relative z-10 text-xs font-mono text-[#2dd4bf] shrink-0">
            Mencari link preset...
          </span>
        </div>
      )}

      {/* Search Results Area — ONLY shown after search completes and keyword is non-empty */}
      {canShowResults && (
        <div className="space-y-4 sm:space-y-5 min-w-0 max-w-full animate-results-reveal">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-[#f1f5f9] flex flex-wrap items-center gap-2 min-w-0">
              <Sparkles
                className="w-4 h-4 text-[#2dd4bf] shrink-0"
                aria-hidden="true"
              />
              <span className="break-words">
                Hasil Pencarian Preset untuk &ldquo;{activeSearchedQuery}&rdquo;
              </span>
              <span className="text-xs font-mono text-[#94a3b8] font-normal shrink-0">
                ({results.length} video ditemukan)
              </span>
            </div>
          </div>

          {results.length === 0 ? (
            <div
              {...liquidPointerHandlers}
              className="glass-panel min-w-0 max-w-full rounded-2xl p-6 text-center space-y-2 overflow-hidden"
            >
              <CardCornerWatermark />
              <p className="relative z-10 text-xs sm:text-sm font-semibold text-[#f1f5f9]">
                Belum ditemukan video dengan link preset langsung untuk kata
                kunci &ldquo;{activeSearchedQuery}&rdquo;.
              </p>
              <p className="relative z-10 text-xs text-[#94a3b8]">
                Coba gunakan kata kunci populer seperti{' '}
                <strong className="text-[#2dd4bf]">Jedag Jedug</strong>,{' '}
                <strong className="text-[#38bdf8]">Transisi Halus</strong>, atau{' '}
                <strong className="text-[#2dd4bf]">Velocity</strong>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-5 min-w-0 max-w-full">
              {results.map((item) => {
                const isExpanded = Boolean(expandedCaptions[item.id]);
                const captionLines = item.caption.split('\n');
                const shouldTruncate =
                  item.caption.length > 210 || captionLines.length > 4;
                const displayedCaption =
                  !shouldTruncate || isExpanded
                    ? item.caption
                    : `${captionLines.slice(0, 3).join('\n').slice(0, 210)}...`;

                return (
                  <article
                    key={item.id}
                    {...liquidPointerHandlers}
                    className="glass-panel min-w-0 max-w-full rounded-2xl p-4 sm:p-6 space-y-4 overflow-hidden"
                  >
                    <CardCornerWatermark />

                    {/* Top Row: Thumbnail + Sound/Music Info + Creator & Stats */}
                    <div className="relative z-10 flex flex-col sm:flex-row items-start gap-3.5 sm:gap-4">
                      {item.coverUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full sm:w-36 h-40 sm:h-24 rounded-xl overflow-hidden border border-white/10 bg-[#111317] shrink-0 relative group"
                        >
                          <img
                            src={item.coverUrl}
                            alt={item.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 ease-out"
                          />
                          <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/80 text-[10px] font-mono text-[#2dd4bf] font-semibold">
                            {item.extractedLinks.length} Preset
                          </span>
                        </a>
                      )}

                      <div className="flex-1 min-w-0 max-w-full space-y-2 w-full">
                        {/* 1. Info Sound / Nama Lagu (dengan ikon musik) */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-subpanel text-xs text-[#2dd4bf] min-w-0 max-w-full w-fit">
                          <Music
                            className="w-3.5 h-3.5 text-[#2dd4bf] shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-medium truncate min-w-0">
                            {item.soundTitle}
                          </span>
                        </div>

                        {/* 2. Info Kreator (@username, views, likes) & Jumlah Preset */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#94a3b8]">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#f1f5f9]">
                            <User
                              className="w-3.5 h-3.5 text-[#38bdf8] shrink-0"
                              aria-hidden="true"
                            />
                            <span>@{item.author.uniqueId}</span>
                          </span>

                          <span aria-hidden="true">·</span>

                          <span
                            className="inline-flex items-center gap-1 font-mono tabular-nums"
                            title="Jumlah tayangan (Views)"
                          >
                            <Eye
                              className="w-3.5 h-3.5 text-[#94a3b8] shrink-0"
                              aria-hidden="true"
                            />
                            <span>{formatCompactCount(item.viewCount)} views</span>
                          </span>

                          <span aria-hidden="true">·</span>

                          <span
                            className="inline-flex items-center gap-1 font-mono tabular-nums"
                            title="Jumlah suka (Likes)"
                          >
                            <Heart
                              className="w-3.5 h-3.5 text-rose-400 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              {formatCompactCount(
                                item.likeCount ||
                                  Math.max(1, Math.round(item.viewCount * 0.035))
                              )}{' '}
                              likes
                            </span>
                          </span>

                          <span aria-hidden="true">·</span>

                          <span className="text-[#2dd4bf] font-semibold">
                            {item.extractedLinks.length} Preset Ditemukan
                          </span>

                          <span aria-hidden="true">·</span>

                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#38bdf8] hover:underline inline-flex items-center gap-1"
                          >
                            <span>Sumber Video</span>
                            <ExternalLink
                              className="w-3 h-3 shrink-0"
                              aria-hidden="true"
                            />
                          </a>
                        </div>

                        {/* 3. Caption Video */}
                        <div className="space-y-1">
                          <p className="text-xs text-[#94a3b8] whitespace-pre-line leading-relaxed break-words url-wrap-box">
                            {displayedCaption}
                          </p>
                          {shouldTruncate && (
                            <button
                              type="button"
                              onClick={() => toggleCaptionExpand(item.id)}
                              className="text-[11px] font-semibold text-[#2dd4bf] hover:underline cursor-pointer"
                            >
                              {isExpanded
                                ? 'Sembunyikan sebagian caption'
                                : 'Lihat seluruh caption'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 4. Daftar Link Preset yang Berhasil Ditemukan (dengan tombol Buka Preset dan Salin) */}
                    <div className="relative z-10 pt-3 border-t border-white/[0.08] space-y-2.5">
                      <div className="text-xs font-semibold text-[#f1f5f9] flex items-center justify-between">
                        <span>
                          Tautan Preset Ditemukan ({item.extractedLinks.length})
                        </span>
                      </div>

                      <div className="divide-y divide-white/[0.07]">
                        {item.extractedLinks.map((link) => {
                          const targetHref = link.resolvedUrl || link.url;
                          const copyKey = `${item.id}-${link.id}`;
                          const isCopied = copiedId === copyKey;

                          return (
                            <div
                              key={link.id}
                              className="py-2.5 first:pt-1 last:pb-0.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  {renderCategoryBadge(link)}
                                  <span
                                    aria-hidden="true"
                                    className="text-xs text-[#94a3b8]"
                                  >
                                    ·
                                  </span>
                                  <span className="text-xs text-[#94a3b8]">
                                    {link.provider}
                                  </span>
                                </div>
                                <a
                                  href={targetHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs font-mono text-[#f1f5f9] hover:text-[#2dd4bf] transition-colors break-all url-wrap-box"
                                >
                                  {targetHref}
                                </a>
                              </div>

                              <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0 w-full sm:w-auto">
                                <a
                                  href={targetHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  {...liquidPointerHandlers}
                                  className="liquid-btn-primary transform-gpu min-h-[44px] sm:min-h-[38px] px-3.5 py-2 sm:py-1.5 rounded-xl active:scale-95 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                                >
                                  <span>Buka Preset</span>
                                  <ExternalLink
                                    className="w-3.5 h-3.5 text-[#38bdf8] shrink-0"
                                    aria-hidden="true"
                                  />
                                </a>

                                <button
                                  type="button"
                                  {...liquidPointerHandlers}
                                  onClick={() =>
                                    handleCopyPresetLink(copyKey, targetHref)
                                  }
                                  className="liquid-btn-secondary transform-gpu min-h-[44px] sm:min-h-[38px] px-3.5 py-2 sm:py-1.5 rounded-xl active:scale-95 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  {isCopied ? (
                                    <span
                                      key="copied"
                                      className="animate-state-pop flex items-center gap-1.5 text-[#2dd4bf]"
                                    >
                                      <Check
                                        className="w-3.5 h-3.5 text-[#10b981] shrink-0"
                                        aria-hidden="true"
                                      />
                                      <span>Tersalin</span>
                                    </span>
                                  ) : (
                                    <span
                                      key="copy"
                                      className="animate-state-pop flex items-center gap-1.5"
                                    >
                                      <Copy
                                        className="w-3.5 h-3.5 text-[#38bdf8] shrink-0"
                                        aria-hidden="true"
                                      />
                                      <span>Salin</span>
                                    </span>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
