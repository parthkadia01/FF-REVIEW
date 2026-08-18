export default async function handler(req, res) {
  const allowedOrigin = 'https://parthkadia01.github.io';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { keywords } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    const prompt = `તમે ગુજરાતી ભાષામાં રિટેલ ગારમેન્ટ સ્ટોર માટે Google review લખતા assistant છો. ગ્રાહકે પસંદ કરેલા points: ${keywords.join(', ')}. માત્ર 2 સ્વાભાવિક ગુજરાતી વાક્યો લખો.`;
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.95, maxOutputTokens: 120 } })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'Gemini API failed' });
    const review = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join(' ').trim();
    return res.status(200).json({ review });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
