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
  if (day.date) lines.push(`日期: ${day.date}`);
  if (day.accommodation) lines.push(`住宿: ${day.accommodation.name}`);
  day.itineraries.forEach((item, i) => {
    const time = item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : '';
    const meal = item.mealType ? `[${item.mealType}] ` : '';
    lines.push(`${i + 1}. ${meal}${item.title} ${time}`.trim());
  });

  const prompt = `分析以下行程，並僅以 JSON 格式回應（不要 markdown、不要程式碼區塊、不要其他文字），使用繁體中文：

{"theme":"用3-6個字的中文短語概括這一天的特色主題","highlights":["重點一","重點二","重點三"]}

${lines.join('\n')}`;

  const providers = [
    { model: 'qwen/qwen3.7-plus' },
    { model: 'qwen/qwen3-next-80b-a3b-instruct:free' },
    { model: 'nvidia/nemotron-3-super-120b-a12b:free' },
  ];

  let lastError = '';
  for (const provider of providers) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      const text = await response.text();

      if (!response.ok) {
        lastError = `${provider.model}: ${response.status} — ${text.slice(0, 200)}`;
        continue;
      }

      const data = JSON.parse(text);
      const content = (data.choices?.[0]?.message?.content || '').trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        lastError = `${provider.model}: could not parse JSON — "${content.slice(0, 200)}"`;
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return res.status(200).json({
        theme: parsed.theme || '精彩一日',
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      });
    } catch (err) {
      lastError = `${provider.model}: ${err.message}`;
    }
  }

  return res.status(502).json({ error: `All providers failed. ${lastError}` });
}
