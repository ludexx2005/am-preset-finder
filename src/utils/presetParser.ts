export type PresetLinkCategory = '5mb' | 'xml' | 'shortlink';

export interface UrlParamPair {
  key: string;
  value: string;
}

export interface ExtractedPresetLink {
  id: string;
  url: string;
  rawMatch: string;
  category: PresetLinkCategory;
  provider:
    | 'Alight Link'
    | 'Alight Creative'
    | 'Google Drive'
    | 'MediaFire'
    | 'Bitly'
    | 's.id'
    | 'TinyURL';
  label: string;
  params: UrlParamPair[];
  needsAlightResolve: boolean;
  resolvedUrl?: string;
  resolvedCategory?: '5mb' | 'xml' | 'unknown';
  resolveStatus?: 'idle' | 'checking' | 'resolved' | 'unverified';
  resolveError?: string;
}

export interface ParsedPresetSummary {
  all: ExtractedPresetLink[];
  links5mb: ExtractedPresetLink[];
  linksXml: ExtractedPresetLink[];
  shortlinks: ExtractedPresetLink[];
  totalCount: number;
}

export interface SocialUrlValidation {
  isValid: boolean;
  platform: 'tiktok' | 'instagram' | 'youtube' | null;
  normalizedUrl: string;
  videoId?: string;
  error?: string;
}

export interface QrPayloadInspection {
  /** Exact, unmodified string decoded from the QR Code */
  rawPayload: string;
  isAlightPreset: boolean;
  isAlightShortlink: boolean;
  isAlightCreativeShare: boolean;
  /** If the QR payload already contains or encodes the full alightcreative.com/am/share/u/.../p/... URL */
  directAlightCreativeUrl: string | null;
}

// Strip only sentence-ending punctuation at the end of prose tokens, never '=', '/', '&', '-', '_', '+', '%'
const TRAILING_PUNCTUATION = /[.,;!?)\]}>"']+$/;

/**
 * Unwraps YouTube redirect URLs (`https://www.youtube.com/redirect?...&q=ENCODED_URL`)
 * inside descriptions or comments so the underlying target preset URL and its parameters
 * are extracted intact without YouTube's wrapper parameters (`&v=`, `&redir_token=`, `&event=`).
 */
export function unwrapYouTubeRedirectLinksInText(text: string): string {
  if (!text || !/youtube\.com\/redirect/i.test(text)) {
    return text;
  }

  return text.replace(
    /https?:\/\/(?:www\.|m\.)?youtube\.com\/redirect\?[^\s"'<>]+/gi,
    (match) => {
      try {
        const cleaned = match.replace(TRAILING_PUNCTUATION, '');
        const parsed = new URL(cleaned);
        const targetQ = parsed.searchParams.get('q');
        if (targetQ && targetQ.trim()) {
          return targetQ.trim();
        }
      } catch {
        // Ignore malformed redirect URL
      }
      return match;
    }
  );
}

/**
 * Extracts a YouTube Video / Shorts ID from watch, youtu.be, shorts, embed, or live URLs.
 */
export function extractYouTubeVideoId(inputUrl: string): string | null {
  if (!inputUrl || !inputUrl.trim()) return null;
  const trimmed = inputUrl.trim();
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProto);
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const seg = parsed.pathname.split('/').filter(Boolean)[0];
      if (seg && /^[A-Za-z0-9_-]{6,20}$/.test(seg)) {
        return seg;
      }
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[A-Za-z0-9_-]{6,20}$/.test(vParam)) {
        return vParam;
      }

      const pathMatch = parsed.pathname.match(
        /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,20})/i
      );
      if (pathMatch && pathMatch[1]) {
        return pathMatch[1];
      }
    }
  } catch {
    // Ignore invalid URL
  }

  return null;
}

function ensureHttpProtocol(raw: string): string {
  const trimmed = raw.trim().replace(TRAILING_PUNCTUATION, '');
  if (/^(?:alight|alightmotion):\/\//i.test(trimmed)) {
    const rest = trimmed.replace(/^(?:alight|alightmotion):\/\/+/i, '');
    if (rest.toLowerCase().startsWith('am/share/')) {
      return `https://alightcreative.com/${rest}`;
    }
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Pure helper that checks if a URL (such as an alight.link Firebase Dynamic Link with ?link=...,
 * or an alight://am/share/u/.../p/... deep link, or an alight.link/u/.../p/... link)
 * already contains the full `/u/.../p/...` Alight Motion share path, and converts it to
 * `https://alightcreative.com/am/share/u/.../p/...` with all parameters intact.
 * Returns null if a network redirect lookup (/api/resolve-url) is required to discover `/u/.../p/...`.
 */
export function convertOrExtractAlightCreativeUrl(rawUrl: string): string | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  const trimmed = rawUrl.trim();

  // 1. Already a valid https://alightcreative.com/am/share/... URL
  if (/^https?:\/\/(?:www\.)?alightcreative\.com\/am\/share\/[^\s"'<>]+/i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  // 2. Bare alightcreative.com/am/share/... without protocol
  if (/^(?:www\.)?alightcreative\.com\/am\/share\/[^\s"'<>]+/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // 3. Custom scheme alight://am/share/u/.../p/... or alightmotion://am/share/u/.../p/...
  if (/^(?:alight|alightmotion):\/\/am\/share\/[^\s"'<>]+/i.test(trimmed)) {
    const rest = trimmed.replace(/^(?:alight|alightmotion):\/\/+/i, '');
    return `https://alightcreative.com/${rest}`;
  }

  // 4. Inspect URL structure if valid URL
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);

    // Check embedded Firebase Dynamic Link query parameters (?link=, ?deep_link_id=, ?afl=, ?ifl=)
    const embeddedTarget =
      parsed.searchParams.get('link') ||
      parsed.searchParams.get('deep_link_id') ||
      parsed.searchParams.get('afl') ||
      parsed.searchParams.get('ifl');

    if (embeddedTarget) {
      const recursive = convertOrExtractAlightCreativeUrl(embeddedTarget);
      if (recursive) return recursive;
    }

    // If an alight.link URL already has /u/{uid}/p/{pid} or /am/share/u/{uid}/p/{pid} in its path
    const host = parsed.hostname.toLowerCase();
    if (host === 'alight.link' || host.endsWith('.alight.link')) {
      const pathMatch = parsed.pathname.match(/^(?:\/am\/share)?(\/u\/[^/]+\/p\/.+)$/i);
      if (pathMatch && pathMatch[1]) {
        return `https://alightcreative.com/am/share${pathMatch[1]}${parsed.search}${parsed.hash}`;
      }
    }
  } catch {
    // Ignore parse error
  }

  return null;
}

/**
 * Extracts all path parameters (such as /u/{uid}, /p/{pid}, /file/d/{id}) and
 * query string parameters (?key=val&...) from a URL without modifying or truncating them.
 */
export function extractUrlParametersList(urlStr: string): UrlParamPair[] {
  const result: UrlParamPair[] = [];
  if (!urlStr) return result;

  try {
    const normalized = /^https?:\/\//i.test(urlStr)
      ? urlStr
      : urlStr.replace(/^(?:alight|alightmotion):\/\//i, 'https://');
    const u = new URL(normalized);

    const uMatch = u.pathname.match(/\/u\/([^/]+)/);
    if (uMatch && uMatch[1]) {
      result.push({ key: 'u (User ID)', value: uMatch[1] });
    }
    const pMatch = u.pathname.match(/\/p\/([^/]+)/);
    if (pMatch && pMatch[1]) {
      result.push({ key: 'p (Package ID)', value: pMatch[1] });
    }

    const dMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (dMatch && dMatch[1]) {
      result.push({ key: 'fileId', value: dMatch[1] });
    }

    u.searchParams.forEach((val, key) => {
      result.push({ key, value: val });
    });

    if (u.hash && u.hash.length > 1) {
      result.push({ key: '#hash', value: u.hash.slice(1) });
    }
  } catch {
    const qIdx = urlStr.indexOf('?');
    if (qIdx !== -1) {
      const queryPart = urlStr.slice(qIdx + 1);
      for (const pair of queryPart.split('&')) {
        const [k, ...vParts] = pair.split('=');
        if (k) {
          result.push({ key: k, value: vParts.join('=') });
        }
      }
    }
  }
  return result;
}

function getCanonicalDedupeKey(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return urlStr;
  }
}

function extractLineContextLabel(fullText: string, matchIndex: number, fallbackLabel: string): string {
  const lineStart = fullText.lastIndexOf('\n', matchIndex) + 1;
  const prefix = fullText
    .slice(lineStart, matchIndex)
    .replace(/[-•*>#:[\]()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (prefix.length >= 3 && prefix.length <= 54) {
    return prefix;
  }

  if (lineStart > 1) {
    const prevLineEnd = lineStart - 1;
    const prevLineStart = fullText.lastIndexOf('\n', prevLineEnd - 1) + 1;
    const prevLine = fullText
      .slice(prevLineStart, prevLineEnd)
      .replace(/[-•*>#:[\]()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (prevLine.length >= 3 && prevLine.length <= 54 && !/https?:\/\//i.test(prevLine)) {
      return prevLine;
    }
  }

  return fallbackLabel;
}

/**
 * Smart Preset Regex Parser
 * Extracts real links from caption/description/comments without fabricating or altering any path or parameter.
 */
export function parsePresetLinks(rawText: string): ParsedPresetSummary {
  if (!rawText || !rawText.trim()) {
    return {
      all: [],
      links5mb: [],
      linksXml: [],
      shortlinks: [],
      totalCount: 0,
    };
  }

  const text = unwrapYouTubeRedirectLinksInText(rawText);
  const seenUrls = new Set<string>();
  const all: ExtractedPresetLink[] = [];

  const patterns: Array<{
    regex: RegExp;
    category: PresetLinkCategory;
    getProvider: (url: string) => ExtractedPresetLink['provider'];
    defaultLabel: string;
  }> = [
    {
      // 5MB Preset Links: alight.link/..., alightcreative.com/am/share/..., or alightmotion://...
      regex: /(?:(?:https?:|alight:|alightmotion:)\/\/)?(?:www\.)?(?:alight\.link\/[^\s"'<>]+|alightcreative\.com\/am\/share\/[^\s"'<>]+)|(?:alight|alightmotion):\/\/am\/share\/[^\s"'<>]+/gi,
      category: '5mb',
      getProvider: (u) =>
        u.toLowerCase().includes('alightcreative.com') ? 'Alight Creative' : 'Alight Link',
      defaultLabel: 'Preset Alight Motion 5MB',
    },
    {
      // XML Preset Links: drive.google.com/... or mediafire.com/...
      regex: /(?:https?:\/\/)?(?:www\.)?(?:drive\.google\.com\/[^\s"'<>]+|mediafire\.com\/[^\s"'<>]+)/gi,
      category: 'xml',
      getProvider: (u) =>
        u.toLowerCase().includes('drive.google.com') ? 'Google Drive' : 'MediaFire',
      defaultLabel: 'Preset XML Google Drive / MediaFire',
    },
    {
      // Shortlinks: bit.ly, s.id, tinyurl.com
      regex: /(?:https?:\/\/)?(?:www\.)?(?:bit\.ly|s\.id|tinyurl\.com)\/[^\s"'<>]+/gi,
      category: 'shortlink',
      getProvider: (u) => {
        const lower = u.toLowerCase();
        if (lower.includes('bit.ly')) return 'Bitly';
        if (lower.includes('s.id')) return 's.id';
        return 'TinyURL';
      },
      defaultLabel: 'Shortlink Preset',
    },
  ];

  for (const spec of patterns) {
    let match: RegExpExecArray | null;
    while ((match = spec.regex.exec(text)) !== null) {
      const rawMatch = match[0].replace(TRAILING_PUNCTUATION, '');
      const normalizedUrl = ensureHttpProtocol(rawMatch);
      const dedupeKey = getCanonicalDedupeKey(normalizedUrl);

      if (seenUrls.has(dedupeKey)) {
        continue;
      }
      seenUrls.add(dedupeKey);

      const provider = spec.getProvider(normalizedUrl);
      const label = extractLineContextLabel(text, match.index, spec.defaultLabel);
      const isAlightShortlink = provider === 'Alight Link';
      const directConverted = isAlightShortlink
        ? convertOrExtractAlightCreativeUrl(normalizedUrl)
        : null;

      all.push({
        id: `${spec.category}-${all.length + 1}-${Math.abs(hashCode(dedupeKey))}`,
        url: normalizedUrl,
        rawMatch,
        category: spec.category,
        provider,
        label,
        params: extractUrlParametersList(directConverted || normalizedUrl),
        needsAlightResolve: isAlightShortlink && !directConverted,
        resolvedUrl: directConverted || undefined,
        resolvedCategory: directConverted ? '5mb' : undefined,
        resolveStatus: directConverted
          ? 'resolved'
          : spec.category === 'shortlink' || isAlightShortlink
          ? 'idle'
          : undefined,
      });
    }
  }

  const links5mb = all.filter((item) => item.category === '5mb');
  const linksXml = all.filter((item) => item.category === 'xml');
  const shortlinks = all.filter((item) => item.category === 'shortlink');

  return {
    all,
    links5mb,
    linksXml,
    shortlinks,
    totalCount: all.length,
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Validates TikTok, Instagram, or YouTube Video URL while preserving all query parameters intact.
 */
export function validateSocialUrl(input: string): SocialUrlValidation {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      platform: null,
      normalizedUrl: '',
      error: 'Masukkan tautan video TikTok, Instagram, atau YouTube terlebih dahulu.',
    };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase();

    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      return {
        isValid: true,
        platform: 'tiktok',
        normalizedUrl: withProtocol,
      };
    }

    if (
      host === 'instagram.com' ||
      host.endsWith('.instagram.com') ||
      host === 'instagr.am'
    ) {
      return {
        isValid: true,
        platform: 'instagram',
        normalizedUrl: withProtocol,
      };
    }

    if (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be' ||
      host.endsWith('.youtu.be')
    ) {
      const ytId = extractYouTubeVideoId(withProtocol);
      if (!ytId) {
        return {
          isValid: false,
          platform: 'youtube',
          normalizedUrl: withProtocol,
          error:
            'Masukkan tautan video atau Shorts YouTube yang lengkap (contoh: https://www.youtube.com/watch?v=... , https://youtu.be/... , atau https://youtube.com/shorts/...).',
        };
      }
      return {
        isValid: true,
        platform: 'youtube',
        normalizedUrl: withProtocol,
        videoId: ytId,
      };
    }

    return {
      isValid: false,
      platform: null,
      normalizedUrl: withProtocol,
      error:
        'URL harus berasal dari domain TikTok (tiktok.com / vt.tiktok.com), Instagram (instagram.com), atau YouTube (youtube.com / youtu.be).',
    };
  } catch {
    return {
      isValid: false,
      platform: null,
      normalizedUrl: trimmed,
      error:
        'Format URL tidak valid. Pastikan menyertakan tautan lengkap dari TikTok, Instagram, atau YouTube.',
    };
  }
}

/**
 * Inspects a decoded QR Code string WITHOUT modifying `rawPayload` at all.
 * If the QR payload is an Alight Motion link, identifies whether it is an `alight.link` shortlink
 * (which should be resolved to `https://alightcreative.com/am/share/u/.../p/...`) or already a full
 * `alightcreative.com/am/share/u/.../p/...` URL.
 */
export function inspectQrCodePayload(payload: string): QrPayloadInspection {
  // Keep rawPayload 100% exact as decoded from the QR Code
  const rawPayload = payload ?? '';
  const trimmed = rawPayload.trim();

  if (!trimmed) {
    return {
      rawPayload,
      isAlightPreset: false,
      isAlightShortlink: false,
      isAlightCreativeShare: false,
      directAlightCreativeUrl: null,
    };
  }

  const directAlightCreativeUrl = convertOrExtractAlightCreativeUrl(trimmed);
  if (directAlightCreativeUrl) {
    return {
      rawPayload,
      isAlightPreset: true,
      isAlightShortlink: /alight\.link/i.test(trimmed),
      isAlightCreativeShare: true,
      directAlightCreativeUrl,
    };
  }

  const isAlightShortlink = /(?:https?:\/\/)?(?:www\.)?alight\.link\/[^\s"'<>]+/i.test(trimmed);
  return {
    rawPayload,
    isAlightPreset: isAlightShortlink,
    isAlightShortlink,
    isAlightCreativeShare: false,
    directAlightCreativeUrl: null,
  };
}

export function classifyResolvedUrl(url: string): '5mb' | 'xml' | 'unknown' {
  const parsed = parsePresetLinks(url);
  if (parsed.links5mb.length > 0) return '5mb';
  if (parsed.linksXml.length > 0) return 'xml';
  return 'unknown';
}

/**
 * Resolves an `alight.link` shortlink or `bit.ly`/`s.id`/`tinyurl.com` shortlink to its real
 * destination URL (specifically `https://alightcreative.com/am/share/u/.../p/...` for Alight Motion)
 * using our backend `/api/resolve-url` HTTP redirect & Firebase Dynamic Link inspector.
 * Never invents fake or dummy URLs.
 */
export async function resolveRealRedirectUrl(rawUrl: string): Promise<{
  resolved: boolean;
  resolvedUrl: string;
  category: '5mb' | 'xml' | 'unknown';
  isAlightCreativeShare: boolean;
  error?: string;
}> {
  const direct = convertOrExtractAlightCreativeUrl(rawUrl);
  if (direct) {
    return {
      resolved: true,
      resolvedUrl: direct,
      category: '5mb',
      isAlightCreativeShare: true,
    };
  }

  try {
    const response = await fetch(
      `/api/resolve-url?url=${encodeURIComponent(rawUrl.trim())}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );

    const data = await response.json();
    if (response.ok && data && typeof data.resolvedUrl === 'string' && data.resolvedUrl) {
      const resolvedUrl: string = data.resolvedUrl;
      const changed =
        resolvedUrl.replace(/^https?:\/\//i, '') !==
        rawUrl.trim().replace(/^https?:\/\//i, '');
      return {
        resolved: changed || Boolean(data.isAlightCreativeShare),
        resolvedUrl,
        category: classifyResolvedUrl(resolvedUrl),
        isAlightCreativeShare: Boolean(data.isAlightCreativeShare),
      };
    }

    return {
      resolved: false,
      resolvedUrl: rawUrl.trim(),
      category: classifyResolvedUrl(rawUrl),
      isAlightCreativeShare: false,
      error: data?.error || 'Redirect tujuan tidak ditemukan dari server.',
    };
  } catch (err) {
    return {
      resolved: false,
      resolvedUrl: rawUrl.trim(),
      category: classifyResolvedUrl(rawUrl),
      isAlightCreativeShare: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal menghubungi endpoint resolver.',
    };
  }
}

export interface TikTokCommentUser {
  id: string;
  uniqueId: string;
  nickname: string;
  avatar: string;
  signature?: string;
}

export interface TikTokCommentReplyItem {
  id: string;
  videoId: string;
  parentCommentId: string;
  text: string;
  createTime: number;
  diggCount: number;
  user: TikTokCommentUser;
  isCreator: boolean;
  extractedLinks: ExtractedPresetLink[];
}

export interface TikTokCommentThread {
  id: string;
  videoId: string;
  text: string;
  createTime: number;
  diggCount: number;
  replyTotal: number;
  user: TikTokCommentUser;
  isCreator: boolean;
  extractedLinks: ExtractedPresetLink[];
  replies: TikTokCommentReplyItem[];
  repliesCursor: number;
  repliesHasMore: boolean;
  repliesLoaded: boolean;
}

/**
 * Extracts and deduplicates all Alight Motion preset links (5MB, XML, and Shortlinks)
 * found across a list of TikTok comments and their nested replies, preserving all URL parameters intact.
 */
export function extractPresetLinksFromCommentsAndReplies(
  threads: TikTokCommentThread[]
): ExtractedPresetLink[] {
  const seenKeys = new Set<string>();
  const collected: ExtractedPresetLink[] = [];

  const addLinkWithSourceLabel = (
    link: ExtractedPresetLink,
    sourceLabel: string,
    idPrefix: string
  ) => {
    const key = getCanonicalDedupeKey(link.url);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    collected.push({
      ...link,
      id: `${idPrefix}-${link.id}`,
      label: sourceLabel,
    });
  };

  for (const comment of threads) {
    const commentAuthorTag = comment.isCreator
      ? `Komentar Kreator @${comment.user.uniqueId}`
      : `Komentar @${comment.user.uniqueId}`;

    const parsedComment =
      comment.extractedLinks.length > 0
        ? comment.extractedLinks
        : parsePresetLinks(comment.text).all;

    for (const link of parsedComment) {
      addLinkWithSourceLabel(link, commentAuthorTag, `cmt-${comment.id}`);
    }

    for (const reply of comment.replies || []) {
      const replyAuthorTag = reply.isCreator
        ? `Balasan Kreator @${reply.user.uniqueId}`
        : `Balasan @${reply.user.uniqueId}`;

      const parsedReply =
        reply.extractedLinks.length > 0
          ? reply.extractedLinks
          : parsePresetLinks(reply.text).all;

      for (const link of parsedReply) {
        addLinkWithSourceLabel(link, replyAuthorTag, `rep-${reply.id}`);
      }
    }
  }

  return collected;
}

/**
 * Merges preset links extracted from the video caption with preset links extracted
 * from comments and replies without duplicating identical URLs.
 */
export function mergeUniquePresetLinks(
  captionLinks: ExtractedPresetLink[],
  commentAndReplyLinks: ExtractedPresetLink[]
): ExtractedPresetLink[] {
  const seenKeys = new Set<string>();
  const merged: ExtractedPresetLink[] = [];

  for (const item of [...captionLinks, ...commentAndReplyLinks]) {
    const key = getCanonicalDedupeKey(item.url);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    merged.push(item);
  }

  return merged;
}

/**
 * Pure transformer that converts a raw comment object from TikWM API (`comment/list`)
 * into a structured TikTokCommentThread and extracts any Alight Motion preset links inside it.
 */
export function normalizeRawTikwmComment(
  raw: Record<string, any>,
  creatorUniqueId?: string
): TikTokCommentThread {
  const uniqueId = String(raw?.user?.unique_id || 'user');
  const signature =
    typeof raw?.user?.signature === 'string' ? raw.user.signature : '';
  const isCreator = Boolean(
    creatorUniqueId &&
      uniqueId.toLowerCase() === creatorUniqueId.replace(/^@/, '').toLowerCase()
  );

  const text = typeof raw?.text === 'string' ? raw.text : '';
  const combinedSourceText =
    isCreator && signature ? `${text}\n${signature}` : text;
  const parsed = parsePresetLinks(combinedSourceText);

  const authorTag = isCreator
    ? `Komentar Kreator @${uniqueId}`
    : `Komentar @${uniqueId}`;

  const extractedLinks = parsed.all.map((link) => ({
    ...link,
    id: `cmt-${String(raw?.id || '')}-${link.id}`,
    label: authorTag,
  }));

  return {
    id: String(raw?.id || ''),
    videoId: String(raw?.video_id || ''),
    text,
    createTime: Number(raw?.create_time) || 0,
    diggCount: Number(raw?.digg_count) || 0,
    replyTotal: Number(raw?.reply_total) || 0,
    user: {
      id: String(raw?.user?.id || ''),
      uniqueId,
      nickname: String(raw?.user?.nickname || uniqueId),
      avatar: typeof raw?.user?.avatar === 'string' ? raw.user.avatar : '',
      signature,
    },
    isCreator,
    extractedLinks,
    replies: [],
    repliesCursor: 0,
    repliesHasMore: (Number(raw?.reply_total) || 0) > 0,
    repliesLoaded: false,
  };
}

/**
 * Pure transformer that converts a raw reply object from TikWM API (`comment/reply`)
 * into a structured TikTokCommentReplyItem and extracts any Alight Motion preset links inside it.
 */
export function normalizeRawTikwmReply(
  raw: Record<string, any>,
  parentCommentId: string,
  creatorUniqueId?: string
): TikTokCommentReplyItem {
  const uniqueId = String(raw?.user?.unique_id || 'user');
  const signature =
    typeof raw?.user?.signature === 'string' ? raw.user.signature : '';
  const isCreator = Boolean(
    creatorUniqueId &&
      uniqueId.toLowerCase() === creatorUniqueId.replace(/^@/, '').toLowerCase()
  );

  const text = typeof raw?.text === 'string' ? raw.text : '';
  const combinedSourceText =
    isCreator && signature ? `${text}\n${signature}` : text;
  const parsed = parsePresetLinks(combinedSourceText);

  const authorTag = isCreator
    ? `Balasan Kreator @${uniqueId}`
    : `Balasan @${uniqueId}`;

  const extractedLinks = parsed.all.map((link) => ({
    ...link,
    id: `rep-${String(raw?.id || '')}-${link.id}`,
    label: authorTag,
  }));

  return {
    id: String(raw?.id || ''),
    videoId: String(raw?.video_id || ''),
    parentCommentId,
    text,
    createTime: Number(raw?.create_time) || 0,
    diggCount: Number(raw?.digg_count) || 0,
    user: {
      id: String(raw?.user?.id || ''),
      uniqueId,
      nickname: String(raw?.user?.nickname || uniqueId),
      avatar: typeof raw?.user?.avatar === 'string' ? raw.user.avatar : '',
      signature,
    },
    isCreator,
    extractedLinks,
  };
}

/**
 * Formats a video duration or timestamp in seconds into a tabular `M:SS` or `H:MM:SS` string.
 */
export function formatVideoTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSec = Math.floor(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const paddedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  if (hrs > 0) {
    const paddedMins = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }
  return `${mins}:${paddedSecs}`;
}

/**
 * Builds a clean, full-controls YouTube embed URL from a YouTube video ID or video URL.
 */
export function buildYouTubeEmbedUrl(videoIdOrUrl: string): string | null {
  if (!videoIdOrUrl || typeof videoIdOrUrl !== 'string') return null;
  const trimmed = videoIdOrUrl.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/embed/${trimmed}?controls=1&rel=0&modestbranding=1&playsinline=1`;
  }
  const extractedId = extractYouTubeVideoId(trimmed);
  if (extractedId) {
    return `https://www.youtube.com/embed/${extractedId}?controls=1&rel=0&modestbranding=1&playsinline=1`;
  }
  return null;
}


