import {
  validateSocialUrl,
  TikTokCommentThread,
  TikTokCommentReplyItem,
  ExtractedPresetLink,
  normalizeRawTikwmComment,
  normalizeRawTikwmReply,
  extractPresetLinksFromCommentsAndReplies,
} from './presetParser';

export interface SocialVideoData {
  id: string;
  sourceUrl: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  title?: string;
  caption: string;
  author: {
    uniqueId: string;
    nickname: string;
    avatar: string;
  };
  coverUrl: string;
  /** Direct no-watermark video URL from TikWM API (or empty for YouTube) */
  playUrl: string;
  /** Same-origin proxied stream URL so <video> + <canvas> + jsQR can scan real frames without CORS taint */
  proxiedPlayUrl: string;
  durationSec: number;
  commentCount: number;
  youtubeComments?: TikTokCommentThread[];
}

export interface TikTokCommentsScanResult {
  threads: TikTokCommentThread[];
  extractedLinks: ExtractedPresetLink[];
  cursor: number;
  hasMore: boolean;
  totalCommentsReported: number;
  totalRepliesScanned: number;
}

function normalizeTikwmVideoUrl(rawUrl: string | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) {
    return `https://www.tikwm.com${trimmed}`;
  }
  return `https://www.tikwm.com/${trimmed}`;
}

/**
 * Fetches real video metadata & caption/description from TikTok, Instagram, or YouTube.
 * - For YouTube: calls `/api/youtube?url={VIDEO_URL}` to extract full title, description, and top/pinned comments.
 * - For TikTok / Instagram: calls `https://www.tikwm.com/api/?url={VIDEO_URL}` with `/api/tikwm` proxy fallback.
 * Never generates dummy, mock, or fabricated URLs.
 */
export async function fetchSocialVideoData(rawInputUrl: string): Promise<SocialVideoData> {
  const validation = validateSocialUrl(rawInputUrl);
  if (!validation.isValid || !validation.platform) {
    throw new Error(validation.error || 'URL tidak valid.');
  }

  // Handle YouTube Video & YouTube Shorts
  if (validation.platform === 'youtube') {
    const ytRes = await fetch(
      `/api/youtube?url=${encodeURIComponent(validation.normalizedUrl)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );

    let ytPayload: { code?: number; msg?: string; data?: Record<string, any> } | null = null;
    try {
      ytPayload = await ytRes.json();
    } catch {
      // Ignore JSON error
    }

    if (!ytRes.ok || !ytPayload || ytPayload.code !== 0 || !ytPayload.data) {
      throw new Error(
        ytPayload?.msg ||
          'Gagal mengambil data video atau Shorts YouTube. Pastikan tautan YouTube bersifat publik dan valid.'
      );
    }

    const yd = ytPayload.data;
    const creatorHandle = String(yd.author?.unique_id || 'youtube');
    const rawComments = Array.isArray(yd.comments) ? yd.comments : [];
    const normalizedYtComments = rawComments.map((raw: Record<string, any>) =>
      normalizeRawTikwmComment(
        {
          ...raw,
          video_id: yd.id,
        },
        creatorHandle
      )
    );

    const videoTitle = typeof yd.title === 'string' ? yd.title.trim() : '';
    const videoDescription =
      typeof yd.description === 'string' ? yd.description.trim() : '';
    const combinedCaption = [videoTitle, videoDescription]
      .filter(Boolean)
      .join('\n\n');

    return {
      id: String(yd.id || validation.videoId || Date.now()),
      sourceUrl: validation.normalizedUrl,
      platform: 'youtube',
      title: videoTitle,
      caption: combinedCaption,
      author: {
        uniqueId: creatorHandle,
        nickname: String(yd.author?.nickname || 'YouTube Creator'),
        avatar: String(yd.author?.avatar || ''),
      },
      coverUrl: String(yd.cover || ''),
      playUrl: '',
      proxiedPlayUrl: '',
      durationSec: Number(yd.duration) || 0,
      commentCount: Number(yd.comment_count) || normalizedYtComments.length,
      youtubeComments: normalizedYtComments,
    };
  }

  let jsonPayload: { code?: number; msg?: string; data?: Record<string, any> } | null = null;

  // 1. Direct frontend call to https://www.tikwm.com/api/?url={VIDEO_URL}
  try {
    const directEndpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(validation.normalizedUrl)}`;
    const response = await fetch(directEndpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    if (response.ok) {
      jsonPayload = await response.json();
    }
  } catch {
    // Proceed to same-origin /api/tikwm proxy if browser blocks cross-origin call
  }

  // 2. Fallback to same-origin /api/tikwm proxy if direct browser request failed or hit rate limit
  if (!jsonPayload || jsonPayload.code !== 0 || !jsonPayload.data) {
    const proxyEndpoint = `/api/tikwm?url=${encodeURIComponent(validation.normalizedUrl)}`;
    const proxyRes = await fetch(proxyEndpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    if (proxyRes.ok) {
      jsonPayload = await proxyRes.json();
    }
  }

  if (!jsonPayload || jsonPayload.code !== 0 || !jsonPayload.data) {
    const apiErrorMsg =
      jsonPayload?.msg ||
      'Gagal mengambil data video. Pastikan tautan video bersifat publik dan valid.';
    throw new Error(apiErrorMsg);
  }

  const d = jsonPayload.data;
  const playUrl = normalizeTikwmVideoUrl(d.play || d.hdplay || d.wmplay);
  const coverUrl = normalizeTikwmVideoUrl(d.cover || d.origin_cover);

  if (!playUrl) {
    throw new Error('URL video tanpa watermark (play) tidak ditemukan pada respons API.');
  }

  return {
    id: String(d.id || Date.now()),
    sourceUrl: validation.normalizedUrl,
    platform: validation.platform,
    caption: typeof d.title === 'string' ? d.title : '',
    author: {
      uniqueId: String(d.author?.unique_id || 'unknown'),
      nickname: String(d.author?.nickname || 'Creator'),
      avatar: normalizeTikwmVideoUrl(d.author?.avatar),
    },
    coverUrl,
    playUrl,
    proxiedPlayUrl: `/api/video-proxy?url=${encodeURIComponent(playUrl)}`,
    durationSec: Number(d.duration) || 0,
    commentCount: Number(d.comment_count) || 0,
  };
}

/**
 * Fetches a page of top-level comments for a TikTok video via
 * `https://www.tikwm.com/api/comment/list?url={VIDEO_URL}&count={COUNT}&cursor={CURSOR}`
 * with same-origin proxy fallback (`/api/tikwm/comments`).
 */
export async function fetchTikTokCommentsPage(options: {
  videoUrlOrId: string;
  creatorUniqueId?: string;
  cursor?: number;
  count?: number;
}): Promise<{
  comments: TikTokCommentThread[];
  cursor: number;
  hasMore: boolean;
  total: number;
}> {
  const { videoUrlOrId, creatorUniqueId, cursor = 0, count = 50 } = options;
  let payload: { code?: number; msg?: string; data?: Record<string, any> } | null = null;

  // Prefer same-origin rate-limit-queued endpoint first so rapid calls after video fetch never fail
  try {
    const proxyUrl = `/api/tikwm/comments?url=${encodeURIComponent(
      videoUrlOrId
    )}&count=${count}&cursor=${cursor}`;
    const res = await fetch(proxyUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      payload = await res.json();
    }
  } catch {
    // Fallback to direct frontend call if proxy unavailable
  }

  if (!payload || payload.code !== 0 || !payload.data) {
    try {
      const directUrl = `https://www.tikwm.com/api/comment/list?url=${encodeURIComponent(
        videoUrlOrId
      )}&count=${count}&cursor=${cursor}`;
      const directRes = await fetch(directUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (directRes.ok) {
        payload = await directRes.json();
      }
    } catch {
      // Ignore
    }
  }

  if (!payload || payload.code !== 0 || !payload.data) {
    throw new Error(
      payload?.msg || 'Gagal mengambil daftar komentar video TikTok.'
    );
  }

  const rawComments = Array.isArray(payload.data.comments)
    ? payload.data.comments
    : [];
  const normalizedComments = rawComments.map((raw: Record<string, any>) =>
    normalizeRawTikwmComment(raw, creatorUniqueId)
  );

  return {
    comments: normalizedComments,
    cursor: Number(payload.data.cursor) || 0,
    hasMore: Boolean(payload.data.hasMore),
    total: Number(payload.data.total) || normalizedComments.length,
  };
}

/**
 * Fetches nested replies (`balasan`) for a specific TikTok comment via
 * `https://www.tikwm.com/api/comment/reply?video_id={VIDEO_ID}&comment_id={COMMENT_ID}&count={COUNT}&cursor={CURSOR}`
 * with same-origin proxy fallback (`/api/tikwm/replies`).
 */
export async function fetchTikTokCommentReplies(options: {
  videoId: string;
  commentId: string;
  creatorUniqueId?: string;
  cursor?: number;
  count?: number;
}): Promise<{
  replies: TikTokCommentReplyItem[];
  cursor: number;
  hasMore: boolean;
}> {
  const { videoId, commentId, creatorUniqueId, cursor = 0, count = 50 } = options;
  let payload: { code?: number; msg?: string; data?: Record<string, any> } | null = null;

  try {
    const proxyUrl = `/api/tikwm/replies?video_id=${encodeURIComponent(
      videoId
    )}&comment_id=${encodeURIComponent(commentId)}&count=${count}&cursor=${cursor}`;
    const res = await fetch(proxyUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      payload = await res.json();
    }
  } catch {
    // Fallback to direct call
  }

  if (!payload || payload.code !== 0 || !payload.data) {
    try {
      const directUrl = `https://www.tikwm.com/api/comment/reply?video_id=${encodeURIComponent(
        videoId
      )}&comment_id=${encodeURIComponent(commentId)}&count=${count}&cursor=${cursor}`;
      const directRes = await fetch(directUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (directRes.ok) {
        payload = await directRes.json();
      }
    } catch {
      // Ignore
    }
  }

  if (!payload || payload.code !== 0 || !payload.data) {
    throw new Error(
      payload?.msg || 'Gagal mengambil balasan komentar TikTok.'
    );
  }

  const rawReplies = Array.isArray(payload.data.comments)
    ? payload.data.comments
    : [];
  const normalizedReplies = rawReplies.map((raw: Record<string, any>) =>
    normalizeRawTikwmReply(raw, commentId, creatorUniqueId)
  );

  return {
    replies: normalizedReplies,
    cursor: Number(payload.data.cursor) || 0,
    hasMore: Boolean(payload.data.hasMore),
  };
}

/**
 * Automatically fetches top-level comments and scans priority reply threads for a TikTok video,
 * returning all comment threads alongside all extracted Alight Motion preset links.
 */
export async function scanTikTokVideoCommentsAndReplies(options: {
  videoId: string;
  sourceUrl: string;
  creatorUniqueId?: string;
  maxAutoReplyThreads?: number;
  onProgress?: (statusText: string) => void;
}): Promise<TikTokCommentsScanResult> {
  const {
    videoId,
    sourceUrl,
    creatorUniqueId,
    maxAutoReplyThreads = 3,
    onProgress,
  } = options;

  onProgress?.('Memindai daftar komentar utama video TikTok...');
  const firstPage = await fetchTikTokCommentsPage({
    videoUrlOrId: videoId || sourceUrl,
    creatorUniqueId,
    cursor: 0,
    count: 50,
  });

  const threads = [...firstPage.comments];
  let totalRepliesScanned = 0;

  // Identify priority comment threads that have replies (replyTotal > 0):
  // 1. Comments by creator, 2. Comments mentioning preset/link/am/5mb/xml/spill, 3. Top liked comments with replies
  const candidatesWithReplies = threads
    .filter((c) => c.replyTotal > 0)
    .sort((a, b) => {
      const score = (c: TikTokCommentThread) => {
        let s = 0;
        if (c.isCreator) s += 1000;
        if (c.extractedLinks.length > 0) s += 500;
        if (/(preset|link|alight|am|5mb|xml|mana|spill|bagi|minta|drive)/i.test(c.text)) {
          s += 300;
        }
        s += Math.min(200, c.diggCount);
        return s;
      };
      return score(b) - score(a);
    })
    .slice(0, maxAutoReplyThreads);

  for (let i = 0; i < candidatesWithReplies.length; i++) {
    const targetThread = candidatesWithReplies[i];
    onProgress?.(
      `Memindai balasan komentar @${targetThread.user.uniqueId} (${i + 1}/${candidatesWithReplies.length})...`
    );
    try {
      // eslint-disable-next-line no-await-in-loop
      const replyData = await fetchTikTokCommentReplies({
        videoId: targetThread.videoId || videoId,
        commentId: targetThread.id,
        creatorUniqueId,
        cursor: 0,
        count: 50,
      });

      targetThread.replies = replyData.replies;
      targetThread.repliesCursor = replyData.cursor;
      targetThread.repliesHasMore = replyData.hasMore;
      targetThread.repliesLoaded = true;
      totalRepliesScanned += replyData.replies.length;
    } catch {
      // Keep thread even if a single reply fetch fails
    }
  }

  const extractedLinks = extractPresetLinksFromCommentsAndReplies(threads);

  return {
    threads,
    extractedLinks,
    cursor: firstPage.cursor,
    hasMore: firstPage.hasMore,
    totalCommentsReported: firstPage.total || threads.length,
    totalRepliesScanned,
  };
}
