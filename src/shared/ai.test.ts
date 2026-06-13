import { describe, expect, it, vi } from 'vitest';
import { PACKAGES } from './lottery';
import { buildAiPrompt, parseAiDraws, parseJsonishArray } from './ai';

describe('AI prompt and response helpers', () => {
  it('builds stats prompts from recent lottery results and package config', () => {
    const { prompt, systemInstruction } = buildAiPrompt({
      mode: 'stats',
      pkg: PACKAGES[0],
      results: [
        {
          lotteryDrawNum: '26047',
          lotteryDrawResult: '01 02 03 04 05 06 07',
          lotteryDrawTime: '2026-06-13',
        },
      ],
    });

    expect(systemInstruction).toContain('走势分析专家');
    expect(prompt).toContain('期号:26047');
    expect(prompt).toContain('生成 1 注号码组合');
  });

  it('builds iching prompts with the requested package structure', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890);

    const { prompt, systemInstruction } = buildAiPrompt({
      mode: 'iching',
      pkg: PACKAGES[2],
      results: [],
    });

    expect(systemInstruction).toContain('易经');
    expect(prompt).toContain('1234567890');
    expect(prompt).toContain('生成 6 注推演号码组合');
    expect(prompt).toContain('生成 1 注推演号码组合');

    vi.restoreAllMocks();
  });

  it('parses JSON arrays wrapped in markdown fences', () => {
    expect(parseJsonishArray('```json\n[{"front":[5,1],"back":[2]}]\n```')).toEqual([
      { front: [5, 1], back: [2] },
    ]);
  });

  it('extracts JSON from explanatory model text', () => {
    expect(parseJsonishArray('结果如下：{"draws":[{"front":[1,2,3,4,5],"back":[1,2]}]}')).toEqual({
      draws: [{ front: [1, 2, 3, 4, 5], back: [1, 2] }],
    });
  });

  it('normalizes valid AI draws and filters malformed entries', () => {
    expect(parseAiDraws([
      { front: ['5', 1, 'bad'], back: ['2', 1] },
      { front: [], back: [1, 2] },
      { nope: true },
    ])).toEqual([
      { front: [1, 5], back: [1, 2] },
    ]);
  });

  it('accepts wrapped draw objects', () => {
    expect(parseAiDraws({
      draws: [{ front: ['5', 1, 3, 4, 2], back: ['2', 1] }],
    })).toEqual([
      { front: [1, 2, 3, 4, 5], back: [1, 2] },
    ]);
  });
});
