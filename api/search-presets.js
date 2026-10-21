export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Parameter pencarian 'q' diperlukan." });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API Key belum terpasang di Vercel." });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
     },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
               text: `Berikan rekomendasi preset Alight Motion untuk "${q}". Wajib sertakan contoh link impor: https://alight.link/preset dan tautan Google Drive https://drive.google.com/file/d/sample agar preset terbaca.`
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
const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return res.status(200).json({
    data: {
      items: [
        {
          id: "gemini-result-1",
          title: "Hasil Pencarian Preset AI",
          caption: textResult,
          sourceUrl: ""
        }
      ]
    }
  });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
// update route   
