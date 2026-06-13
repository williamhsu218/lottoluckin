export interface LottoResult {
  lotteryDrawNum: string;
  lotteryDrawResult: string;
  lotteryDrawTime: string;
  poolBalanceAfterdraw?: string;
}

export interface DrawSet {
  front: number[];
  back: number[];
}

export interface HistoryLikeRecord {
  front: string;
  excluded: string;
  created_at: string;
}

export type GenMode = 'random' | 'iching' | 'stats';
export type DrawConfig = { f: number; b: number; count: number };
export type PackageDef = { id: string; name: string; price: number; desc: string; configs: DrawConfig[] };

export const PACKAGES: PackageDef[] = [
  { id: 'p_1', name: '单注体验', price: 2, desc: '1注单式，纯粹摸奖', configs: [{ f: 5, b: 2, count: 1 }] },
  { id: 'p_5', name: '标准满票', price: 10, desc: '单张彩票5注排列', configs: [{ f: 5, b: 2, count: 5 }] },
  { id: 'p_18', name: '18元套票', price: 18, desc: '6注单式 + 1注(5+3)复式', configs: [{ f: 5, b: 2, count: 6 }, { f: 5, b: 3, count: 1 }] },
  { id: 'p_28', name: '28元套票', price: 28, desc: '8注单式 + 1注(6+2)复式', configs: [{ f: 5, b: 2, count: 8 }, { f: 6, b: 2, count: 1 }] },
  { id: 'p_58', name: '58元套票', price: 58, desc: '8注单式 + 1注(7+2)复式', configs: [{ f: 5, b: 2, count: 8 }, { f: 7, b: 2, count: 1 }] },
  { id: 'p_88', name: '88元套票', price: 88, desc: '5单式+(7+2)复式+(6+3)复式', configs: [{ f: 5, b: 2, count: 5 }, { f: 7, b: 2, count: 1 }, { f: 6, b: 3, count: 1 }] },
];

export function getCombinations(arr: number[], k: number): number[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  if (k === arr.length) return [arr];
  if (k > arr.length) return [];
  const head = arr[0];
  const tailCombs = getCombinations(arr.slice(1), k - 1);
  const withHead = tailCombs.map(c => [head, ...c]);
  const withoutHead = getCombinations(arr.slice(1), k);
  return [...withHead, ...withoutHead];
}

export function expandDraw(draw: DrawSet): DrawSet[] {
  const fCombs = getCombinations(draw.front, 5);
  const bCombs = getCombinations(draw.back, 2);
  const res: DrawSet[] = [];
  for (const f of fCombs) {
    for (const b of bCombs) {
      res.push({ front: f, back: b });
    }
  }
  return res;
}

export const getPrizeLevel = (f: number, b: number): number => {
  if (f === 5 && b === 2) return 1;
  if (f === 5 && b === 1) return 2;
  if ((f === 5 && b === 0) || (f === 4 && b === 2)) return 3;
  if (f === 4 && b === 1) return 4;
  if ((f === 3 && b === 2) || (f === 4 && b === 0)) return 5;
  if ((f === 3 && b === 1) || (f === 2 && b === 2)) return 6;
  if ((f === 3 && b === 0) || (f === 1 && b === 2) || (f === 2 && b === 1) || (f === 0 && b === 2)) return 7;
  return 0;
};

export const formatNumber = (num: number) => num.toString().padStart(2, '0');

export const parseHistoryRecord = (rec: Pick<HistoryLikeRecord, 'front'>): DrawSet[] => {
  try {
    const parsed = JSON.parse(rec.front);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].front) return parsed;
  } catch (e) {}
  return [];
};

export const getDynamicPrizeStr = (pLevel: number, poolBalanceAfterdraw: string | undefined) => {
  const poolAmount = poolBalanceAfterdraw ? parseInt(poolBalanceAfterdraw.replace(/,/g, ''), 10) : 0;
  const isHighPool = poolAmount >= 800000000;

  if (pLevel === 1) return '浮动(约1000万)';
  if (pLevel === 2) return '浮动(约20万)';
  if (pLevel === 3) return isHighPool ? '6,666元' : '5,000元';
  if (pLevel === 4) return isHighPool ? '380元' : '300元';
  if (pLevel === 5) return isHighPool ? '200元' : '150元';
  if (pLevel === 6) return isHighPool ? '18元' : '15元';
  if (pLevel === 7) return isHighPool ? '7元' : '5元';
  return '-';
};

export const getDynamicPrizeNum = (pLevel: number, poolBalanceAfterdraw: string | undefined) => {
  const poolAmount = poolBalanceAfterdraw ? parseInt(poolBalanceAfterdraw.replace(/,/g, ''), 10) : 0;
  const isHighPool = poolAmount >= 800000000;

  if (pLevel === 1) return 10000000;
  if (pLevel === 2) return 200000;
  if (pLevel === 3) return isHighPool ? 6666 : 5000;
  if (pLevel === 4) return isHighPool ? 380 : 300;
  if (pLevel === 5) return isHighPool ? 200 : 150;
  if (pLevel === 6) return isHighPool ? 18 : 15;
  if (pLevel === 7) return isHighPool ? 7 : 5;
  return 0;
};

export const checkHits = (historyRec: HistoryLikeRecord, results: LottoResult[]) => {
  if (results.length === 0) return null;

  let meta: any = {};
  try {
    meta = JSON.parse(historyRec.excluded || '{}');
  } catch (e) {}
  const purchaseDate = new Date(meta.purchased_at || historyRec.created_at);

  const drawDate = new Date(purchaseDate);
  if (purchaseDate.getHours() >= 21) {
    drawDate.setDate(drawDate.getDate() + 1);
  }

  const yyyy = drawDate.getFullYear();
  const mm = String(drawDate.getMonth() + 1).padStart(2, '0');
  const dd = String(drawDate.getDate()).padStart(2, '0');
  const pDateStr = `${yyyy}-${mm}-${dd}`;

  const sortedResults = [...results].reverse();
  const targetResult = sortedResults.find(r => r.lotteryDrawTime >= pDateStr);

  if (!targetResult) {
    return { isWaiting: true };
  }

  const targetIdx = results.findIndex(r => r.lotteryDrawNum === targetResult.lotteryDrawNum);
  const previousResult = results[targetIdx + 1];
  const effectivePoolBalance = previousResult ? previousResult.poolBalanceAfterdraw : targetResult.poolBalanceAfterdraw;

  const draws = parseHistoryRecord(historyRec);
  if (draws.length === 0) return null;

  const parts = targetResult.lotteryDrawResult.split(' ');
  const resFront = parts.slice(0, 5).map(n => parseInt(n, 10));
  const resBack = parts.slice(5, 7).map(n => parseInt(n, 10));

  const winningLines: any[] = [];
  let bestNoPrizeInfo: any = null;
  let bestNoPrizeScore = -1;
  let bestNoPrizeComboNum = 0;
  let overallLines = 0;

  draws.forEach((draw, dIdx) => {
    const expanded = expandDraw(draw);
    overallLines += expanded.length;

    const isMultiplex = expanded.length > 1;
    let lineTotalPrizeNum = 0;
    const hitCounts: Record<number, number> = {};
    let highestPrize = 99;
    let lineHitScore = 0;

    const winningSubTickets: any[] = [];

    expanded.forEach((cmb, cIdx) => {
      const fHits = cmb.front.filter(n => resFront.includes(n));
      const bHits = cmb.back.filter(n => resBack.includes(n));
      const pLevel = getPrizeLevel(fHits.length, bHits.length);
      const score = (fHits.length * 2) + bHits.length;

      if (score > lineHitScore) lineHitScore = score;

      if (pLevel > 0) {
        hitCounts[pLevel] = (hitCounts[pLevel] || 0) + 1;
        lineTotalPrizeNum += getDynamicPrizeNum(pLevel, effectivePoolBalance);
        if (pLevel < highestPrize) highestPrize = pLevel;
        winningSubTickets.push({
          subId: cIdx + 1,
          pLevel,
          amount: getDynamicPrizeStr(pLevel, effectivePoolBalance),
          fHits,
          bHits,
          frontStr: cmb.front.map(n => formatNumber(n)).join(' '),
          backStr: cmb.back.map(n => formatNumber(n)).join(' '),
        });
      }
    });

    if (Object.keys(hitCounts).length > 0) {
      winningLines.push({
        lineNum: dIdx + 1,
        isMultiplex,
        frontStr: draw.front.map(n => formatNumber(n)).join(' '),
        backStr: draw.back.map(n => formatNumber(n)).join(' '),
        hitCounts,
        highestPrize,
        totalPrizeNum: lineTotalPrizeNum,
        hasFloating: hitCounts[1] || hitCounts[2],
        fHits: draw.front.filter(n => resFront.includes(n)),
        bHits: draw.back.filter(n => resBack.includes(n)),
        winningSubTickets,
      });
    } else if (winningLines.length === 0 && lineHitScore > bestNoPrizeScore) {
      bestNoPrizeScore = lineHitScore;
      bestNoPrizeInfo = {
        fHits: draw.front.filter(n => resFront.includes(n)),
        bHits: draw.back.filter(n => resBack.includes(n)),
      };
      bestNoPrizeComboNum = dIdx + 1;
    }
  });

  return {
    drawNum: targetResult.lotteryDrawNum,
    drawTime: targetResult.lotteryDrawTime,
    winningLines: winningLines.sort((a, b) => a.highestPrize - b.highestPrize),
    bestNoPrizeInfo: winningLines.length === 0 ? bestNoPrizeInfo : null,
    bestNoPrizeComboNum,
    totalLines: overallLines,
  };
};
