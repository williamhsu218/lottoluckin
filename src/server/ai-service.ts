import { GoogleGenAI, Type } from '@google/genai';
import { buildAiPrompt, parseAiDraws, parseJsonishArray, type AiGenerateRequest } from '../shared/ai';
import type { DrawSet } from '../shared/lottery';

export type AiGenerateResult = {
  draws: DrawSet[];
  source: 'custom_llm' | 'gemini';
};

export async function generateAiDraws(input: AiGenerateRequest): Promise<AiGenerateResult> {
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

    if (!res.ok) {
      throw new Error(`Custom LLM Error: ${res.status} ${res.statusText}`);
    }

    const jsonResp = await res.json();
    const textResponse = jsonResp.choices?.[0]?.message?.content || jsonResp.message?.content || '';
    return {
      draws: parseAiDraws(parseJsonishArray(textResponse)),
      source: 'custom_llm',
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    throw new Error('Server AI key is not configured');
  }

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

  return {
    draws: parseAiDraws(parseJsonishArray(response.text?.trim() || '[]')),
    source: 'gemini',
  };
}
