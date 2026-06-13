import { describe, expect, it } from 'vitest';
import { checkHits, expandDraw, getCombinations, getDynamicPrizeNum, getDynamicPrizeStr, getPrizeLevel, parseHistoryRecord } from './lottery';

describe('lottery rule helpers', () => {
  it('generates combinations for basic and edge cases', () => {
    expect(getCombinations([1, 2, 3], 2)).toEqual([
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
    expect(getCombinations([1, 2], 0)).toEqual([[]]);
    expect(getCombinations([1, 2], 3)).toEqual([]);
  });

  it('expands multiplex draws into standard tickets', () => {
    const expanded = expandDraw({
      front: [1, 2, 3, 4, 5, 6],
      back: [1, 2, 3],
    });

    expect(expanded).toHaveLength(18);
    expect(expanded[0]).toEqual({ front: [1, 2, 3, 4, 5], back: [1, 2] });
    expect(expanded.at(-1)).toEqual({ front: [2, 3, 4, 5, 6], back: [2, 3] });
  });

  it('maps front and back hit counts to Super Lotto prize levels', () => {
    expect(getPrizeLevel(5, 2)).toBe(1);
    expect(getPrizeLevel(5, 1)).toBe(2);
    expect(getPrizeLevel(5, 0)).toBe(3);
    expect(getPrizeLevel(4, 2)).toBe(3);
    expect(getPrizeLevel(4, 1)).toBe(4);
    expect(getPrizeLevel(3, 2)).toBe(5);
    expect(getPrizeLevel(4, 0)).toBe(5);
    expect(getPrizeLevel(3, 1)).toBe(6);
    expect(getPrizeLevel(2, 2)).toBe(6);
    expect(getPrizeLevel(3, 0)).toBe(7);
    expect(getPrizeLevel(1, 2)).toBe(7);
    expect(getPrizeLevel(2, 1)).toBe(7);
    expect(getPrizeLevel(0, 2)).toBe(7);
    expect(getPrizeLevel(2, 0)).toBe(0);
  });

  it('parses stored generated history records', () => {
    expect(parseHistoryRecord({
      front: JSON.stringify([{ front: [1, 2, 3, 4, 5], back: [1, 2] }]),
    })).toEqual([{ front: [1, 2, 3, 4, 5], back: [1, 2] }]);
    expect(parseHistoryRecord({ front: 'not json' })).toEqual([]);
  });

  it('uses high-pool fixed prize amounts when pool is at least 800 million', () => {
    expect(getDynamicPrizeStr(3, '800000000')).toBe('6,666元');
    expect(getDynamicPrizeNum(3, '800000000')).toBe(6666);
    expect(getDynamicPrizeStr(6, '799999999')).toBe('15元');
    expect(getDynamicPrizeNum(6, '799999999')).toBe(15);
    expect(getDynamicPrizeStr(1, '900000000')).toBe('浮动(约1000万)');
  });

  it('checks a standard winning ticket against the next available draw', () => {
    const result = checkHits({
      front: JSON.stringify([{ front: [1, 2, 3, 4, 5], back: [1, 2] }]),
      excluded: '{}',
      created_at: '2026-06-13T10:00:00.000Z',
    }, [
      {
        lotteryDrawNum: '26048',
        lotteryDrawResult: '09 10 11 12 13 03 04',
        lotteryDrawTime: '2026-06-16',
        poolBalanceAfterdraw: '100000000',
      },
      {
        lotteryDrawNum: '26047',
        lotteryDrawResult: '01 02 03 04 05 01 02',
        lotteryDrawTime: '2026-06-13',
        poolBalanceAfterdraw: '900000000',
      },
    ]);

    expect(result?.drawNum).toBe('26047');
    expect(result?.winningLines).toHaveLength(1);
    expect(result?.winningLines[0].highestPrize).toBe(1);
    expect(result?.winningLines[0].hasFloating).toBe(1);
  });

  it('moves purchases at or after 21:00 to the next draw date', () => {
    const result = checkHits({
      front: JSON.stringify([{ front: [9, 10, 11, 12, 13], back: [3, 4] }]),
      excluded: '{}',
      created_at: '2026-06-13T21:30:00.000Z',
    }, [
      {
        lotteryDrawNum: '26048',
        lotteryDrawResult: '09 10 11 12 13 03 04',
        lotteryDrawTime: '2026-06-16',
        poolBalanceAfterdraw: '100000000',
      },
      {
        lotteryDrawNum: '26047',
        lotteryDrawResult: '01 02 03 04 05 01 02',
        lotteryDrawTime: '2026-06-13',
        poolBalanceAfterdraw: '900000000',
      },
    ]);

    expect(result?.drawNum).toBe('26048');
    expect(result?.winningLines[0].highestPrize).toBe(1);
  });

  it('reports best partial hits when no prize is won', () => {
    const result = checkHits({
      front: JSON.stringify([{ front: [1, 2, 8, 9, 10], back: [3, 4] }]),
      excluded: '{}',
      created_at: '2026-06-13T10:00:00.000Z',
    }, [
      {
        lotteryDrawNum: '26047',
        lotteryDrawResult: '01 02 03 04 05 01 02',
        lotteryDrawTime: '2026-06-13',
        poolBalanceAfterdraw: '900000000',
      },
    ]);

    expect(result?.winningLines).toHaveLength(0);
    expect(result?.bestNoPrizeInfo).toEqual({ fHits: [1, 2], bHits: [] });
    expect(result?.bestNoPrizeComboNum).toBe(1);
  });
});
