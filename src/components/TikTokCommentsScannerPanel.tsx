import React, { useState, useCallback } from 'react';
import {
  MessageSquare,
  CornerDownRight,
  Sparkles,
  FileCode2,
  Link2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Search,
  Loader2,
  AlertCircle,
  ArrowRight,
  ThumbsUp,
  UserCheck,
} from 'lucide-react';
import {
  TikTokCommentThread,
  ExtractedPresetLink,
  extractPresetLinksFromCommentsAndReplies,
  extractUrlParametersList,
  resolveRealRedirectUrl,
} from '../utils/presetParser';
import {
  fetchTikTokCommentsPage,
  fetchTikTokCommentReplies,
} from '../utils/tikwmApi';
import { copyFullUrlToClipboard } from '../utils/clipboard';

interface TikTokCommentsScannerPanelProps {
  platform?: 'tiktok' | 'instagram' | 'youtube';
  videoId: string;
  sourceUrl: string;
  creatorUniqueId: string;
  threads: TikTokCommentThread[];
  cursor: number;
  hasMore: boolean;
  isScanningInitial: boolean;
  scanStatusText: string;
  scanError: string | null;
  onThreadsUpdated: (
    updatedThreads: TikTokCommentThread[],
    nextCursor: number,
    nextHasMore: boolean,
    extractedFromComments: ExtractedPresetLink[]
  ) => void;
  onRetryInitialScan: () => void;
}

type CommentFilterMode = 'all' | 'with-links' | 'creator' | 'with-replies';

export const TikTokCommentsScannerPanel: React.FC<
  TikTokCommentsScannerPanelProps
> = ({
  platform = 'tiktok',
  videoId,
  sourceUrl,
  creatorUniqueId,
  threads,
  cursor,
  hasMore,
  isScanningInitial,
  scanStatusText,
  scanError,
  onThreadsUpdated,
  onRetryInitialScan,
}) => {
  const [filterMode, setFilterMode] = useState<CommentFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingCommentRepliesMap, setLoadingCommentRepliesMap] = useState<
    Record<string, boolean>
  >({});
  const [isLoadingMoreComments, setIsLoadingMoreComments] =
    useState<boolean>(false);
  const [isScanningAllReplies, setIsScanningAllReplies] =
    useState<boolean>(false);
  const [batchReplyProgress, setBatchReplyProgress] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resolvingLinkMap, setResolvingLinkMap] = useState<
    Record<string, boolean>
  >({});
  const [resolvedLinkOverrides, setResolvedLinkOverrides] = useState<
    Record<string, string>
  >({});

  const totalRepliesLoaded = threads.reduce(
    (sum, t) => sum + (t.replies?.length || 0),
    0
  );

  const allExtractedCommentLinks =
    extractPresetLinksFromCommentsAndReplies(threads);

  const threadHasPresetLink = (t: TikTokCommentThread): boolean => {
    if (t.extractedLinks.length > 0) return true;
    return (t.replies || []).some((r) => r.extractedLinks.length > 0);
  };

  const threadHasCreatorActivity = (t: TikTokCommentThread): boolean => {
    if (t.isCreator) return true;
    return (t.replies || []).some((r) => r.isCreator);
  };

  const countWithLinks = threads.filter(threadHasPresetLink).length;
  const countCreator = threads.filter(threadHasCreatorActivity).length;
  const countWithReplies = threads.filter((t) => t.replyTotal > 0).length;
  const unscannedReplyThreads = threads.filter(
    (t) => t.replyTotal > 0 && !t.repliesLoaded
  );

  const filteredThreads = threads.filter((t) => {
    if (filterMode === 'with-links' && !threadHasPresetLink(t)) return false;
    if (filterMode === 'creator' && !threadHasCreatorActivity(t)) return false;
    if (filterMode === 'with-replies' && t.replyTotal <= 0) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const inCommentText = t.text.toLowerCase().includes(q);
    const inCommentAuthor =
      t.user.uniqueId.toLowerCase().includes(q) ||
      t.user.nickname.toLowerCase().includes(q);
    const inCommentLinks = t.extractedLinks.some((l) =>
      l.url.toLowerCase().includes(q)
    );
    const inReplies = (t.replies || []).some(
      (r) =>
        r.text.toLowerCase().includes(q) ||
        r.user.uniqueId.toLowerCase().includes(q) ||
        r.extractedLinks.some((l) => l.url.toLowerCase().includes(q))
    );
    return inCommentText || inCommentAuthor || inCommentLinks || inReplies;
  });

  const handleCopyUrl = async (id: string, fullUrl: string) => {
    await copyFullUrlToClipboard(fullUrl);
    setCopiedId(id);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2200);
  };

  const handleResolveSingleShortlink = useCallback(
    async (link: ExtractedPresetLink) => {
      setResolvingLinkMap((prev) => ({ ...prev, [link.id]: true }));
      const res = await resolveRealRedirectUrl(link.url);
      setResolvingLinkMap((prev) => ({ ...prev, [link.id]: false }));
      if (res.resolved && res.resolvedUrl) {
        setResolvedLinkOverrides((prev) => ({
          ...prev,
          [link.id]: res.resolvedUrl,
        }));
      }
    },
    []
  );

  // Automatically resolve any alight.link shortlinks discovered in comments or replies
  React.useEffect(() => {
    const pendingLinks = allExtractedCommentLinks.filter(
      (l) =>
        l.needsAlightResolve &&
        !l.resolvedUrl &&
        !resolvedLinkOverrides[l.id] &&
        !resolvingLinkMap[l.id]
    );
    for (const link of pendingLinks) {
      handleResolveSingleShortlink(link);
    }
  }, [
    allExtractedCommentLinks,
    handleResolveSingleShortlink,
    resolvedLinkOverrides,
    resolvingLinkMap,
  ]);

  const handleLoadRepliesForComment = useCallback(
    async (comment: TikTokCommentThread, loadMore = false) => {
      const targetCursor = loadMore ? comment.repliesCursor : 0;
      setLoadingCommentRepliesMap((prev) => ({ ...prev, [comment.id]: true }));
      setLocalError(null);

      try {
        const replyRes = await fetchTikTokCommentReplies({
          videoId: comment.videoId || videoId,
          commentId: comment.id,
          creatorUniqueId,
          cursor: targetCursor,
          count: 50,
        });

        const nextThreads = threads.map((item) => {
          if (item.id !== comment.id) return item;
          const existingIds = new Set(item.replies.map((r) => r.id));
          const mergedReplies = loadMore
            ? [
                ...item.replies,
                ...replyRes.replies.filter((r) => !existingIds.has(r.id)),
              ]
            : replyRes.replies;
          return {
            ...item,
            replies: mergedReplies,
            repliesCursor: replyRes.cursor,
            repliesHasMore: replyRes.hasMore,
            repliesLoaded: true,
          };
        });

        const nextExtracted =
          extractPresetLinksFromCommentsAndReplies(nextThreads);
        onThreadsUpdated(nextThreads, cursor, hasMore, nextExtracted);
      } catch (err) {
        setLocalError(
          err instanceof Error
            ? err.message
            : 'Gagal memuat balasan komentar.'
        );
      } finally {
        setLoadingCommentRepliesMap((prev) => ({
          ...prev,
          [comment.id]: false,
        }));
      }
    },
    [creatorUniqueId, cursor, hasMore, onThreadsUpdated, threads, videoId]
  );

  const handleScanAllRemainingReplies = async () => {
    if (unscannedReplyThreads.length === 0 || isScanningAllReplies) return;
    setIsScanningAllReplies(true);
    setLocalError(null);

    let workingThreads = [...threads];
    const targets = unscannedReplyThreads.slice(0, 10);

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      setBatchReplyProgress(
        `Memindai balasan @${target.user.uniqueId} (${i + 1}/${targets.length})...`
      );
      try {
        // eslint-disable-next-line no-await-in-loop
        const replyRes = await fetchTikTokCommentReplies({
          videoId: target.videoId || videoId,
          commentId: target.id,
          creatorUniqueId,
          cursor: 0,
          count: 50,
        });

        workingThreads = workingThreads.map((item) =>
          item.id === target.id
            ? {
                ...item,
                replies: replyRes.replies,
                repliesCursor: replyRes.cursor,
                repliesHasMore: replyRes.hasMore,
                repliesLoaded: true,
              }
            : item
        );

        const nextExtracted =
          extractPresetLinksFromCommentsAndReplies(workingThreads);
        onThreadsUpdated(workingThreads, cursor, hasMore, nextExtracted);
      } catch {
        // Continue to next thread
      }
    }

    setBatchReplyProgress('');
    setIsScanningAllReplies(false);
  };

  const handleLoadMoreComments = async () => {
    if (!hasMore || isLoadingMoreComments) return;
    setIsLoadingMoreComments(true);
    setLocalError(null);

    try {
      const nextPage = await fetchTikTokCommentsPage({
        videoUrlOrId: videoId || sourceUrl,
        creatorUniqueId,
        cursor,
        count: 50,
      });

      const existingIds = new Set(threads.map((t) => t.id));
      const appended = nextPage.comments.filter((c) => !existingIds.has(c.id));
      const updatedThreads = [...threads, ...appended];
      const updatedExtracted =
        extractPresetLinksFromCommentsAndReplies(updatedThreads);

      onThreadsUpdated(
        updatedThreads,
        nextPage.cursor,
        nextPage.hasMore,
        updatedExtracted
      );
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat halaman komentar berikutnya.'
      );
    } finally {
      setIsLoadingMoreComments(false);
    }
  };

  const renderExtractedLinksInline = (links: ExtractedPresetLink[]) => {
    if (!links || links.length === 0) return null;

    return (
      <div className="mt-2.5 space-y-2">
        {links.map((link) => {
          const resolvedUrl =
            resolvedLinkOverrides[link.id] || link.resolvedUrl;
          const primaryUrl = resolvedUrl || link.url;
          const params = extractUrlParametersList(primaryUrl);
          const isResolving = Boolean(resolvingLinkMap[link.id]);

          return (
            <div
              key={link.id}
              className="p-3 rounded-lg bg-[#00E5A3]/[0.08] border border-[#00E5A3]/35 space-y-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-semibold text-[#00E5A3]">
                      {link.category === '5mb'
                        ? 'Preset 5MB'
                        : link.category === 'xml'
                        ? 'Preset XML'
                        : 'Shortlink'}
                    </span>
                    <span aria-hidden="true" className="text-slate-500">
                      ·
                    </span>
                    <span className="text-slate-300">{link.provider}</span>
                    <span aria-hidden="true" className="text-slate-500">
                      ·
                    </span>
                    <span className="text-slate-400">{link.label}</span>
                  </div>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-mono text-xs font-medium text-white hover:text-[#00E5A3] hover:underline break-all select-all"
                  >
                    {link.url}
                  </a>

                  {resolvedUrl && resolvedUrl !== link.url && (
                    <div className="pt-1 space-y-0.5">
                      <div className="text-[11px] text-[#00E5A3] flex items-center gap-1 font-medium">
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                        <span>URL Tujuan (`alightcreative.com/am/share/...`):</span>
                      </div>
                      <a
                        href={resolvedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-mono text-xs font-semibold text-[#00E5A3] hover:underline break-all select-all"
                      >
                        {resolvedUrl}
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {(link.needsAlightResolve || link.category === 'shortlink') &&
                    !resolvedUrl && (
                      <button
                        type="button"
                        onClick={() => handleResolveSingleShortlink(link)}
                        disabled={isResolving}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 hover:bg-amber-500/25 text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${isResolving ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        <span>
                          {isResolving ? 'Meresolve...' : 'Resolve Link'}
                        </span>
                      </button>
                    )}

                  <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#00E5A3] text-slate-950 hover:bg-[#00cca0] text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    {link.category === '5mb' ? (
                      <>
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        <span>Buka di Alight Motion</span>
                      </>
                    ) : link.category === 'xml' ? (
                      <>
                        <FileCode2 className="w-3 h-3" aria-hidden="true" />
                        <span>Unduh XML</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3 h-3" aria-hidden="true" />
                        <span>Buka Link</span>
                      </>
                    )}
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleCopyUrl(link.id, primaryUrl)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedId === link.id ? (
                      <>
                        <Check
                          className="w-3 h-3 text-[#00E5A3]"
                          aria-hidden="true"
                        />
                        <span className="text-[#00E5A3] font-semibold">
                          Tersalin Utuh
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" aria-hidden="true" />
                        <span>Salin URL Utuh</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {params.length > 0 && (
                <div className="pt-1.5 border-t border-white/10 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-slate-400">
                  <span className="text-slate-300 font-sans">Parameter:</span>
                  {params.map((p, idx) => (
                    <React.Fragment key={`${link.id}-p-${p.key}-${idx}`}>
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <span>
                        {p.key}=<span className="text-[#00E5A3]">{p.value}</span>
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-b border-white/[0.08] pb-3.5 sm:pb-4">
        <div className="max-w-2xl space-y-1">
          <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
            <MessageSquare
              className="w-4 h-4 text-[#00E5A3] shrink-0"
              aria-hidden="true"
            />
            <span>
              {platform === 'youtube'
                ? 'Kolom Komentar YouTube'
                : 'Kolom Komentar & Balasan TikTok'}
            </span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
            <span>{threads.length} komentar dipindai</span>
            {platform === 'tiktok' && (
              <>
                <span aria-hidden="true">·</span>
                <span>{totalRepliesLoaded} balasan dipindai</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-[#00E5A3] font-semibold">
              {allExtractedCommentLinks.length} tautan preset ditemukan
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0 w-full sm:w-auto">
          {platform === 'tiktok' && unscannedReplyThreads.length > 0 && (
            <button
              type="button"
              onClick={handleScanAllRemainingReplies}
              disabled={isScanningAllReplies || isScanningInitial}
              className="min-h-[40px] px-3 sm:px-3.5 py-2 rounded-lg bg-[#00E5A3] text-slate-950 hover:bg-[#00cca0] disabled:opacity-50 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isScanningAllReplies ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                  <span className="truncate">{batchReplyProgress || 'Memindai Balasan...'}</span>
                </>
              ) : (
                <>
                  <CornerDownRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Pindai Balasan ({unscannedReplyThreads.length})
                  </span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onRetryInitialScan}
            disabled={isScanningInitial}
            className="min-h-[40px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${isScanningInitial ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Pindai Ulang</span>
          </button>
        </div>
      </div>

      {/* Scanning Status Banner */}
      {isScanningInitial && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-lg bg-[#00E5A3]/10 border border-[#00E5A3]/30 flex items-center gap-3 text-xs text-white"
        >
          <Loader2
            className="w-4 h-4 text-[#00E5A3] animate-spin shrink-0"
            aria-hidden="true"
          />
          <span>
            {scanStatusText ||
              'Sedang mengambil daftar komentar dari video...'}
          </span>
        </div>
      )}

      {/* Error State */}
      {(scanError || localError) && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle
              className="w-4 h-4 text-rose-400 shrink-0"
              aria-hidden="true"
            />
            <span>{scanError || localError}</span>
          </div>
          <button
            type="button"
            onClick={onRetryInitialScan}
            className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Filter & Search Controls — Flexible 2x2 Grid on Mobile */}
      {threads.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          <div className="grid grid-cols-2 sm:flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-900/90 border border-white/10 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center ${
                filterMode === 'all'
                  ? 'bg-[#00E5A3] text-slate-950 font-semibold animate-state-pop'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Semua ({threads.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('with-links')}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center ${
                filterMode === 'with-links'
                  ? 'bg-[#00E5A3] text-slate-950 font-semibold animate-state-pop'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Ada Link ({countWithLinks})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('creator')}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center ${
                filterMode === 'creator'
                  ? 'bg-[#00E5A3] text-slate-950 font-semibold animate-state-pop'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Kreator ({countCreator})
            </button>
            {platform === 'tiktok' && (
              <button
                type="button"
                onClick={() => setFilterMode('with-replies')}
                className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center ${
                  filterMode === 'with-replies'
                    ? 'bg-[#00E5A3] text-slate-950 font-semibold animate-state-pop'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Ada Balasan ({countWithReplies})
              </button>
            )}
          </div>

          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari di komentar..."
              aria-label="Cari di komentar"
              className="w-full md:w-64 min-h-[38px] pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/90 border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#00E5A3]"
            />
          </div>
        </div>
      )}

      {/* Comments & Replies Thread List */}
      {!isScanningInitial && threads.length === 0 && !scanError ? (
        <div className="glass-subpanel rounded-lg p-6 text-center space-y-2 animate-state-enter">
          <p className="text-sm font-medium text-slate-200">
            Tidak ada komentar publik pada video ini.
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Pastikan kolom komentar pada video diaktifkan oleh kreator, atau klik Pindai Ulang.
          </p>
        </div>
      ) : filteredThreads.length === 0 && threads.length > 0 ? (
        <div
          key={`empty-filter-${filterMode}`}
          className="glass-subpanel rounded-lg p-6 text-center space-y-2 animate-state-enter"
        >
          <p className="text-sm font-medium text-slate-200">
            Tidak ada komentar yang cocok dengan filter ini.
          </p>
          {platform === 'tiktok' &&
            unscannedReplyThreads.length > 0 &&
            filterMode === 'with-links' && (
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Masih ada {unscannedReplyThreads.length} thread komentar yang memiliki balasan namun belum dipindai. Klik tombol <strong>Pindai Semua Balasan</strong> di atas untuk memeriksa seluruh balasan.
              </p>
            )}
        </div>
      ) : (
        <div
          key={`list-${filterMode}`}
          className="space-y-3 max-h-[540px] overflow-y-auto pr-1 animate-state-enter"
        >
          {filteredThreads.map((comment) => {
            const hasAnyLink = threadHasPresetLink(comment);
            const isLoadingReplies = Boolean(
              loadingCommentRepliesMap[comment.id]
            );

            return (
              <div
                key={comment.id}
                className={`glass-subpanel rounded-lg p-4 space-y-3 transition-colors ${
                  hasAnyLink
                    ? 'border-[#00E5A3]/45 bg-[#00E5A3]/[0.03]'
                    : 'border-white/10'
                }`}
              >
                {/* Top-Level Comment Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">
                      {comment.user.nickname}
                    </span>
                    <span className="font-mono text-slate-400">
                      @{comment.user.uniqueId}
                    </span>
                    {comment.isCreator && (
                      <span className="text-[#00E5A3] font-semibold flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Kreator Video</span>
                      </span>
                    )}
                    {comment.extractedLinks.length > 0 && (
                      <span className="text-[#00E5A3] font-mono font-semibold">
                        · {comment.extractedLinks.length} Link Preset
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 font-mono tabular-nums">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" aria-hidden="true" />
                      <span>{comment.diggCount}</span>
                    </span>
                    {comment.replyTotal > 0 && (
                      <span>{comment.replyTotal} balasan</span>
                    )}
                  </div>
                </div>

                {/* Top-Level Comment Body */}
                <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                  {comment.text}
                </p>

                {/* Extracted Preset Links inside Top-Level Comment */}
                {renderExtractedLinksInline(comment.extractedLinks)}

                {/* Replies Controls & Nested Replies List (TikTok only) */}
                {platform === 'tiktok' &&
                  (comment.replyTotal > 0 || comment.replies.length > 0) && (
                    <div className="pt-2 border-t border-white/5 space-y-2.5">
                      {comment.replies.length > 0 && (
                        <div className="pl-3 sm:pl-4 border-l-2 border-white/15 space-y-2.5 animate-expand-reveal">
                          {comment.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className={`p-3 rounded-lg space-y-1.5 animate-state-enter ${
                                reply.extractedLinks.length > 0
                                  ? 'bg-[#00E5A3]/[0.06] border border-[#00E5A3]/35'
                                  : 'bg-slate-950/60 border border-white/5'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <CornerDownRight
                                    className="w-3 h-3 text-slate-400 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span className="font-semibold text-white">
                                    {reply.user.nickname}
                                  </span>
                                  <span className="font-mono text-slate-400">
                                    @{reply.user.uniqueId}
                                  </span>
                                  {reply.isCreator && (
                                    <span className="text-[#00E5A3] font-semibold">
                                      · Kreator
                                    </span>
                                  )}
                                  {reply.extractedLinks.length > 0 && (
                                    <span className="text-[#00E5A3] font-mono font-semibold">
                                      · {reply.extractedLinks.length} Link Preset
                                    </span>
                                  )}
                                </div>

                                <span className="text-slate-400 font-mono tabular-nums flex items-center gap-1">
                                  <ThumbsUp className="w-3 h-3" aria-hidden="true" />
                                  <span>{reply.diggCount}</span>
                                </span>
                              </div>

                              <p className="text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                                {reply.text}
                              </p>

                              {renderExtractedLinksInline(reply.extractedLinks)}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Button to load or load more replies for this comment */}
                      {(!comment.repliesLoaded || comment.repliesHasMore) && (
                        <button
                          type="button"
                          onClick={() =>
                            handleLoadRepliesForComment(
                              comment,
                              comment.repliesLoaded
                            )
                          }
                          disabled={isLoadingReplies}
                          className="text-xs font-semibold text-[#00E5A3] hover:underline flex items-center gap-1.5 cursor-pointer"
                        >
                          {isLoadingReplies ? (
                            <span
                              key="loading-replies"
                              className="animate-state-pop flex items-center gap-1.5"
                            >
                              <Loader2
                                className="w-3.5 h-3.5 animate-spin"
                                aria-hidden="true"
                              />
                              <span>Memindai balasan komentar...</span>
                            </span>
                          ) : (
                            <span
                              key="idle-replies"
                              className="animate-state-pop flex items-center gap-1.5"
                            >
                              <CornerDownRight
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                              <span>
                                {comment.repliesLoaded
                                  ? `Muat Balasan Berikutnya (${comment.replies.length}/${comment.replyTotal})`
                                  : `Lihat & Pindai Balasan (${comment.replyTotal} Balasan)`}
                              </span>
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer for More Top-Level Comments */}
      {hasMore && (
        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            Menampilkan {threads.length} komentar yang telah dipindai
          </span>
          <button
            type="button"
            onClick={handleLoadMoreComments}
            disabled={isLoadingMoreComments}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-[#00E5A3] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isLoadingMoreComments ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                <span>Memuat Komentar...</span>
              </>
            ) : (
              <span>Muat 50 Komentar Berikutnya</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
