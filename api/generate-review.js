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

    if (!cleanKeywords.length) {
      return res.status(400).json({ error: 'કૃપા કરીને ઓછામાં ઓછું એક option પસંદ કરો.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }

    // Random style + nonce prevents the model from falling into the same template.
    const styles = [
      'એકદમ સામાન્ય ગ્રાહકની બોલચાલની ભાષા વાપરો.',
      'મિત્રને દુકાન વિશે કહીએ એવી સરળ અને સ્વાભાવિક ભાષા વાપરો.',
      'ખરીદી પછીનો સાચો અનુભવ જણાવતા હોવ એવી ટૂંકી ભાષા વાપરો.',
      'સ્થાનિક ગુજરાતી ગ્રાહક સામાન્ય રીતે લખે તેવી સરળ ભાષા વાપરો.',
      'થોડી casual અને warm ભાષા વાપરો, પણ અતિશય વખાણ ન કરો.',
      'સાદી, ટૂંકી અને natural Google review જેવી ભાષા વાપરો.'
    ];
    const style = styles[Math.floor(Math.random() * styles.length)];
    const nonce = Math.random().toString(36).slice(2, 10);

    const prompt = `ગુજરાતીમાં Google Maps માટે એક સાચા ગ્રાહકે લખ્યો હોય એવો retail garment store review બનાવો.

ગ્રાહકે પસંદ કરેલા points:
${cleanKeywords.map((item) => `- ${item}`).join('\n')}

લખવાની રીત:
- ${style}
- ફક્ત 2 ટૂંકા, સંપૂર્ણ વાક્યો.
- પસંદ કરેલા pointsને સ્વાભાવિક રીતે જોડો; બધા pointsનો ઉપયોગ કરો.
- બનાવટી, ખૂબ promotional અથવા જાહેરાત જેવી ભાષા ન લખો.
- એક જ શબ્દો અને એક જ sentence pattern વારંવાર ન વાપરો.
- reviewની શરૂઆત દરેક વખતે અલગ રાખો.
- દુકાનનું નામ, location અથવા કોઈ ખોટી detail ઉમેરશો નહીં.
- માત્ર review text આપો; heading, bullets, quotes, emoji અથવા explanation નહીં.

આ request માટે unique variation code: ${nonce}`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            maxOutputTokens: 100,
            thinkingConfig: { thinkingLevel: 'minimal' }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini API failed.'
      });
    }

    const review = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!review) {
      return res.status(502).json({ error: 'Gemini returned an empty review.' });
    }

    return res.status(200).json({ review });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error.'
    });
  }
}
