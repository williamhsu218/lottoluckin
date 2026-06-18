import type { LottoResult } from './lottery';

const MAX_OFFICIAL_RESULTS = 50;

function drawNumValue(result: LottoResult) {
  const numeric = Number(String(result.lotteryDrawNum || '').replace(/\D/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function hasValidDraw(result: Partial<LottoResult>): result is LottoResult {
  return Boolean(result.lotteryDrawNum && result.lotteryDrawResult && result.lotteryDrawTime);
}

export function sortOfficialResults(results: LottoResult[]) {
  return [...results].sort((a, b) => {
    const drawDiff = drawNumValue(b) - drawNumValue(a);
    if (drawDiff !== 0) return drawDiff;
    return String(b.lotteryDrawTime).localeCompare(String(a.lotteryDrawTime));
  });
}

export function mergeOfficialResults(...sources: Array<LottoResult[] | null | undefined>) {
  const byDrawNum = new Map<string, LottoResult>();

  sources.flatMap(source => source || []).filter(hasValidDraw).forEach(result => {
    const existing = byDrawNum.get(result.lotteryDrawNum);
    byDrawNum.set(result.lotteryDrawNum, {
      ...result,
      ...existing,
      poolBalanceAfterdraw: existing?.poolBalanceAfterdraw || result.poolBalanceAfterdraw,
    });
  });

  return sortOfficialResults(Array.from(byDrawNum.values())).slice(0, MAX_OFFICIAL_RESULTS);
}

export function readStoredOfficialResults(storage: Storage) {
  try {
    const parsed = JSON.parse(storage.getItem('official_lottery_results') || '[]');
    return Array.isArray(parsed) ? mergeOfficialResults(parsed) : [];
  } catch (err) {
    return [];
  }
}
