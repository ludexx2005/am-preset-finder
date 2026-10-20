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
    return { code: -1, msg: 'Batas request API TikWM tercapai, silakan coba sesaat lagi.' };
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
        msg: err instanceof Error ? err.message : 'Gagal menghubungi server TikWM.',
      });
    }
  });

  /**
   * 1b. Proxy for TikWM Video Comments List (`comment/list`)
   */
  app.get('/api/tikwm/comments', async (req, res) => {
    const videoUrlOrId = String(req.query.url || '').trim();
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 50));
    const cursor = Math.max(0, Number(req.query.cursor) || 0);

    if (!videoUrlOrId) {
      res.status(400).json({ code: -1, msg: 'Parameter url atau video_id diperlukan.' });
      return;
    }

    try {
      const target = `https://www.tikwm.com/api/comment/list?url=${encodeURIComponent(
        videoUrlOrId
      )}&count=${count}&cursor=${cursor}`;
      const data = await fetchTikwmJsonWithRetry(target);
      res.json(data);
    } catch (err) {
      res.status(502).json({
        code: -1,
        msg:
          err instanceof Error
            ? err.message
            : 'Gagal mengambil daftar komentar dari TikWM.',
      });
    }
  });

  /**
   * 1c. Proxy for TikWM Comment Replies (`comment/reply`)
   */
  app.get('/api/tikwm/replies', async (req, res) => {
    const videoId = String(req.query.video_id || '').trim();
    const commentId = String(req.query.comment_id || '').trim();
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 50));
    const cursor = Math.max(0, Number(req.query.cursor) || 0);

    if (!videoId || !commentId) {
      res
        .status(400)
        .json({ code: -1, msg: 'Parameter video_id dan comment_id diperlukan.' });
      return;
    }

    try {
      const target = `https://www.tikwm.com/api/comment/reply?video_id=${encodeURIComponent(
        videoId
      )}&comment_id=${encodeURIComponent(commentId)}&count=${count}&cursor=${cursor}`;
      const data = await fetchTikwmJsonWithRetry(target);
      res.json(data);
    } catch (err) {
      res.status(502).json({
        code: -1,
        msg:
          err instanceof Error
            ? err.message
            : 'Gagal mengambil balasan komentar dari TikWM.',
      });
    }
  });

  /**
   * 1d. YouTube Video & Shorts Metadata, Full Description & Comments Extractor (`/api/youtube`)
   */
  app.get('/api/youtube', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ code: -1, msg: 'Parameter url YouTube diperlukan.' });
      return;
    }

    // Extract videoId from watch?v=, youtu.be/, /shorts/, /embed/, /live/
    let videoId: string | null = null;
    try {
      const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      const u = new URL(withProto);
      const host = u.hostname.toLowerCase();
      if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
        const seg = u.pathname.split('/').filter(Boolean)[0];
        if (seg && /^[A-Za-z0-9_-]{6,20}$/.test(seg)) videoId = seg;
      } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
        const vParam = u.searchParams.get('v');
        if (vParam && /^[A-Za-z0-9_-]{6,20}$/.test(vParam)) {
          videoId = vParam;
        } else {
          const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,20})/i);
          if (m && m[1]) videoId = m[1];
        }
      }
    } catch {
      // Ignore parse error
    }

    if (!videoId) {
      res.status(400).json({
        code: -1,
        msg: 'ID video atau Shorts YouTube tidak valid.',
      });
      return;
    }

    try {
      const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=id`;
      const htmlRes = await fetch(watchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!htmlRes.ok) {
        res.status(502).json({
          code: -1,
          msg: `Gagal mengambil halaman YouTube (HTTP ${htmlRes.status}).`,
        });
        return;
      }

      const html = await htmlRes.text();
      const playerMatch = html.match(
        /var ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|const|let|<\/script>)/s
      );

      let title = '';
      let description = '';
      let authorName = 'YouTube Creator';
      let authorHandle = 'youtube';
      let channelId = '';
      let durationSec = 0;
      let coverUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      if (playerMatch && playerMatch[1]) {
        try {
          const playerJson = JSON.parse(playerMatch[1]);
          const vd = playerJson?.videoDetails || {};
          const mf = playerJson?.microformat?.playerMicroformatRenderer || {};

          title = String(vd.title || mf?.title?.simpleText || '').trim();
          description = String(
            vd.shortDescription || mf?.description?.simpleText || ''
          ).trim();
          authorName = String(vd.author || mf?.ownerChannelName || 'YouTube Creator').trim();
          channelId = String(vd.channelId || mf?.externalChannelId || '').trim();
          durationSec = Number(vd.lengthSeconds || mf?.lengthSeconds || 0);

          const ownerProfileUrl = String(mf?.ownerProfileUrl || '');
          const handleMatch = ownerProfileUrl.match(/\/@([A-Za-z0-9_.-]+)/);
          if (handleMatch && handleMatch[1]) {
            authorHandle = handleMatch[1];
          } else {
            authorHandle = authorName.replace(/\s+/g, '').toLowerCase() || 'youtube';
          }

          const thumbs = vd?.thumbnail?.thumbnails;
          if (Array.isArray(thumbs) && thumbs.length > 0) {
            coverUrl = thumbs[thumbs.length - 1]?.url || coverUrl;
          }
        } catch {
          // Fallback to oEmbed below if JSON parse fails
        }
      }

      if (!title) {
        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(
              `https://www.youtube.com/watch?v=${videoId}`
            )}&format=json`
          );
          if (oembedRes.ok) {
            const oe = await oembedRes.json();
            title = String(oe.title || `YouTube Video ${videoId}`);
            authorName = String(oe.author_name || authorName);
            coverUrl = String(oe.thumbnail_url || coverUrl);
          }
        } catch {
          // Ignore oembed error
        }
      }

      if (!title && !description) {
        res.status(404).json({
          code: -1,
          msg: 'Video YouTube tidak ditemukan atau bersifat privat.',
        });
        return;
      }

      // Attempt to fetch top-level / pinned comments via Innertube /youtubei/v1/next
      const comments: Array<{
        id: string;
        text: string;
        create_time: number;
        digg_count: number;
        reply_total: number;
        is_creator: boolean;
        user: {
          id: string;
          unique_id: string;
          nickname: string;
          avatar: string;
        };
      }> = [];

      try {
        const tokenMatches = [
          ...html.matchAll(/"continuationCommand"\s*:\s*\{\s*"token"\s*:\s*"([^"]+)"/g),
        ];
        if (tokenMatches.length > 0) {
          const commentContinuationToken = tokenMatches[tokenMatches.length - 1][1];
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);

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
                  },
                },
                continuation: commentContinuationToken,
              }),
              signal: controller.signal,
            }
          );
          clearTimeout(timer);

          if (nextRes.ok) {
            const nextJson = await nextRes.json();
            const mutations =
              nextJson?.frameworkUpdates?.entityBatchUpdate?.mutations || [];
            for (const m of mutations) {
              const cep = m?.payload?.commentEntityPayload;
              if (!cep) continue;
              const textContent = String(cep?.properties?.content?.content || '').trim();
              if (!textContent) continue;

              const rawDisplay = String(
                cep?.author?.displayName || 'YouTube User'
              ).replace(/^@/, '');
              const isCreator = Boolean(cep?.author?.isCreator);
              const likeCount =
                parseInt(String(cep?.toolbar?.likeCountNotliked || '0'), 10) || 0;
              const replyCount =
                parseInt(String(cep?.toolbar?.replyCount || '0'), 10) || 0;

              comments.push({
                id: String(cep?.properties?.commentId || `yt-cmt-${comments.length + 1}`),
                text: textContent,
                create_time: 0,
                digg_count: likeCount,
                reply_total: replyCount,
                is_creator: isCreator,
                user: {
                  id: String(cep?.author?.channelId || rawDisplay),
                  unique_id: rawDisplay,
                  nickname: rawDisplay,
                  avatar: String(cep?.author?.avatarThumbnailUrl || ''),
                },
              });
            }
          }
        }
      } catch {
        // Non-fatal if comments are disabled or timed out
      }

      res.json({
        code: 0,
        msg: 'success',
        data: {
          id: videoId,
          title,
          description,
          duration: durationSec,
          cover: coverUrl,
          comment_count: comments.length,
          author: {
            id: channelId || authorHandle,
            unique_id: authorHandle,
            nickname: authorName,
            avatar: '',
          },
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
        res.status(upstream.status).send(`Upstream video error: ${upstream.statusText}`);
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
        res.status(502).send(
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
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
