import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  FileCode2,
  Sparkles,
  Link2,
} from 'lucide-react';
import {
  ExtractedPresetLink,
  PresetLinkCategory,
  resolveRealRedirectUrl,
  extractUrlParametersList,
} from '../utils/presetParser';
import { copyFullUrlToClipboard } from '../utils/clipboard';
import { CardCornerWatermark } from './AmLogoWatermark';
import { liquidPointerHandlers } from '../utils/liquidGlass';

interface PresetResultsListProps {
  links: ExtractedPresetLink[];
  onLinkResolved?: (
    linkId: string,
    resolvedUrl: string,
    resolvedCategory: '5mb' | 'xml' | 'unknown'
  ) => void;
}

const FILTER_ORDER: Array<'all' | PresetLinkCategory> = [
  'all',
  '5mb',
  'xml',
  'shortlink',
];

export const PresetResultsList: React.FC<PresetResultsListProps> = ({
  links,
  onLinkResolved,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | PresetLinkCategory>('all');
  const [isSlidingFilter, setIsSlidingFilter] = useState<boolean>(false);
  const filterTimerRef = useRef<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastCopiedFullUrl, setLastCopiedFullUrl] = useState<string | null>(null);
  const [resolvingMap, setResolvingMap] = useState<Record<string, boolean>>({});
  const [resolvedData, setResolvedData] = useState<
    Record<
      string,
      {
        url: string;
        category: '5mb' | 'xml' | 'unknown';
        resolved: boolean;
        error?: string;
      }
    >
  >({});

  const count5mb = links.filter((l) => l.category === '5mb').length;
  const countXml = links.filter((l) => l.category === 'xml').length;
  const countShort = links.filter((l) => l.category === 'shortlink').length;
  const countAlightShort = links.filter((l) => l.needsAlightResolve).length;

  const filteredLinks =
    activeFilter === 'all' ? links : links.filter((l) => l.category === activeFilter);

  const handleSelectFilter = (next: 'all' | PresetLinkCategory) => {
    setIsSlidingFilter(true);
    if (filterTimerRef.current !== null) {
      window.clearTimeout(filterTimerRef.current);
    }
    filterTimerRef.current = window.setTimeout(() => {
      setIsSlidingFilter(false);
    }, 300);
    setActiveFilter(next);
  };

  useEffect(() => {
    return () => {
      if (filterTimerRef.current !== null) {
        window.clearTimeout(filterTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async (id: string, urlToCopy: string) => {
    await copyFullUrlToClipboard(urlToCopy);
    setCopiedId(id);
    setLastCopiedFullUrl(urlToCopy);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2400);
  };

  const handleResolveSingleLink = useCallback(
    async (item: ExtractedPresetLink) => {
      setResolvingMap((prev) => ({ ...prev, [item.id]: true }));
      const result = await resolveRealRedirectUrl(item.url);

      setResolvedData((prev) => ({
        ...prev,
        [item.id]: {
          url: result.resolvedUrl,
          category: result.category,
          resolved: result.resolved,
          error: result.error,
        },
      }));
      setResolvingMap((prev) => ({ ...prev, [item.id]: false }));

      if (result.resolved && onLinkResolved) {
        onLinkResolved(item.id, result.resolvedUrl, result.category);
      }
    },
    [onLinkResolved]
  );

  useEffect(() => {
    const alightShortItems = links.filter(
      (item) => item.needsAlightResolve && !item.resolvedUrl
    );
    for (const item of alightShortItems) {
      handleResolveSingleLink(item);
    }
  }, [links, handleResolveSingleLink]);

  const handleResolveAll = async () => {
    const targetItems = links.filter(
      (l) => l.category === 'shortlink' || l.needsAlightResolve
    );
    for (const item of targetItems) {
      // eslint-disable-next-line no-await-in-loop
      await handleResolveSingleLink(item);
    }
  };

  if (links.length === 0) {
    return (
      <div
        {...liquidPointerHandlers}
        className="glass-panel rounded-2xl p-6 text-center space-y-1.5 overflow-hidden"
      >
        <CardCornerWatermark />
        <p className="relative z-10 text-sm font-medium text-[#f1f5f9]">
          Belum ada tautan preset tertulis pada deskripsi/caption atau komentar yang dipindai.
        </p>
        <p className="relative z-10 text-xs text-[#94a3b8] max-w-lg mx-auto">
          Periksa panel komentar di bawah, gunakan <strong className="text-[#f1f5f9]">Auto Video QR Scanner</strong>, atau unggah tangkapan layar kode QR pada tab <strong className="text-[#f1f5f9]">Scan Gambar QR</strong>.
        </p>
      </div>
    );
  }

  const activeFilterIdx = Math.max(0, FILTER_ORDER.indexOf(activeFilter));

  return (
    <div
      {...liquidPointerHandlers}
      className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-hidden"
    >
      <CardCornerWatermark />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/[0.08] pb-3.5 sm:pb-4">
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-semibold text-[#f1f5f9]">
            Tautan Preset Ditemukan ({links.length})
          </h3>
          <div className="flex items-center gap-2 text-xs text-[#94a3b8] font-mono tabular-nums">
            <span className="text-[#2dd4bf]">5MB: {count5mb}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#38bdf8]">XML: {countXml}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#10b981]">Shortlink: {countShort}</span>
          </div>
        </div>

        {/* 4-Column Segmented Filter with Smooth Sliding Liquid Pill */}
        <div
          {...liquidPointerHandlers}
          className="p-1 rounded-xl glass-subpanel w-full sm:w-auto"
        >
          <div className="relative grid grid-cols-4 items-center">
            <div
              aria-hidden="true"
              style={{
                width: 'calc(100% / 4)',
                transform: `translate3d(calc(${activeFilterIdx} * 100%), 0, 0) scale(${
                  isSlidingFilter ? 1.02 : 1
                })`,
              }}
              className="sliding-liquid-pill absolute inset-y-0 left-0 rounded-lg z-0"
            />
            {(
              [
                { id: 'all', label: `Semua (${links.length})` },
                { id: '5mb', label: `5MB (${count5mb})` },
                { id: 'xml', label: `XML (${countXml})` },
                { id: 'shortlink', label: `Short (${countShort})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                {...liquidPointerHandlers}
                onClick={() => handleSelectFilter(tab.id)}
                className={`relative z-10 min-h-[36px] px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium bg-transparent active:scale-95 whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center ${
                  activeFilter === tab.id
                    ? 'text-[#f1f5f9] font-semibold'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {lastCopiedFullUrl && (
        <div
          role="status"
          aria-live="polite"
          className="relative z-10 px-4 py-3 rounded-xl glass-subpanel text-xs space-y-1 animate-expand-reveal"
        >
          <div className="flex items-center justify-between gap-2 text-[#2dd4bf] font-semibold">
            <span>URL Utuh Beserta Parameter Berhasil Disalin</span>
            <span className="font-mono tabular-nums">{lastCopiedFullUrl.length} karakter</span>
          </div>
          <div className="font-mono text-[#f1f5f9] break-all select-all">
            {lastCopiedFullUrl}
          </div>
        </div>
      )}

      {(countShort > 0 || countAlightShort > 0) && (
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#94a3b8]">
          <span className="hidden sm:inline">
            Shortlink <code className="text-[#2dd4bf]">alight.link</code> otomatis di-resolve ke format tujuan <code className="text-[#38bdf8]">alightcreative.com/am/share/u/.../p/...</code>.
          </span>
          <button
            type="button"
            {...liquidPointerHandlers}
            onClick={handleResolveAll}
            className="text-xs font-semibold text-[#2dd4bf] hover:underline active:scale-95 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Resolve Semua Shortlink</span>
          </button>
        </div>
      )}

      <div
        key={`preset-filter-${activeFilter}`}
        className="relative z-10 divide-y divide-white/[0.08] animate-state-enter"
      >
        {filteredLinks.map((item) => {
          const runtimeResolved = resolvedData[item.id];
          const isResolving = Boolean(resolvingMap[item.id]);
          const resolvedTargetUrl =
            (runtimeResolved?.resolved ? runtimeResolved.url : undefined) ||
            item.resolvedUrl;
          const primaryOpenUrl = resolvedTargetUrl || item.url;
          const activeParams = extractUrlParametersList(primaryOpenUrl);

          return (
            <div
              key={item.id}
              className="py-3.5 sm:py-4 first:pt-1 last:pb-1 flex flex-col gap-2.5 animate-state-enter"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#94a3b8]">
                    <span className="font-semibold text-[#2dd4bf]">
                      {item.category === '5mb'
                        ? 'Preset 5MB'
                        : item.category === 'xml'
                        ? 'Preset XML'
                        : 'Shortlink'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#38bdf8]">{item.provider}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.label}</span>
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="url-wrap-box break-all block font-mono text-xs sm:text-sm font-medium text-[#f1f5f9] hover:text-[#2dd4bf] transition-colors select-all"
                  >
                    {item.url}
                  </a>

                  {resolvedTargetUrl && resolvedTargetUrl !== item.url && (
                    <div className="pt-1 space-y-0.5">
                      <div className="text-xs text-[#2dd4bf] flex items-center gap-1 font-medium">
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>URL Tujuan (alightcreative.com):</span>
                      </div>
                      <a
                        href={resolvedTargetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="url-wrap-box break-all block font-mono text-xs sm:text-sm font-semibold text-[#2dd4bf] hover:underline select-all"
                      >
                        {resolvedTargetUrl}
                      </a>
                    </div>
                  )}

                  {activeParams.length > 0 && (
                    <div className="hidden sm:flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#94a3b8] font-mono pt-0.5">
                      <span className="text-[#f1f5f9] font-sans">Parameter:</span>
                      {activeParams.map((p, idx) => (
                        <React.Fragment key={`${item.id}-param-${p.key}-${idx}`}>
                          {idx > 0 && <span aria-hidden="true">·</span>}
                          <span>
                            {p.key}=<span className="text-[#2dd4bf]">{p.value}</span>
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 sm:flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto">
                  {(item.category === 'shortlink' || item.needsAlightResolve) &&
                    !resolvedTargetUrl && (
                      <button
                        type="button"
                        {...liquidPointerHandlers}
                        onClick={() => handleResolveSingleLink(item)}
                        disabled={isResolving}
                        className="liquid-btn-secondary transform-gpu col-span-2 sm:col-span-1 min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl active:scale-95 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-[#38bdf8] ${isResolving ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        <span>{isResolving ? 'Meresolve...' : 'Resolve Link'}</span>
                      </button>
                    )}

                  <a
                    href={primaryOpenUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...liquidPointerHandlers}
                    className="liquid-btn-primary transform-gpu min-h-[44px] sm:min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl active:scale-95 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    {item.category === '5mb' ||
                    runtimeResolved?.category === '5mb' ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#2dd4bf] shrink-0" aria-hidden="true" />
                        <span>Buka Preset</span>
                      </>
                    ) : item.category === 'xml' ||
                      runtimeResolved?.category === 'xml' ? (
                      <>
                        <FileCode2 className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" aria-hidden="true" />
                        <span>Unduh File XML</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5 text-[#2dd4bf] shrink-0" aria-hidden="true" />
                        <span>Buka Preset</span>
                      </>
                    )}
                    <ExternalLink className="w-3 h-3 hidden sm:inline text-[#38bdf8] shrink-0" aria-hidden="true" />
                  </a>

                  <button
                    type="button"
                    {...liquidPointerHandlers}
                    onClick={() => handleCopy(item.id, primaryOpenUrl)}
                    aria-label={`Salin URL utuh ${primaryOpenUrl}`}
                    className="liquid-btn-secondary transform-gpu min-h-[44px] sm:min-h-[40px] px-3 sm:px-3.5 py-2 rounded-xl active:scale-95 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#10b981] shrink-0" aria-hidden="true" />
                        <span className="text-[#2dd4bf] font-semibold">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
