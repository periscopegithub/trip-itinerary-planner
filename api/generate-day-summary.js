export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { day } = req.body;
  if (!day || !day.itineraries || !day.itineraries.length) {
    return res.status(400).json({ error: 'Missing day data or no itineraries' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });
  }

  const lines = [];
  if (day.date) lines.push(`Date: ${day.date}`);
  if (day.accommodation) lines.push(`Accommodation: ${day.accommodation.name}`);
  day.itineraries.forEach((item, i) => {
    const time = item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : '';
    const meal = item.mealType ? `[${item.mealType}] ` : '';
    lines.push(`${i + 1}. ${meal}${item.title} ${time}`.trim());
  });

  const prompt = `Analyze this day itinerary and respond ONLY with a JSON object (no markdown, no code fences, no extra text):

{"theme":"a catchy 3-6 word phrase capturing this day","highlights":["highlight 1","highlight 2","highlight 3"]}

${lines.join('\n')}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.7-plus',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.7,
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(502).json({ error: `API error ${response.status}: ${text.slice(0, 300)}` });
    }

    const data = JSON.parse(text);
    const content = (data.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(200).json({
        theme: 'A Great Day',
        highlights: ['(Could not generate structured highlights)'],
        _raw: content.slice(0, 300),
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({
      theme: parsed.theme || 'A Great Day',
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
