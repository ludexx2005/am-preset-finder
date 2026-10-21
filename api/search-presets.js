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

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API Key belum terpasang di Vercel." });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`;
    
    // Menggunakan tool googleSearch agar kemampuan pencariannya setara dengan AI Studio
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        tools: [{ googleSearch: {} }],
        contents: [
          {
            parts: [
              {
                text: `Cari dan berikan 3 rekomendasi preset Alight Motion asli yang aktif dan bisa diunduh untuk kata kunci: "${q}". Wajib sertakan tautan unduh lengkap yang valid (seperti link alight.link atau Google Drive) di dalam teks jawaban.`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Gagal memanggil Gemini API" });
    }

    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "Tidak ada hasil ditemukan.";

    return res.status(200).json({
      data: {
        items: [
          {
            id: "preset-ai-" + Date.now(),
            sourceUrl: "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " preset alight motion"),
            title: `Hasil Pencarian AI: ${q}`,
            caption: textResult,
            soundTitle: "Original Sound",
            viewCount: 2500,
            likeCount: 450,
            durationSec: 30,
            coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60",
            author: {
              uniqueId: "am_creator",
              nickname: "Preset Finder AI",
              avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60"
            }
          }
        ]
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
