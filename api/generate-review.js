export default async function handler(req, res) {
  const allowedOrigin = 'https://parthkadia01.github.io';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { keywords, recentReviews } = req.body || {};
    const cleanKeywords = Array.isArray(keywords)
      ? keywords.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : [];

    const cleanRecentReviews = Array.isArray(recentReviews)
      ? recentReviews.map((item) => String(item).trim()).filter(Boolean).slice(0, 10)
      : [];

    if (!cleanKeywords.length) {
      return res.status(400).json({ error: 'કૃપા કરીને ઓછામાં ઓછું એક option પસંદ કરો.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }

    // Multiple independent writing modes create much more variation than a single style prompt.
    const modes = [
      'સાદી અને સ્થાનિક બોલચાલની ગુજરાતી.',
      'casual Gujarati + થોડું natural English mix.',
      'ટૂંકી, સીધી અને સામાન્ય customer-style ભાષા.',
      'મિત્રને shopping experience કહેતા હોઈએ એવી ભાષા.',
      'થોડી warm પરંતુ understated ભાષા; over-praise નહીં.',
      'ખરીદી પછીનો simple personal experience જણાવતી ભાષા.',
      'modern WhatsApp જેવી natural Gujarati, પરંતુ readable.',
      'Gujarati મુખ્ય રાખો અને માત્ર 1-2 સામાન્ય English words વાપરો.',
      'એકદમ normal Google Maps review જેવી conversational ભાષા.',
      'નાની વાતમાં સંતોષ વ્યક્ત કરતો genuine-sounding tone.'
    ];

    const openings = [
      'મને અહીંથી shopping કરવાનો સારો અનુભવ રહ્યો.',
      'આ વખતે અહીંથી લીધેલી ખરીદીથી હું ખુશ થયો/થઈ.',
      'હમણાં જ અહીંથી shopping કરી અને experience સારો રહ્યો.',
      'અહીં પહેલી વાર shopping કરી અને overall સારું લાગ્યું.',
      'મને તો અહીંનું collection જોઈને ગમ્યું.',
      'Shopping માટે અહીં આવવું સારું લાગ્યું.',
      'કપડાં લીધા અને quality જોઈને સંતોષ થયો.',
      'અહીંની variety મારા કામની લાગી.',
      'Overall મને અહીંનો અનુભવ સારો લાગ્યો.',
      'આ દુકાન વિશે કહું તો experience સરસ રહ્યો.'
    ];

    const mode = modes[Math.floor(Math.random() * modes.length)];
    const opening = openings[Math.floor(Math.random() * openings.length)];
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

    const previousBlock = cleanRecentReviews.length
      ? `\nઆ જ browserમાં અગાઉ બનેલા reviews છે. આમાંથી કોઈ review, sentence, phrase અથવા તેની નજીકનું wording ફરી ન વાપરવું:\n${cleanRecentReviews.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : '';

    const prompt = `તમે retail garment store માટે authentic customer review drafting assistant છો.
ગ્રાહક જે points પસંદ કરે છે તેના આધારે જ review લખો. કોઈ ખોટી ખરીદી, product, discount, staff member, location અથવા બીજી detail invent ન કરો.

પસંદ કરેલા points:
${cleanKeywords.map((item) => `- ${item}`).join('\n')}

Writing mode: ${mode}
Possible opening inspiration (આ exact sentence copy ન કરશો): ${opening}

ખાસ નિયમો:
1. ફક્ત 2 natural વાક્યો લખો. બહુ લાંબા વાક્યો નહીં.
2. Review એવું લાગે કે સામાન્ય ગુજરાતી customerએ પોતે લખ્યું છે, marketing copywriterએ નહીં.
3. Selected pointsને naturally combine કરો; દરેક pointને mechanically list ન કરો.
4. દરેક requestમાં sentence structure, opening, verbs અને adjectives બદલો.
5. Gujarati + English mix હોય તો પણ ખૂબ થોડું અને natural રાખો; જેમ કે collection, quality, shopping, experience, overall જેવા સામાન્ય શબ્દો. દરેક reviewમાં English જરૂરી નથી.
6. 'ખૂબ જ ઉત્તમ', 'અદ્ભુત', 'બેસ્ટ શોપ', 'મસ્ટ વિઝિટ', 'highly recommended' જેવી promotional phrases ટાળો.
7. emoji, quotes, bullets, heading, hashtags અથવા explanation ન આપો.
8. reviewમાં દુકાનનું નામ અથવા location ન ઉમેરો.
9. કોઈ fake personal detail (જેમ કે wedding, family, specific garment purchased) ઉમેરશો નહીં.
10. Reviewને human અને varied રાખો, પણ જાણબૂઝીને spelling mistakes ન કરો.
${previousBlock}

આ request માટે variation nonce: ${nonce}

માત્ર final 2-sentence review આપો.`;

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
            maxOutputTokens: 120,
            temperature: 1.05,
            topP: 0.95,
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

    let review = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!review) {
      return res.status(502).json({ error: 'Gemini returned an empty review.' });
    }

    // Remove accidental markdown/quotes without changing the actual review.
    review = review
      .replace(/^['"“”]+|['"“”]+$/g, '')
      .replace(/^Review\s*:\s*/i, '')
      .trim();

    return res.status(200).json({ review });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error.'
    });
  }
}
