export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: "Parameter pencarian 'q' diperlukan." });
  }

  try {
    const searchQuery = `${q} preset alight motion link`;
    const items = [];

    // 1. Cari video preset langsung dari YouTube
    const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const ytRes = await fetch(ytSearchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    const html = await ytRes.text();

    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
    if (match && match[1]) {
      const ytData = JSON.parse(match[1]);
      const contents =
        ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

      const videoRenderers = [];
      for (const section of contents) {
        const sectionItems = section?.itemSectionRenderer?.contents || [];
        for (const item of sectionItems) {
          if (item.videoRenderer) {
            videoRenderers.push(item.videoRenderer);
          }
        }
      }

      // Ambil maksimal 6 video teratas untuk diekstrak deskripsi lengkap & link presetnya
      const topVideos = videoRenderers.slice(0, 6);

      await Promise.all(
        topVideos.map(async (v) => {
          const videoId = v.videoId;
          if (!videoId) return;

          try {
            const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });
            const watchHtml = await watchRes.text();

            // Ambil deskripsi lengkap dari halaman video
            let fullDesc = '';
            const playerMatch = watchHtml.match(/var ytInitialPlayerResponse = (\{.*?\});/s);
            if (playerMatch && playerMatch[1]) {
              try {
                const playerData = JSON.parse(playerMatch[1]);
                fullDesc = playerData?.videoDetails?.shortDescription || '';
              } catch {}
            }

            if (!fullDesc) {
              const descMatch = watchHtml.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
              if (descMatch && descMatch[1]) {
                fullDesc = JSON.parse(`"${descMatch[1]}"`);
              }
            }

            // Buka bungkus redirect link YouTube (youtube.com/redirect?q=...) jika ada
            const redirectMatches = [...watchHtml.matchAll(/https?:\/\/(?:www\.)?youtube\.com\/redirect\?[^"'\s\\]+/g)];
            const unwrappedLinks = [];
            for (const m of redirectMatches) {
              try {
                const rawUrl = m[0].replace(/\\u0026/g, '&');
                const urlObj = new URL(rawUrl);
                const targetQ = urlObj.searchParams.get('q');
                if (targetQ) unwrappedLinks.push(decodeURIComponent(targetQ));
              } catch {}
            }

            const combinedCaption = [
              fullDesc,
              unwrappedLinks.length > 0
                ? `\n\n[Tautan Lengkap Ekstraksi Deskripsi]:\n${unwrappedLinks.join('\n')}`
                : ''
            ].join('');

            const title = v.title?.runs?.map((r) => r.text).join('') || 'Preset Alight Motion';
            const authorName = v.ownerText?.runs?.[0]?.text || 'Creator';
            const authorHandle =
              v.ownerText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.replace(/^\//, '') ||
              authorName;
            const viewText = v.viewCountText?.simpleText || '';
            const viewCount = parseInt(viewText.replace(/\D/g, ''), 10) || 0;
            const coverUrl = v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            items.push({
              id: videoId,
              sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
              title,
              caption: combinedCaption || title,
              soundTitle: 'Original Audio',
              viewCount,
              likeCount: 0,
              durationSec: 0,
              coverUrl,
              author: {
                uniqueId: authorHandle.replace(/^@/, ''),
                nickname: authorName,
                avatar: v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url || ''
              }
            });
          } catch {}
        })
      );
    }

    // 2. Tambahan cadangan dari TikWM (TikTok) jika hasil YouTube sedikit
    try {
      const tikRes = await fetch(
        `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(searchQuery)}&count=10`
      );
      const tikJson = await tikRes.json();
      const videos = tikJson?.data?.videos || [];
      for (const tv of videos) {
        items.push({
          id: String(tv.video_id || tv.id),
          sourceUrl: `https://www.tiktok.com/@${tv.author?.unique_id || 'user'}/video/${tv.video_id || tv.id}`,
          title: tv.title || 'TikTok Preset',
          caption: tv.title || '',
          soundTitle: tv.music_info?.title || 'TikTok Sound',
          viewCount: Number(tv.play_count) || 0,
          likeCount: Number(tv.digg_count) || 0,
          durationSec: Number(tv.duration) || 0,
          coverUrl: tv.cover || '',
          author: {
            uniqueId: tv.author?.unique_id || 'creator',
            nickname: tv.author?.nickname || 'Creator',
            avatar: tv.author?.avatar || ''
          }
        });
      }
    } catch {}

    return res.status(200).json({
      data: {
        items
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
