function buildAiPrompt({ mode, pkg, results }) {
  let prompt = '';
  let systemInstruction = '';

  if (mode === 'stats') {
    const historySummary = results
      .slice(0, 12)
      .map(r => `期号:${r.lotteryDrawNum} 红球:${r.lotteryDrawResult.substring(0, 14)} 蓝球:${r.lotteryDrawResult.substring(15)}`)
      .join('\n');
    systemInstruction = '作为中国体彩超级大乐透资深走势分析专家，请根据近期历史开奖数据，利用冷热遗漏、连号、重号、奇偶比、区间分布等专业走势分析手法，精挑细选出一组最高概率的号码。返回严格的数组对象 JSON。不允许重复。';
    prompt = `下面是近期的开奖历史：\n${historySummary}\n\n请按照不同的复式或单式规则，帮我生成如下要求的号码注数：\n`;
  } else {
    systemInstruction = '作为一位精通《易经》理数与先天八卦阵列的大师，请结合当前时辰的八字干支，通过太极生两仪、两仪生四象的推演规律，推测出超级大乐透的吉数。返回严格的数组对象 JSON。不允许重复。';
    prompt = `当前时间时间戳：${Date.now()}\n请根据易经理数，推演生成如下要求的号码注数：\n`;
  }

  pkg.configs.forEach(c => {
    const label = mode === 'stats' ? '号码组合' : '推演号码组合';
    prompt += `- 生成 ${c.count} 注${label}，每一注要求 ${c.f} 个红球(1-35) 和 ${c.b} 个蓝球(1-12)。\n`;
  });

  return { prompt, systemInstruction };
}

function parseJsonishArray(text) {
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
  }

  if (!jsonStr.startsWith('[') && !jsonStr.startsWith('{')) {
    const arrayStart = jsonStr.indexOf('[');
    const arrayEnd = jsonStr.lastIndexOf(']');
    const objectStart = jsonStr.indexOf('{');
    const objectEnd = jsonStr.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart && (arrayStart < 0 || objectStart < arrayStart)) {
      jsonStr = jsonStr.slice(objectStart, objectEnd + 1);
    } else if (arrayStart >= 0 && arrayEnd > arrayStart) {
      jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
    }
  }

  return JSON.parse(jsonStr || '[]');
}

function parseAiDraws(value) {
  const items = Array.isArray(value)
    ? value
    : (value && typeof value === 'object' && Array.isArray(value.draws) ? value.draws : []);

  return items
    .map(item => ({
      front: Array.isArray(item?.front) ? item.front.map(Number).filter(Number.isFinite).sort((a, b) => a - b) : [],
      back: Array.isArray(item?.back) ? item.back.map(Number).filter(Number.isFinite).sort((a, b) => a - b) : [],
    }))
    .filter(draw => draw.front.length > 0 && draw.back.length > 0);
}

async function generateAiDraws(input) {
  const { prompt, systemInstruction } = buildAiPrompt(input);
  const customUrl = process.env.LLM_API_URL?.trim();

  if (customUrl) {
    const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || '';
    const isChatCompletion = customUrl.endsWith('/chat/completions') || customUrl.includes('/v1/messages');
    const finalUrl = isChatCompletion ? customUrl : customUrl.replace(/\/$/, '') + '/chat/completions';
    const modelToUse = process.env.LLM_MODEL_NAME?.trim() || 'gpt-3.5-turbo';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let res;
    try {
      res = await fetch(finalUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: systemInstruction + '\n请务必只返回能够被JSON.parse解析的JSON对象格式：{"draws":[{"front":[1,2,3,4,5],"back":[1,2]}]}。不要包含多余文本或 Markdown 代码块标识符。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 700,
          stream: false,
          response_format: { type: 'json_object' },
        }),
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error('Custom LLM timed out after 15s');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Custom LLM Error: ${res.status} ${res.statusText}${errorText ? ` - ${errorText.slice(0, 300)}` : ''}`);
    }
    const jsonResp = await res.json();
    const textResponse = jsonResp.choices?.[0]?.message?.content || jsonResp.message?.content || '';
    const draws = parseAiDraws(parseJsonishArray(textResponse));
    if (draws.length === 0) {
      throw new Error(`Custom LLM returned no usable draws. Raw response: ${JSON.stringify(jsonResp).slice(0, 500)}`);
    }

    return { draws, source: 'custom_llm' };
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) throw new Error('Server AI key is not configured');

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL_NAME || 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            front: { type: 'ARRAY', items: { type: 'NUMBER' } },
            back: { type: 'ARRAY', items: { type: 'NUMBER' } },
          },
          required: ['front', 'back'],
        },
      },
    },
  });

  const draws = parseAiDraws(parseJsonishArray(response.text?.trim() || '[]'));
  if (draws.length === 0) {
    throw new Error(`Gemini returned no usable draws. Raw response: ${(response.text || '').slice(0, 500)}`);
  }

  return { draws, source: 'gemini' };
}

export async function handler(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { mode, pkg, results } = body;
    if ((mode !== 'stats' && mode !== 'iching') || !pkg || !Array.isArray(results)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid generation request' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await generateAiDraws({ mode, pkg, results })),
    };
  } catch (err) {
    const statusCode = err.message === 'Server AI key is not configured' ? 503 : 500;
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
