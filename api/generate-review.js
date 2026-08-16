export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { keywords } = req.body || {};

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'કૃપા કરીને ઓછામાં ઓછું એક ઓપ્શન પસંદ કરો.' });
    }

    const cleanKeywords = keywords
      .map((value) => String(value).trim())
      .filter(Boolean)
      .slice(0, 6);

    if (cleanKeywords.length === 0) {
      return res.status(400).json({ error: 'Invalid review options.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }

    const prompt = `તમે ગુજરાતી ભાષામાં રિટેલ ગારમેન્ટ સ્ટોર માટે Google review લખતા assistant છો.
ગ્રાહકે નીચેના points પસંદ કર્યા છે: ${cleanKeywords.join(', ')}.

માત્ર 2 સ્વાભાવિક, ટૂંકા અને પોઝિટિવ ગુજરાતી વાક્યો લખો.
Review સાચા ગ્રાહકે લખ્યો હોય એવો conversational રાખો.
"સારી ક્વોલિટી", "સરસ કલેક્શન", "વ્યાજબી ભાવ", "સારું વર્તન" જેવા pointsને સ્વાભાવિક રીતે સામેલ કરો.
કોઈ heading, bullets, numbering, quotes, emoji અથવા extra explanation આપશો નહીં.`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
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
            temperature: 0.95,
            maxOutputTokens: 120,
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || 'Gemini API request failed.';
      return res.status(response.status).json({ error: message });
    }

    const review = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || '')
      .join(' ')
      .trim();

    if (!review) {
      return res.status(502).json({ error: 'Gemini returned an empty review.' });
    }

    return res.status(200).json({ review });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error.',
    });
  }
}
