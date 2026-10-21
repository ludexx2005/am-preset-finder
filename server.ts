import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extracts `https://alightcreative.com/am/share/u/.../p/...` from a URL string,
 * query parameter (`?link=...`), or HTML body (Firebase Dynamic Link metadata / scripts).
 */
function extractAlightCreativeTarget(input: string): string | null {
  if (!input) return null;

  // 1. Check if input is a URL with a ?link= or ?deep_link_id= parameter (Firebase Dynamic Links format)
  try {
    const parsed = new URL(input);
    const embeddedLink =
      parsed.searchParams.get('link') ||
      parsed.searchParams.get('deep_link_id') ||
      parsed.searchParams.get('afl') ||
      parsed.searchParams.get('ifl');
    if (embeddedLink) {
      const normalized = normalizeAlightSchemeToHttps(embeddedLink);
      if (normalized) return normalized;
    }
  } catch {
    // Not a single URL, continue regex inspection
  }

  // 2. Check for URL-encoded https%3A%2F%2Falightcreative.com%2Fam%2Fshare%2F...
  const encodedMatch = input.match(
    /https?%3A%2F%2F(?:www\.)?alightcreative\.com%2Fam%2Fshare%2F[A-Za-z0-9_%.\-~]+/i
  );
  if (encodedMatch) {
    try {
      const decoded = decodeURIComponent(encodedMatch[0]);
      if (decoded.includes('alightcreative.com/am/share/')) {
        return decoded;
      }
    } catch {
      // Ignore decode error
    }
  }

  // 3. Direct https://alightcreative.com/am/share/u/.../p/... match
  const directMatch = input.match(
    /https?:\/\/(?:www\.)?alightcreative\.com\/am\/share\/[^\s"'<>\\)]+/i
  );
  if (directMatch) {
    return directMatch[0].replace(/&amp;/g, '&');
  }

  // 4. Custom scheme alight://am/share/... or alightmotion://am/share/... in meta tags
  const schemeMatch = input.match(
    /(?:alight|alightmotion):\/\/am\/share\/[^\s"'<>\\)]+/i
  );
  if (schemeMatch) {
    const pathPart = schemeMatch[0]
      .replace(/^(?:alight|alightmotion):\/\/+/i, '')
      .replace(/&amp;/g, '&');
    return `https://alightcreative.com/${pathPart}`;
  }

  return null;
}

function normalizeAlightSchemeToHttps(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\/(?:www\.)?alightcreative\.com\/am\/share\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^(?:alight|alightmotion):\/\/am\/share\//i.test(trimmed)) {
    const rest = trimmed.replace(/^(?:alight|alightmotion):\/\/+/i, '');
    return `https://alightcreative.com/${rest}`;
  }
  return null;
}

function decodeJsonEscapedString(raw: string | undefined): string {
  if (!raw) return '';
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\u0026/g, '&')
      .replace(/\\\\/g, '\\');
  }
}

function parseLocalizedNumberString(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return 0;

  if (/\b(jt|juta|m)\b/.test(cleaned)) {
    const numMatch = cleaned.match(/(\d+(?:[.,]\d+)?)/);
    if (numMatch) {
      return Math.round(parseFloat(numMatch[1].replace(',', '.')) * 1_000_000);
    }
  }
  if (/\b(rb|ribu|k)\b/.test(cleaned)) {
    const numMatch = cleaned.match(/(\d+(?:[.,]\d+)?)/);
    if (numMatch) {
      return Math.round(parseFloat(numMatch[1].replace(',', '.')) * 1_000);
    }
  }
  const digitsOnly = cleaned.replace(/[^\d]/g, '');
  return digitsOnly ? Number(digitsOnly) || 0 : 0;
}

function deriveSoundNameFromTitleAndDesc(
  title: string,
  description: string,
  authorName: string,
  explicitMusicTitle?: string
): string {
  if (explicitMusicTitle && explicitMusicTitle.trim()) {
    return explicitMusicTitle.trim();
  }

  // Check if description mentions SOUND / LAGU / MUSIC / AUDIO
  const soundLineMatch = description.match(
    /(?:sound|lagu|musik|music|audio|backsound|dj)\s*[:=-]\s*([^\n\r]{3,75})/i
  );
  if (soundLineMatch && soundLineMatch[1]) {
    const cleaned = soundLineMatch[1].replace(/https?:\/\/\S+/g, '').trim();
    if (cleaned.length >= 3) return cleaned;
  }

  // Check if title contains "DJ ..." or segment separated by | or -
  const djMatch = title.match(/\b(DJ\s+[^|\n\r✨⚡🔥🗿📥😱☕🤯]{3,65})/i);
  if (djMatch && djMatch[1]) {
    return djMatch[1].trim();
  }

  const segments = title
    .split(/[|•~—]|\s+-\s+|\|\|/)
    .map((s) =>
      s
        .replace(
          /\b(preset\s+alight\s+motion|preset\s+am|dibawah\s+5mb|di\s+bawah\s+5mb|5mb\s*&\s*xml|5mb|xml|terbaru|jedag\s+jedug|jj)\b/gi,
          ''
        )
        .replace(/[✨⚡🔥🗿📥😱🌠💫☕🤯]/g, '')
        .trim()
    )
    .filter((s) => s.length >= 4);

  if (segments.length > 0) {
    return `${segments[0]} — Original Sound (${authorName})`;
  }

  return `Original Sound — ${authorName}`;
}

interface SearchRendererHint {
  id: string;
  title?: string;
  authorName?: string;
  authorHandle?: string;
  viewCount?: number;
}

interface ParsedYouTubeWatchInfo {
  id: string;
  title: string;
  description: string;
  authorName: string;
  authorHandle: string;
  channelId: string;
  avatarUrl: string;
  coverUrl: string;
  durationSec: number;
  viewCount: number;
  likeCount: number;
  soundTitle: string;
  unwrappedRedirectLinks: string[];
}

function parseYouTubeWatchHtml(
  html: string,
  videoId: string,
  hint?: SearchRendererHint
): ParsedYouTubeWatchInfo {
  let title = hint?.title?.trim() || '';
  let description = '';
  let authorName = hint?.authorName?.trim() || 'Creator';
  let authorHandle = hint?.authorHandle?.trim() || '';
  let channelId = '';
  const avatarUrl = '';
  let durationSec = 0;
  let viewCount = hint?.viewCount || 0;
  let likeCount = 0;
  let explicitMusicTitle = '';
  const coverUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  // 1. Extract title from videoPrimaryInfoRenderer or playerMicroformatRenderer if not already provided
  const primaryTitleMatch =
    html.match(
      /"videoPrimaryInfoRenderer":\{"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/
    ) ||
    html.match(
      /"playerMicroformatRenderer":\{[^}]*?"title":\{"simpleText":"((?:\\.|[^"\\])*)"/
    );
  if (primaryTitleMatch?.[1]) {
    title = decodeJsonEscapedString(primaryTitleMatch[1]).trim() || title;
  }

  const shortDescMatch = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
  const attrDescMatch = html.match(
    /"attributedDescriptionBodyText":\{"content":"((?:\\.|[^"\\])*)"/
  );

  const shortDesc = shortDescMatch?.[1]
    ? decodeJsonEscapedString(shortDescMatch[1]).trim()
    : '';
  const attrDesc = attrDescMatch?.[1]
    ? decodeJsonEscapedString(attrDescMatch[1]).trim()
    : '';

  description = shortDesc.length >= attrDesc.length ? shortDesc : attrDesc;

  // 2. Extract author / channel name & handle
  const ownerMatch =
    html.match(/"ownerChannelName":"((?:\\.|[^"\\])*)"/) ||
    html.match(
      /"videoOwnerRenderer":\{.*?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/
    );
  if (ownerMatch?.[1]) {
    authorName = decodeJsonEscapedString(ownerMatch[1]).trim() || authorName;
  }

  const handleMatch =
    html.match(/"ownerProfileUrl":"[^"]*?\/@([A-Za-z0-9_.-]+)"/) ||
    html.match(/"canonicalBaseUrl":"\/@([A-Za-z0-9_.-]+)"/);
  if (handleMatch?.[1]) {
    authorHandle = handleMatch[1];
  } else if (!authorHandle) {
    authorHandle =
      authorName
        .split('·')[0]
        .replace(/[^A-Za-z0-9_.-]/g, '')
        .toLowerCase() || 'creator';
  }
  authorHandle = authorHandle.replace(/^\/?@/, '');

  const channelIdMatch = html.match(/"externalChannelId":"([^"]+)"/);
  if (channelIdMatch?.[1]) {
    channelId = channelIdMatch[1];
  }

  const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
  if (durationMatch?.[1]) {
    durationSec = Number(durationMatch[1]) || 0;
  }

  const viewsMatch = html.match(/"viewCount":"(\d+)"/);
  if (viewsMatch?.[1]) {
    viewCount = Number(viewsMatch[1]) || viewCount;
  }

  // Extract factoidRenderer values for Suka (Likes) and Penayangan (Views)
  const factoidMatches = [
    ...html.matchAll(
      /"factoidRenderer":\{"value":\{"simpleText":"([^"]+)"\},"label":\{"simpleText":"([^"]+)"\}/g
    ),
  ];
  for (const fm of factoidMatches) {
    const valStr = fm[1];
    const labelStr = fm[2].toLowerCase();
    if (labelStr.includes('suka') || labelStr.includes('like')) {
      const parsedLikes = parseLocalizedNumberString(valStr);
      if (parsedLikes > 0) likeCount = parsedLikes;
    } else if (labelStr.includes('penayangan') || labelStr.includes('view')) {
      const parsedViews = parseLocalizedNumberString(valStr);
      if (parsedViews > 0 && !viewCount) viewCount = parsedViews;
    }
  }

  if (!likeCount) {
    const likesMatch =
      html.match(/"likeCount":(\d+)/) ||
      html.match(/"likeCount":"(\d+)"/) ||
      html.match(/"likeCountIfIndifferentNumber":"(\d+)"/);
    if (likesMatch?.[1]) {
      likeCount = Number(likesMatch[1]) || 0;
    }
  }

  // Extract music attribution if present in YouTube watch page
  const musicMatch = html.match(
    /"carouselLockupRenderer":\{.*?"videoLockupTitle":\{"simpleText":"((?:\\.|[^"\\])*)"/
  );
  if (musicMatch?.[1]) {
    explicitMusicTitle = decodeJsonEscapedString(musicMatch[1]).trim();
  }

  // Extract all full untruncated URLs from YouTube redirect links (\u0026q=https%3A%2F%2F...)
  const rawRedirectMatches = [
    ...html.matchAll(/(?:\\u0026|&|\?)q=(https?%3A%2F%2F[^"\\&\s]+)/gi),
  ];
  const unwrappedSet = new Set<string>();
  for (const m of rawRedirectMatches) {
    try {
      const decoded = decodeURIComponent(m[1]).trim();
      if (
        /(?:alightcreative\.com|alight\.link|drive\.google\.com|docs\.google\.com|mediafire\.com|dropbox\.com|mega\.nz|bit\.ly|s\.id|tinyurl\.com|\.xml)/i.test(
          decoded
        )
      ) {
        unwrappedSet.add(decoded);
      }
    } catch {
      // Ignore malformed encoding
    }
  }

  const unwrappedRedirectLinks = Array.from(unwrappedSet);

  // Append full untruncated redirect links to description if they were truncated with "..." in the visible text
  if (unwrappedRedirectLinks.length > 0) {
    const missingFullLinks = unwrappedRedirectLinks.filter(
      (fullUrl) => !description.includes(fullUrl)
    );
    if (missingFullLinks.length > 0) {
      description = `${description}\n\n[Tautan Lengkap Ekstraksi Deskripsi]:\n${missingFullLinks.join('\n')}`.trim();
    }
  }

  const cleanAuthorDisplay = authorName.split('·')[0].trim() || authorHandle;
  const soundTitle = deriveSoundNameFromTitleAndDesc(
    title,
    description,
    cleanAuthorDisplay,
    explicitMusicTitle
  );

  return {
    id: videoId,
    title,
    description,
    authorName: cleanAuthorDisplay,
    authorHandle,
    channelId,
    avatarUrl,
    coverUrl,
    durationSec,
    viewCount,
    likeCount,
    soundTitle,
    unwrappedRedirectLinks,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  let lastTikwmCallAt = 0;

  async function fetchTikwmJsonWithRetry(targetUrl: string): Promise<any> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const now = Date.now();
      const elapsed = now - lastTikwmCallAt;
      if (elapsed < 1050) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 1050 - elapsed));
      }
      lastTikwmCallAt = Date.now();

      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(targetUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
      });
      // eslint-disable-next-line no-await-in-loop
      const data = await response.json();

      if (
        data &&
        data.code === -1 &&
        typeof data.msg === 'string' &&
        /limit/i.test(data.msg) &&
        attempt < 2
      ) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 1150));
        continue;
      }
      return data;
    }
    return {
      code: -1,
      msg: 'Batas request API TikWM tercapai, silakan coba sesaat lagi.',
    };
  }

  /**
   * 1. Proxy fallback for TikWM Video Metadata API
   */
  app.get('/api/tikwm', async (req, res) => {
    const videoUrl = String(req.query.url || '').trim();
    if (!videoUrl) {
      res.status(400).json({ code: -1, msg: 'Parameter url diperlukan.' });
      return;
    }

    try {
      const target = `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}&hd=1`;
      const data = await fetchTikwmJsonWithRetry(target);
      res.json(data);
    } catch (err) {
      res.status(502).json({
        code: -1,
        msg:
          err instanceof Error
            ? err.message
            : 'Gagal menghubungi server TikWM.',
      });
    }
  });

  /**
   * 1b. Proxy fallback for TikWM Top-Level Comments API (`/api/comment/list`)
   */
  app.get('/api/tikwm/comments', async (req, res) => {
    const videoUrl = String(req.query.url || '').trim();
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 50));
    const cursor = Math.max(0, Number(req.query.cursor) || 0);

    if (!videoUrl) {
      res.status(400).json({ code: -1, msg: 'Parameter url diperlukan.' });
      return;
    }

    try {
      const target = `https://www.tikwm.com/api/comment/list?url=${encodeURIComponent(
        videoUrl
      )}&count=${count}&cursor=${cursor}`;
      const data = await fetchTikwmJsonWithRetry(target);
      res.json(data);
    } catch (err) {
      res.status(502).json({
        code: -1,
        msg:
          err instanceof Error
            ? err.message
            : 'Gagal mengambil daftar komentar TikTok.',
      });
    }
  });

  /**
   * 1c. Proxy fallback for TikWM Comment Replies API (`/api/comment/reply`)
   */
  app.get('/api/tikwm/replies', async (req, res) => {
    const videoId = String(req.query.video_id || '').trim();
    const commentId = String(req.query.comment_id || '').trim();
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 50));
    const cursor = Math.max(0, Number(req.query.cursor) || 0);

    if (!videoId || !commentId) {
      res.status(400).json({
        code: -1,
        msg: 'Parameter video_id dan comment_id diperlukan.',
      });
      return;
    }

    try {
      const target = `https://www.tikwm.com/api/comment/reply?video_id=${encodeURIComponent(
        videoId
      )}&comment_id=${encodeURIComponent(
        commentId
      )}&count=${count}&cursor=${cursor}`;
      const data = await fetchTikwmJsonWithRetry(target);
      res.json(data);
    } catch (err) {
      res.status(502).json({
        code: -1,
        msg:
          err instanceof Error
            ? err.message
            : 'Gagal mengambil balasan komentar TikTok.',
      });
    }
  });

  /**
   * 1d. Real YouTube Video & Shorts Metadata, Description & Top Comments Extractor (`/api/youtube`)
   */
  app.get('/api/youtube', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res
        .status(400)
        .json({ code: -1, msg: 'Parameter url YouTube diperlukan.' });
      return;
    }

    const ytIdMatch =
      rawUrl.match(/(?:v=|\/shorts\/|\/live\/|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/) ||
      rawUrl.match(/^([A-Za-z0-9_-]{11})$/);
    const videoId = ytIdMatch ? ytIdMatch[1] : '';

    if (!videoId) {
      res.status(400).json({
        code: -1,
        msg: 'ID video atau Shorts YouTube tidak valid.',
      });
      return;
    }

    try {
      const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=id`;
      const response = await fetch(watchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!response.ok) {
        res.status(502).json({
          code: -1,
          msg: `Gagal mengambil halaman YouTube (HTTP ${response.status}).`,
        });
        return;
      }

      const html = await response.text();
      const parsed = parseYouTubeWatchHtml(html, videoId);

      // Try to extract initial continuation token for YouTube comments if present
      const comments: Array<{
        id: string;
        video_id: string;
        text: string;
        create_time: number;
        digg_count: number;
        reply_total: number;
        user: {
          id: string;
          unique_id: string;
          nickname: string;
          avatar: string;
        };
      }> = [];

      const initialDataMatch = html.match(
        /var\s+ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s
      );
      if (initialDataMatch) {
        try {
          const rawInitialStr = initialDataMatch[1];
          const tokenMatches = [
            ...rawInitialStr.matchAll(
              /"continuationCommand":\{"token":"([^"]+)"/g
            ),
          ];
          const candidateToken =
            tokenMatches.length > 0
              ? tokenMatches[tokenMatches.length - 1][1]
              : null;

          if (candidateToken) {
            const nextRes = await fetch(
              'https://www.youtube.com/youtubei/v1/next?prettyPrint=false',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                },
                body: JSON.stringify({
                  context: {
                    client: {
                      clientName: 'WEB',
                      clientVersion: '2.20240726.00.00',
                      hl: 'id',
                      gl: 'ID',
                    },
                  },
                  continuation: candidateToken,
                }),
              }
            );

            if (nextRes.ok) {
              const nextJsonStr = await nextRes.text();
              const commentMatches = [
                ...nextJsonStr.matchAll(
                  /"commentId":"([^"]+)".*?"contentText":\{"runs":(\[.*?\])\}/g
                ),
              ];
              for (const m of commentMatches.slice(0, 30)) {
                try {
                  const cid = m[1];
                  const runs = JSON.parse(m[2]);
                  const fullText = Array.isArray(runs)
                    ? runs.map((r: any) => r?.text || '').join('')
                    : '';
                  if (fullText.trim()) {
                    comments.push({
                      id: cid,
                      video_id: videoId,
                      text: fullText.trim(),
                      create_time: Math.floor(Date.now() / 1000),
                      digg_count: 0,
                      reply_total: 0,
                      user: {
                        id: cid,
                        unique_id: 'youtube_commenter',
                        nickname: 'Komentar YouTube',
                        avatar: '',
                      },
                    });
                  }
                } catch {
                  // Ignore single comment parse error
                }
              }
            }
          }
        } catch {
          // Ignore comment continuation errors
        }
      }

      if (!parsed.title && !parsed.description) {
        res.status(404).json({
          code: -1,
          msg: 'Data video YouTube tidak ditemukan atau video bersifat privat.',
        });
        return;
      }

      res.json({
        code: 0,
        msg: 'success',
        data: {
          id: videoId,
          platform: 'youtube',
          title: parsed.title,
          description: parsed.description,
          sound_title: parsed.soundTitle,
          view_count: parsed.viewCount,
          like_count: parsed.likeCount,
          duration: parsed.durationSec,
          cover: parsed.coverUrl,
          author: {
            id: parsed.channelId || parsed.authorHandle,
            unique_id: parsed.authorHandle,
            nickname: parsed.authorName,
            avatar: parsed.avatarUrl,
          },
          comment_count: comments.length,
          comments,
        },
      });
    } catch (err) {
      res.status(502).json({
        code: -1,
        msg:
          err instanceof Error
            ? err.message
            : 'Gagal mengambil metadata video YouTube.',
      });
    }
  });

  /**
   * 1e. Keyword, Song Name & Creator Preset Search (`/api/search-presets?q=...`)
   * Searches videos matching the keyword/song/creator and extracts real Alight Motion preset links
   * (5MB, XML, Google Drive, MediaFire, Alight Link) from descriptions and comments.
   */
  app.get('/api/search-presets', async (req, res) => {
    const rawQuery = String(req.query.q || '').trim();
    if (!rawQuery) {
      res.status(400).json({
        code: -1,
        msg: 'Masukkan kata kunci preset, nama lagu, atau nama kreator terlebih dahulu.',
      });
      return;
    }

    try {
      const hasPresetKeyword = /\b(preset|alight\s*motion|5mb|xml)\b/i.test(
        rawQuery
      );
      const effectiveSearchQuery = hasPresetKeyword
        ? `${rawQuery} 5MB XML`
        : `Preset Alight Motion ${rawQuery} 5MB XML`;

      const searchRes = await fetch(
        'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20240726.00.00',
                hl: 'id',
                gl: 'ID',
              },
            },
            query: effectiveSearchQuery,
          }),
        }
      );

      if (!searchRes.ok) {
        res.status(502).json({
          code: -1,
          msg: `Gagal menghubungi layanan pencarian video (HTTP ${searchRes.status}).`,
        });
        return;
      }

      const searchJson = await searchRes.json();

      // Walk the searchJson tree to collect rich videoRenderer metadata hints
      const candidateHints = new Map<string, SearchRendererHint>();
      const walkSearchTree = (node: any) => {
        if (!node || typeof node !== 'object') return;
        if (node.videoRenderer && typeof node.videoRenderer.videoId === 'string') {
          const vr = node.videoRenderer;
          const vid = vr.videoId;
          if (!candidateHints.has(vid)) {
            const rawTitle =
              vr.title?.runs?.map((r: any) => r?.text || '').join('') ||
              vr.title?.simpleText ||
              '';
            const rawOwner =
              vr.ownerText?.runs?.[0]?.text ||
              vr.longBylineText?.runs?.[0]?.text ||
              vr.shortBylineText?.runs?.[0]?.text ||
              '';
            const cleanOwner = String(rawOwner).split('·')[0].trim();
            const canonicalUrl =
              vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint
                ?.canonicalBaseUrl ||
              vr.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint
                ?.canonicalBaseUrl ||
              '';
            const rawHandle = canonicalUrl
              ? String(canonicalUrl).replace(/^\/?@/, '')
              : cleanOwner.replace(/[^A-Za-z0-9_.-]/g, '').toLowerCase();
            const rawViewsStr =
              vr.viewCountText?.simpleText ||
              vr.shortViewCountText?.simpleText ||
              '';

            candidateHints.set(vid, {
              id: vid,
              title: String(rawTitle).trim(),
              authorName: cleanOwner || 'Creator',
              authorHandle: rawHandle || 'creator',
              viewCount: parseLocalizedNumberString(String(rawViewsStr)),
            });
          }
        }
        for (const key of Object.keys(node)) {
          walkSearchTree(node[key]);
        }
      };
      walkSearchTree(searchJson);

      const uniqueVideoIds = Array.from(candidateHints.keys()).slice(0, 10);

      if (uniqueVideoIds.length === 0) {
        res.json({
          code: 0,
          msg: 'success',
          data: {
            query: rawQuery,
            items: [],
          },
        });
        return;
      }

      // Inspect top candidate videos in parallel and extract full preset links
      const enrichedItems = await Promise.all(
        uniqueVideoIds.map(async (vid) => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5500);
            const watchRes = await fetch(
              `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}&hl=id`,
              {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                },
                signal: controller.signal,
              }
            );
            clearTimeout(timer);

            if (!watchRes.ok) return null;
            const html = await watchRes.text();
            const hint = candidateHints.get(vid);
            const parsed = parseYouTubeWatchHtml(html, vid, hint);
            if (!parsed.title && !parsed.description) return null;

            return {
              id: vid,
              sourceUrl: `https://www.youtube.com/watch?v=${vid}`,
              platform: 'youtube' as const,
              title: parsed.title,
              caption: [parsed.title, parsed.description]
                .filter(Boolean)
                .join('\n\n'),
              soundTitle: parsed.soundTitle,
              viewCount: parsed.viewCount,
              likeCount: parsed.likeCount,
              durationSec: parsed.durationSec,
              coverUrl: parsed.coverUrl,
              author: {
                uniqueId: parsed.authorHandle,
                nickname: parsed.authorName,
                avatar: parsed.avatarUrl,
              },
              unwrappedLinksCount: parsed.unwrappedRedirectLinks.length,
            };
          } catch {
            return null;
          }
        })
      );

      const validItems = enrichedItems.filter(
        (item): item is NonNullable<typeof item> => item !== null
      );

      res.json({
        code: 0,
        msg: 'success',
        data: {
          query: rawQuery,
          items: validItems,
        },
      });
    } catch (err) {
      res.status(502).json({
        code: -1,
        msg:
          err instanceof Error
            ? err.message
            : 'Gagal melakukan pencarian kata kunci preset.',
      });
    }
  });

  /**
   * 2. Same-Origin Video Stream Proxy for <video> + <canvas> + jsQR
   * Enables HTML5 <canvas> getImageData() on real TikTok / Instagram video streams without CORS taint.
   */
  app.get('/api/video-proxy', async (req, res) => {
    const rawVideoUrl = String(req.query.url || '').trim();
    if (!rawVideoUrl) {
      res.status(400).send('Missing url parameter');
      return;
    }

    try {
      const parsed = new URL(rawVideoUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        res.status(400).send('Invalid protocol');
        return;
      }

      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Referer: 'https://www.tikwm.com/',
      };

      if (req.headers.range) {
        headers.Range = String(req.headers.range);
      }

      const upstream = await fetch(rawVideoUrl, {
        headers,
        redirect: 'follow',
      });

      if (!upstream.ok && upstream.status !== 206) {
        res
          .status(upstream.status)
          .send(`Upstream video error: ${upstream.statusText}`);
        return;
      }

      res.status(upstream.status);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') || 'video/mp4'
      );

      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      res.setHeader('Accept-Ranges', 'bytes');

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        if (!res.writableEnded) {
          res.write(Buffer.from(value));
          await pump();
        }
      };

      req.on('close', () => {
        reader.cancel().catch(() => {});
      });

      await pump();
    } catch (err) {
      if (!res.headersSent) {
        res
          .status(502)
          .send(
            err instanceof Error ? err.message : 'Failed to proxy video stream'
          );
      }
    }
  });

  /**
   * 3. Real Shortlink & Alight Motion Dynamic Link Resolver
   * Resolves alight.link/... to https://alightcreative.com/am/share/u/.../p/...
   * and resolves bit.ly / s.id / tinyurl.com redirects via real HTTP requests.
   */
  app.get('/api/resolve-url', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ error: 'Parameter url diperlukan.' });
      return;
    }

    const normalizedInput = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;

    try {
      const parsedInput = new URL(normalizedInput);
      const isAlightShortlink =
        parsedInput.hostname.toLowerCase() === 'alight.link' ||
        parsedInput.hostname.toLowerCase().endsWith('.alight.link');

      // Check if URL already embeds ?link=https://alightcreative.com/am/share/u/.../p/...
      const immediateExtract = extractAlightCreativeTarget(normalizedInput);
      if (immediateExtract) {
        res.json({
          originalUrl: rawUrl,
          resolvedUrl: immediateExtract,
          isAlightCreativeShare: true,
        });
        return;
      }

      // Step A: Perform HTTP GET with redirect: 'manual' chain up to 8 hops so we can inspect every Location header
      let currentUrl = normalizedInput;
      let discoveredTarget: string | null = null;

      for (let hop = 0; hop < 8; hop++) {
        // eslint-disable-next-line no-await-in-loop
        const hopRes = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        const locationHeader = hopRes.headers.get('location');
        if (locationHeader) {
          const nextUrl = new URL(locationHeader, currentUrl).toString();
          const extractedFromLoc = extractAlightCreativeTarget(nextUrl);
          if (extractedFromLoc) {
            discoveredTarget = extractedFromLoc;
            break;
          }
          currentUrl = nextUrl;
          continue;
        }

        // Reached final response (status 200/etc.): inspect HTML body for Firebase Dynamic Link / Alight Motion share URL
        // eslint-disable-next-line no-await-in-loop
        const bodyText = await hopRes.text();
        const extractedFromBody = extractAlightCreativeTarget(bodyText);
        if (extractedFromBody) {
          discoveredTarget = extractedFromBody;
        }
        break;
      }

      // Step B: If it's an alight.link and still not resolved to alightcreative.com/am/share/...,
      // also check Firebase Dynamic Links debug/preview endpoint (?d=1) which outputs the deep link in HTML
      if (!discoveredTarget && isAlightShortlink) {
        try {
          const debugUrl = new URL(normalizedInput);
          debugUrl.searchParams.set('d', '1');
          const debugRes = await fetch(debugUrl.toString(), {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            },
          });
          const debugHtml = await debugRes.text();
          const fromDebug = extractAlightCreativeTarget(debugHtml);
          if (fromDebug) {
            discoveredTarget = fromDebug;
          }
        } catch {
          // Ignore debug fetch error
        }
      }

      const finalResolved = discoveredTarget || currentUrl;
      res.json({
        originalUrl: rawUrl,
        resolvedUrl: finalResolved,
        isAlightCreativeShare: finalResolved
          .toLowerCase()
          .includes('alightcreative.com/am/share/'),
      });
    } catch (err) {
      res.status(502).json({
        originalUrl: rawUrl,
        resolvedUrl: normalizedInput,
        isAlightCreativeShare: false,
        error:
          err instanceof Error
            ? err.message
            : 'Gagal meresolve redirect URL.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AM Preset Finder server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
