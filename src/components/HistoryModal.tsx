import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ChevronDown, Dices, History, Trash2, X } from 'lucide-react';
import { checkHits, formatNumber, parseHistoryRecord, type LottoResult } from '../shared/lottery';

export type HistoryTab = 'purchased' | 'generated';

interface HistoryRecord {
  id: string;
  front: string;
  back: string;
  excluded: string;
  purchased: boolean;
  created_at: string;
}

interface HistoryModalProps {
  history: HistoryRecord[];
  lotteryResults: LottoResult[];
  isFetchingResults: boolean;
  historyTab: HistoryTab;
  backtestPage: number;
  expandedHistoryIds: Set<string>;
  hasMoreHistory: boolean;
  isFetchingHistory: boolean;
  onClose: () => void;
  onHistoryTabChange: (tab: HistoryTab) => void;
  onBacktestPageChange: Dispatch<SetStateAction<number>>;
  onLoadDrawResults: () => void;
  onToggleExpand: (id: string, event: MouseEvent) => void;
  onTogglePurchased: (id: string, purchased: boolean) => void;
  onDeleteRecord: (id: string) => void;
  onLoadMoreHistory: () => void;
}

const getMetadata = (rec: HistoryRecord) => {
  try {
    const m = JSON.parse(rec.excluded || '{}');
    return m as { mode?: string; pkg?: string; source?: string; purchased_at?: string };
  } catch (e) {}
  return null;
};

const methodLabels: Record<string, string> = {
  random: '随机漫步',
  iching: '易经理数',
  stats: '走势分析',
};

const sourceLabels: Record<string, string> = {
  random_local: '本地随机',
  weighted_local: '本地走势',
  iching_local: '本地易经',
  local_fallback: '本地回退',
  custom_llm: 'AI 推演',
  gemini: 'Gemini 推演',
};

export default function HistoryModal({
  history,
  lotteryResults,
  isFetchingResults,
  historyTab,
  backtestPage,
  expandedHistoryIds,
  hasMoreHistory,
  isFetchingHistory,
  onClose,
  onHistoryTabChange,
  onBacktestPageChange,
  onLoadDrawResults,
  onToggleExpand,
  onTogglePurchased,
  onDeleteRecord,
  onLoadMoreHistory,
}: HistoryModalProps) {
  const switchTab = (tab: HistoryTab) => {
    onHistoryTabChange(tab);
    onBacktestPageChange(1);
  };

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
        className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-6 lg:p-8 max-w-[700px] w-full shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <button aria-label="关闭历史数据" onClick={onClose} className="absolute top-6 right-6 text-[var(--text-disabled)] hover:text-[var(--text-main)] px-2 transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 border-b border-[var(--border-card)] pb-4 pr-8">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--text-main)] mb-1">
              <History className="w-5 h-5" /> 历史数据
            </h2>
            <p className="text-xs text-[var(--text-disabled)]">查看往期生成的号码与实购记录。</p>
          </div>

          <div className="flex gap-1.5 bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border-card)] mt-3 sm:mt-0 self-start sm:self-auto">
            <button
              className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${historyTab === 'purchased' ? 'bg-[var(--bg-card)] text-amber-500 shadow border border-[var(--border-card)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
              onClick={() => switchTab('purchased')}
            >
              回测记录 (已购)
            </button>
            <button
              className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${historyTab === 'generated' ? 'bg-[var(--bg-card)] text-blue-500 shadow border border-[var(--border-card)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
              onClick={() => switchTab('generated')}
            >
              生成记录 (全部)
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar my-2">
          {historyTab === 'purchased' && (
            <PurchasedHistoryView
              history={history}
              lotteryResults={lotteryResults}
              isFetchingResults={isFetchingResults}
              backtestPage={backtestPage}
              onBacktestPageChange={onBacktestPageChange}
              onLoadDrawResults={onLoadDrawResults}
            />
          )}

          {historyTab === 'generated' && (
            <GeneratedHistoryView
              history={history}
              expandedHistoryIds={expandedHistoryIds}
              hasMoreHistory={hasMoreHistory}
              isFetchingHistory={isFetchingHistory}
              onToggleExpand={onToggleExpand}
              onTogglePurchased={onTogglePurchased}
              onDeleteRecord={onDeleteRecord}
              onLoadMoreHistory={onLoadMoreHistory}
            />
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--border-card)] flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-main)] font-semibold text-[13px] rounded-full hover:bg-[var(--bg-hover)] transition-colors">关闭明细概览</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PurchasedHistoryView({
  history,
  lotteryResults,
  isFetchingResults,
  backtestPage,
  onBacktestPageChange,
  onLoadDrawResults,
}: Pick<HistoryModalProps, 'history' | 'lotteryResults' | 'isFetchingResults' | 'backtestPage' | 'onBacktestPageChange' | 'onLoadDrawResults'>) {
  if (isFetchingResults) {
    return <div className="flex justify-center items-center py-10"><Dices className="animate-spin w-8 h-8 text-[var(--text-muted)]" /></div>;
  }

  if (lotteryResults.length === 0) {
    return (
      <div className="text-center py-12 flex flex-col items-center gap-4">
        <p className="text-[var(--text-muted)] text-sm">暂未加载最新开奖数据，无法进行回测比对。</p>
        <button onClick={onLoadDrawResults} className="px-6 py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:bg-amber-600 active:scale-95 transition-all">
          加载官网最新开奖数据
        </button>
      </div>
    );
  }

  const purchasedRecords = history
    .filter(h => h.purchased)
    .sort((a, b) => {
      const tA = getMetadata(a)?.purchased_at || a.created_at;
      const tB = getMetadata(b)?.purchased_at || b.created_at;
      return new Date(tB).getTime() - new Date(tA).getTime();
    });

  if (purchasedRecords.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-muted)] text-sm">暂无标记为实购的记录，请先在记录列表中点亮对勾标志。</p>
      </div>
    );
  }

  const totalPages = Math.ceil(purchasedRecords.length / 3);
  const currentRecords = purchasedRecords.slice((backtestPage - 1) * 3, backtestPage * 3);

  return (
    <div className="space-y-4">
      {currentRecords.map(record => (
        <div key={'bt-' + record.id}>
          <PurchasedRecordCard record={record} lotteryResults={lotteryResults} />
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-6 border-t border-[var(--border-card)] pt-4">
          <button disabled={backtestPage <= 1} onClick={() => onBacktestPageChange(p => p - 1)} className="px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-md text-[11px] disabled:opacity-30 text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors">上一页</button>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">{backtestPage} / {totalPages}</span>
          <button disabled={backtestPage >= totalPages} onClick={() => onBacktestPageChange(p => p + 1)} className="px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-md text-[11px] disabled:opacity-30 text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors">下一页</button>
        </div>
      )}
    </div>
  );
}

function PurchasedRecordCard({ record, lotteryResults }: { record: HistoryRecord; lotteryResults: LottoResult[] }) {
  const matchRes = checkHits(record, lotteryResults);
  const meta = getMetadata(record);

  return (
    <div className="bg-[var(--bg-input)] rounded-xl p-4 border border-[var(--border-card)]">
      <div className="flex justify-between items-center mb-3 border-b border-[var(--border-card)] pb-2">
        <div className="text-sm font-semibold flex gap-2 items-center text-[var(--text-main)]">
          {format(new Date(meta?.purchased_at || record.created_at), 'MM-dd HH:mm')} 购买记录
          {meta?.pkg && <span className="bg-[var(--bg-hover)] border border-[var(--border-card)] text-[10px] text-[var(--text-muted)] px-2 py-0.5 rounded-full">{meta.pkg}</span>}
        </div>
        <span className="text-[10px] text-green-700 dark:text-green-500 bg-green-500/10 px-2 py-1 rounded font-bold border border-green-500/20">已实购</span>
      </div>

      {matchRes?.isWaiting ? (
        <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-card)] shadow-sm text-center">
          <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">待开奖</div>
          <div className="text-[11px] text-[var(--text-disabled)] mt-1">此实购号码对应的开奖结果尚未公布</div>
        </div>
      ) : matchRes && matchRes.winningLines.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between">
            <span>校验开奖: 第 <span className="text-[var(--text-main)] font-mono font-bold mr-1">{matchRes.drawNum}</span>期</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">中奖 {matchRes.winningLines.length} 注</span>
          </div>
          {matchRes.winningLines.map((line: any, idx: number) => (
            <div key={idx}>
              <WinningLine line={line} />
            </div>
          ))}
        </div>
      ) : matchRes && matchRes.bestNoPrizeInfo && (matchRes.bestNoPrizeInfo.fHits.length > 0 || matchRes.bestNoPrizeInfo.bHits.length > 0) ? (
        <BestNoPrize matchRes={matchRes} />
      ) : (
        <div className="text-xs text-[var(--text-disabled)] italic p-2 text-center bg-[var(--bg-card)] rounded-lg border border-[var(--border-card)]">未产生任何命中号码，或者找不到可用于匹配的数据。</div>
      )}
    </div>
  );
}

function WinningLine({ line }: { line: any }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-amber-500/30 shadow-sm relative overflow-hidden flex flex-col gap-2">
      <div className="absolute top-0 right-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
        {line.hasFloating ? '含浮动奖金' : `奖金: ${line.totalPrizeNum}元`}
      </div>
      <div className="text-[11px] text-[var(--text-disabled)] mb-0 font-semibold flex flex-wrap items-center gap-2 mt-1">
        <span>第 {line.lineNum} 行 {line.isMultiplex ? <span className="text-amber-600 dark:text-amber-500 font-bold">(复式票)</span> : '(单式票)'}</span>
        <span className="text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded font-bold text-[10px]">
          {Object.entries(line.hitCounts).map(([lvl, cnt]) => `${cnt}注${lvl}等奖`).join(', ')}
        </span>
      </div>
      <div className="flex flex-col gap-1 text-xs font-mono bg-[var(--bg-input)] border border-[var(--border-card)] p-2 rounded relative">
        <div className="text-[var(--text-main)] break-all mt-1">
          <span className="text-red-500/70 dark:text-red-400/70">{line.frontStr}</span> <span className="text-[var(--text-disabled)] mx-1">|</span> <span className="text-blue-500/70 dark:text-blue-400/70">{line.backStr}</span>
        </div>
        <div className="text-[var(--text-disabled)] mt-1 border-t border-[var(--border-card)] pt-2 flex items-center">
          <span className="w-10">命中:</span>
          <span className="text-red-500 dark:text-red-400 font-bold tracking-widest">{line.fHits.length > 0 ? line.fHits.map((n: number) => formatNumber(n)).join(' ') : '--'}</span>
          {line.fHits.length > 0 && line.bHits.length > 0 && <span className="mx-2">+</span>}
          <span className="text-blue-500 dark:text-blue-400 font-bold tracking-widest">{line.bHits.length > 0 ? line.bHits.map((n: number) => formatNumber(n)).join(' ') : (line.fHits.length === 0 ? '--' : '')}</span>
        </div>
      </div>

      {line.isMultiplex && line.winningSubTickets && line.winningSubTickets.length > 0 && (
        <div className="mt-1 border-t border-amber-500/20 pt-2 flex flex-col gap-1.5">
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mb-1">拆分后中奖明细 ({line.winningSubTickets.length}注):</div>
          <div className="max-h-32 overflow-y-auto flex flex-col gap-1.5 pr-1 custom-scrollbar">
            {line.winningSubTickets.map((sub: any, sIdx: number) => (
              <div key={sIdx} className="text-[10px] font-mono flex items-center gap-2 bg-amber-500/5 p-1.5 rounded">
                <span className="text-[var(--text-disabled)] w-10 shrink-0">注{sub.subId}:</span>
                <div className="flex-1 min-w-0 flex items-center truncate text-[var(--text-main)]">
                  <span className="text-red-500/80 dark:text-red-400/80">{sub.frontStr}</span>
                  <span className="text-[var(--text-disabled)] mx-1 shrink-0">|</span>
                  <span className="text-blue-500/80 dark:text-blue-400/80">{sub.backStr}</span>
                </div>
                <span className="text-amber-600 dark:text-amber-400 font-bold shrink-0 self-start ml-2 bg-amber-500/10 px-1 rounded">
                  {sub.pLevel}等奖 {sub.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BestNoPrize({ matchRes }: { matchRes: any }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-card)] shadow-sm">
      <div className="text-[11px] text-[var(--text-muted)] mb-2 flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
        <span>校验开奖: 第 <span className="text-[var(--text-main)] font-mono font-bold mr-1">{matchRes.drawNum}</span>期 (第{matchRes.bestNoPrizeComboNum}行最高对 {matchRes.bestNoPrizeInfo.fHits.length}+{matchRes.bestNoPrizeInfo.bHits.length})</span>
        <span className="text-[var(--text-disabled)] font-bold px-2 py-0.5 rounded self-start sm:self-auto border border-[var(--border-card)]">未中奖</span>
      </div>
      <div className="flex flex-col gap-1 text-xs font-mono bg-[var(--bg-input)] border border-[var(--border-card)] p-2 rounded">
        <div className="text-[var(--text-disabled)] flex items-center">
          <span className="w-16">红球命中:</span>
          <span className="text-[var(--text-main)] font-bold ml-2 tracking-widest">{matchRes.bestNoPrizeInfo.fHits.length > 0 ? matchRes.bestNoPrizeInfo.fHits.map((n: number) => formatNumber(n)).join(' ') : '--'}</span>
        </div>
        <div className="text-[var(--text-disabled)] flex items-center">
          <span className="w-16">蓝球命中:</span>
          <span className="text-[var(--text-main)] font-bold ml-2 tracking-widest">{matchRes.bestNoPrizeInfo.bHits.length > 0 ? matchRes.bestNoPrizeInfo.bHits.map((n: number) => formatNumber(n)).join(' ') : '--'}</span>
        </div>
      </div>
    </div>
  );
}

function GeneratedHistoryView({
  history,
  expandedHistoryIds,
  hasMoreHistory,
  isFetchingHistory,
  onToggleExpand,
  onTogglePurchased,
  onDeleteRecord,
  onLoadMoreHistory,
}: Pick<HistoryModalProps, 'history' | 'expandedHistoryIds' | 'hasMoreHistory' | 'isFetchingHistory' | 'onToggleExpand' | 'onTogglePurchased' | 'onDeleteRecord' | 'onLoadMoreHistory'>) {
  if (history.length === 0) {
    return <div className="text-center py-12 text-[var(--text-muted)] text-sm">暂无生成记录。</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {history.map(item => (
          <div key={item.id}>
            <GeneratedHistoryCard
              item={item}
              expanded={expandedHistoryIds.has(item.id)}
              onToggleExpand={onToggleExpand}
              onTogglePurchased={onTogglePurchased}
              onDeleteRecord={onDeleteRecord}
            />
          </div>
        ))}
      </div>

      {hasMoreHistory && (
        <div className="flex justify-center mt-6 py-4">
          <button
            onClick={onLoadMoreHistory}
            disabled={isFetchingHistory}
            className="px-6 py-2 bg-[var(--bg-input)] border border-[var(--border-card)] text-sm text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded-full transition-all flex items-center gap-2"
          >
            {isFetchingHistory && <Dices className="w-4 h-4 animate-spin" />}
            {isFetchingHistory ? '加载中...' : '加载更多云端记录'}
          </button>
        </div>
      )}
    </div>
  );
}

function GeneratedHistoryCard({
  item,
  expanded,
  onToggleExpand,
  onTogglePurchased,
  onDeleteRecord,
}: {
  item: HistoryRecord;
  expanded: boolean;
  onToggleExpand: (id: string, event: MouseEvent) => void;
  onTogglePurchased: (id: string, purchased: boolean) => void;
  onDeleteRecord: (id: string) => void;
}) {
  const draws = parseHistoryRecord(item);
  if (draws.length === 0) return null;

  const mainDraw = draws[0];
  const meta = getMetadata(item);
  const methodLabel = methodLabels[meta?.mode || ''] || '未知';
  const sourceLabel = meta?.source ? sourceLabels[meta.source] || meta.source : null;
  const isAiSource = meta?.source === 'custom_llm' || meta?.source === 'gemini';

  return (
    <div className="flex flex-col p-4 bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-card)] rounded-xl transition-colors relative cursor-pointer" onClick={e => onToggleExpand(item.id, e)}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-[var(--text-disabled)]">{format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}</span>
        {item.purchased ? (
          <span className="text-[10px] text-green-700 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded font-bold">已购</span>
        ) : (
          <button
            className="text-[10px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-muted)] hover:text-green-500 hover:border-green-500/50 px-2 py-0.5 rounded transition-colors"
            onClick={e => {
              e.stopPropagation();
              onTogglePurchased(item.id, item.purchased);
            }}
          >
            设为已购
          </button>
        )}
      </div>
      <div className="font-mono text-sm tracking-wide gap-1.5 flex flex-wrap items-center">
        {mainDraw.front.map((n, i) => <span key={`fh-${i}`} className="text-red-500 dark:text-red-400 font-black">{formatNumber(n)}</span>)}
        <span className="text-[var(--text-muted)] mx-1">+</span>
        {mainDraw.back.map((n, i) => <span key={`bh-${i}`} className="text-blue-500 dark:text-blue-400 font-black">{formatNumber(n)}</span>)}
      </div>

      <div className="flex justify-between items-end mt-3">
        <div className="flex items-center gap-2">
          <span className="text-[9px] bg-[var(--bg-hover)] border border-[var(--border-card)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-md">
            {methodLabel}
          </span>
          {meta?.pkg && <span className="text-[9px] bg-[var(--bg-hover)] border border-[var(--border-card)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-md">{meta.pkg}</span>}
          {sourceLabel && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md border ${
              isAiSource
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
            }`}>
              {sourceLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {draws.length > 1 && (
            <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">共{draws.length}注 <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} /></span>
          )}
          <button
            aria-label={`删除 ${format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')} 的生成记录`}
            className="text-[var(--text-muted)] hover:text-red-500 p-1"
            onClick={e => {
              e.stopPropagation();
              onDeleteRecord(item.id);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && draws.length > 1 && (
        <div className="flex flex-col gap-1.5 mt-3 border-t border-[var(--border-card)] pt-3 animate-fade-in">
          {draws.slice(1).map((d, didx) => (
            <div key={didx} className="font-mono text-[11px] flex gap-1 items-center bg-[var(--bg-card)] px-2 py-1.5 rounded border border-[var(--border-card)]">
              <span className="text-[var(--text-disabled)] w-6 shrink-0">{didx + 2}.</span>
              {d.front.map((n, i) => <span key={`fhd-${i}`} className="text-red-500/80 font-bold">{formatNumber(n)}</span>)}
              <span className="text-[var(--text-muted)] mx-0.5">+</span>
              {d.back.map((n, i) => <span key={`bhd-${i}`} className="text-blue-500/80 font-bold">{formatNumber(n)}</span>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
