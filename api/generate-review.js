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
    const cleanKeywords = Array.isArray(keywords)
      ? keywords.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : [];

    if (cleanKeywords.length === 0) {
      return res.status(400).json({ error: 'કૃપા કરીને ઓછામાં ઓછું એક option પસંદ કરો.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }

    const prompt = `તમે ગુજરાતીમાં Google Maps માટે રિટેલ ગારમેન્ટ સ્ટોરનો નાનો customer review લખો.

ગ્રાહકે પસંદ કરેલા points:
${cleanKeywords.map((item) => `- ${item}`).join('\n')}

કડક નિયમો:
1. ફક્ત 2 સંપૂર્ણ અને સ્વાભાવિક ગુજરાતી વાક્યો લખો.
2. બંને વાક્યો એક જ review તરીકે લખો.
3. પસંદ કરેલા બધા pointsને સ્વાભાવિક રીતે સામેલ કરો.
4. ભાષા સરળ, બોલચાલની અને સાચા ગ્રાહકે લખી હોય તેવી રાખો.
5. માત્ર review text આપો — કોઈ heading, નંબર, bullet, quotes, English explanation, emoji અથવા "review" શબ્દની explanation નહીં.
6. "સારી ક્વોલિટી" જેવા pointને જરૂરી હોય તો "ક્વોલિટી ખૂબ સારી લાગી" જેવી natural Gujarati ભાષામાં બદલી શકો.
7. Reviewમાં દુકાનનું નામ બનાવટી રીતે ઉમેરશો નહીં.
8. દરેક requestમાં wording અલગ રાખો; copy-paste template જેવું ન લખો.`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                review: {
                  type: 'STRING',
                  description: 'Exactly two natural Gujarati sentences suitable for a Google Maps customer review.',
                },
              },
              required: ['review'],
            },
            thinkingConfig: {
              thinkingLevel: 'minimal',
            },
            maxOutputTokens: 180,
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini API failed.',
      });
    }

    const rawText = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || '')
      .join(' ')
      .trim();

    if (!rawText) {
      return res.status(502).json({ error: 'Gemini returned an empty response.' });
    }

    let review = rawText;
    try {
      const parsed = JSON.parse(rawText);
      review = parsed?.review || rawText;
    } catch (_) {
      // Fallback for an unexpected non-JSON response.
    }

    review = String(review)
      .replace(/^\s*["“”']|["“”']\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!review) {
      return res.status(502).json({ error: 'Gemini returned an invalid review.' });
    }

    return res.status(200).json({ review });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error.',
    });
  }
}
