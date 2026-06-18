import { describe, expect, it } from 'vitest';
import { mergeOfficialResults, readStoredOfficialResults } from './official-history';
import type { LottoResult } from './lottery';

const draw = (lotteryDrawNum: string, lotteryDrawTime: string): LottoResult => ({
  lotteryDrawNum,
  lotteryDrawTime,
  lotteryDrawResult: '01 02 03 04 05 01 02',
});

describe('official lottery history persistence helpers', () => {
  it('keeps newer local cached draws ahead of stale cloud data', () => {
    const local = [draw('26048', '2026-06-16')];
    const staleCloud = [draw('26046', '2026-06-10')];

    const merged = mergeOfficialResults(local, staleCloud);

    expect(merged.map(item => item.lotteryDrawNum)).toEqual(['26048', '26046']);
  });

  it('deduplicates by draw number and keeps existing pool info', () => {
    const cached = [{ ...draw('26048', '2026-06-16'), poolBalanceAfterdraw: '900000000' }];
    const refreshed = [draw('26048', '2026-06-16')];

    expect(mergeOfficialResults(cached, refreshed)).toEqual(cached);
  });

  it('reads valid stored official history and drops malformed rows', () => {
    const storage = {
      length: 1,
      clear: () => undefined,
      getItem: () => JSON.stringify([
        draw('26047', '2026-06-13'),
        { lotteryDrawNum: 'broken' },
      ]),
      key: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    } as unknown as Storage;

    expect(readStoredOfficialResults(storage).map(item => item.lotteryDrawNum)).toEqual(['26047']);
  });
});
