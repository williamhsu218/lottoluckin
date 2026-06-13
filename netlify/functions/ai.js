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
  const toNumberList = (input) => {
    const raw = Array.isArray(input)
      ? input
      : typeof input === 'string'
        ? input.split(/[\s,，、|+]+/)
        : [];

    return raw
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  };

  const normalizeDraw = (item) => {
    if (!item || typeof item !== 'object') return null;

    const front = toNumberList(
      item.front ?? item.fronts ?? item.red ?? item.reds ?? item.redBalls ?? item.red_balls ??
      item.redNumbers ?? item.frontNumbers ?? item.frontBalls ?? item.front_area ?? item.frontArea ??
      item.front_zone ?? item.frontZone ?? item.qianqu ?? item['前区'] ?? item['前区号码'] ?? item['红球'],
    );
    const back = toNumberList(
      item.back ?? item.backs ?? item.blue ?? item.blues ?? item.blueBalls ?? item.blue_balls ??
      item.blueNumbers ?? item.backNumbers ?? item.backBalls ?? item.back_area ?? item.backArea ??
      item.back_zone ?? item.backZone ?? item.houqu ?? item['后区'] ?? item['后区号码'] ?? item['蓝球'],
    );

    return front.length > 0 && back.length > 0 ? { front, back } : null;
  };

  const collectTextDraws = (text) => {
    const draws = [];
    const pattern = /(?:前区|红球|front(?:\s*area)?|red(?:\s*balls?)?)\s*[:：=\-]?\s*([0-9\s,，、|+]+?)(?:后区|蓝球|back(?:\s*area)?|blue(?:\s*balls?)?)\s*[:：=\-]?\s*([0-9\s,，、|+]+)/gi;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const front = toNumberList(match[1]).filter(n => n >= 1 && n <= 35).slice(0, 5);
      const back = toNumberList(match[2]).filter(n => n >= 1 && n <= 12).slice(0, 2);
      if (front.length === 5 && back.length === 2) {
        draws.push({ front, back });
      }
    }

    return draws;
  };

  const collectDraws = (input, depth = 0) => {
    if (depth > 8 || input == null) return [];
    if (typeof input === 'string') {
      try {
        return collectDraws(parseJsonishArray(input), depth + 1);
      } catch (e) {
        return collectTextDraws(input);
      }
    }

    if (Array.isArray(input)) {
      return input.flatMap(item => collectDraws(item, depth + 1));
    }

    if (typeof input !== 'object') return [];

    const direct = normalizeDraw(input);
    if (direct) return [direct];

    return Object.values(input).flatMap(item => collectDraws(item, depth + 1));
  };

  const seen = new Set();
  return collectDraws(value).filter(draw => {
    const key = `${draw.front.join(',')}|${draw.back.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const textResponse = jsonResp.choices?.[0]?.message?.content || jsonResp.choices?.[0]?.message?.reasoning_content || jsonResp.message?.content || '';
    const draws = parseAiDraws(textResponse);
    if (draws.length === 0) {
      throw new Error(`Custom LLM returned no usable draws. Message content: ${String(textResponse || JSON.stringify(jsonResp)).slice(0, 800)}`);
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

  const draws = parseAiDraws(response.text?.trim() || '[]');
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
