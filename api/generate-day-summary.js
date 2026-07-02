export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { day } = req.body;
  if (!day || !day.itineraries || !day.itineraries.length) {
    return res.status(400).json({ error: 'Missing day data or no itineraries' });
  }

  const lines = [];
  if (day.date) lines.push(`日期: ${day.date}`);
  if (day.accommodation) lines.push(`住宿: ${day.accommodation.name}`);
  day.itineraries.forEach((item, i) => {
    const time = item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : '';
    const meal = item.mealType ? `[${item.mealType}] ` : '';
    lines.push(`${i + 1}. ${meal}${item.title} ${time}`.trim());
    if (item.description) lines.push(`   描述: ${item.description.slice(0, 300)}`);
  });

  const count = day.itineraries.length;
  const prompt = `分析以下行程，並僅以 JSON 格式回應（不要 markdown、不要程式碼區塊、不要其他文字），使用繁體中文：

{
  "theme": "用箭頭列出今天所有行程項目名稱，例如：羅浮宮 → 艾菲爾鐵塔 → 塞納河遊船",
  "highlights": [${Array(count).fill('"為該項目撰寫一句重點描述（參考其描述內容）"').join(', ')}]
}

${lines.join('\n')}`;

  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  const providers = [];
  if (nvidiaKey) providers.push({
    name: 'nvidia',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${nvidiaKey}`,
      'Accept': 'application/json',
    },
    model: 'minimaxai/minimax-m3',
    body: { model: 'minimaxai/minimax-m3', messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 1.0, top_p: 0.95 },
  });
  if (openRouterKey) providers.push({
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openRouterKey}`,
    },
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    body: { model: 'nvidia/nemotron-3-super-120b-a12b:free', messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 0.7 },
  });

  if (!providers.length) {
    return res.status(500).json({ error: 'No API keys configured' });
  }

  let lastError = '';
  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: provider.headers,
        body: JSON.stringify(provider.body),
      });

      const text = await response.text();

      if (!response.ok) {
        lastError = `${provider.name}: ${response.status} — ${text.slice(0, 200)}`;
        continue;
      }

      const data = JSON.parse(text);
      const content = (data.choices?.[0]?.message?.content || '').trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        lastError = `${provider.name}: could not parse JSON — "${content.slice(0, 200)}"`;
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return res.status(200).json({
        theme: parsed.theme || '精彩一日',
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        provider: provider.name,
      });
    } catch (err) {
      lastError = `${provider.name}: ${err.message}`;
    }
  }

  return res.status(502).json({ error: `All providers failed. ${lastError}` });
}
