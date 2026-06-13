import type { DrawSet, GenMode, LottoResult, PackageDef } from './lottery';

export interface AiGenerateRequest {
  mode: Exclude<GenMode, 'random'>;
  pkg: PackageDef;
  results: LottoResult[];
}

export function buildAiPrompt({ mode, pkg, results }: AiGenerateRequest) {
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

export function parseAiDraws(value: unknown): DrawSet[] {
  const toNumberList = (input: unknown): number[] => {
    const raw = Array.isArray(input)
      ? input
      : typeof input === 'string'
        ? input.split(/[\s,，、|+]+/)
        : [];

    return raw
      .map(Number)
      .filter(Number.isFinite)
      .sort((a: number, b: number) => a - b);
  };

  const normalizeDraw = (item: any): DrawSet | null => {
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

  const collectDraws = (input: unknown, depth = 0): DrawSet[] => {
    if (depth > 8 || input == null) return [];
    if (typeof input === 'string') {
      try {
        return collectDraws(parseJsonishArray(input), depth + 1);
      } catch (e) {
        return [];
      }
    }

    if (Array.isArray(input)) {
      return input.flatMap(item => collectDraws(item, depth + 1));
    }

    if (typeof input !== 'object') return [];

    const direct = normalizeDraw(input);
    if (direct) return [direct];

    return Object.values(input as Record<string, unknown>).flatMap(value => collectDraws(value, depth + 1));
  };

  const seen = new Set<string>();
  return collectDraws(value).filter(draw => {
    const key = `${draw.front.join(',')}|${draw.back.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseJsonishArray(text: string) {
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
