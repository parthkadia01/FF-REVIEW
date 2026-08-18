export default async function handler(req, res) {
  const allowedOrigins = new Set([
    'https://parthkadia01.github.io',
    'https://ff-review.vercel.app'
  ]);
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.has(origin) ? origin : 'https://parthkadia01.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const cleanKeywords = Array.isArray(body.keywords)
      ? body.keywords.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
      : [];
    const cleanRecentReviews = Array.isArray(body.recentReviews)
      ? body.recentReviews.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
      : [];
    const rating = Number(body.rating);

    if (!cleanKeywords.length) {
      return res.status(400).json({ error: 'કૃપા કરીને ઓછામાં ઓછું એક અનુભવ option પસંદ કરો.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Review service is not configured.' });

    const modes = [
      'સાદી સ્થાનિક બોલચાલની ગુજરાતી',
      'casual Gujarati + 1-2 natural English words',
      'ટૂંકી customer-style ભાષા',
      'મિત્રને shopping experience કહેતા હોઈએ એવી ભાષા',
      'warm પરંતુ understated ભાષા',
      'ખરીદી પછીનો simple personal experience',
      'modern WhatsApp જેવી natural Gujarati',
      'normal Google Maps review જેવી conversational ભાષા',
      'નાની વાતમાં સંતોષ વ્યક્ત કરતો tone',
      'થોડી informal પરંતુ સાફ ગુજરાતી'
    ];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const ratingText = Number.isFinite(rating) && rating >= 1 && rating <= 5 ? `${rating}/5 stars` : 'not specified';
    const previousBlock = cleanRecentReviews.length
      ? `\nઆ અગાઉના drafts છે. તેમનું wording, opening અથવા sentence structure ફરી ન વાપરવું:\n${cleanRecentReviews.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : '';

    const prompt = `તમે Fashion Factory જેવા retail garment store માટે customer review DRAFT assistant છો.
ગ્રાહકે પસંદ કરેલા અનુભવ points અને rating પરથી જ એક natural draft બનાવો. Customerએ પસંદ ન કરેલી કોઈ વસ્તુ, product, discount, staff member, family, wedding, location અથવા personal detail invent ન કરો.

Customer rating: ${ratingText}
પસંદ કરેલા અનુભવ points:
${cleanKeywords.map((item) => `- ${item}`).join('\n')}

Writing mode: ${mode}

નિયમો:
1. ફક્ત 2 natural sentences.
2. સામાન્ય ગુજરાતી customerએ પોતે લખ્યું હોય એવું લાગે; advertising copy નહીં.
3. Selected points naturally combine કરો; list ન કરો.
4. દરેક requestમાં opening, structure, verbs અને adjectives બદલાવો.
5. Gujarati મુખ્ય રાખો; ક્યારેક માત્ર 1-2 સામાન્ય English words જેવા quality, collection, shopping, experience, overall વાપરી શકો.
6. Rating 4-5 હોય તો positive પરંતુ understated રાખો; over-praise નહીં. Rating 3 હોય તો balanced રાખો. Rating 1-2 હોય તો selected experience પ્રમાણે honest/neutral tone રાખો.
7. 'ખૂબ જ ઉત્તમ', 'અદ્ભુત', 'બેસ્ટ શોપ', 'મસ્ટ વિઝિટ', 'highly recommended' જેવી promotional phrases ટાળો.
8. emoji, quotes, bullets, heading અથવા hashtags નહીં.
9. દુકાનનું નામ અથવા location ઉમેરશો નહીં.
10. fake personal detail ન ઉમેરો.
11. જાણબૂઝીને spelling mistakes ન કરો.
12. Review customer પોતાની રીતે edit કરી શકે એવો short draft હોવો જોઈએ.
${previousBlock}

Variation nonce: ${nonce}
માત્ર final 2-sentence review આપો.`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 120,
            temperature: 1.1,
            topP: 0.96,
            thinkingConfig: { thinkingLevel: 'minimal' }
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      let review = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join(' ')
        .replace(/\s+/g, ' ').trim();
      if (!review) return res.status(502).json({ error: 'Review service returned an empty result.' });
      review = review.replace(/^['"“”]+|['"“”]+$/g, '').replace(/^Review\s*:\s*/i, '').trim();
      return res.status(200).json({ review });
    }

    if (response.status === 429 || data?.error?.status === 'RESOURCE_EXHAUSTED') {
      return res.status(200).json({ review: makeLocalReview(cleanKeywords, cleanRecentReviews, rating) });
    }

    return res.status(response.status).json({ error: data?.error?.message || 'Review service failed.' });
  } catch (error) {
    try {
      const body = req.body || {};
      const kws = Array.isArray(body.keywords) ? body.keywords.map(String).slice(0, 8) : [];
      const recent = Array.isArray(body.recentReviews) ? body.recentReviews.map(String).slice(0, 12) : [];
      const rating = Number(body.rating);
      if (kws.length) return res.status(200).json({ review: makeLocalReview(kws, recent, rating) });
    } catch (_) {}
    return res.status(500).json({ error: 'Review service is temporarily unavailable.' });
  }
}

function makeLocalReview(keywords, recentReviews, rating) {
  const has = (name) => keywords.includes(name);
  const quality = has('સારી ક્વોલિટી');
  const collection = has('સરસ કલેક્શન');
  const price = has('વ્યાજબી ભાવ');
  const behavior = has('સારું વર્તન');
  const fit = has('સારો ફિટિંગ');
  const variety = has('સારી વેરાયટી');
  const shopping = has('સરળ શોપિંગ');
  const staff = has('હેલ્પફુલ સ્ટાફ');
  const ratingNum = Number.isFinite(rating) ? rating : 5;

  const first = [
    quality && collection ? 'અહીં કપડાંની quality અને collection બંને મને ગમ્યા.' :
    quality ? 'કપડાંની quality સારી લાગી અને પસંદગી પણ સંતોષકારક રહી.' :
    collection ? 'અહીંનું collection જોઈને સારું લાગ્યું, variety પણ સારી છે.' :
    price ? 'અહીં ભાવ reasonable લાગ્યા અને shopping કરવી સરળ રહી.' :
    behavior ? 'અહીંનું વર્તન સારું લાગ્યું અને shopping comfortable રહી.' :
    fit ? 'કપડાંનું fitting મને સારું લાગ્યું અને પહેરવામાં comfortable છે.' :
    variety ? 'અહીં variety સારી જોવા મળી એટલે પસંદગી કરવામાં સરળતા રહી.' :
    shopping ? 'અહીં shopping કરવી simple અને convenient લાગી.' :
    staff ? 'Staff helpful લાગ્યો અને shopping દરમિયાન સારી રીતે guide કર્યું.' :
    'અહીંથી shopping કરવાનો overall અનુભવ સારો રહ્યો.',
    quality ? 'Quality જોઈને સંતોષ થયો.' : collection ? 'Collectionમાં સારી variety જોવા મળી.' : price ? 'ભાવ પણ યોગ્ય લાગ્યા.' : behavior ? 'Staffનું વર્તન friendly લાગ્યું.' : fit ? 'Overall fittingથી સંતોષ રહ્યો.' : variety ? 'પસંદગી માટે options સારા હતા.' : shopping ? 'Shoppingમાં વધારે hassle લાગ્યો નહીં.' : staff ? 'જરૂર મુજબ help મળી.' : 'Simple અને સારો shopping experience રહ્યો.'
  ];

  const second = [
    ratingNum <= 2 ? 'મારા માટે experience average રહ્યો, એટલે આગળથી થોડું વધુ ધ્યાન આપવાની અપેક્ષા છે.' :
    ratingNum === 3 ? 'Overall experience ઠીક રહ્યો અને કેટલીક બાબતો સારી લાગી.' :
    quality && price ? 'Quality અને price બંને બાબતે shopping worth લાગી.' :
    collection && variety ? 'Varietyને કારણે પસંદગી કરવામાં સારી રીતે મદદ મળી.' :
    behavior && staff ? 'Staffના સારા વર્તનથી shopping વધુ comfortable બની.' :
    fit ? 'Overall experience comfortable રહ્યો.' :
    'Overall, shopping કર્યા પછી સંતોષ થયો.',
    'મને અહીંનો experience natural અને comfortable લાગ્યો.',
    'Overall shopping સારી રહી અને ફરી આવવાનું મન થાય એવું લાગ્યું.'
  ];

  const candidates = [];
  for (const a of first) for (const b of second) {
    const text = `${a} ${b}`;
    if (!recentReviews.includes(text)) candidates.push(text);
  }
  if (!candidates.length) candidates.push(`${first[0]} ${second[0]}`);
  return candidates[Math.floor(Math.random() * candidates.length)];
}
