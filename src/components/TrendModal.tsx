import { motion } from 'motion/react';
import { Dices, TrendingUp, X } from 'lucide-react';
import TrendChart from './TrendChart';
import type { LottoResult } from '../shared/lottery';

interface TrendDatum {
  num: string;
  frontFreq: number;
  backFreq: number | null;
}

interface TrendModalProps {
  trendData: TrendDatum[];
  lotteryResults: LottoResult[];
  isFetchingResults: boolean;
  onClose: () => void;
  onLoadDrawResults: () => void;
}

export default function TrendModal({
  trendData,
  lotteryResults,
  isFetchingResults,
  onClose,
  onLoadDrawResults,
}: TrendModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[var(--bg-modal)] backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:p-0"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-6 lg:p-8 max-w-[800px] w-full shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <button aria-label="关闭走势图" onClick={onClose} className="absolute top-6 right-6 text-[var(--text-disabled)] hover:text-[var(--text-main)] transition-colors">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-blue-600 dark:text-blue-500">
          <TrendingUp className="w-5 h-5" /> 历史出号频率走势
        </h2>
        <p className="text-xs text-[var(--text-disabled)] mb-6">基于最近 50 期的红蓝球出号频率统计 (开奖结果来源于官网接口)。</p>

        <div className="w-full flex-1 min-h-[350px] overflow-hidden flex flex-col justify-center">
          {isFetchingResults ? (
            <div className="flex justify-center items-center h-full"><Dices className="animate-spin w-8 h-8 text-[var(--text-muted)]" /></div>
          ) : lotteryResults.length === 0 ? (
            <div className="text-center h-full flex flex-col items-center justify-center gap-4">
              <p className="text-[var(--text-muted)] text-sm">暂未加载历史开奖数据，无法进行走势分析。</p>
              <button onClick={onLoadDrawResults} className="px-6 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg hover:bg-blue-600 active:scale-95 transition-all">
                从竞彩网 (Sporttery) 加载数据
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-4">
              <div className="text-right text-[10px] text-[var(--text-muted)] mt-1">
                成功从 竞彩网获取 {lotteryResults.length} 期数据
              </div>
              <div className="w-full h-[300px] shrink-0">
                <TrendChart data={trendData} />
              </div>

              <div className="bg-[var(--bg-main)] rounded-lg border border-[var(--border-card)] w-full overflow-x-auto shrink-0 shadow-sm relative">
                <table className="w-full text-sm text-center whitespace-nowrap min-w-[300px]">
                  <thead className="bg-[var(--bg-hover)] text-[var(--text-disabled)] text-xs uppercase sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-medium border-b border-[var(--border-card)]">号码</th>
                      <th className="px-4 py-3 font-medium border-b border-[var(--border-card)] text-red-500/80">红球出现次数</th>
                      <th className="px-4 py-3 font-medium border-b border-[var(--border-card)] text-blue-500/80">蓝球出现次数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-card)]">
                    {trendData.map((d) => (
                      <tr key={d.num} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="px-4 py-2 font-bold text-[var(--text-main)] border-r border-[var(--border-card)]/30">{d.num}</td>
                        <td className="px-4 py-2 text-red-500 font-medium border-r border-[var(--border-card)]/30">{d.frontFreq > 0 ? d.frontFreq : '-'}</td>
                        <td className="px-4 py-2 text-blue-500 font-medium">{d.backFreq != null ? (d.backFreq > 0 ? d.backFreq : '-') : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold text-sm rounded-full hover:bg-[var(--border-card)] transition-colors">关闭图表</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
