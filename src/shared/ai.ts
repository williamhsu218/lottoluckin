import type { DrawSet, GenMode, LottoResult, PackageDef } from './lottery';

export interface AiGenerateRequest {
  mode: Exclude<GenMode, 'random'>;
  pkg: PackageDef;
  results: LottoResult[];
}

export function buildAiPrompt({ mode, pkg, results }: AiGenerateRequest) {
  let prompt = '';
  let systemInstruction = '';
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  if (mode === 'stats') {
    const historySummary = results
      .slice(0, 12)
      .map(r => `期号:${r.lotteryDrawNum} 红球:${r.lotteryDrawResult.substring(0, 14)} 蓝球:${r.lotteryDrawResult.substring(15)}`)
      .join('\n');
    systemInstruction = '作为中国体彩超级大乐透走势分析助手，请根据近期历史开奖数据，结合冷热遗漏、连号、重号、奇偶比、区间分布等方法，生成一组分散且有差异的候选号码。不要反复选择同一批热号，不要声称号码有确定中奖概率。返回严格 JSON。';
    prompt = `下面是近期的开奖历史：\n${historySummary}\n\n生成批次随机因子：${nonce}\n请按照不同的复式或单式规则，帮我生成如下要求的号码注数：\n`;
  } else {
    systemInstruction = '作为一位熟悉《易经》理数与先天八卦阵列的数字推演助手，请结合当前时辰与随机因子，生成一组分散且有差异的超级大乐透候选号码。不要固定套用常见吉数，不要声称号码有确定中奖概率。返回严格 JSON。';
    prompt = `当前时间时间戳：${Date.now()}\n生成批次随机因子：${nonce}\n请根据易经理数，推演生成如下要求的号码注数：\n`;
  }

  pkg.configs.forEach(c => {
    const label = mode === 'stats' ? '号码组合' : '推演号码组合';
    prompt += `- 生成 ${c.count} 注${label}，每一注要求 ${c.f} 个红球(1-35) 和 ${c.b} 个蓝球(1-12)。\n`;
  });
  prompt += '\n硬性要求：\n';
  prompt += '- 每一注内部数字必须唯一，红球升序，蓝球升序。\n';
  prompt += '- 多注之间必须尽量分散：任意两注红球重合不超过 2 个，蓝球重合不超过 1 个；如果是复式，也要尽量减少与其他注的重合。\n';
  prompt += '- 不要直接复制最近 12 期中的任意一期开奖结果，也不要连续多注使用同一组高频数字。\n';
  prompt += '- 必须按要求返回足够注数，只返回 {"draws":[{"front":[...],"back":[...]}]}。';

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

  const collectTextDraws = (text: string): DrawSet[] => {
    const draws: DrawSet[] = [];
    const pattern = /(?:前区|红球|front(?:\s*area)?|red(?:\s*balls?)?)\s*[:：=\-]?\s*([0-9\s,，、|+]+?)(?:后区|蓝球|back(?:\s*area)?|blue(?:\s*balls?)?)\s*[:：=\-]?\s*([0-9\s,，、|+]+)/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const front = toNumberList(match[1]).filter(n => n >= 1 && n <= 35).slice(0, 5);
      const back = toNumberList(match[2]).filter(n => n >= 1 && n <= 12).slice(0, 2);
      if (front.length === 5 && back.length === 2) {
        draws.push({ front, back });
      }
    }

    return draws;
  };

  const collectDraws = (input: unknown, depth = 0): DrawSet[] => {
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
