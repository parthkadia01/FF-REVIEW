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
    if (!apiKey) return res.status(500).json({ error: 'Gemini API key is not configured.' });

    const modes = [
      'સાદી સ્થાનિક બોલચાલની ગુજરાતી.',
      'casual Gujarati + થોડું natural English mix.',
      'ટૂંકી અને સીધી customer-style ભાષા.',
      'મિત્રને shopping experience કહેતા હોઈએ એવી ભાષા.',
      'warm પરંતુ understated ભાષા; over-praise નહીં.',
      'ખરીદી પછીનો simple personal experience.',
      'modern WhatsApp જેવી natural Gujarati.',
      'Gujarati મુખ્ય અને માત્ર 1-2 સામાન્ય English words.',
      'normal Google Maps review જેવી conversational ભાષા.',
      'નાની વાતમાં સંતોષ વ્યક્ત કરતો genuine-sounding tone.'
    ];

    const mode = modes[Math.floor(Math.random() * modes.length)];
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const previousBlock = cleanRecentReviews.length
      ? `\nઆ અગાઉના reviews છે. કોઈ sentence અથવા તેની નજીકનું wording ફરી ન વાપરવું:\n${cleanRecentReviews.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : '';

    const prompt = `તમે retail garment store માટે authentic customer review drafting assistant છો.
ગ્રાહકે પસંદ કરેલા અનુભવ pointsના આધારે જ review લખો. કોઈ ખોટી ખરીદી, product, discount, staff member, family, wedding અથવા બીજી personal detail invent ન કરો.

પસંદ કરેલા points:
${cleanKeywords.map((item) => `- ${item}`).join('\n')}

Writing mode: ${mode}

નિયમો:
1. ફક્ત 2 natural વાક્યો.
2. સામાન્ય ગુજરાતી customerએ પોતે લખ્યું હોય એવું લાગે; marketing copy નહીં.
3. Selected points naturally combine કરો; list ન કરો.
4. દરેક requestમાં opening, structure, verbs અને adjectives બદલો.
5. Gujarati + English mix ક્યારેક જ; collection, quality, shopping, experience, overall જેવા સામાન્ય words પૂરતા છે.
6. 'ખૂબ જ ઉત્તમ', 'અદ્ભુત', 'બેસ્ટ શોપ', 'મસ્ટ વિઝિટ', 'highly recommended' જેવી promotional phrases ટાળો.
7. emoji, quotes, bullets, heading અથવા hashtags નહીં.
8. દુકાનનું નામ/location ઉમેરશો નહીં.
9. કોઈ fake personal detail ઉમેરશો નહીં.
10. જાણબૂઝીને spelling mistakes ન કરો.
${previousBlock}

Variation nonce: ${nonce}
માત્ર final 2-sentence review આપો.`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 120,
            temperature: 1.05,
            topP: 0.95,
            thinkingConfig: { thinkingLevel: 'minimal' }
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      let review = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join(' ')
        .replace(/\s+/g, ' ').trim();
      if (!review) return res.status(502).json({ error: 'Gemini returned an empty review.' });
      review = review.replace(/^['"“”]+|['"“”]+$/g, '').replace(/^Review\s*:\s*/i, '').trim();
      return res.status(200).json({ review, source: 'gemini' });
    }

    // Gemini free-tier quota can temporarily return 429. Keep the review tool usable
    // by falling back to local human-style wording based only on the selected points.
    if (response.status === 429 || data?.error?.status === 'RESOURCE_EXHAUSTED') {
      const fallback = makeLocalReview(cleanKeywords, cleanRecentReviews);
      return res.status(200).json({ review: fallback, source: 'local-fallback' });
    }

    return res.status(response.status).json({ error: data?.error?.message || 'Gemini API failed.' });
  } catch (error) {
    // Network/API failure: use the same safe local fallback so customers are not blocked.
    try {
      const body = req.body || {};
      const kws = Array.isArray(body.keywords) ? body.keywords.map(String).slice(0, 4) : [];
      const recent = Array.isArray(body.recentReviews) ? body.recentReviews.map(String).slice(0, 10) : [];
      if (kws.length) return res.status(200).json({ review: makeLocalReview(kws, recent), source: 'local-fallback' });
    } catch (_) {}
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected server error.' });
  }
}

function makeLocalReview(keywords, recentReviews) {
  const has = (name) => keywords.includes(name);
  const quality = has('સારી ક્વોલિટી');
  const collection = has('સરસ કલેક્શન');
  const price = has('વ્યાજબી ભાવ');
  const behavior = has('સારું વર્તન');

  const first = [
    quality && collection ? 'અહીં કપડાંની quality અને collection બંને મને ગમ્યા.' :
    quality ? 'કપડાંની quality સારી લાગી અને પસંદગી પણ સંતોષકારક રહી.' :
    collection ? 'અહીંનું collection જોઈને સારું લાગ્યું, variety પણ સારી છે.' :
    price ? 'અહીં ભાવ reasonable લાગ્યા અને shopping કરવી સરળ રહી.' :
    behavior ? 'અહીં વાતાવરણ અને વર્તન બંને સારા લાગ્યા.' :
    'અહીંથી shopping કરવાનો overall અનુભવ સારો રહ્યો.',
    quality ? 'Quality જોઈને ખરેખર સંતોષ થયો.' :
    collection ? 'Collection માં સારી variety જોવા મળી.' :
    price ? 'ભાવ મુજબ વસ્તુઓ સારી લાગી.' :
    behavior ? 'Staffનું વર્તન પણ friendly લાગ્યું.' :
    'Simple અને સારો shopping experience રહ્યો.',
    collection && price ? 'Collection સારું છે અને ભાવ પણ reasonable લાગ્યા.' :
    quality && behavior ? 'Quality સારી છે અને staffનું વર્તન પણ ગમ્યું.' :
    'મને અહીંનો experience comfortable અને સારો લાગ્યો.'
  ].filter(Boolean);

  const second = [
    quality && collection ? 'Overall, ખરીદી કર્યા પછી સંતોષ થયો અને ફરી આવવાનું મન થાય એવું લાગ્યું.' :
    collection ? 'Overall experience સરસ રહ્યો અને ફરી collection જોવા આવીશ.' :
    quality ? 'મને તો quality પ્રમાણે shopping worth લાગ્યું.' :
    price ? 'Overall shopping budget-friendly લાગી.' :
    behavior ? 'એટલે shopping દરમિયાન કોઈપણ પ્રકારની અસુવિધા લાગી નહીં.' :
    'નાનો પણ સારો experience રહ્યો.',
    price && collection ? 'Variety અને ભાવ બંનેને કારણે shopping સારી લાગી.' :
    quality && price ? 'Quality અને price બંને બાબતે હું satisfied રહ્યો/રહી.' :
    behavior && collection ? 'Staffના સારા વર્તન સાથે shopping પણ સારી રીતે થઈ.' :
    'Overall, મને shopping experience ગમ્યો.',
    quality ? 'Overall, કપડાં જોઈને અને લીધા પછી સંતોષ રહ્યો.' :
    collection ? 'Variety સારી હોવાથી પસંદગી કરવામાં સરળતા રહી.' :
    price ? 'ભાવને ધ્યાનમાં રાખીએ તો experience સારો રહ્યો.' :
    behavior ? 'Friendly વર્તનને કારણે experience comfortable રહ્યો.' :
    'સાદો અને pleasant experience રહ્યો.'
  ].filter(Boolean);

  const candidates = [];
  for (const a of first) for (const b of second) candidates.push(`${a} ${b}`);
  const recent = new Set(recentReviews.map((x) => x.trim()));
  const fresh = candidates.filter((x) => !recent.has(x));
  const pool = fresh.length ? fresh : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}
