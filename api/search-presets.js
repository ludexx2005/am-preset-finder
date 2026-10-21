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
    const items = [];
    const searchQuery = `${q} preset alight motion`;

    // 1. Cari Video dari TikWM (TikTok) + Ekstrak Komentar untuk cari Link Preset Asli
    try {
      const tikSearchUrl = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(searchQuery + ' link')}&count=12`;
      const tikRes = await fetch(tikSearchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const tikJson = await tikRes.json();
      const videos = tikJson?.data?.videos || [];

      // Ambil 6 video teratas dan cek juga isi komentarnya agar link di komentar terbaca
      const topTikToks = videos.slice(0, 6);

      await Promise.all(
        topTikToks.map(async (tv) => {
          const videoId = String(tv.video_id || tv.id || '');
          if (!videoId) return;

          let extraCommentLinks = '';
          try {
            const cRes = await fetch(`https://www.tikwm.com/api/comment/list?url=${encodeURIComponent(videoId)}&count=20`);
            const cJson = await cRes.json();
            const comments = cJson?.data?.comments || [];
            const commentTexts = comments.map((c) => c.text || '').join('\n');
            if (commentTexts) {
              extraCommentLinks = `\n\n[Tautan Lengkap Ekstraksi Deskripsi]:\n${commentTexts}`;
            }
          } catch {}

          items.push({
            id: videoId,
            sourceUrl: `https://www.tiktok.com/@${tv.author?.unique_id || 'user'}/video/${videoId}`,
            title: tv.title || 'Preset Alight Motion',
            caption: `${tv.title || ''}${extraCommentLinks}`,
            soundTitle: tv.music_info?.title || 'Original Audio',
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
        })
      );
    } catch {}

    // 2. Cari dari YouTube via InnerTube API (Bebas Blokir Cookie Vercel)
    try {
      const ytApiRes = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          context: {
            client: {
              hl: 'id',
              gl: 'ID',
              clientName: 'WEB',
              clientVersion: '2.20240726.00.00'
            }
          },
          query: `${searchQuery} 5mb xml link drive`
        })
      });

      const ytData = await ytApiRes.json();
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

      const topYt = videoRenderers.slice(0, 6);

      await Promise.all(
        topYt.map(async (v) => {
          const videoId = v.videoId;
          if (!videoId) return;

          try {
            // Ambil deskripsi lengkap lewat endpoint player InnerTube
            const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              body: JSON.stringify({
                context: {
                  client: {
                    hl: 'id',
                    gl: 'ID',
                    clientName: 'WEB',
                    clientVersion: '2.20240726.00.00'
                  }
                },
                videoId
              })
            });

            const playerData = await playerRes.json();
            const fullDesc = playerData?.videoDetails?.shortDescription || '';
            const snippetDesc =
              v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r) => r.text).join('') || '';

            const title = v.title?.runs?.map((r) => r.text).join('') || 'Preset Alight Motion';
            const authorName = v.ownerText?.runs?.[0]?.text || 'Creator';
            const authorHandle =
              v.ownerText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.replace(/^\//, '') ||
              authorName;
            const viewText = v.viewCountText?.simpleText || '';
            const viewCount = parseInt(viewText.replace(/\D/g, ''), 10) || 0;
            const coverUrl =
              v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            items.push({
              id: videoId,
              sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
              title,
              caption: `${fullDesc}\n${snippetDesc}\n${title}`,
              soundTitle: 'Original Audio',
              viewCount,
              likeCount: 0,
              durationSec: Number(playerData?.videoDetails?.lengthSeconds) || 0,
              coverUrl,
              author: {
                uniqueId: authorHandle.replace(/^@/, ''),
                nickname: authorName,
                avatar:
                  v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]
                    ?.url || ''
              }
            });
          } catch {}
        })
      );
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
