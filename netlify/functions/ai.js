import { GoogleGenAI, Type } from '@google/genai';

function buildAiPrompt({ mode, pkg, results }) {
  let prompt = '';
  let systemInstruction = '';

  if (mode === 'stats') {
    const historySummary = results
      .slice(0, 30)
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
  return JSON.parse(jsonStr || '[]');
}

function parseAiDraws(value) {
  if (!Array.isArray(value)) return [];
  return value
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
    const res = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: 'system', content: systemInstruction + '\n请务必只返回能够被JSON.parse解析的JSON数组格式（[{front:[], back:[]}]），不要包含多余文本或 Markdown 代码块标识符。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`Custom LLM Error: ${res.status} ${res.statusText}`);
    const jsonResp = await res.json();
    const textResponse = jsonResp.choices?.[0]?.message?.content || jsonResp.message?.content || '';
    return parseAiDraws(parseJsonishArray(textResponse));
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) throw new Error('Server AI key is not configured');

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL_NAME || 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            back: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          },
          required: ['front', 'back'],
        },
      },
    },
  });

  return parseAiDraws(parseJsonishArray(response.text?.trim() || '[]'));
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
      body: JSON.stringify({ draws: await generateAiDraws({ mode, pkg, results }) }),
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
