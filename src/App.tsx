/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Link2,
  MessageSquareText,
  QrCode,
  Search,
  CheckCircle2,
  Loader2,
  AlertCircle,
  User,
  Download,
  RotateCcw,
  MessageSquare,
  ExternalLink,
  ClipboardPaste,
  Check,
  X,
  EyeOff,
  History,
} from 'lucide-react';
import {
  parsePresetLinks,
  ExtractedPresetLink,
  TikTokCommentThread,
  extractUrlParametersList,
  extractPresetLinksFromCommentsAndReplies,
  mergeUniquePresetLinks,
  validateSocialUrl,
} from './utils/presetParser';
import {
  fetchSocialVideoData,
  scanTikTokVideoCommentsAndReplies,
  SocialVideoData,
} from './utils/tikwmApi';
import { QrScanDetection } from './utils/qrHelper';
import { VideoQrScannerPanel } from './components/VideoQrScannerPanel';
import { UnifiedVideoCaptionSection } from './components/UnifiedVideoCaptionSection';
import { TikTokCommentsScannerPanel } from './components/TikTokCommentsScannerPanel';
import { PresetResultsList } from './components/PresetResultsList';
import { QrImageUploadTab } from './components/QrImageUploadTab';
import {
  PresetHistorySection,
  PresetHistoryRecord,
} from './components/PresetHistorySection';
import {
  LegalModal,
  LegalDocType,
  WHATSAPP_CHANNEL_URL,
  TIKTOK_CONTACT_URL,
} from './components/LegalModal';
import {
  WelcomeModal,
  SOCIABUZZ_SUPPORT_URL,
} from './components/WelcomeModal';

type ActiveTab = 'url' | 'text' | 'qr-image';

const STORAGE_KEY = 'am_preset_finder_history_v2';
const LEGACY_STORAGE_KEY = 'am_preset_finder_history_v1';

const LOADING_STEPS = [
  'Mengambil data video...',
  'Memindai teks caption...',
  'Memindai komentar & balasan...',
  'Memindai frame QR video...',
];

export default function App() {
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const tab2UrlInputRef = useRef<HTMLInputElement | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'url' || tabParam === 'text' || tabParam === 'qr-image') {
        return tabParam;
      }
    } catch {
      // Ignore
    }
    return 'url';
  });

  // Legal Modal State (Terms of Service & Privacy Policy)
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const legalParam = params.get('legal');
      if (legalParam === 'tos' || legalParam === 'privacy') {
        return legalParam;
      }
    } catch {
      // Ignore
    }
    return null;
  });

  // Toggle for History Section (hidden by default so only the search column & instructions show initially)
  const [showHistorySection, setShowHistorySection] = useState<boolean>(false);

  // Welcome Modal State (shown on initial home page visit unless deep-linked via ?url= or ?autostart=1)
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('autostart') === '1' ||
        params.get('url') ||
        params.get('legal')
      ) {
        return false;
      }
    } catch {
      // Ignore
    }
    return true;
  });

  // Paste Feedback States
  const [pastedUrlFeedback, setPastedUrlFeedback] = useState<boolean>(false);
  const [pastedTab2UrlFeedback, setPastedTab2UrlFeedback] =
    useState<boolean>(false);
  const [pastedCommentTextFeedback, setPastedCommentTextFeedback] =
    useState<boolean>(false);

  // Tab 1: URL Link State
  const [urlInput, setUrlInput] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const passedUrl = params.get('url');
      if (passedUrl && passedUrl.trim()) {
        return passedUrl.trim();
      }
    } catch {
      // Ignore
    }
    return '';
  });
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState<number>(0);
  const [currentVideoData, setCurrentVideoData] =
    useState<SocialVideoData | null>(null);
  const [captionExtractedLinks, setCaptionExtractedLinks] = useState<
    ExtractedPresetLink[]
  >([]);
  const [urlExtractedLinks, setUrlExtractedLinks] = useState<
    ExtractedPresetLink[]
  >([]);
  const [videoDetectedQr, setVideoDetectedQr] =
    useState<QrScanDetection | null>(null);
  const [hasSearchedUrl, setHasSearchedUrl] = useState<boolean>(false);

  // TikTok Comments & Replies Scanner State
  const [commentThreads, setCommentThreads] = useState<TikTokCommentThread[]>(
    []
  );
  const [commentsCursor, setCommentsCursor] = useState<number>(0);
  const [commentsHasMore, setCommentsHasMore] = useState<boolean>(false);
  const [isScanningComments, setIsScanningComments] = useState<boolean>(false);
  const [commentScanStatusText, setCommentScanStatusText] =
    useState<string>('');
  const [commentScanError, setCommentScanError] = useState<string | null>(null);
  const [commentExtractedPresetLinks, setCommentExtractedPresetLinks] =
    useState<ExtractedPresetLink[]>([]);

  // Tab 2: Filter Teks / Komentar & Pemindai Komentar TikTok State
  const [tab2TiktokUrl, setTab2TiktokUrl] = useState<string>('');
  const [tab2VideoMeta, setTab2VideoMeta] = useState<SocialVideoData | null>(
    null
  );
  const [commentText, setCommentText] = useState<string>('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentExtractedLinks, setCommentExtractedLinks] = useState<
    ExtractedPresetLink[]
  >([]);
  const [hasAnalyzedComment, setHasAnalyzedComment] = useState<boolean>(false);

  const resetUrlSearchResults = useCallback(() => {
    setHasSearchedUrl(false);
    setCurrentVideoData(null);
    setCaptionExtractedLinks([]);
    setUrlExtractedLinks([]);
    setVideoDetectedQr(null);
    setCommentThreads([]);
    setCommentsCursor(0);
    setCommentsHasMore(false);
    setCommentScanError(null);
    setCommentExtractedPresetLinks([]);
  }, []);

  const resetTab2SearchResults = useCallback(() => {
    setHasAnalyzedComment(false);
    setTab2VideoMeta(null);
    setCommentExtractedLinks([]);
    setCommentThreads([]);
    setCommentsCursor(0);
    setCommentsHasMore(false);
    setCommentScanError(null);
    setCommentExtractedPresetLinks([]);
  }, []);

  const handlePasteToUrlInput = async () => {
    setUrlError(null);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setUrlInput(clipText.trim());
          resetUrlSearchResults();
          setPastedUrlFeedback(true);
          window.setTimeout(() => setPastedUrlFeedback(false), 1800);
          urlInputRef.current?.focus();
          return;
        }
      }
      urlInputRef.current?.focus();
      setUrlError(
        'Clipboard kosong atau dibatasi browser. Silakan tekan Ctrl+V atau tahan lalu pilih Tempel pada kolom pencarian.'
      );
    } catch {
      urlInputRef.current?.focus();
      setUrlError(
        'Izin baca clipboard dibatasi oleh browser. Silakan tekan Ctrl+V atau tahan lalu pilih Tempel langsung pada kolom pencarian.'
      );
    }
  };

  const handlePasteToTab2UrlInput = async () => {
    setCommentError(null);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setTab2TiktokUrl(clipText.trim());
          resetTab2SearchResults();
          setPastedTab2UrlFeedback(true);
          window.setTimeout(() => setPastedTab2UrlFeedback(false), 1800);
          tab2UrlInputRef.current?.focus();
          return;
        }
      }
      tab2UrlInputRef.current?.focus();
      setCommentError(
        'Clipboard kosong atau dibatasi browser. Silakan tekan Ctrl+V atau tahan lalu pilih Tempel pada kolom tautan.'
      );
    } catch {
      tab2UrlInputRef.current?.focus();
      setCommentError(
        'Izin baca clipboard dibatasi oleh browser. Silakan tekan Ctrl+V atau tahan lalu pilih Tempel langsung pada kolom tautan.'
      );
    }
  };

  const handlePasteToCommentTextarea = async () => {
    setCommentError(null);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setCommentText(clipText.trim());
          setHasAnalyzedComment(false);
          setPastedCommentTextFeedback(true);
          window.setTimeout(() => setPastedCommentTextFeedback(false), 1800);
          commentTextareaRef.current?.focus();
          return;
        }
      }
      commentTextareaRef.current?.focus();
      setCommentError(
        'Clipboard kosong atau dibatasi browser. Silakan tekan Ctrl+V atau tahan lalu pilih Tempel pada kotak teks.'
      );
    } catch {
      commentTextareaRef.current?.focus();
      setCommentError(
        'Izin baca clipboard dibatasi oleh browser. Silakan tekan Ctrl+V atau tahan lalu pilih Tempel langsung pada kotak teks.'
      );
    }
  };

  // Preset History in localStorage
  const [history, setHistory] = useState<PresetHistoryRecord[]>(() => {
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const upsertHistoryRecord = useCallback((newRecord: PresetHistoryRecord) => {
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== newRecord.id);
      return [newRecord, ...filtered].slice(0, 30);
    });
  }, []);

  const runTikTokCommentsAndRepliesScan = useCallback(
    async (
      videoData: SocialVideoData,
      baseCaptionLinks: ExtractedPresetLink[]
    ) => {
      if (videoData.platform !== 'tiktok') return;

      setIsScanningComments(true);
      setCommentScanError(null);
      setCommentScanStatusText(
        'Mengambil daftar komentar utama dan balasan dari video TikTok...'
      );

      try {
        const scanRes = await scanTikTokVideoCommentsAndReplies({
          videoId: videoData.id,
          sourceUrl: videoData.sourceUrl,
          creatorUniqueId: videoData.author.uniqueId,
          maxAutoReplyThreads: 3,
          onProgress: (msg) => setCommentScanStatusText(msg),
        });

        setCommentThreads(scanRes.threads);
        setCommentsCursor(scanRes.cursor);
        setCommentsHasMore(scanRes.hasMore);
        setCommentExtractedPresetLinks(scanRes.extractedLinks);

        const combinedLinks = mergeUniquePresetLinks(
          baseCaptionLinks,
          scanRes.extractedLinks
        );
        setUrlExtractedLinks(combinedLinks);

        const firstLineTitle =
          videoData.caption.split('\n')[0]?.trim() ||
          `Video @${videoData.author.uniqueId}`;

        upsertHistoryRecord({
          id: `url-${videoData.id}`,
          title: firstLineTitle,
          authorHandle: `@${videoData.author.uniqueId}`,
          sourceMode: 'url',
          sourceUrl: videoData.sourceUrl,
          createdAtIso: new Date().toISOString(),
          links: combinedLinks,
        });
      } catch (err) {
        setCommentScanError(
          err instanceof Error
            ? err.message
            : 'Gagal memindai kolom komentar TikTok.'
        );
      } finally {
        setIsScanningComments(false);
        setCommentScanStatusText('');
      }
    },
    [upsertHistoryRecord]
  );

  const executeUrlExtraction = useCallback(
    async (targetUrl: string) => {
      setUrlError(null);
      setVideoDetectedQr(null);
      setCommentThreads([]);
      setCommentsCursor(0);
      setCommentsHasMore(false);
      setCommentScanError(null);
      setCommentExtractedPresetLinks([]);

      const trimmed = targetUrl.trim();
      if (!trimmed) {
        setHasSearchedUrl(false);
        setCurrentVideoData(null);
        setUrlError(
          'Masukkan atau tempel tautan video TikTok, Instagram, atau YouTube terlebih dahulu sebelum menekan tombol Cari.'
        );
        return;
      }

      const directPresetParse = parsePresetLinks(trimmed);
      if (
        directPresetParse.totalCount > 0 &&
        !/tiktok\.com|instagram\.com|instagr\.am|youtube\.com|youtu\.be/i.test(
          trimmed
        )
      ) {
        setCurrentVideoData(null);
        setCaptionExtractedLinks(directPresetParse.all);
        setUrlExtractedLinks(directPresetParse.all);
        setHasSearchedUrl(true);

        upsertHistoryRecord({
          id: `direct-${Date.now()}`,
          title: `Direct Link: ${directPresetParse.all[0].url}`,
          authorHandle: directPresetParse.all[0].provider,
          sourceMode: 'url',
          sourceUrl: directPresetParse.all[0].url,
          createdAtIso: new Date().toISOString(),
          links: directPresetParse.all,
        });
        return;
      }

      setIsLoadingUrl(true);
      setLoadingStepIndex(0);

      try {
        const videoData = await fetchSocialVideoData(trimmed);
        setLoadingStepIndex(1);
        await new Promise((r) => window.setTimeout(r, 200));

        const parsedCaption = parsePresetLinks(videoData.caption);
        setCaptionExtractedLinks(parsedCaption.all);
        setUrlExtractedLinks(parsedCaption.all);

        setLoadingStepIndex(2);
        let initialCombinedLinks = parsedCaption.all;

        if (videoData.platform === 'tiktok') {
          try {
            const scanRes = await scanTikTokVideoCommentsAndReplies({
              videoId: videoData.id,
              sourceUrl: videoData.sourceUrl,
              creatorUniqueId: videoData.author.uniqueId,
              maxAutoReplyThreads: 3,
              onProgress: (msg) => setCommentScanStatusText(msg),
            });
            setCommentThreads(scanRes.threads);
            setCommentsCursor(scanRes.cursor);
            setCommentsHasMore(scanRes.hasMore);
            setCommentExtractedPresetLinks(scanRes.extractedLinks);
            initialCombinedLinks = mergeUniquePresetLinks(
              parsedCaption.all,
              scanRes.extractedLinks
            );
            setUrlExtractedLinks(initialCombinedLinks);
          } catch (cErr) {
            setCommentScanError(
              cErr instanceof Error
                ? cErr.message
                : 'Gagal memindai komentar video TikTok.'
            );
          } finally {
            setCommentScanStatusText('');
          }
        } else if (
          videoData.platform === 'youtube' &&
          videoData.youtubeComments &&
          videoData.youtubeComments.length > 0
        ) {
          const ytThreads = videoData.youtubeComments;
          const ytCommentLinks =
            extractPresetLinksFromCommentsAndReplies(ytThreads);
          setCommentThreads(ytThreads);
          setCommentsCursor(0);
          setCommentsHasMore(false);
          setCommentExtractedPresetLinks(ytCommentLinks);
          initialCombinedLinks = mergeUniquePresetLinks(
            parsedCaption.all,
            ytCommentLinks
          );
          setUrlExtractedLinks(initialCombinedLinks);
        }

        setLoadingStepIndex(3);
        await new Promise((r) => window.setTimeout(r, 200));

        setCurrentVideoData(videoData);
        setHasSearchedUrl(true);
        setIsLoadingUrl(false);

        const firstLineTitle =
          videoData.title?.trim() ||
          videoData.caption.split('\n')[0]?.trim() ||
          `Video @${videoData.author.uniqueId}`;

        upsertHistoryRecord({
          id: `url-${videoData.id}`,
          title: firstLineTitle,
          authorHandle: `@${videoData.author.uniqueId}`,
          sourceMode: 'url',
          sourceUrl: videoData.sourceUrl,
          createdAtIso: new Date().toISOString(),
          links: initialCombinedLinks,
        });
      } catch (err) {
        setIsLoadingUrl(false);
        setHasSearchedUrl(false);
        setCurrentVideoData(null);
        setUrlError(
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat mengambil data video.'
        );
      }
    },
    [upsertHistoryRecord]
  );

  const handleUrlFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeUrlExtraction(urlInput);
  };

  const handleThreadsUpdatedFromPanel = useCallback(
    (
      updatedThreads: TikTokCommentThread[],
      nextCursor: number,
      nextHasMore: boolean,
      extractedFromComments: ExtractedPresetLink[]
    ) => {
      setCommentThreads(updatedThreads);
      setCommentsCursor(nextCursor);
      setCommentsHasMore(nextHasMore);
      setCommentExtractedPresetLinks(extractedFromComments);

      const merged = mergeUniquePresetLinks(
        captionExtractedLinks,
        extractedFromComments
      );
      setUrlExtractedLinks(merged);

      if (activeTab === 'text') {
        const manualParsed = parsePresetLinks(commentText).all;
        setCommentExtractedLinks(
          mergeUniquePresetLinks(manualParsed, extractedFromComments)
        );
        setHasAnalyzedComment(true);
      }

      const activeVideo = currentVideoData || tab2VideoMeta;
      if (activeVideo) {
        const firstLineTitle =
          activeVideo.title?.trim() ||
          activeVideo.caption.split('\n')[0]?.trim() ||
          `Video @${activeVideo.author.uniqueId}`;

        upsertHistoryRecord({
          id: `url-${activeVideo.id}`,
          title: firstLineTitle,
          authorHandle: `@${activeVideo.author.uniqueId}`,
          sourceMode: activeTab === 'text' ? 'text' : 'url',
          sourceUrl: activeVideo.sourceUrl,
          createdAtIso: new Date().toISOString(),
          links: merged,
          qrLink:
            videoDetectedQr?.resolvedAlightCreativeUrl ||
            videoDetectedQr?.rawPayload,
        });
      }
    },
    [
      activeTab,
      captionExtractedLinks,
      commentText,
      currentVideoData,
      tab2VideoMeta,
      upsertHistoryRecord,
      videoDetectedQr,
    ]
  );

  const handleVideoQrDetected = useCallback(
    (detection: QrScanDetection) => {
      setVideoDetectedQr(detection);
      if (!currentVideoData) return;

      const effectiveQrUrl =
        detection.resolvedAlightCreativeUrl || detection.rawPayload;

      const firstLineTitle =
        currentVideoData.title?.trim() ||
        currentVideoData.caption.split('\n')[0]?.trim() ||
        `Video @${currentVideoData.author.uniqueId}`;

      upsertHistoryRecord({
        id: `url-${currentVideoData.id}`,
        title: firstLineTitle,
        authorHandle: `@${currentVideoData.author.uniqueId}`,
        sourceMode: 'url',
        sourceUrl: currentVideoData.sourceUrl,
        createdAtIso: new Date().toISOString(),
        links: urlExtractedLinks,
        qrLink: effectiveQrUrl,
      });
    },
    [currentVideoData, upsertHistoryRecord, urlExtractedLinks]
  );

  const handleScanTiktokCommentsInTab2 = async (targetSocialUrl: string) => {
    setCommentError(null);
    setCommentScanError(null);

    const validation = validateSocialUrl(targetSocialUrl);
    if (
      !validation.isValid ||
      (validation.platform !== 'tiktok' && validation.platform !== 'youtube')
    ) {
      setCommentError(
        'Masukkan tautan video TikTok atau YouTube yang valid untuk memindai komentar dan deskripsinya.'
      );
      return;
    }

    setIsScanningComments(true);
    setCommentScanStatusText(
      validation.platform === 'youtube'
        ? 'Mengambil deskripsi & komentar video YouTube...'
        : 'Mengambil informasi video & komentar TikTok...'
    );

    try {
      const videoData = await fetchSocialVideoData(validation.normalizedUrl);
      setTab2VideoMeta(videoData);

      let scannedCommentLinks: ExtractedPresetLink[] = [];

      if (videoData.platform === 'tiktok') {
        const scanRes = await scanTikTokVideoCommentsAndReplies({
          videoId: videoData.id,
          sourceUrl: videoData.sourceUrl,
          creatorUniqueId: videoData.author.uniqueId,
          maxAutoReplyThreads: 3,
          onProgress: (msg) => setCommentScanStatusText(msg),
        });

        setCommentThreads(scanRes.threads);
        setCommentsCursor(scanRes.cursor);
        setCommentsHasMore(scanRes.hasMore);
        setCommentExtractedPresetLinks(scanRes.extractedLinks);
        scannedCommentLinks = scanRes.extractedLinks;
      } else {
        const ytThreads = videoData.youtubeComments || [];
        scannedCommentLinks =
          extractPresetLinksFromCommentsAndReplies(ytThreads);
        setCommentThreads(ytThreads);
        setCommentsCursor(0);
        setCommentsHasMore(false);
        setCommentExtractedPresetLinks(scannedCommentLinks);
      }

      const captionLinks = parsePresetLinks(videoData.caption).all;
      setCaptionExtractedLinks(captionLinks);

      const manualLinks = commentText.trim()
        ? parsePresetLinks(commentText).all
        : [];
      const allFound = mergeUniquePresetLinks(
        mergeUniquePresetLinks(captionLinks, scannedCommentLinks),
        manualLinks
      );

      setCommentExtractedLinks(allFound);
      setHasAnalyzedComment(true);

      upsertHistoryRecord({
        id: `cmt-scan-${videoData.id}`,
        title: `Scan Komentar @${videoData.author.uniqueId}`,
        authorHandle: `@${videoData.author.uniqueId}`,
        sourceMode: 'text',
        sourceUrl: videoData.sourceUrl,
        createdAtIso: new Date().toISOString(),
        links: allFound,
      });
    } catch (err) {
      setCommentError(
        err instanceof Error
          ? err.message
          : 'Gagal memindai kolom komentar dari tautan video.'
      );
    } finally {
      setIsScanningComments(false);
      setCommentScanStatusText('');
    }
  };

  const handleAnalyzeCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);

    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentError(
        'Tempelkan teks komentar/balasan atau masukkan tautan video TikTok / YouTube terlebih dahulu untuk diekstrak.'
      );
      return;
    }

    const singleLineCheck = validateSocialUrl(trimmed);
    if (
      singleLineCheck.isValid &&
      (singleLineCheck.platform === 'tiktok' ||
        singleLineCheck.platform === 'youtube') &&
      !trimmed.includes('\n')
    ) {
      setTab2TiktokUrl(trimmed);
      handleScanTiktokCommentsInTab2(trimmed);
      return;
    }

    const parsed = parsePresetLinks(trimmed);
    const mergedWithScannedComments = mergeUniquePresetLinks(
      parsed.all,
      commentExtractedPresetLinks
    );
    setCommentExtractedLinks(mergedWithScannedComments);
    setHasAnalyzedComment(true);

    if (mergedWithScannedComments.length > 0) {
      const snippetTitle =
        trimmed.split('\n')[0]?.trim().slice(0, 60) ||
        'Ekstraksi Teks Komentar Preset AM';

      upsertHistoryRecord({
        id: `text-${Date.now()}`,
        title: snippetTitle,
        authorHandle: 'Filter Komentar',
        sourceMode: 'text',
        createdAtIso: new Date().toISOString(),
        links: mergedWithScannedComments,
      });
    }
  };

  const handleQrImageExtracted = useCallback(
    (info: {
      title: string;
      sourceLabel: string;
      detection: QrScanDetection;
    }) => {
      const effectiveUrl =
        info.detection.resolvedAlightCreativeUrl || info.detection.rawPayload;

      upsertHistoryRecord({
        id: `qr-${info.title}-${info.detection.rawPayload}`,
        title: `QR Screenshot: ${info.title}`,
        authorHandle: info.sourceLabel,
        sourceMode: 'qr-image',
        createdAtIso: new Date().toISOString(),
        links: [
          {
            id: `qr-link-${Date.now()}`,
            url: info.detection.rawPayload,
            rawMatch: info.detection.rawPayload,
            category: '5mb',
            provider: effectiveUrl.toLowerCase().includes('alightcreative.com')
              ? 'Alight Creative'
              : 'Alight Link',
            label: 'Hasil Scan Gambar QR Galeri',
            params: extractUrlParametersList(effectiveUrl),
            needsAlightResolve:
              info.detection.isAlightShortlink &&
              !info.detection.resolvedAlightCreativeUrl,
            resolvedUrl: info.detection.resolvedAlightCreativeUrl,
            resolvedCategory: '5mb',
            resolveStatus: info.detection.resolvedAlightCreativeUrl
              ? 'resolved'
              : 'idle',
          },
        ],
        qrLink: effectiveUrl,
      });
    },
    [upsertHistoryRecord]
  );

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllHistory = () => {
    setHistory([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#060A14] text-slate-100 relative selection:bg-[#00E5A3]/25 selection:text-[#00E5A3]">
      {/* Animated Liquid Glass Ambient Background Orbs & Refractive Caustics */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
        aria-hidden="true"
      >
        <div className="liquid-orb-primary absolute -top-44 left-1/4 w-[360px] sm:w-[620px] h-[360px] sm:h-[620px] rounded-full bg-gradient-to-br from-[#00E5A3]/[0.09] via-[#2DD4BF]/[0.05] to-transparent blur-[90px] sm:blur-[130px]" />
        <div className="liquid-orb-secondary absolute top-1/3 -right-36 w-[320px] sm:w-[520px] h-[320px] sm:h-[520px] rounded-full bg-gradient-to-tl from-[#38BDF8]/[0.08] via-[#0EA5E9]/[0.04] to-transparent blur-[95px] sm:blur-[140px]" />
        <div className="liquid-sheen-bar hidden sm:block absolute -bottom-56 left-1/3 w-[680px] h-[420px] rounded-full bg-gradient-to-tr from-[#10B981]/[0.06] via-[#2DD4BF]/[0.04] to-transparent blur-[150px]" />
      </div>

      {/* Top Bar Contract: 1-row, 3-zone header (Compact 56px on mobile to stay well under 15% viewport height) */}
      <header className="sticky top-0 z-30 glass-panel border-b border-white/[0.10]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            className="text-base sm:text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
          >
            AM Preset Finder
          </a>

          {/* Zone 2: 4 Single-line Navigation Links */}
          <nav
            aria-label="Navigasi Utama"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab('url');
                resetUrlSearchResults();
              }}
              className={`hover:text-[#00E5A3] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'url'
                  ? 'text-[#00E5A3] underline underline-offset-8'
                  : ''
              }`}
            >
              URL Video
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('text');
                resetTab2SearchResults();
              }}
              className={`hover:text-[#00E5A3] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'text'
                  ? 'text-[#00E5A3] underline underline-offset-8'
                  : ''
              }`}
            >
              Komentar & Teks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qr-image')}
              className={`hover:text-[#00E5A3] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'qr-image'
                  ? 'text-[#00E5A3] underline underline-offset-8'
                  : ''
              }`}
            >
              Scan Gambar QR
            </button>
            <button
              type="button"
              onClick={() => {
                setShowHistorySection((prev) => {
                  const next = !prev;
                  if (next) {
                    window.setTimeout(() => {
                      document
                        .getElementById('riwayat-preset')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }, 80);
                  }
                  return next;
                });
              }}
              className={`hover:text-[#00E5A3] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showHistorySection
                  ? 'text-[#00E5A3] underline underline-offset-8'
                  : ''
              }`}
            >
              Riwayat Preset {history.length > 0 ? `(${history.length})` : ''}
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('qr-image')}
              className="min-h-[38px] sm:min-h-[40px] px-3.5 sm:px-4 py-2 text-xs font-semibold text-slate-950 bg-[#00E5A3] hover:bg-[#00cca0] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Scan QR Galeri
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container — Airy, modern max-w-5xl workspace */}
      <main
        id="top"
        className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-10 space-y-5 sm:space-y-8"
      >
        {/* Clean, Uncluttered Hero & Mode Switcher */}
        <section className="space-y-4 sm:space-y-6">
          <div className="max-w-2xl space-y-1.5 sm:space-y-2.5">
            <div className="text-[11px] sm:text-xs font-mono text-[#00E5A3]">
              Ekstraktor Preset Alight Motion · TikTok, Instagram & YouTube
            </div>
            <h1 className="text-xl sm:text-4xl font-bold text-white tracking-tight font-display [text-wrap:balance]">
              Temukan & Ekstrak Tautan Preset Alight Motion dengan Cepat
            </h1>
            <p className="hidden sm:block text-sm sm:text-base text-slate-300 leading-relaxed">
              Deteksi otomatis tautan preset dari video TikTok, Instagram, dan YouTube, kolom komentar beserta balasan, maupun tangkapan layar kode QR secara utuh.
            </p>
          </div>

          {/* 3 Mode Input Tabs — Flexible 3-Column Grid on Mobile & Desktop */}
          <div
            role="tablist"
            aria-label="Mode Ekstraksi Preset"
            className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1.5 rounded-xl glass-panel max-w-2xl"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'url'}
              onClick={() => {
                setActiveTab('url');
                resetUrlSearchResults();
              }}
              className={`min-h-[44px] px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'url'
                  ? 'bg-[#00E5A3] text-slate-950 shadow-sm animate-state-pop'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only sm:not-sr-only">1. </span>URL Video
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'text'}
              onClick={() => {
                setActiveTab('text');
                resetTab2SearchResults();
              }}
              className={`min-h-[44px] px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'text'
                  ? 'bg-[#00E5A3] text-slate-950 shadow-sm animate-state-pop'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquareText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only sm:not-sr-only">2. </span>Komentar
                <span className="sr-only sm:not-sr-only"> & Teks</span>
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'qr-image'}
              onClick={() => setActiveTab('qr-image')}
              className={`min-h-[44px] px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'qr-image'
                  ? 'bg-[#00E5A3] text-slate-950 shadow-sm animate-state-pop'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only sm:not-sr-only">3. Scan </span>Gambar QR
              </span>
            </button>
          </div>
        </section>

        {/* TAB 1: URL VIDEO */}
        {activeTab === 'url' && (
          <section
            key="tab-url"
            aria-label="Ekstraktor URL TikTok, Instagram, dan YouTube"
            className="space-y-5 sm:space-y-8 animate-state-enter"
          >
            {/* Search Box & Pointers (Kolom Pencarian Beserta Penunjuknya) */}
            <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
              <form
                onSubmit={handleUrlFormSubmit}
                className="space-y-3 sm:space-y-3.5"
                noValidate
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="social-video-url-input"
                    className="block text-xs sm:text-sm font-semibold text-white"
                  >
                    Kolom Pencarian Tautan Video (TikTok, Instagram & YouTube)
                  </label>

                  {hasSearchedUrl && (
                    <button
                      type="button"
                      onClick={resetUrlSearchResults}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer animate-state-pop"
                    >
                      <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Sembunyikan Hasil</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1 min-w-0 flex items-center">
                    <Link2
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      ref={urlInputRef}
                      id="social-video-url-input"
                      type="url"
                      value={urlInput}
                      onChange={(e) => {
                        setUrlInput(e.target.value);
                        if (urlError) setUrlError(null);
                        if (hasSearchedUrl || currentVideoData) {
                          resetUrlSearchResults();
                        }
                      }}
                      placeholder="Tempel tautan TikTok, Instagram, atau YouTube di sini..."
                      className={`w-full min-h-[46px] pl-10 ${
                        urlInput ? 'pr-10' : 'pr-4'
                      } py-3 rounded-xl bg-slate-950/90 border border-white/15 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5A3] font-mono`}
                    />
                    {urlInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setUrlInput('');
                          setUrlError(null);
                          resetUrlSearchResults();
                          urlInputRef.current?.focus();
                        }}
                        aria-label="Bersihkan kolom pencarian"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer animate-state-pop"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Flexible 2-Column Button Grid on Mobile */}
                  <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handlePasteToUrlInput}
                      className="min-h-[44px] px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 text-slate-100 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {pastedUrlFeedback ? (
                        <span
                          key="pasted-url"
                          className="animate-state-pop flex items-center gap-2"
                        >
                          <Check
                            className="w-4 h-4 text-[#00E5A3]"
                            aria-hidden="true"
                          />
                          <span className="text-[#00E5A3]">Tertempel</span>
                        </span>
                      ) : (
                        <span
                          key="paste-url-idle"
                          className="animate-state-pop flex items-center gap-2"
                        >
                          <ClipboardPaste
                            className="w-4 h-4 text-[#00E5A3]"
                            aria-hidden="true"
                          />
                          <span>Tempel Tautan</span>
                        </span>
                      )}
                    </button>

                    <button
                      type="submit"
                      disabled={isLoadingUrl}
                      className="min-h-[44px] px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-[#00E5A3] text-slate-950 hover:bg-[#00cca0] disabled:opacity-60 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isLoadingUrl ? (
                        <span
                          key="searching-url"
                          className="animate-state-pop flex items-center gap-2"
                        >
                          <Loader2
                            className="w-4 h-4 animate-spin"
                            aria-hidden="true"
                          />
                          <span>Mencari...</span>
                        </span>
                      ) : (
                        <span
                          key="search-url-idle"
                          className="animate-state-pop flex items-center gap-2"
                        >
                          <Search className="w-4 h-4" aria-hidden="true" />
                          <span>Cari Preset</span>
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {urlError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2 animate-expand-reveal"
                  >
                    <AlertCircle
                      className="w-4 h-4 text-rose-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{urlError}</span>
                  </div>
                )}
              </form>

              {/* Penunjuk Pencarian (Search Pointers / Instructions) — Flexible 3-Column Grid on Mobile with Verbose Text Hidden */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-300">
                    Penunjuk Pencarian Preset:
                  </span>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHistorySection((prev) => !prev)}
                      className="text-xs text-[#00E5A3] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {showHistorySection
                          ? 'Sembunyikan Riwayat'
                          : `Lihat Riwayat (${history.length})`}
                      </span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="glass-subpanel p-2.5 sm:p-3.5 rounded-xl flex flex-col justify-center space-y-1 text-center sm:text-left">
                    <div className="text-[11px] sm:text-xs font-semibold text-[#00E5A3] whitespace-nowrap">
                      1. Tempel <span className="sm:hidden">Link</span>
                      <span className="hidden sm:inline">Tautan</span>
                    </div>
                    <p className="hidden sm:block text-xs text-slate-400 leading-relaxed">
                      Klik tombol <strong>Tempel Tautan</strong> untuk memasukkan link video TikTok, Instagram Reels, atau YouTube.
                    </p>
                  </div>

                  <div className="glass-subpanel p-2.5 sm:p-3.5 rounded-xl flex flex-col justify-center space-y-1 text-center sm:text-left">
                    <div className="text-[11px] sm:text-xs font-semibold text-[#00E5A3] whitespace-nowrap">
                      2. Tekan Cari
                    </div>
                    <p className="hidden sm:block text-xs text-slate-400 leading-relaxed">
                      Tekan tombol <strong>Cari Preset</strong> untuk memindai deskripsi, caption, komentar, dan kode QR.
                    </p>
                  </div>

                  <div className="glass-subpanel p-2.5 sm:p-3.5 rounded-xl flex flex-col justify-center space-y-1 text-center sm:text-left">
                    <div className="text-[11px] sm:text-xs font-semibold text-[#00E5A3] whitespace-nowrap">
                      3. Hasil Muncul
                    </div>
                    <p className="hidden sm:block text-xs text-slate-400 leading-relaxed">
                      Bagian hasil pencarian baru akan ditampilkan di bawah setelah proses pencarian selesai.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step-by-Step Loading Progress State — Flexible 2x2 Grid on Mobile */}
            {isLoadingUrl && (
              <div
                role="status"
                aria-live="polite"
                className="glass-panel rounded-2xl p-4 sm:p-6 space-y-3.5 sm:space-y-4 border border-[#00E5A3]/30 animate-state-enter"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-white truncate">
                    {commentScanStatusText ||
                      'Mengambil Video, Komentar & Mengekstrak Preset...'}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-[#00E5A3] shrink-0">
                    Tahap {loadingStepIndex + 1} / {LOADING_STEPS.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {LOADING_STEPS.map((stepText, idx) => {
                    const isCompleted = idx < loadingStepIndex;
                    const isCurrent = idx === loadingStepIndex;

                    return (
                      <div
                        key={stepText}
                        className={`p-2.5 sm:p-3.5 rounded-xl border text-[11px] sm:text-xs flex items-center gap-2 transition-all duration-300 ${
                          isCurrent
                            ? 'bg-[#00E5A3]/15 border-[#00E5A3]/50 text-white font-semibold animate-state-pop animate-live-pulse'
                            : isCompleted
                            ? 'bg-slate-900/80 border-[#00E5A3]/30 text-[#00E5A3]'
                            : 'bg-slate-950/50 border-white/10 text-slate-500'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00E5A3] shrink-0 animate-state-pop"
                            aria-hidden="true"
                          />
                        ) : isCurrent ? (
                          <Loader2
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00E5A3] animate-spin shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-slate-700 inline-block shrink-0" />
                        )}
                        <span className="leading-snug">{stepText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Results Section — Strictly hidden until the Search button is pressed (hasSearchedUrl === true) */}
            {!isLoadingUrl && hasSearchedUrl && currentVideoData && (
              <div className="space-y-5 sm:space-y-8 animate-state-enter">
                {/* Unified Video Player (Full Controls) & Video Caption Details Section */}
                <div className="animate-state-enter stagger-1">
                  <UnifiedVideoCaptionSection
                    videoData={currentVideoData}
                    captionLinksCount={captionExtractedLinks.length}
                    commentLinksCount={commentExtractedPresetLinks.length}
                    detectedQr={videoDetectedQr}
                    onJumpToQrScanner={() => {
                      document
                        .getElementById('video-qr-scanner-panel')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                </div>

                {/* Combined Extracted Preset Links */}
                <div className="animate-state-enter stagger-2">
                  <PresetResultsList links={urlExtractedLinks} />
                </div>

                {/* Comments & Replies Preset Scanner Panel (TikTok or YouTube comments) */}
                {(currentVideoData.platform === 'tiktok' ||
                  commentThreads.length > 0) && (
                  <div className="animate-state-enter stagger-3">
                    <TikTokCommentsScannerPanel
                      platform={currentVideoData.platform}
                      videoId={currentVideoData.id}
                      sourceUrl={currentVideoData.sourceUrl}
                      creatorUniqueId={currentVideoData.author.uniqueId}
                      threads={commentThreads}
                      cursor={commentsCursor}
                      hasMore={commentsHasMore}
                      isScanningInitial={isScanningComments}
                      scanStatusText={commentScanStatusText}
                      scanError={commentScanError}
                      onThreadsUpdated={handleThreadsUpdatedFromPanel}
                      onRetryInitialScan={() => {
                        if (currentVideoData.platform === 'youtube') {
                          executeUrlExtraction(currentVideoData.sourceUrl);
                        } else {
                          runTikTokCommentsAndRepliesScan(
                            currentVideoData,
                            captionExtractedLinks
                          );
                        }
                      }}
                    />
                  </div>
                )}

                {/* Auto Video QR Scanner (when direct video stream is available) */}
                {currentVideoData.playUrl && (
                  <div className="animate-state-enter stagger-4">
                    <VideoQrScannerPanel
                      videoData={currentVideoData}
                      autoStartScan={true}
                      onQrDetected={handleVideoQrDetected}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Direct Link Extraction View (Only shown after pressing Search button) */}
            {!isLoadingUrl && hasSearchedUrl && !currentVideoData && (
              <div className="animate-state-enter">
                <PresetResultsList links={urlExtractedLinks} />
              </div>
            )}
          </section>
        )}

        {/* TAB 2: KOMENTAR & TEKS (Unified Clean Surface) */}
        {activeTab === 'text' && (
          <section
            key="tab-text"
            aria-label="Filter Teks dan Pemindai Kolom Komentar TikTok dan YouTube"
            className="space-y-5 sm:space-y-8 animate-state-enter"
          >
            <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6">
              {/* Part 1: Scan TikTok / YouTube Comments & Replies by Video Link */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                      <MessageSquare
                        className="w-4 h-4 text-[#00E5A3] shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Pindai Kolom Komentar & Balasan dari Tautan Video TikTok / YouTube
                      </span>
                    </h2>
                    <p className="hidden sm:block text-xs text-slate-400 mt-0.5">
                      Tempel tautan video lalu tekan tombol Cari untuk mengekstrak tautan preset di kolom komentar.
                    </p>
                  </div>

                  {(hasAnalyzedComment || tab2VideoMeta) && (
                    <button
                      type="button"
                      onClick={resetTab2SearchResults}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer animate-state-pop"
                    >
                      <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Sembunyikan Hasil</span>
                    </button>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleScanTiktokCommentsInTab2(tab2TiktokUrl);
                  }}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                  noValidate
                >
                  <label htmlFor="tab2-tiktok-comment-url" className="sr-only">
                    Tautan Video TikTok atau YouTube untuk Pindai Komentar
                  </label>
                  <div className="relative flex-1 min-w-0 flex items-center">
                    <Link2
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      ref={tab2UrlInputRef}
                      id="tab2-tiktok-comment-url"
                      type="url"
                      value={tab2TiktokUrl}
                      onChange={(e) => {
                        setTab2TiktokUrl(e.target.value);
                        if (commentError) setCommentError(null);
                        if (hasAnalyzedComment || tab2VideoMeta) {
                          resetTab2SearchResults();
                        }
                      }}
                      placeholder="https://vt.tiktok.com/... atau https://www.youtube.com/watch?v=..."
                      className={`w-full min-h-[44px] pl-10 ${
                        tab2TiktokUrl ? 'pr-10' : 'pr-4'
                      } py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5A3] font-mono`}
                    />
                    {tab2TiktokUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setTab2TiktokUrl('');
                          setCommentError(null);
                          resetTab2SearchResults();
                          tab2UrlInputRef.current?.focus();
                        }}
                        aria-label="Bersihkan tautan video komentar"
                        className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer animate-state-pop"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handlePasteToTab2UrlInput}
                      className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 text-slate-100 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {pastedTab2UrlFeedback ? (
                        <span
                          key="tab2-pasted"
                          className="animate-state-pop flex items-center gap-1.5"
                        >
                          <Check
                            className="w-3.5 h-3.5 text-[#00E5A3]"
                            aria-hidden="true"
                          />
                          <span className="text-[#00E5A3]">Tertempel</span>
                        </span>
                      ) : (
                        <span
                          key="tab2-paste-idle"
                          className="animate-state-pop flex items-center gap-1.5"
                        >
                          <ClipboardPaste
                            className="w-3.5 h-3.5 text-[#00E5A3]"
                            aria-hidden="true"
                          />
                          <span>Tempel Tautan</span>
                        </span>
                      )}
                    </button>

                    <button
                      type="submit"
                      disabled={isScanningComments}
                      className="min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl bg-[#00E5A3] text-slate-950 hover:bg-[#00cca0] disabled:opacity-60 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isScanningComments ? (
                        <span
                          key="tab2-scanning"
                          className="animate-state-pop flex items-center gap-2"
                        >
                          <Loader2
                            className="w-4 h-4 animate-spin"
                            aria-hidden="true"
                          />
                          <span>Mencari...</span>
                        </span>
                      ) : (
                        <span
                          key="tab2-scan-idle"
                          className="animate-state-pop flex items-center gap-2"
                        >
                          <Search className="w-4 h-4" aria-hidden="true" />
                          <span>Cari Komentar</span>
                        </span>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Hairline Divider */}
              <div className="border-t border-white/[0.08]" />

              {/* Part 2: Manual Paste Comment / Reply Text Filter */}
              <form
                onSubmit={handleAnalyzeCommentSubmit}
                className="space-y-3"
                noValidate
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="comment-filter-textarea"
                    className="text-xs sm:text-sm font-semibold text-white"
                  >
                    Atau Tempel Teks Komentar / Deskripsi Manual
                  </label>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handlePasteToCommentTextarea}
                      className="text-xs font-semibold text-[#00E5A3] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {pastedCommentTextFeedback ? (
                        <span
                          key="comment-text-pasted"
                          className="animate-state-pop flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Teks Tertempel</span>
                        </span>
                      ) : (
                        <span
                          key="comment-text-idle"
                          className="animate-state-pop flex items-center gap-1"
                        >
                          <ClipboardPaste
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          <span>Tempel Teks</span>
                        </span>
                      )}
                    </button>

                    {commentText && (
                      <button
                        type="button"
                        onClick={() => {
                          setCommentText('');
                          setHasAnalyzedComment(false);
                          setCommentError(null);
                        }}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer animate-state-pop"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Bersihkan</span>
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  ref={commentTextareaRef}
                  id="comment-filter-textarea"
                  rows={3}
                  value={commentText}
                  onChange={(e) => {
                    setCommentText(e.target.value);
                    if (commentError) setCommentError(null);
                    if (hasAnalyzedComment) {
                      setHasAnalyzedComment(false);
                    }
                  }}
                  placeholder="Tempelkan salinan komentar atau deskripsi YouTube/TikTok/IG di sini... (Contoh: https://alight.link/... atau https://drive.google.com/file/...)"
                  className="w-full p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-white/15 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5A3] font-mono leading-relaxed"
                />

                {commentError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2 animate-expand-reveal"
                  >
                    <AlertCircle
                      className="w-4 h-4 text-rose-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{commentError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-[#00E5A3]" aria-hidden="true" />
                    <span>Cari Link AM dari Teks</span>
                  </button>
                </div>
              </form>

              {/* Penunjuk Pencarian Komentar & Teks — Flexible 2-Column Grid on Mobile */}
              <div className="pt-2 border-t border-white/[0.08] grid grid-cols-2 gap-2 sm:gap-3">
                <div className="glass-subpanel p-2.5 sm:p-3.5 rounded-xl space-y-1 text-center sm:text-left">
                  <div className="text-[11px] sm:text-xs font-semibold text-[#00E5A3]">
                    1. Via Tautan Video
                  </div>
                  <p className="hidden sm:block text-xs text-slate-400 leading-relaxed">
                    Klik <strong>Tempel Tautan</strong> lalu tekan <strong>Cari Komentar</strong> untuk memindai komentar dan balasan video TikTok atau YouTube.
                  </p>
                </div>
                <div className="glass-subpanel p-2.5 sm:p-3.5 rounded-xl space-y-1 text-center sm:text-left">
                  <div className="text-[11px] sm:text-xs font-semibold text-[#00E5A3]">
                    2. Filter Teks Manual
                  </div>
                  <p className="hidden sm:block text-xs text-slate-400 leading-relaxed">
                    Klik <strong>Tempel Teks</strong> lalu tekan <strong>Cari Link AM dari Teks</strong> untuk mengekstrak seluruh tautan preset di dalam teks panjang.
                  </p>
                </div>
              </div>
            </div>

            {hasAnalyzedComment && (
              <div className="animate-state-enter stagger-1">
                <PresetResultsList links={commentExtractedLinks} />
              </div>
            )}

            {(isScanningComments ||
              (hasAnalyzedComment &&
                (commentThreads.length > 0 || tab2VideoMeta))) && (
              <div className="animate-state-enter stagger-2">
                <TikTokCommentsScannerPanel
                  platform={(tab2VideoMeta || currentVideoData)?.platform || 'tiktok'}
                  videoId={(tab2VideoMeta || currentVideoData)?.id || ''}
                  sourceUrl={
                    (tab2VideoMeta || currentVideoData)?.sourceUrl ||
                    tab2TiktokUrl
                  }
                  creatorUniqueId={
                    (tab2VideoMeta || currentVideoData)?.author.uniqueId || ''
                  }
                  threads={commentThreads}
                  cursor={commentsCursor}
                  hasMore={commentsHasMore}
                  isScanningInitial={isScanningComments}
                  scanStatusText={commentScanStatusText}
                  scanError={commentScanError}
                  onThreadsUpdated={handleThreadsUpdatedFromPanel}
                  onRetryInitialScan={() => {
                    const target =
                      tab2TiktokUrl ||
                      (tab2VideoMeta || currentVideoData)?.sourceUrl ||
                      '';
                    if (target) {
                      handleScanTiktokCommentsInTab2(target);
                    }
                  }}
                />
              </div>
            )}
          </section>
        )}

        {/* TAB 3: SCAN GAMBAR QR */}
        {activeTab === 'qr-image' && (
          <section
            key="tab-qr-image"
            aria-label="Pemindai Screenshot Gambar QR Alight Motion"
            className="animate-state-enter"
          >
            <QrImageUploadTab onQrImageExtracted={handleQrImageExtracted} />
          </section>
        )}

        {/* RIWAYAT PRESET (LOCALSTORAGE) — Only shown when toggled or after user explicitly requests it */}
        {showHistorySection && (
          <div className="animate-state-enter">
            <PresetHistorySection
              history={history}
              onDeleteRecord={handleDeleteHistoryItem}
              onClearAll={handleClearAllHistory}
            />
          </div>
        )}
      </main>

      {/* Modern Structured Footer with Flexible Mobile Grid */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-[#070A12] mt-10 sm:mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 sm:space-y-10">
          <div className="grid grid-cols-2 lg:grid-cols-12 gap-6 sm:gap-8">
            {/* Column 1: Brand & Developer Profile */}
            <div className="col-span-2 lg:col-span-5 space-y-2.5 sm:space-y-3">
              <div className="text-base font-bold text-white font-display tracking-tight">
                AM Preset Finder
              </div>
              <p className="hidden sm:block text-xs text-slate-400 leading-relaxed max-w-sm">
                Platform ekstraktor tautan preset Alight Motion (5MB, XML & Kode QR) dari video, deskripsi, kolom komentar, dan balasan TikTok, Instagram, maupun YouTube.
              </p>
              <div className="pt-0.5 sm:pt-1 text-xs text-slate-300 flex flex-wrap sm:flex-col items-center sm:items-start gap-x-4 gap-y-1">
                <div>
                  Pengembang:{' '}
                  <strong className="text-white font-semibold">
                    Dimas Kurniawan
                  </strong>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span>TikTok:</span>
                  <a
                    href={TIKTOK_CONTACT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00E5A3] hover:underline font-mono inline-flex items-center gap-1"
                  >
                    <span>@ludexkurniawan</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>

            {/* Column 2: Support (SociaBuzz & Saluran WhatsApp) */}
            <div className="col-span-1 lg:col-span-4 space-y-2.5 sm:space-y-3 min-w-0">
              <h3 className="text-xs font-semibold text-white tracking-wide">
                Support
              </h3>
              <ul className="space-y-2 sm:space-y-2.5 text-xs text-slate-400">
                <li>
                  <a
                    href={SOCIABUZZ_SUPPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00E5A3] hover:underline font-semibold transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Beri Dukungan (SociaBuzz)</span>
                    <ExternalLink className="w-3 h-3 text-[#00E5A3] shrink-0" aria-hidden="true" />
                  </a>
                </li>
                <li>
                  <a
                    href={WHATSAPP_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-200 hover:text-[#00E5A3] font-medium transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Saluran WhatsApp</span>
                    <ExternalLink className="w-3 h-3 text-[#00E5A3] shrink-0" aria-hidden="true" />
                  </a>
                </li>
                <li className="hidden sm:list-item">
                  <a
                    href={WHATSAPP_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-300 hover:text-[#00E5A3] transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Gabung Saluran WhatsApp Resmi</span>
                    <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </a>
                </li>
                <li>
                  <a
                    href={TIKTOK_CONTACT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-300 hover:text-[#00E5A3] transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>TikTok @ludexkurniawan</span>
                    <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Legal (Terms of Service & Privacy Policy) */}
            <div className="col-span-1 lg:col-span-3 space-y-2.5 sm:space-y-3">
              <h3 className="text-xs font-semibold text-white tracking-wide">
                Legal
              </h3>
              <ul className="space-y-2 sm:space-y-2.5 text-xs text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveLegalDoc('tos')}
                    className="text-slate-300 hover:text-[#00E5A3] transition-colors cursor-pointer"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveLegalDoc('privacy')}
                    className="text-slate-300 hover:text-[#00E5A3] transition-colors cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setShowWelcomeModal(true)}
                    className="text-slate-300 hover:text-[#00E5A3] transition-colors cursor-pointer"
                  >
                    Info & Dukungan Aplikasi
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Attribution Bar */}
          <div className="pt-5 sm:pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs text-slate-400 text-center sm:text-left">
            <div>
              © {new Date().getFullYear()} AM Preset Finder · Hak Cipta{' '}
              <strong className="text-slate-200 font-medium">
                Dimas Kurniawan
              </strong>
              . Seluruh hak cipta dilindungi.
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setActiveLegalDoc('tos')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Terms of Service
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setActiveLegalDoc('privacy')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
              <span aria-hidden="true">·</span>
              <a
                href={SOCIABUZZ_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00E5A3] hover:underline font-medium"
              >
                Beri Dukungan
              </a>
              <span aria-hidden="true">·</span>
              <a
                href={WHATSAPP_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00E5A3] hover:underline font-medium"
              >
                Saluran WhatsApp
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Aesthetic Welcome Popup Modal on Initial Page Load */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />

      {/* Interactive Legal Modal (Terms of Service & Privacy Policy) */}
      <LegalModal
        activeDoc={activeLegalDoc}
        onSelectDoc={(doc) => setActiveLegalDoc(doc)}
        onClose={() => setActiveLegalDoc(null)}
      />
    </div>
  );
}
