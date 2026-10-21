/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from 'react';
import {
  Link2,
  MessageSquareText,
  QrCode,
  Search,
  CheckCircle2,
  Loader2,
  AlertCircle,
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
  KeywordPresetSearchResultItem,
} from './utils/tikwmApi';
import { QrScanDetection } from './utils/qrHelper';
import { VideoQrScannerPanel } from './components/VideoQrScannerPanel';
import { UnifiedVideoCaptionSection } from './components/UnifiedVideoCaptionSection';
import { TikTokCommentsScannerPanel } from './components/TikTokCommentsScannerPanel';
import { PresetResultsList } from './components/PresetResultsList';
import { QrImageUploadTab } from './components/QrImageUploadTab';
import { KeywordPresetSearchTab } from './components/KeywordPresetSearchTab';
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
import {
  AmLogoSvg,
  HeroLogoWatermark,
  CardCornerWatermark,
} from './components/AmLogoWatermark';
import {
  InitialLoadingScreen,
  SearchLoadingOverlay,
} from './components/LoadingScreen';
import { liquidPointerHandlers } from './utils/liquidGlass';

type ActiveTab = 'url' | 'keyword-search' | 'text' | 'qr-image';

const TAB_ORDER: ActiveTab[] = ['url', 'keyword-search', 'text', 'qr-image'];

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
  const pillTimerRef = useRef<number | null>(null);

  // Refs for accurate top navbar capsule sliding pill measurement
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const navButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [navPillGeometry, setNavPillGeometry] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 5, width: 0, ready: false });

  // Refs for accurate main mode switcher sliding pill measurement
  const tabSwitcherContainerRef = useRef<HTMLDivElement | null>(null);
  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tabPillGeometry, setTabPillGeometry] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 0, width: 0, ready: false });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (
        tabParam === 'url' ||
        tabParam === 'keyword-search' ||
        tabParam === 'text' ||
        tabParam === 'qr-image'
      ) {
        return tabParam;
      }
    } catch {
      // Ignore
    }
    return 'url';
  });

  // Explicit states to hide History & Results by default before link is pasted or searched
  const [hasPastedOrSearched, setHasPastedOrSearched] =
    useState<boolean>(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(false);

  // Sliding Liquid Pill Spring State
  const [isSlidingPill, setIsSlidingPill] = useState<boolean>(false);

  const triggerPillSlideBounce = useCallback(() => {
    setIsSlidingPill(true);
    if (pillTimerRef.current !== null) {
      window.clearTimeout(pillTimerRef.current);
    }
    pillTimerRef.current = window.setTimeout(() => {
      setIsSlidingPill(false);
    }, 300);
  }, []);

  const handleSelectTab = useCallback(
    (nextTab: ActiveTab) => {
      triggerPillSlideBounce();
      setActiveTab(nextTab);
    },
    [triggerPillSlideBounce]
  );

  useEffect(() => {
    return () => {
      if (pillTimerRef.current !== null) {
        window.clearTimeout(pillTimerRef.current);
      }
    };
  }, []);

  // Legal Modal State (Terms of Service & Privacy Policy)
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(
    () => {
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
    }
  );

  // Welcome Modal State
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

  // Tab: Filter Teks / Komentar & Pemindai Komentar TikTok State
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
    setIsLoadingUrl(false);
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
    setIsScanningComments(false);
    setHasAnalyzedComment(false);
    setTab2VideoMeta(null);
    setCommentExtractedLinks([]);
    setCommentThreads([]);
    setCommentsCursor(0);
    setCommentsHasMore(false);
    setCommentScanError(null);
    setCommentExtractedPresetLinks([]);
  }, []);

  const handleClearUrlInputAndReset = useCallback(() => {
    setUrlInput('');
    setUrlError(null);
    resetUrlSearchResults();
    setHasPastedOrSearched(false);
    setIsHistoryVisible(false);
    urlInputRef.current?.focus();
  }, [resetUrlSearchResults]);

  const handlePasteToUrlInput = async () => {
    setUrlError(null);
    setHasPastedOrSearched(true);
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
    setHasPastedOrSearched(true);
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
    setHasPastedOrSearched(true);
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

  const handleKeywordPresetSavedToHistory = useCallback(
    (item: KeywordPresetSearchResultItem) => {
      upsertHistoryRecord({
        id: `kw-${item.id}`,
        title: item.title || `Preset ${item.soundTitle}`,
        authorHandle: `@${item.author.uniqueId}`,
        sourceMode: 'url',
        sourceUrl: item.sourceUrl,
        createdAtIso: new Date().toISOString(),
        links: item.extractedLinks,
      });
    },
    [upsertHistoryRecord]
  );

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

      setHasPastedOrSearched(true);

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
        setHasPastedOrSearched(true);
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

    setHasPastedOrSearched(true);
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

    setHasPastedOrSearched(true);

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
      setHasPastedOrSearched(true);
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

  const activeTabIndex = Math.max(0, TAB_ORDER.indexOf(activeTab));
  const activeNavIndex = isHistoryVisible ? 4 : activeTabIndex;

  // Derived flags for clean conditional rendering:
  // When URL input is empty or not yet searched, force idle state
  const isUrlTabIdle =
    !isLoadingUrl &&
    (!hasSearchedUrl || !urlInput.trim() || !hasPastedOrSearched);
  const canShowUrlResults =
    !isLoadingUrl &&
    hasSearchedUrl &&
    hasPastedOrSearched &&
    Boolean(urlInput.trim());

  const isTab2Idle =
    !isScanningComments &&
    (!hasAnalyzedComment ||
      (!tab2TiktokUrl.trim() && !commentText.trim()) ||
      !hasPastedOrSearched);
  const canShowTab2Results =
    hasPastedOrSearched &&
    hasAnalyzedComment &&
    Boolean(tab2TiktokUrl.trim() || commentText.trim());

  // Measure the exact offsetLeft and offsetWidth of the active top navbar button & main mode tab button
  const updatePillPositions = useCallback(() => {
    const activeNavBtn = navButtonRefs.current[activeNavIndex];
    if (activeNavBtn && activeNavBtn.offsetWidth > 0) {
      setNavPillGeometry({
        left: activeNavBtn.offsetLeft,
        width: activeNavBtn.offsetWidth,
        ready: true,
      });
    }

    const activeModeBtn = tabButtonRefs.current[activeTabIndex];
    if (activeModeBtn && activeModeBtn.offsetWidth > 0) {
      setTabPillGeometry({
        left: activeModeBtn.offsetLeft,
        width: activeModeBtn.offsetWidth,
        ready: true,
      });
    }
  }, [activeNavIndex, activeTabIndex]);

  useLayoutEffect(() => {
    updatePillPositions();
  }, [updatePillPositions, history.length, activeTab, isHistoryVisible]);

  useEffect(() => {
    const handleResize = () => updatePillPositions();
    window.addEventListener('resize', handleResize, { passive: true });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updatePillPositions();
      });
      if (navContainerRef.current) observer.observe(navContainerRef.current);
      if (tabSwitcherContainerRef.current) {
        observer.observe(tabSwitcherContainerRef.current);
      }
      navButtonRefs.current.forEach((btn) => {
        if (btn) observer?.observe(btn);
      });
      tabButtonRefs.current.forEach((btn) => {
        if (btn) observer?.observe(btn);
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [updatePillPositions]);

  return (
    <div className="min-h-screen max-w-[100vw] overflow-x-hidden flex flex-col bg-slate-950 text-[#f1f5f9] relative selection:bg-[#2dd4bf]/20 selection:text-[#38bdf8]">
      {/* Lightweight Pure-CSS Radial-Gradient Ambient Glow (Zero Blur Filter, Zero Continuous Animation) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] z-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.15)_0%,transparent_70%)]"
      />

      {/* Top Bar Contract: ONLY element using backdrop-blur-md for 60fps mobile scroll */}
      <header
        {...liquidPointerHandlers}
        className="sticky top-0 z-30 backdrop-blur-md bg-slate-950/85 border-b border-cyan-500/20 transform-gpu"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2.5 sm:gap-4 min-w-0">
          {/* Zone 1: Brand Wordmark with Logo Mark (shrink-0 so it never gets squished or overlapped) */}
          <a
            href="#top"
            className="flex items-center gap-2 sm:gap-2.5 text-sm sm:text-lg font-bold tracking-tight font-display whitespace-nowrap shrink-0"
          >
            <img
              src="/favicon.png"
              alt=""
              aria-hidden="true"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-white/10 shrink-0"
            />
            <span className="text-liquid-gradient shrink-0">
              AM Preset Finder
            </span>
          </a>

          {/* Zone 2: Wrapper with min-w-0 and flex-1 + scrollable flex-nowrap scroll-smooth container */}
          <div className="min-w-0 flex-1 flex items-center justify-end md:justify-center">
            <nav
              aria-label="Navigasi Utama"
              className="navbar-capsule-scroll min-w-0 max-w-full overflow-x-auto whitespace-nowrap flex-nowrap scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] rounded-full"
            >
              <div
                ref={navContainerRef}
                {...liquidPointerHandlers}
                className="navbar-capsule-container transform-gpu flex-nowrap whitespace-nowrap overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                <div
                  aria-hidden="true"
                  data-testid="sliding-liquid-nav-pill"
                  style={{
                    left: `${navPillGeometry.left}px`,
                    width: `${navPillGeometry.width}px`,
                    opacity: navPillGeometry.ready ? 1 : 0,
                    transform: `scale(${isSlidingPill ? 1.02 : 1})`,
                  }}
                  className="sliding-liquid-pill transform-gpu absolute inset-y-[5px] rounded-full z-0"
                />

                <button
                  ref={(el) => {
                    navButtonRefs.current[0] = el;
                  }}
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={() => {
                    setIsHistoryVisible(false);
                    handleSelectTab('url');
                  }}
                  className={`navbar-capsule-item transform-gpu shrink-0 whitespace-nowrap ${
                    activeNavIndex === 0
                      ? 'text-[#f1f5f9]'
                      : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                  }`}
                >
                  <span>🔗 URL Video</span>
                </button>

                <button
                  ref={(el) => {
                    navButtonRefs.current[1] = el;
                  }}
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={() => {
                    setIsHistoryVisible(false);
                    handleSelectTab('keyword-search');
                  }}
                  className={`navbar-capsule-item transform-gpu shrink-0 whitespace-nowrap ${
                    activeNavIndex === 1
                      ? 'text-[#f1f5f9]'
                      : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                  }`}
                >
                  <span>🔍 Cari Preset</span>
                </button>

                <button
                  ref={(el) => {
                    navButtonRefs.current[2] = el;
                  }}
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={() => {
                    setIsHistoryVisible(false);
                    handleSelectTab('text');
                  }}
                  className={`navbar-capsule-item transform-gpu shrink-0 whitespace-nowrap ${
                    activeNavIndex === 2
                      ? 'text-[#f1f5f9]'
                      : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                  }`}
                >
                  <span>Komentar & Teks</span>
                </button>

                <button
                  ref={(el) => {
                    navButtonRefs.current[3] = el;
                  }}
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={() => {
                    setIsHistoryVisible(false);
                    handleSelectTab('qr-image');
                  }}
                  className={`navbar-capsule-item transform-gpu shrink-0 whitespace-nowrap ${
                    activeNavIndex === 3
                      ? 'text-[#f1f5f9]'
                      : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                  }`}
                >
                  <span>Scan Gambar QR</span>
                </button>

                <button
                  ref={(el) => {
                    navButtonRefs.current[4] = el;
                  }}
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={() => {
                    triggerPillSlideBounce();
                    setIsHistoryVisible((prev) => {
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
                  className={`navbar-capsule-item transform-gpu shrink-0 whitespace-nowrap ${
                    activeNavIndex === 4
                      ? 'text-[#f1f5f9]'
                      : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                  }`}
                >
                  <span>
                    Riwayat Preset
                    {history.length > 0 ? ` (${history.length})` : ''}
                  </span>
                </button>
              </div>
            </nav>
          </div>

          {/* Zone 3: Primary Action Button (shrink-0) */}
          <div className="hidden lg:flex items-center shrink-0">
            <button
              type="button"
              {...liquidPointerHandlers}
              onClick={() => {
                setIsHistoryVisible(false);
                handleSelectTab('qr-image');
              }}
              className="liquid-btn-primary transform-gpu min-h-[38px] px-3.5 py-2 text-xs font-semibold active:scale-95 rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <QrCode
                className="w-3.5 h-3.5 text-[#2dd4bf] shrink-0"
                aria-hidden="true"
              />
              <span>Scan QR Galeri</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main
        id="top"
        className="relative z-10 flex-1 max-w-5xl w-full min-w-0 overflow-x-hidden mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-10 space-y-5 sm:space-y-8"
      >
        {/* Hero & Mode Switcher with Subtle Large Logo Watermark */}
        <section className="relative space-y-4 sm:space-y-6">
          {/* 2a) Hero Background Watermark Silhouette */}
          <HeroLogoWatermark />

          <div className="relative z-10 max-w-2xl space-y-1.5 sm:space-y-2.5">
            <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-mono text-[#2dd4bf]">
              <AmLogoSvg className="w-4 h-4 shrink-0" />
              <span>
                Ekstraktor Preset Alight Motion · TikTok, Instagram & YouTube
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#f1f5f9] tracking-tight font-display [text-wrap:balance]">
              Temukan & Ekstrak{' '}
              <span className="text-liquid-gradient">
                Tautan Preset Alight Motion
              </span>{' '}
              dengan Cepat
            </h1>
            <p className="hidden sm:block text-sm sm:text-base text-[#94a3b8] leading-relaxed">
              Deteksi otomatis tautan preset dari video TikTok, Instagram, dan
              YouTube, pencarian kata kunci & nama lagu, kolom komentar, maupun
              tangkapan layar kode QR secara utuh.
            </p>
          </div>

          {/* 4 Mode Input Tabs — Smooth Sliding Liquid Pill Indicator */}
          <div
            role="tablist"
            aria-label="Mode Ekstraksi Preset"
            {...liquidPointerHandlers}
            className="relative z-10 p-1.5 rounded-2xl glass-panel transform-gpu max-w-3xl overflow-x-auto whitespace-nowrap flex-nowrap scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <div
              ref={tabSwitcherContainerRef}
              className="relative flex sm:grid sm:grid-cols-4 items-center gap-1 min-w-max sm:min-w-0"
            >
              <div
                aria-hidden="true"
                data-testid="sliding-liquid-tab-pill"
                style={{
                  left: `${tabPillGeometry.left}px`,
                  width: `${tabPillGeometry.width}px`,
                  opacity: tabPillGeometry.ready ? 1 : 0,
                  transform: `scale(${isSlidingPill ? 1.02 : 1})`,
                }}
                className="sliding-liquid-pill transform-gpu absolute inset-y-0 rounded-xl z-0"
              />

              <button
                ref={(el) => {
                  tabButtonRefs.current[0] = el;
                }}
                type="button"
                role="tab"
                aria-selected={activeTab === 'url'}
                {...liquidPointerHandlers}
                onPointerDown={(e) => {
                  liquidPointerHandlers.onPointerDown(e);
                  triggerPillSlideBounce();
                }}
                onClick={() => {
                  handleSelectTab('url');
                }}
                className={`transform-gpu relative z-10 min-h-[44px] px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer bg-transparent active:scale-95 transition-[transform,opacity,color,background-color] duration-300 ease-in-out ${
                  activeTab === 'url'
                    ? 'text-[#f1f5f9]'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                }`}
              >
                <span>🔗 URL Video</span>
              </button>

              <button
                ref={(el) => {
                  tabButtonRefs.current[1] = el;
                }}
                type="button"
                role="tab"
                aria-selected={activeTab === 'keyword-search'}
                {...liquidPointerHandlers}
                onPointerDown={(e) => {
                  liquidPointerHandlers.onPointerDown(e);
                  triggerPillSlideBounce();
                }}
                onClick={() => {
                  handleSelectTab('keyword-search');
                }}
                className={`transform-gpu relative z-10 min-h-[44px] px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer bg-transparent active:scale-95 transition-[transform,opacity,color,background-color] duration-300 ease-in-out ${
                  activeTab === 'keyword-search'
                    ? 'text-[#f1f5f9]'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                }`}
              >
                <span>🔍 Cari Preset</span>
              </button>

              <button
                ref={(el) => {
                  tabButtonRefs.current[2] = el;
                }}
                type="button"
                role="tab"
                aria-selected={activeTab === 'text'}
                {...liquidPointerHandlers}
                onPointerDown={(e) => {
                  liquidPointerHandlers.onPointerDown(e);
                  triggerPillSlideBounce();
                }}
                onClick={() => {
                  handleSelectTab('text');
                }}
                className={`transform-gpu relative z-10 min-h-[44px] px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer bg-transparent active:scale-95 transition-[transform,opacity,color,background-color] duration-300 ease-in-out ${
                  activeTab === 'text'
                    ? 'text-[#f1f5f9]'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                }`}
              >
                <MessageSquareText
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-colors duration-300 ease-in-out ${
                    activeTab === 'text' ? 'text-[#38bdf8]' : 'text-[#94a3b8]'
                  }`}
                  aria-hidden="true"
                />
                <span>Komentar & Teks</span>
              </button>

              <button
                ref={(el) => {
                  tabButtonRefs.current[3] = el;
                }}
                type="button"
                role="tab"
                aria-selected={activeTab === 'qr-image'}
                {...liquidPointerHandlers}
                onPointerDown={(e) => {
                  liquidPointerHandlers.onPointerDown(e);
                  triggerPillSlideBounce();
                }}
                onClick={() => handleSelectTab('qr-image')}
                className={`transform-gpu relative z-10 min-h-[44px] px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer bg-transparent active:scale-95 transition-[transform,opacity,color,background-color] duration-300 ease-in-out ${
                  activeTab === 'qr-image'
                    ? 'text-[#f1f5f9]'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                }`}
              >
                <QrCode
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-colors duration-300 ease-in-out ${
                    activeTab === 'qr-image'
                      ? 'text-[#2dd4bf]'
                      : 'text-[#94a3b8]'
                  }`}
                  aria-hidden="true"
                />
                <span>Scan Gambar QR</span>
              </button>
            </div>
          </div>
        </section>

        {/* TAB 1: URL VIDEO */}
        {activeTab === 'url' && (
          <section
            key="tab-url"
            aria-label="Ekstraktor URL TikTok, Instagram, dan YouTube"
            className="space-y-5 sm:space-y-8 animate-state-enter"
          >
            {/* Search Box & Conditional Pointers with Bottom-Right Logo Watermark */}
            <div
              {...liquidPointerHandlers}
              className="glass-panel transform-gpu rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-hidden"
            >
              {/* 2b) Card Bottom-Right Corner Watermark */}
              <CardCornerWatermark />

              <form
                onSubmit={handleUrlFormSubmit}
                className="relative z-10 space-y-3 sm:space-y-3.5"
                noValidate
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="social-video-url-input"
                    className="block text-xs sm:text-sm font-semibold text-[#f1f5f9]"
                  >
                    Kolom Pencarian Tautan Video (TikTok, Instagram & YouTube)
                  </label>

                  {canShowUrlResults && (
                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={resetUrlSearchResults}
                      className="text-xs text-[#94a3b8] hover:text-[#2dd4bf] active:scale-95 flex items-center gap-1.5 transition-colors cursor-pointer animate-state-pop"
                    >
                      <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Sembunyikan Hasil</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1 min-w-0 flex items-center w-full">
                    <Link2
                      className="w-4 h-4 text-[#38bdf8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"
                      aria-hidden="true"
                    />
                    <input
                      ref={urlInputRef}
                      id="social-video-url-input"
                      type="url"
                      value={urlInput}
                      {...liquidPointerHandlers}
                      onPaste={() => {
                        setHasPastedOrSearched(true);
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUrlInput(val);
                        if (val.trim()) {
                          setHasPastedOrSearched(true);
                        } else {
                          setHasPastedOrSearched(false);
                          setIsHistoryVisible(false);
                        }
                        if (urlError) setUrlError(null);
                        if (hasSearchedUrl || currentVideoData) {
                          resetUrlSearchResults();
                        }
                      }}
                      placeholder="Tempel tautan TikTok, Instagram, atau YouTube di sini..."
                      className={`liquid-input w-full min-h-[46px] pl-10 ${
                        urlInput ? 'pr-10' : 'pr-4'
                      } py-2.5 sm:py-3 rounded-xl text-base sm:text-sm text-[#f1f5f9] placeholder:text-[#94a3b8]/75 font-mono`}
                    />
                    {urlInput && (
                      <button
                        type="button"
                        {...liquidPointerHandlers}
                        onClick={handleClearUrlInputAndReset}
                        aria-label="Bersihkan kolom pencarian"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-white/10 active:scale-95 transition-[transform,opacity,background-color,color] duration-200 ease-out cursor-pointer animate-state-pop"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Touch-Friendly 2-Column Button Grid on Mobile */}
                  <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-2.5 shrink-0">
                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={handlePasteToUrlInput}
                      className="liquid-btn-secondary transform-gpu min-h-[44px] px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl active:scale-95 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {pastedUrlFeedback ? (
                        <span
                          key="pasted-url"
                          className="animate-state-pop flex items-center gap-2"
                        >
                          <Check
                            className="w-4 h-4 text-[#10b981]"
                            aria-hidden="true"
                          />
                          <span className="text-[#2dd4bf]">Tertempel</span>
                        </span>
                      ) : (
                        <span
                          key="paste-url-idle"
                          className="animate-state-pop flex items-center gap-2"
                        >
                          <ClipboardPaste
                            className="w-4 h-4 text-[#38bdf8]"
                            aria-hidden="true"
                          />
                          <span>Tempel Tautan</span>
                        </span>
                      )}
                    </button>

                    <button
                      type="submit"
                      disabled={isLoadingUrl}
                      {...liquidPointerHandlers}
                      className="liquid-btn-primary transform-gpu min-h-[44px] px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl active:scale-95 disabled:opacity-60 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isLoadingUrl ? (
                        <span
                          key="searching-url"
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
                          key="search-url-idle"
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

              {/* Petunjuk Pencarian Preset — ONLY visible when idle (before search starts / after X clear) */}
              {isUrlTabIdle && (
                <div className="relative z-10 pt-2 border-t border-white/[0.08] space-y-2.5 animate-expand-reveal">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#f1f5f9]">
                      Petunjuk Pencarian Preset:
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
                    <div
                      {...liquidPointerHandlers}
                      className="glass-subpanel transform-gpu p-3 sm:p-3.5 rounded-xl flex flex-col justify-center space-y-1 text-left"
                    >
                      <div className="text-xs font-semibold text-[#2dd4bf]">
                        1. Tempel Tautan Video
                      </div>
                      <p className="text-[11px] sm:text-xs text-[#94a3b8] leading-relaxed">
                        Klik tombol{' '}
                        <strong className="text-[#f1f5f9]">
                          Tempel Tautan
                        </strong>{' '}
                        untuk memasukkan link video TikTok, Instagram Reels,
                        atau YouTube.
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
                        Tekan tombol{' '}
                        <strong className="text-[#f1f5f9]">Cari Preset</strong>{' '}
                        untuk memindai deskripsi, caption, komentar, dan kode
                        QR.
                      </p>
                    </div>

                    <div
                      {...liquidPointerHandlers}
                      className="glass-subpanel transform-gpu p-3 sm:p-3.5 rounded-xl flex flex-col justify-center space-y-1 text-left"
                    >
                      <div className="text-xs font-semibold text-[#10b981]">
                        3. Hasil Muncul & 4. Buka/Salin
                      </div>
                      <p className="text-[11px] sm:text-xs text-[#94a3b8] leading-relaxed">
                        Pemutar video, detail caption, dan tombol{' '}
                        <strong className="text-[#f1f5f9]">Buka Preset</strong>{' '}
                        / <strong className="text-[#f1f5f9]">Salin</strong> akan
                        tampil setelah pencarian selesai.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step-by-Step Loading Progress State ("Mencari link preset...") */}
            {isLoadingUrl && (
              <div
                role="status"
                aria-live="polite"
                {...liquidPointerHandlers}
                className="glass-panel transform-gpu rounded-2xl p-4 sm:p-6 space-y-3.5 sm:space-y-4 animate-state-enter overflow-hidden"
              >
                <CardCornerWatermark />
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-[#f1f5f9] truncate">
                    {commentScanStatusText || 'Mencari link preset...'}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-[#2dd4bf] shrink-0">
                    Tahap {loadingStepIndex + 1} / {LOADING_STEPS.length}
                  </span>
                </div>

                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {LOADING_STEPS.map((stepText, idx) => {
                    const isCompleted = idx < loadingStepIndex;
                    const isCurrent = idx === loadingStepIndex;

                    return (
                      <div
                        key={stepText}
                        className={`glass-subpanel p-2.5 sm:p-3.5 rounded-xl text-[11px] sm:text-xs flex items-center gap-2 transition-[transform,opacity,background-color,border-color,color] duration-300 ease-out ${
                          isCurrent
                            ? 'text-[#f1f5f9] font-semibold animate-state-pop animate-live-pulse'
                            : isCompleted
                            ? 'text-[#2dd4bf]'
                            : 'text-[#94a3b8] opacity-75'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#10b981] shrink-0 animate-state-pop"
                            aria-hidden="true"
                          />
                        ) : isCurrent ? (
                          <Loader2
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#38bdf8] animate-spin shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-[#94a3b8]/50 inline-block shrink-0" />
                        )}
                        <span className="leading-snug">{stepText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Results Section (Only shown after search completes and input is non-empty) */}
            {canShowUrlResults && currentVideoData && (
              <div className="space-y-5 sm:space-y-8 animate-results-reveal">
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

                <div className="animate-state-enter stagger-2">
                  <PresetResultsList links={urlExtractedLinks} />
                </div>

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

            {/* Direct Link Extraction View (Only shown after search completes and input is non-empty) */}
            {canShowUrlResults && !currentVideoData && (
              <div className="animate-results-reveal">
                <PresetResultsList links={urlExtractedLinks} />
              </div>
            )}
          </section>
        )}

        {/* TAB 2: 🔍 CARI PRESET (KATA KUNCI & NAMA LAGU) */}
        {activeTab === 'keyword-search' && (
          <section
            key="tab-keyword-search"
            aria-label="Cari Preset Berdasarkan Kata Kunci, Nama Lagu, atau Kreator"
            className="animate-state-enter"
          >
            <KeywordPresetSearchTab
              onPresetFoundForHistory={handleKeywordPresetSavedToHistory}
              onClearResetAll={() => {
                setIsHistoryVisible(false);
              }}
            />
          </section>
        )}

        {/* TAB 3: KOMENTAR & TEKS */}
        {activeTab === 'text' && (
          <section
            key="tab-text"
            aria-label="Filter Teks dan Pemindai Kolom Komentar TikTok dan YouTube"
            className="space-y-5 sm:space-y-8 animate-state-enter"
          >
            <div
              {...liquidPointerHandlers}
              className="glass-panel rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-hidden"
            >
              {/* 2b) Card Bottom-Right Corner Watermark */}
              <CardCornerWatermark />

              {/* Part 1: Scan TikTok / YouTube Comments & Replies by Video Link */}
              <div className="relative z-10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xs sm:text-sm font-semibold text-[#f1f5f9] flex items-center gap-2">
                      <MessageSquare
                        className="w-4 h-4 text-[#2dd4bf] shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Pindai Kolom Komentar & Balasan dari Tautan Video TikTok
                        / YouTube
                      </span>
                    </h2>
                    <p className="hidden sm:block text-xs text-[#94a3b8] mt-0.5">
                      Tempel tautan video lalu tekan tombol Cari untuk
                      mengekstrak tautan preset di kolom komentar.
                    </p>
                  </div>

                  {canShowTab2Results && (
                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={resetTab2SearchResults}
                      className="text-xs text-[#94a3b8] hover:text-[#2dd4bf] active:scale-95 flex items-center gap-1.5 transition-colors cursor-pointer animate-state-pop"
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
                      className="w-4 h-4 text-[#38bdf8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"
                      aria-hidden="true"
                    />
                    <input
                      ref={tab2UrlInputRef}
                      id="tab2-tiktok-comment-url"
                      type="url"
                      value={tab2TiktokUrl}
                      {...liquidPointerHandlers}
                      onPaste={() => {
                        setHasPastedOrSearched(true);
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTab2TiktokUrl(val);
                        if (val.trim()) {
                          setHasPastedOrSearched(true);
                        }
                        if (commentError) setCommentError(null);
                        if (hasAnalyzedComment || tab2VideoMeta) {
                          resetTab2SearchResults();
                        }
                      }}
                      placeholder="https://vt.tiktok.com/... atau https://www.youtube.com/watch?v=..."
                      className={`liquid-input w-full min-h-[46px] pl-10 ${
                        tab2TiktokUrl ? 'pr-10' : 'pr-4'
                      } py-2.5 sm:py-3 rounded-xl text-base sm:text-sm text-[#f1f5f9] placeholder:text-[#94a3b8]/75 font-mono`}
                    />
                    {tab2TiktokUrl && (
                      <button
                        type="button"
                        {...liquidPointerHandlers}
                        onClick={() => {
                          setTab2TiktokUrl('');
                          setCommentError(null);
                          resetTab2SearchResults();
                          if (!commentText.trim()) {
                            setHasPastedOrSearched(false);
                            setIsHistoryVisible(false);
                          }
                          tab2UrlInputRef.current?.focus();
                        }}
                        aria-label="Bersihkan tautan video komentar"
                        className="absolute right-2.5 p-1 rounded-lg text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-white/10 active:scale-95 flex items-center justify-center cursor-pointer animate-state-pop"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-2.5 shrink-0">
                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={handlePasteToTab2UrlInput}
                      className="liquid-btn-secondary transform-gpu min-h-[44px] px-3.5 py-2.5 rounded-xl active:scale-95 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {pastedTab2UrlFeedback ? (
                        <span
                          key="tab2-pasted"
                          className="animate-state-pop flex items-center gap-1.5"
                        >
                          <Check
                            className="w-3.5 h-3.5 text-[#10b981]"
                            aria-hidden="true"
                          />
                          <span className="text-[#2dd4bf]">Tertempel</span>
                        </span>
                      ) : (
                        <span
                          key="tab2-paste-idle"
                          className="animate-state-pop flex items-center gap-1.5"
                        >
                          <ClipboardPaste
                            className="w-3.5 h-3.5 text-[#38bdf8]"
                            aria-hidden="true"
                          />
                          <span>Tempel Tautan</span>
                        </span>
                      )}
                    </button>

                    <button
                      type="submit"
                      disabled={isScanningComments}
                      {...liquidPointerHandlers}
                      className="liquid-btn-primary transform-gpu min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl active:scale-95 disabled:opacity-60 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isScanningComments ? (
                        <span
                          key="tab2-scanning"
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
                          key="tab2-scan-idle"
                          className="animate-state-pop flex items-center gap-2"
                        >
                          <Search
                            className="w-4 h-4 text-[#2dd4bf]"
                            aria-hidden="true"
                          />
                          <span>Cari Komentar</span>
                        </span>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Hairline Divider */}
              <div className="relative z-10 border-t border-white/[0.08]" />

              {/* Part 2: Manual Paste Comment / Reply Text Filter */}
              <form
                onSubmit={handleAnalyzeCommentSubmit}
                className="relative z-10 space-y-3"
                noValidate
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="comment-filter-textarea"
                    className="text-xs sm:text-sm font-semibold text-[#f1f5f9]"
                  >
                    Atau Tempel Teks Komentar / Deskripsi Manual
                  </label>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={handlePasteToCommentTextarea}
                      className="text-xs font-semibold text-[#2dd4bf] hover:underline active:scale-95 flex items-center gap-1 cursor-pointer"
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
                        {...liquidPointerHandlers}
                        onClick={() => {
                          setCommentText('');
                          setHasAnalyzedComment(false);
                          setCommentError(null);
                          if (!tab2TiktokUrl.trim()) {
                            setHasPastedOrSearched(false);
                            setIsHistoryVisible(false);
                          }
                        }}
                        className="text-xs text-[#94a3b8] hover:text-[#f1f5f9] active:scale-95 flex items-center gap-1 cursor-pointer animate-state-pop"
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
                  {...liquidPointerHandlers}
                  onPaste={() => {
                    setHasPastedOrSearched(true);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCommentText(val);
                    if (val.trim()) {
                      setHasPastedOrSearched(true);
                    }
                    if (commentError) setCommentError(null);
                    if (hasAnalyzedComment) {
                      setHasAnalyzedComment(false);
                    }
                  }}
                  placeholder="Tempelkan salinan komentar atau deskripsi YouTube/TikTok/IG di sini... (Contoh: https://alight.link/... atau https://drive.google.com/file/...)"
                  className="liquid-input w-full p-3.5 sm:p-4 rounded-xl text-base sm:text-sm text-[#f1f5f9] placeholder:text-[#94a3b8]/75 font-mono leading-relaxed"
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
                    {...liquidPointerHandlers}
                    className="liquid-btn-secondary transform-gpu w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl active:scale-95 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Search
                      className="w-4 h-4 text-[#2dd4bf]"
                      aria-hidden="true"
                    />
                    <span>Cari Link AM dari Teks</span>
                  </button>
                </div>
              </form>

              {/* Petunjuk Pencarian Komentar & Teks — ONLY visible when idle */}
              {isTab2Idle && (
                <div className="relative z-10 pt-2 border-t border-white/[0.08] grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 animate-expand-reveal">
                  <div
                    {...liquidPointerHandlers}
                    className="glass-subpanel transform-gpu p-3 sm:p-3.5 rounded-xl space-y-1 text-left"
                  >
                    <div className="text-xs font-semibold text-[#2dd4bf]">
                      1. Via Tautan Video
                    </div>
                    <p className="text-[11px] sm:text-xs text-[#94a3b8] leading-relaxed">
                      Klik{' '}
                      <strong className="text-[#f1f5f9]">Tempel Tautan</strong>{' '}
                      lalu tekan{' '}
                      <strong className="text-[#f1f5f9]">Cari Komentar</strong>{' '}
                      untuk memindai komentar dan balasan video TikTok atau
                      YouTube.
                    </p>
                  </div>
                  <div
                    {...liquidPointerHandlers}
                    className="glass-subpanel transform-gpu p-3 sm:p-3.5 rounded-xl space-y-1 text-left"
                  >
                    <div className="text-xs font-semibold text-[#38bdf8]">
                      2. Filter Teks Manual
                    </div>
                    <p className="text-[11px] sm:text-xs text-[#94a3b8] leading-relaxed">
                      Klik{' '}
                      <strong className="text-[#f1f5f9]">Tempel Teks</strong>{' '}
                      lalu tekan{' '}
                      <strong className="text-[#f1f5f9]">
                        Cari Link AM dari Teks
                      </strong>{' '}
                      untuk mengekstrak seluruh tautan preset di dalam teks
                      panjang.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {canShowTab2Results && (
              <div className="animate-results-reveal stagger-1">
                <PresetResultsList links={commentExtractedLinks} />
              </div>
            )}

            {hasPastedOrSearched &&
              (isScanningComments ||
                (canShowTab2Results &&
                  (commentThreads.length > 0 || tab2VideoMeta))) && (
                <div className="animate-results-reveal stagger-2">
                  <TikTokCommentsScannerPanel
                    platform={
                      (tab2VideoMeta || currentVideoData)?.platform || 'tiktok'
                    }
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

        {/* TAB 4: SCAN GAMBAR QR */}
        {activeTab === 'qr-image' && (
          <section
            key="tab-qr-image"
            aria-label="Pemindai Screenshot Gambar QR Alight Motion"
            className="animate-state-enter"
          >
            <QrImageUploadTab onQrImageExtracted={handleQrImageExtracted} />
          </section>
        )}

        {/* RIWAYAT PRESET (LOCALSTORAGE) — Hidden by default until explicitly opened */}
        {isHistoryVisible && (
          <div className="animate-results-reveal">
            <PresetHistorySection
              history={history}
              onDeleteRecord={handleDeleteHistoryItem}
              onClearAll={handleClearAllHistory}
              onCloseHistory={() => setIsHistoryVisible(false)}
            />
          </div>
        )}
      </main>

      {/* Modern Structured Footer (Semi-Transparent Dark Slate, Zero Backdrop-Blur) */}
      <footer className="relative z-10 border-t border-cyan-500/20 bg-slate-950/95 mt-10 sm:mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 sm:space-y-10">
          <div className="grid grid-cols-2 lg:grid-cols-12 gap-6 sm:gap-8">
            {/* Column 1: Brand & Developer Profile */}
            <div className="col-span-2 lg:col-span-5 space-y-2.5 sm:space-y-3">
              <div className="flex items-center gap-2 text-base font-bold font-display tracking-tight">
                <img
                  src="/favicon.png"
                  alt=""
                  aria-hidden="true"
                  className="w-5 h-5 rounded-full object-cover border border-white/10"
                />
                <span className="text-liquid-gradient">AM Preset Finder</span>
              </div>
              <p className="hidden sm:block text-xs text-[#94a3b8] leading-relaxed max-w-sm">
                Platform ekstraktor tautan preset Alight Motion (5MB, XML & Kode
                QR) dari video, pencarian kata kunci & lagu, kolom komentar, dan
                balasan TikTok, Instagram, maupun YouTube.
              </p>
              <div className="pt-0.5 sm:pt-1 text-xs text-[#94a3b8] flex flex-wrap sm:flex-col items-center sm:items-start gap-x-4 gap-y-1">
                <div>
                  Pengembang:{' '}
                  <strong className="text-[#f1f5f9] font-semibold">
                    Dimas Kurniawan
                  </strong>
                </div>
                <div className="flex items-center gap-1.5 text-[#94a3b8]">
                  <span>TikTok:</span>
                  <a
                    href={TIKTOK_CONTACT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2dd4bf] hover:underline font-mono inline-flex items-center gap-1"
                  >
                    <span>@ludexkurniawan</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>

            {/* Column 2: Support (SociaBuzz & Saluran WhatsApp) */}
            <div className="col-span-1 lg:col-span-4 space-y-2.5 sm:space-y-3 min-w-0">
              <h3 className="text-xs font-semibold text-[#f1f5f9] tracking-wide">
                Support
              </h3>
              <ul className="space-y-2 sm:space-y-2.5 text-xs text-[#94a3b8]">
                <li>
                  <a
                    href={SOCIABUZZ_SUPPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2dd4bf] hover:underline font-semibold transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Beri Dukungan (SociaBuzz)</span>
                    <ExternalLink
                      className="w-3 h-3 text-[#2dd4bf] shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                </li>
                <li>
                  <a
                    href={WHATSAPP_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#f1f5f9] hover:text-[#38bdf8] font-medium transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Saluran WhatsApp</span>
                    <ExternalLink
                      className="w-3 h-3 text-[#38bdf8] shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                </li>
                <li className="hidden sm:list-item">
                  <a
                    href={WHATSAPP_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#94a3b8] hover:text-[#2dd4bf] transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Gabung Saluran WhatsApp Resmi</span>
                    <ExternalLink
                      className="w-3 h-3 shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                </li>
                <li>
                  <a
                    href={TIKTOK_CONTACT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#94a3b8] hover:text-[#2dd4bf] transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>TikTok @ludexkurniawan</span>
                    <ExternalLink
                      className="w-3 h-3 shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Legal (Terms of Service & Privacy Policy) */}
            <div className="col-span-1 lg:col-span-3 space-y-2.5 sm:space-y-3">
              <h3 className="text-xs font-semibold text-[#f1f5f9] tracking-wide">
                Legal
              </h3>
              <ul className="space-y-2 sm:space-y-2.5 text-xs text-[#94a3b8]">
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveLegalDoc('tos')}
                    className="text-[#94a3b8] hover:text-[#2dd4bf] transition-colors cursor-pointer"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveLegalDoc('privacy')}
                    className="text-[#94a3b8] hover:text-[#2dd4bf] transition-colors cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setShowWelcomeModal(true)}
                    className="text-[#94a3b8] hover:text-[#2dd4bf] transition-colors cursor-pointer"
                  >
                    Info & Dukungan Aplikasi
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Attribution Bar */}
          <div className="pt-5 sm:pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs text-[#94a3b8] text-center sm:text-left">
            <div>
              © {new Date().getFullYear()} AM Preset Finder · Hak Cipta{' '}
              <strong className="text-[#f1f5f9] font-medium">
                Dimas Kurniawan
              </strong>
              . Seluruh hak cipta dilindungi.
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setActiveLegalDoc('tos')}
                className="hover:text-[#f1f5f9] transition-colors cursor-pointer"
              >
                Terms of Service
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setActiveLegalDoc('privacy')}
                className="hover:text-[#f1f5f9] transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
              <span aria-hidden="true">·</span>
              <a
                href={SOCIABUZZ_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2dd4bf] hover:underline font-medium"
              >
                Beri Dukungan
              </a>
              <span aria-hidden="true">·</span>
              <a
                href={WHATSAPP_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#38bdf8] hover:underline font-medium"
              >
                Saluran WhatsApp
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Initial Page Load Splash Screen (1.5 - 2s with smooth fade-out) */}
      <InitialLoadingScreen />

      {/* Search / Link Extraction Loading Overlay */}
      <SearchLoadingOverlay
        isOpen={isLoadingUrl || isScanningComments}
        customStatusText={
          isScanningComments
            ? commentScanStatusText || 'Memindai komentar & balasan TikTok...'
            : undefined
        }
        targetLabel={
          isLoadingUrl && urlInput.trim()
            ? urlInput.trim()
            : isScanningComments && tab2TiktokUrl.trim()
              ? tab2TiktokUrl.trim()
              : undefined
        }
      />

      {/* Welcome Popup Modal on Initial Page Load */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />

      {/* Interactive Legal Modal */}
      <LegalModal
        activeDoc={activeLegalDoc}
        onSelectDoc={(doc) => setActiveLegalDoc(doc)}
        onClose={() => setActiveLegalDoc(null)}
      />
    </div>
  );
}
