import type { MouseEvent } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, ChevronDown, Database, Trash2 } from 'lucide-react';
import { formatNumber, parseHistoryRecord } from '../shared/lottery';

interface HistoryRecord {
  id: string;
  front: string;
  back: string;
  excluded: string;
  purchased: boolean;
  created_at: string;
}

interface RecentHistoryPanelProps {
  history: HistoryRecord[];
  isAdmin: boolean;
  supabaseError: string | null;
  expandedHistoryIds: Set<string>;
  onClearHistory: () => void;
  onOpenHistory: () => void;
  onToggleExpand: (id: string, event: MouseEvent) => void;
  onDeleteRecord: (id: string) => void;
  onTogglePurchased: (id: string, purchased: boolean) => void;
}

const methodLabels: Record<string, string> = {
  random: '随机漫步',
  iching: '易经理数',
  stats: '走势分析',
};

const getMetadata = (rec: HistoryRecord) => {
  try {
    const m = JSON.parse(rec.excluded || '{}');
    return m as { mode?: string; pkg?: string; purchased_at?: string };
  } catch (e) {}
  return null;
};

export default function RecentHistoryPanel({
  history,
  isAdmin,
  supabaseError,
  expandedHistoryIds,
  onClearHistory,
  onOpenHistory,
  onToggleExpand,
  onDeleteRecord,
  onTogglePurchased,
}: RecentHistoryPanelProps) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-6 flex flex-col relative overflow-hidden h-[600px] lg:h-auto transition-colors duration-300">
      <div className="text-[11px] uppercase tracking-[1px] text-[var(--text-disabled)] mb-4 font-semibold flex justify-between items-center">
        <span>最近记录 (Recent)</span>
        <div className="flex gap-2">
          {!isAdmin && history.length > 0 && (
            <button onClick={onClearHistory} className="text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded text-[10px]">
              清空
            </button>
          )}
          <button onClick={onOpenHistory} className="text-blue-500 hover:text-blue-600 hover:underline px-2 py-0.5 rounded text-[10px]">
            更 多
          </button>
        </div>
      </div>

      {isAdmin && supabaseError ? (
        <div className="text-left p-4 bg-red-500/10 rounded-xl border border-red-500/20 mb-4 flex flex-col gap-2">
          <p className="text-xs text-red-500 font-bold mb-1 flex items-center gap-1">
            <Database className="w-3 h-3" /> 数据库同步异常
          </p>
          <pre className="text-[10px] text-red-400 bg-red-500/5 p-2 rounded whitespace-pre-wrap word-break">{supabaseError}</pre>
          <div className="text-[10px] text-[var(--text-disabled)] mt-1 space-y-1">
            <p>如果是因为表不存在，请在 Supabase SQL Editor 中执行：</p>
            <pre className="p-2 bg-[var(--bg-input)] rounded border border-[var(--border-card)] font-mono text-blue-400 select-all overflow-x-auto">
{`CREATE TABLE draw_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  front text,
  back text,
  excluded text,
  purchased boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`}
            </pre>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto pr-1 space-y-0 scrollbar-thin scrollbar-thumb-[var(--scrollbar-thumb)] flex flex-col">
        {history.slice(0, 10).map(item => (
          <div key={item.id}>
            <RecentHistoryItem
              item={item}
              expanded={expandedHistoryIds.has(item.id)}
              onToggleExpand={onToggleExpand}
              onDeleteRecord={onDeleteRecord}
              onTogglePurchased={onTogglePurchased}
            />
          </div>
        ))}
        {history.length === 0 && (
          <div className="text-[var(--text-disabled)] text-sm text-center mt-8 px-4 leading-relaxed">
            暂无记录<br />点击记录右上方的对勾将其标记为【已购】即可参与回测
          </div>
        )}
      </div>
    </div>
  );
}

interface RecentHistoryItemProps {
  item: HistoryRecord;
  expanded: boolean;
  onToggleExpand: (id: string, event: MouseEvent) => void;
  onDeleteRecord: (id: string) => void;
  onTogglePurchased: (id: string, purchased: boolean) => void;
}

function RecentHistoryItem({
  item,
  expanded,
  onToggleExpand,
  onDeleteRecord,
  onTogglePurchased,
}: RecentHistoryItemProps) {
  const draws = parseHistoryRecord(item);
  if (draws.length === 0) return null;

  const mainDraw = draws[0];
  const meta = getMetadata(item);
  const genMethod = meta?.mode || '未知';
  const methodLabel = methodLabels[genMethod] || genMethod;

  return (
    <div
      className="flex flex-col p-3 border border-transparent border-b-[var(--border-card)] hover:bg-[var(--bg-hover)] transition-colors group relative cursor-pointer rounded-lg"
      onClick={e => onToggleExpand(item.id, e)}
    >
      <div className="font-mono text-[12px] flex flex-col gap-1.5 mb-2 relative pr-12">
        <div className={`flex gap-1 transition-opacity flex-wrap items-center ${item.purchased ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
          {mainDraw.front.map((n, i) => (
            <span key={`fh-${i}`} className="text-red-500 dark:text-red-400 font-bold">{formatNumber(n)}</span>
          ))}
          <span className="text-[var(--text-muted)] mx-0.5">+</span>
          {mainDraw.back.map((n, i) => (
            <span key={`bh-${i}`} className="text-blue-500 dark:text-blue-400 font-bold">{formatNumber(n)}</span>
          ))}
          <span className="ml-2 text-[9px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-md font-sans">
            模式: {methodLabel}
          </span>
        </div>

        {expanded && draws.length > 1 && (
          <div className="flex flex-col gap-1.5 mt-1 border-t border-[var(--border-card)] pt-2 animate-fade-in">
            {draws.slice(1).map((d, didx) => (
              <div key={didx} className={`flex gap-1 transition-opacity flex-wrap ${item.purchased ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
                {d.front.map((n, i) => (
                  <span key={`fhd-${i}`} className="text-red-500/80 dark:text-red-400/80 font-bold">{formatNumber(n)}</span>
                ))}
                <span className="text-[var(--text-muted)] mx-0.5">+</span>
                {d.back.map((n, i) => (
                  <span key={`bhd-${i}`} className="text-blue-500/80 dark:text-blue-400/80 font-bold">{formatNumber(n)}</span>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="absolute right-0 top-0 transition-all flex items-center justify-center gap-1 z-10">
          <button
            aria-label={`删除 ${format(new Date(item.created_at), 'MM-dd HH:mm')} 的生成记录`}
            className="p-1 rounded-full text-[var(--text-muted)] opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hover:text-red-500 hover:scale-110 transition-all"
            onClick={e => {
              e.stopPropagation();
              onDeleteRecord(item.id);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            aria-label={item.purchased ? `取消标记 ${format(new Date(item.created_at), 'MM-dd HH:mm')} 的实购记录` : `标记 ${format(new Date(item.created_at), 'MM-dd HH:mm')} 为已购`}
            className={`p-1 rounded-full ${item.purchased ? 'text-green-500 scale-100 opacity-100' : 'text-[var(--text-muted)] scale-90 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hover:text-green-500 hover:scale-110'} transition-all`}
            onClick={e => {
              e.stopPropagation();
              onTogglePurchased(item.id, item.purchased);
            }}
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center text-[10px] text-[var(--text-disabled)]">
        <span>{format(new Date(item.created_at), 'MM-dd HH:mm')}</span>
        <div className="flex gap-2 items-center">
          {meta?.pkg && <span className="bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">{meta.pkg}</span>}
          {draws.length > 1 && (
            <span className="text-[var(--text-muted)] px-1 mt-0.5 flex items-center gap-1">
              等 {draws.length} 组 <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </span>
          )}
          {item.purchased && <span className="text-green-600 font-bold mt-0.5">已实购</span>}
        </div>
      </div>
    </div>
  );
}
