import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dices, X, CheckCircle2, History, Database, Sparkles, BarChart3, Activity, Settings, User, TrendingUp, ChevronDown, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

function getCombinations(arr: number[], k: number): number[][] {
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

function expandDraw(draw: DrawSet): DrawSet[] {
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

const getPrizeLevel = (f: number, b: number): number => {
  if (f === 5 && b === 2) return 1;
  if (f === 5 && b === 1) return 2;
  if ((f === 5 && b === 0) || (f === 4 && b === 2)) return 3;
  if (f === 4 && b === 1) return 4;
  if ((f === 3 && b === 2) || (f === 4 && b === 0)) return 5;
  if ((f === 3 && b === 1) || (f === 2 && b === 2)) return 6;
  if ((f === 3 && b === 0) || (f === 1 && b === 2) || (f === 2 && b === 1) || (f === 0 && b === 2)) return 7;
  return 0; // No prize
};

// Setup initialization
const localSupaUrl = localStorage.getItem('SUPABASE_URL') || '';
const localSupaKey = localStorage.getItem('SUPABASE_KEY') || '';
const localHistoryApiUrl = localStorage.getItem('HISTORY_API_URL') || '';

let supabase: any = null;
let isAdminInit = false;
try {
  if (localSupaUrl && localSupaKey) {
    supabase = createClient(localSupaUrl, localSupaKey);
    isAdminInit = true;
  }
} catch(e) {
  console.warn("Invalid Supabase config:", e);
}

interface HistoryRecord {
  id: string;
  front: string; 
  back: string;  
  excluded: string; 
  purchased: boolean;
  created_at: string;
}

interface LottoResult {
  lotteryDrawNum: string;
  lotteryDrawResult: string;
  lotteryDrawTime: string;
}

interface DrawSet { front: number[]; back: number[]; }

type GenMode = 'random' | 'iching' | 'stats';
type DrawConfig = { f: number; b: number; count: number };
type PackageDef = { id: string; name: string; price: number; desc: string; configs: DrawConfig[] };

const PACKAGES: PackageDef[] = [
  { id: 'p_1', name: '单注体验', price: 2, desc: '1注单式，纯粹摸奖', configs: [{ f: 5, b: 2, count: 1 }] },
  { id: 'p_5', name: '标准满票', price: 10, desc: '单张彩票5注排列', configs: [{ f: 5, b: 2, count: 5 }] },
  { id: 'p_18', name: '18元套票', price: 18, desc: '6注单式 + 1注(5+3)复式', configs: [{ f: 5, b: 2, count: 6 }, { f: 5, b: 3, count: 1 }] },
  { id: 'p_28', name: '28元套票', price: 28, desc: '8注单式 + 1注(6+2)复式', configs: [{ f: 5, b: 2, count: 8 }, { f: 6, b: 2, count: 1 }] },
  { id: 'p_58', name: '58元套票', price: 58, desc: '8注单式 + 1注(7+2)复式', configs: [{ f: 5, b: 2, count: 8 }, { f: 7, b: 2, count: 1 }] },
  { id: 'p_88', name: '88元套票', price: 88, desc: '5单式+(7+2)复式+(6+3)复式', configs: [{ f: 5, b: 2, count: 5 }, { f: 7, b: 2, count: 1 }, { f: 6, b: 3, count: 1 }] },
];

type Theme = 'light' | 'dark' | 'system';

export default function App() {
  const [currentDraws, setCurrentDraws] = useState<DrawSet[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const [mode, setMode] = useState<GenMode>('random');
  const [pkg, setPkg] = useState<PackageDef>(PACKAGES[0]);

  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [backtestPage, setBacktestPage] = useState(1);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);
  
  const [lotteryResults, setLotteryResults] = useState<LottoResult[]>([]);
  const [isFetchingResults, setIsFetchingResults] = useState(false);
  
  const [isAdmin] = useState<boolean>(isAdminInit);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e: any) => {
     e.stopPropagation();
     setExpandedHistoryIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
           next.delete(id);
        } else {
           next.add(id);
        }
        return next;
     });
  };

  // Theme support
  const [theme, setTheme] = useState<Theme>((localStorage.getItem('theme') as Theme) || 'system');
  
  useEffect(() => {
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    applyTheme();
    localStorage.setItem('theme', theme);
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if(theme === 'system') applyTheme(); };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // Settings State
  const [setupUrl, setSetupUrl] = useState(localSupaUrl);
  const [setupKey, setSetupKey] = useState(localSupaKey);
  const [historyApiUrl, setHistoryApiUrl] = useState(localHistoryApiUrl);

  const fetchOfficialHistory = async () => {
    let loadedFromCloud = false;
    if (isAdmin && supabase) {
      try {
        const { data, error } = await supabase
          .from('official_draws')
          .select('*')
          .order('lotteryDrawNum', { ascending: false })
          .limit(50);
        if (!error && data && data.length > 0) {
           setLotteryResults(data);
           localStorage.setItem('official_lottery_results', JSON.stringify(data));
           loadedFromCloud = true;
           return;
        }
      } catch (err: any) {
        console.warn("Failed to fetch official history from cloud:", err);
      }
    } 
    
    // Fallback if not loaded from cloud
    if (!loadedFromCloud) {
       try {
         const localData = JSON.parse(localStorage.getItem('official_lottery_results') || '[]');
         if (localData.length > 0) setLotteryResults(localData);
       } catch(e) {}
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchOfficialHistory();
  }, [supabase, isAdmin]);

  const fetchHistory = async () => {
    if (isAdmin && supabase) {
      try {
        const { data, error } = await supabase
          .from('draw_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        if (data) setHistory(data);
      } catch (err: any) {
        setSupabaseError(err.message || "Failed to fetch from Supabase");
      }
    } else {
      // Guest mode
      try {
        const localData = JSON.parse(localStorage.getItem('lotto_history_v2') || '[]');
        setHistory(localData);
      } catch(e) {}
    }
  };

  const loadDrawResults = async () => {
    setIsFetchingResults(true);
    let resultsList: LottoResult[] = [];

    // 0. Try custom user-configured API URL first
    if (historyApiUrl) {
      try {
        const res = await fetch(historyApiUrl);
        if (res.ok) {
          const data = await res.json();
          // Be flexible with the data format from custom APIs
          if (data?.value?.list) {
            resultsList = data.value.list;
          } else if (data?.list) {
            resultsList = data.list;
          } else if (Array.isArray(data) && data[0]?.lotteryDrawNum) {
            resultsList = data; // Raw array
          } else if (data?.data?.list) {
            resultsList = data.data.list;
          }
        }
      } catch (err) {
        console.warn("Custom History API failed", err);
      }
    }
    
    // 1. First try the local proxy (Works in Vite dev, Express, and Netlify via netlify.toml)
    if (resultsList.length === 0) {
      try {
        const res = await fetch('/api/lottery/history');
        if (res.ok) {
          const data = await res.json();
          if (data?.value?.list) {
            resultsList = data.value.list;
          }
        }
      } catch (err) {
        console.warn("Local API proxy failed, falling back to JSONP", err);
      }
    }
    
    // 2. Attempt JSONP fallback (Bypasses some CORS and WAF)
    if (resultsList.length === 0) {
        try {
          resultsList = await new Promise<LottoResult[]>((resolve, reject) => {
            const callbackName = 'jsonp_callback_' + Math.round(1000000 * Math.random());
            const timeout = setTimeout(() => {
               cleanup();
               reject(new Error('JSONP timeout'));
            }, 5000);
            
            const cleanup = () => {
               clearTimeout(timeout);
               delete (window as any)[callbackName];
               const el = document.getElementById(callbackName);
               if (el) document.body.removeChild(el);
            };

            (window as any)[callbackName] = (data: any) => {
                cleanup();
                if (data && data.value && data.value.list) {
                   resolve(data.value.list);
                } else {
                   reject(new Error('Invalid JSONP data'));
                }
            };
            
            const script = document.createElement('script');
            script.id = callbackName;
            script.src = `https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=50&isVerify=1&pageNo=1&callback=${callbackName}`;
            script.onerror = () => {
                cleanup();
                reject(new Error('JSONP failed'));
            };
            document.body.appendChild(script);
          });
        } catch (e) {
           console.warn("JSONP failed, trying raw CORS proxy", e);
        }
    }
    
    // 3. Last resort: CORS proxy services
    if (resultsList.length === 0) {
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent('https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=50&isVerify=1&pageNo=1')}`,
        `https://corsproxy.io/?${encodeURIComponent('https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=50&isVerify=1&pageNo=1')}`
      ];
      
      for (const pxUrl of proxies) {
          try {
            const res = await fetch(pxUrl);
            if (res.ok) {
               const data = await res.json();
               if (data?.value?.list) {
                  resultsList = data.value.list;
                  break; 
               }
            }
          } catch(e) {
             console.warn("CORS proxy failed", pxUrl, e);
          }
      }
    }

    if (resultsList.length > 0) {
       setLotteryResults(resultsList);
       localStorage.setItem('official_lottery_results', JSON.stringify(resultsList));
       if (isAdmin && supabase) {
          try {
             await supabase.from('official_draws').upsert(resultsList, { onConflict: 'lotteryDrawNum' });
          } catch(e) {
             console.warn("Could not sync official history to cloud", e);
          }
       }
    }
    
    setIsFetchingResults(false);
    return resultsList;
  };

  const togglePurchased = async (id: string, currentStatus: boolean) => {
    // Optimistically update
    const purchased_at = !currentStatus ? new Date().toISOString() : undefined;
    const newHistory = history.map(h => {
      if (h.id === id) {
        let meta: any = {};
        try { meta = JSON.parse(h.excluded || '{}'); } catch(e){}
        if (purchased_at) {
           meta.purchased_at = purchased_at;
        } else {
           delete meta.purchased_at;
        }
        return { ...h, purchased: !currentStatus, excluded: JSON.stringify(meta) };
      }
      return h;
    });
    setHistory(newHistory);
    
    if (isAdmin && supabase) {
      try {
        const itemToUpdate = newHistory.find(h => h.id === id);
        const { error } = await supabase.from('draw_history').update({ 
          purchased: !currentStatus,
          excluded: itemToUpdate?.excluded
        }).eq('id', id);
        if (error) {
          setSupabaseError("锁定记录失败: " + error.message);
          setHistory(history); // revert on error
        }
      } catch (err: any) {
          setSupabaseError(err.message);
          setHistory(history); // revert on error
      }
    } else {
      // Guest mode
      localStorage.setItem('lotto_history_v2', JSON.stringify(newHistory));
    }
  };

  const deleteRecord = async (id: string) => {
    // Optimistically update
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    
    if (isAdmin && supabase) {
      try {
        const { error } = await supabase.from('draw_history').delete().eq('id', id);
        if (error) {
          setSupabaseError("删除记录失败: " + error.message);
          setHistory(history); // revert on error
        }
      } catch (err: any) {
          setSupabaseError(err.message);
          setHistory(history); // revert on error
      }
    } else {
      // Guest mode
      localStorage.setItem('lotto_history_v2', JSON.stringify(newHistory));
    }
  };
  const markLatestAsPurchased = () => {
    if (history.length > 0 && !history[0].purchased) {
      togglePurchased(history[0].id, false);
    }
  };

  const getFrequency = (max: number, type: 'front'|'back', results: LottoResult[] = lotteryResults) => {
    const counts = Array(max + 1).fill(1); 
    results.forEach(r => {
      const nums = r.lotteryDrawResult.split(' ');
      const slice = type === 'front' ? nums.slice(0, 5) : nums.slice(5, 7);
      slice.forEach(n => counts[parseInt(n, 10)]++);
    });
    return counts;
  };

  const getRandomWeighted = (max: number, count: number, type: 'front'|'back', results: LottoResult[] = lotteryResults) => {
    const weights = getFrequency(max, type, results);
    const result: number[] = [];
    const available = Array.from({length: max}, (_, i) => i + 1);
    
    for(let i=0; i<count; i++) {
       if(available.length === 0) break;
       const totalW = available.reduce((sum, n) => sum + weights[n], 0);
       let r = Math.random() * totalW;
       for(let j=0; j<available.length; j++) {
         const w = weights[available[j]];
         if (r <= w) {
            result.push(available[j]);
            available.splice(j, 1);
            break;
         }
         r -= w;
       }
    }
    return result.sort((a,b) => a-b);
  };

  const getRandomStandard = (max: number, count: number) => {
    const numbers = Array.from({ length: max }, (_, i) => i + 1);
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      if (numbers.length === 0) break;
      const randomIndex = Math.floor(Math.random() * numbers.length);
      result.push(numbers[randomIndex]);
      numbers.splice(randomIndex, 1);
    }
    return result.sort((a, b) => a - b);
  };

  const getIChingNumber = (max: number, count: number) => {
      const numbers = Array.from({ length: max }, (_, i) => i + 1);
      const result: number[] = [];
      const timestamp = Date.now();
      numbers.sort((a,b) => (Math.sin(a * timestamp) - Math.cos(b * timestamp)));
      for (let i = 0; i < count; i++) {
        if (numbers.length === 0) break;
        const randomIndex = Math.floor(Math.random() * numbers.length);
        result.push(numbers[randomIndex]);
        numbers.splice(randomIndex, 1);
      }
      return result.sort((a, b) => a - b);
  };

  const generateLotto = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    
    let activeResults = lotteryResults;
    if (mode === 'stats' && activeResults.length === 0) {
      activeResults = await loadDrawResults();
    }
    
    setTimeout(async () => {
      const newDraws: DrawSet[] = [];
      const isStats = mode === 'stats' && activeResults.length > 0;
      const isIChing = mode === 'iching';
      
      pkg.configs.forEach(config => {
        for(let i = 0; i < config.count; i++) {
          let fNums, bNums;
          if (isStats) {
              fNums = getRandomWeighted(35, config.f, 'front', activeResults);
              bNums = getRandomWeighted(12, config.b, 'back', activeResults);
          } else if (isIChing) {
              fNums = getIChingNumber(35, config.f);
              bNums = getIChingNumber(12, config.b);
          } else {
              fNums = getRandomStandard(35, config.f);
              bNums = getRandomStandard(12, config.b);
          }
          newDraws.push({ front: fNums, back: bNums });
        }
      });
      
      setCurrentDraws(newDraws);
      setIsAnimating(false);

      const tempId = String(Date.now());
      const record = {
        front: JSON.stringify(newDraws),
        back: '[]', 
        excluded: JSON.stringify({ mode: mode, pkg: pkg.name }), 
        purchased: false,
      };

      const newLocalRecord = { ...record, id: tempId, created_at: new Date().toISOString() };
      const updated = [newLocalRecord, ...history].slice(0, 50);
      setHistory(updated); // Optimistic update

      if (isAdmin && supabase) {
        try {
          const { data, error } = await supabase.from('draw_history').insert(record).select('*').single();
          if (!error && data) {
             // Replace temp record with real one from DB
             setHistory(prev => prev.map(h => h.id === tempId ? data : h));
          } else if (error) {
            setSupabaseError("上传推演数据失败: " + error.message);
          }
        } catch (error: any) {
            setSupabaseError("请求失败: " + error.message);
        }
      } else {
         localStorage.setItem('lotto_history_v2', JSON.stringify(updated));
      }
    }, 500); 
  };

  const saveSettings = () => {
    localStorage.setItem('SUPABASE_URL', setupUrl);
    localStorage.setItem('SUPABASE_KEY', setupKey);
    localStorage.setItem('HISTORY_API_URL', historyApiUrl);
    localStorage.setItem('theme', theme);
    window.location.reload();
  };

  const clearGuestHistory = () => {
    if(confirm("Confirm to delete guest history?")) {
       localStorage.removeItem('lotto_history_v2');
       setHistory([]);
    }
  }

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  const parseHistoryRecord = (rec: HistoryRecord): DrawSet[] => {
    try {
      const parsed = JSON.parse(rec.front);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].front) return parsed;
    } catch(e) {}
    return [];
  };

  const getMetadata = (rec: HistoryRecord) => {
    try {
       const m = JSON.parse(rec.excluded || '{}');
       return m as { mode?: number; pkg?: string; purchased_at?: string };
    }catch(e){}
    return null;
  };

  const checkHits = (historyRec: HistoryRecord, results: LottoResult[]) => {
    if (results.length === 0) return null;
    
    // Find the correct draw result based on purchase time
    let meta: any = {};
    try { meta = JSON.parse(historyRec.excluded || '{}'); } catch(e){}
    const purchaseDate = new Date(meta.purchased_at || historyRec.created_at);
    
    // Convert to YYYY-MM-DD
    const yyyy = purchaseDate.getFullYear();
    const mm = String(purchaseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(purchaseDate.getDate()).padStart(2, '0');
    const pDateStr = `${yyyy}-${mm}-${dd}`;

    // results are ordered descending, so reversing them lets us search from oldest to newest
    const sortedResults = [...results].reverse();
    let targetResult = sortedResults.find(r => r.lotteryDrawTime >= pDateStr);
    
    if (!targetResult) {
      targetResult = results[0]; // fallback if not found
    }

    const draws = parseHistoryRecord(historyRec);
    if(draws.length === 0) return null;

    const parts = targetResult.lotteryDrawResult.split(' ');
    const resFront = parts.slice(0, 5).map(n => parseInt(n, 10));
    const resBack = parts.slice(5, 7).map(n => parseInt(n, 10));

    let bestPrize = 999;
    let bestDrawInfo: any = null;
    let comboNum = 0;

    draws.forEach((draw, dIdx) => {
      const expanded = expandDraw(draw);
      expanded.forEach(cmb => {
         const fHitsCount = cmb.front.filter(n => resFront.includes(n)).length;
         const bHitsCount = cmb.back.filter(n => resBack.includes(n)).length;
         const pLevel = getPrizeLevel(fHitsCount, bHitsCount);
         
         const score = (fHitsCount * 2) + bHitsCount; // used for no-prize best match
         const currentBestScore = bestDrawInfo ? (bestDrawInfo.fHits.length * 2 + bestDrawInfo.bHits.length) : -1;

         if (pLevel > 0) {
            if (pLevel < bestPrize) {
               bestPrize = pLevel;
               bestDrawInfo = {
                  pLevel,
                  fHits: cmb.front.filter(n => resFront.includes(n)),
                  bHits: cmb.back.filter(n => resBack.includes(n))
               };
               comboNum = dIdx + 1;
            }
         } else if (bestPrize === 999 && score > currentBestScore) {
             bestDrawInfo = {
                pLevel: 0,
                fHits: cmb.front.filter(n => resFront.includes(n)),
                bHits: cmb.back.filter(n => resBack.includes(n))
             };
             comboNum = dIdx + 1;
         }
      });
    });

    return { 
      drawNum: targetResult.lotteryDrawNum, 
      drawTime: targetResult.lotteryDrawTime,
      bestPrize: bestPrize === 999 ? 0 : bestPrize,
      ...bestDrawInfo,
      comboNum,
      totalLines: draws.length 
    };
  };

  const trendData = (() => {
    const fCounts = getFrequency(35, 'front');
    const bCounts = getFrequency(12, 'back');
    const combined = [];
    for(let i=1; i<=35; i++) {
       combined.push({ 
         num: formatNumber(i), 
         frontFreq: fCounts[i] || 0,
         backFreq: i <= 12 ? (bCounts[i] || 0) : null 
       });
    }
    return combined;
  })();

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans flex flex-col items-center justify-center p-4 lg:p-8 transition-colors duration-300">
      <div className="flex flex-col gap-4 w-full max-w-[1200px]">
        
        {/* Top Header */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-6 lg:p-8 flex justify-between items-center relative overflow-hidden transition-colors duration-300">
          <div>
             <div className="text-[11px] uppercase tracking-[1px] text-[var(--text-disabled)] font-semibold mb-2">System Active</div>
             <h1 className="m-0 text-2xl md:text-[32px] tracking-tight font-bold flex items-center gap-2">
               <Dices className="w-8 h-8 text-green-500 hidden sm:block delay-100 duration-500 hover:rotate-180 transition-transform" />
               <span className="text-[var(--text-main)]">大乐透猜猜猜</span> 
               <span className="text-[var(--text-disabled)] font-light text-xl md:text-2xl ml-1">v5.0</span>
             </h1>
          </div>
          <div className="flex flex-col items-end gap-3 z-10">
             <div className="flex items-center gap-2">
                {isAdmin ? (
                   <span className="text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded border border-green-500/20 flex items-center gap-1"><Database className="w-3 h-3"/> 管理员模式</span>
                ) : (
                   <span className="text-xs text-amber-600 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 flex items-center gap-1"><User className="w-3 h-3"/> 游客模式</span>
                )}
                
                <button onClick={() => setShowSettingsModal(true)} className="p-2 border border-[var(--border-card)] rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors bg-[var(--bg-card)]">
                  <Settings className="w-4 h-4" />
                </button>
             </div>
             
             <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
               <button onClick={() => setShowTrendModal(true)} className="flex items-center justify-center gap-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors py-2 px-4 border border-[var(--border-card)] rounded-full hover:bg-[var(--bg-hover)] bg-[var(--bg-input)]">
                 <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
                 频率走势
               </button>
               <button onClick={() => setShowBacktestModal(true)} className="flex items-center justify-center gap-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors py-2 px-4 border border-[var(--border-card)] rounded-full hover:bg-[var(--bg-hover)] bg-[var(--bg-input)]">
                 <History className="w-4 h-4 text-amber-500 shrink-0" />
                 查看历史实购回测
               </button>
             </div>
          </div>
          {/* Subtle background glow */}
          <div className="absolute -right-20 -top-20 w-[200px] h-[200px] bg-green-500/5 blur-[100px] rounded-full pointer-events-none"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
           {/* Left/Main Column: Controls & Display */}
           <div className="flex flex-col gap-4 lg:col-span-3">
              
              {/* Action Panel */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-6 lg:p-8 flex flex-col gap-6 relative transition-colors duration-300">
                 <div className="flex-1 flex flex-col xl:flex-row gap-5">
                    {/* Package Selector */}
                    <div className="flex-1">
                      <div className="text-[11px] uppercase tracking-[1px] text-[var(--text-disabled)] mb-3 font-semibold">模拟购买套票</div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {PACKAGES.map(p => (
                          <button 
                             key={p.id} 
                             onClick={() => setPkg(p)}
                             className={`text-left p-4 rounded-xl border transition-all duration-300 ${pkg.id === p.id ? 'border-red-500 bg-red-500/10 shadow-[0_4px_20px_-10px_rgba(239,68,68,0.3)]' : 'border-[var(--border-card)] bg-[var(--bg-input)] hover:border-[var(--text-muted)]'}`}
                          >
                             <div className="flex lg:flex-row flex-col justify-between lg:items-center mb-1.5 gap-1">
                                <span className={`font-bold text-sm truncate ${pkg.id === p.id ? 'text-red-500' : 'text-[var(--text-main)]'}`}>{p.name}</span>
                                <span className="text-[10px] font-mono bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20 w-fit shrink-0">¥ {p.price}</span>
                             </div>
                             <div className="text-xs text-[var(--text-disabled)] leading-relaxed">{p.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                 </div>

                 {/* Generate Area with Modes Side-by-Side */}
                 <div className="flex flex-col gap-5">
                   
                   {/* Latest Draw Information Panel */}
                   <div className="bg-[var(--bg-input)] border border-[var(--border-card)] rounded-2xl p-4 flex flex-col gap-2 transition-colors">
                      <div className="flex items-center justify-between">
                         <h3 className="text-xs uppercase tracking-[1px] text-[var(--text-disabled)] font-semibold flex items-center gap-1.5"><History className="w-3.5 h-3.5"/> 历史开奖数据</h3>
                         {lotteryResults.length > 0 && (
                            <div className="flex items-center gap-3">
                              <button onClick={loadDrawResults} disabled={isFetchingResults} className="text-[11px] text-[var(--text-muted)] hover:text-blue-500 transition-colors flex items-center gap-1">
                                <Database className={`w-3 h-3 ${isFetchingResults ? 'animate-pulse' : ''}`} />手动更新
                              </button>
                              <button onClick={() => setShowTrendModal(true)} className="text-[11px] text-blue-500 hover:text-blue-600 font-medium">查看走势图 ({lotteryResults.length}期)</button>
                            </div>
                         )}
                      </div>
                      
                      {lotteryResults.length > 0 ? (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                             <div className="text-sm text-[var(--text-main)] whitespace-nowrap hidden sm:block">最新 • 第 <span className="font-bold text-foreground">{lotteryResults[0].lotteryDrawNum}</span> 期</div>
                             <div className="text-sm text-[var(--text-main)] whitespace-nowrap sm:hidden">第 <span className="font-bold text-foreground">{lotteryResults[0].lotteryDrawNum}</span> 期</div>
                             
                             <div className="flex gap-1.5 flex-wrap">
                                {lotteryResults[0].lotteryDrawResult.split(' ').map((n, i) => (
                                   <div key={i} className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${i < 5 ? 'bg-red-500/10 text-red-600' : 'bg-blue-500/10 text-blue-600'}`}>
                                     {n}
                                   </div>
                                ))}
                             </div>
                             <div className="text-xs text-[var(--text-disabled)] sm:ml-auto">{lotteryResults[0].lotteryDrawTime}</div>
                          </div>
                      ) : (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
                             <p className="text-[13px] text-[var(--text-muted)] text-center sm:text-left">获取最新大乐透50期数据，将作为“走势分析”模式参考依据</p>
                             <button onClick={loadDrawResults} disabled={isFetchingResults} className="px-5 py-2 w-full sm:w-auto bg-blue-500/10 border border-blue-500/20 font-semibold text-blue-600 rounded-xl hover:bg-blue-500/20 active:scale-95 transition-all outline-none disabled:opacity-50 text-xs whitespace-nowrap flex items-center justify-center gap-1.5">
                                {isFetchingResults ? <Dices className="w-4 h-4 animate-spin"/> : <Database className="w-4 h-4" />}
                                {isFetchingResults ? '加载中...' : '联网获取数据'}
                             </button>
                          </div>
                      )}
                   </div>

                   <div className="flex flex-col md:flex-row gap-4">
                    {/* Mode Selector */}
                    <div className="flex-1">
                      <div className="text-[11px] uppercase tracking-[1px] text-[var(--text-disabled)] mb-3 font-semibold">生成模式选择</div>
                      <div className="flex flex-col sm:flex-row bg-[var(--bg-input)] rounded-2xl border border-[var(--border-card)] p-2 gap-2 h-auto sm:h-[88px] transition-colors duration-300">
                        <button onClick={() => setMode('random')} className={`flex-1 py-3 px-2 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${mode === 'random' ? 'bg-[var(--bg-hover)] text-[var(--text-main)] border border-[var(--border-card)] shadow-sm' : 'text-[var(--text-disabled)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-hover)] border border-transparent'}`}>
                           <Sparkles className="w-5 h-5" /> 随机漫步
                        </button>
                        <button onClick={() => setMode('iching')} className={`flex-1 py-3 px-2 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${mode === 'iching' ? 'bg-amber-500/10 text-amber-600 shadow-sm border border-amber-500/20' : 'text-[var(--text-disabled)] hover:text-amber-500 hover:bg-[var(--bg-hover)] border border-transparent'}`}>
                           <Activity className="w-5 h-5" /> 易经理数
                        </button>
                        <button onClick={() => setMode('stats')} className={`flex-1 py-3 px-2 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${mode === 'stats' ? 'bg-blue-500/10 text-blue-600 shadow-sm border border-blue-500/20' : 'text-[var(--text-disabled)] hover:text-blue-500 hover:bg-[var(--bg-hover)] border border-transparent'}`}>
                           <BarChart3 className="w-5 h-5" /> 走势分析
                        </button>
                      </div>
                    </div>

                    <div className="md:w-[280px] flex flex-col justify-end">
                      <motion.button 
                         whileHover={isAnimating ? {} : { scale: 0.98 }}
                         whileTap={isAnimating ? {} : { scale: 0.96 }}
                         onClick={generateLotto}
                         className={`w-full py-5 md:h-[88px] bg-gradient-to-tr from-red-600 to-red-500 rounded-2xl relative overflow-hidden flex items-center justify-center transition-all ${isAnimating ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer shadow-lg shadow-red-500/30'}`}
                       >
                         <Dices className={`w-8 h-8 mr-3 text-white ${isAnimating ? 'animate-spin' : ''}`} />
                         <span className="text-xl font-bold text-white tracking-widest drop-shadow-md">
                           {isAnimating ? '推演阵列中...' : '生成幸运号码'}
                         </span>
                      </motion.button>
                    </div>
                 </div>
                 </div>
              </div>

              {/* Display Result Grid */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-4 sm:p-6 lg:p-8 flex flex-col relative min-h-[400px] lg:min-h-[500px] transition-colors duration-300">
                 <div className="text-[11px] uppercase tracking-[1px] text-[var(--text-disabled)] mb-6 font-semibold flex justify-between items-center bg-[var(--bg-input)] p-3 rounded-lg border border-[var(--border-card)]">
                    <div className="flex items-center gap-2">
                       <span>Current Sequence ({pkg.name} | 共 {currentDraws.length} 组)</span>
                       {currentDraws.length > 0 && <span className="inline-block text-[var(--text-muted)] bg-[var(--bg-hover)] px-2 py-0.5 rounded text-[10px]">滑动查看</span>}
                    </div>
                 </div>

                 <div className="flex-1 flex flex-col gap-3 pb-4">
                    {currentDraws.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {currentDraws.map((draw, i) => (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (i % 10) * 0.03 }}
                          key={`draw-${i}`}
                          className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-card)] hover:border-[var(--text-muted)] w-full overflow-hidden transition-colors"
                        >
                          <div className="w-5 h-5 rounded bg-[var(--bg-hover)] flex items-center justify-center text-[9px] text-[var(--text-disabled)] font-mono shrink-0">
                             {formatNumber(i+1)}
                          </div>
                          <div className="flex gap-1.5 flex-nowrap overflow-x-auto custom-scrollbar pb-1 flex-1 justify-start">
                             {draw.front.map((num, idx) => (
                               <div key={`front-${idx}`} className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold bg-red-50 text-red-500 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20">
                                 {formatNumber(num)}
                               </div>
                             ))}
                             <span className="shrink-0 text-[var(--text-muted)] mx-0.5 sm:mx-1 flex items-center text-lg">+</span>
                             {draw.back.map((num, idx) => (
                               <div key={`back-${idx}`} className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold bg-blue-50 text-blue-500 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
                                 {formatNumber(num)}
                               </div>
                             ))}
                          </div>
                        </motion.div>
                       ))}
                      </div>
                    ) : (
                       <div className="h-[200px] flex items-center justify-center text-[var(--text-disabled)] italic">
                         系统待机...请部署推演指令
                       </div>
                    )}
                 </div>

                 {currentDraws.length > 0 && (history.length === 0 || !history[0].purchased) && !isAnimating && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-card)] flex justify-end shrink-0 animate-fade-in">
                       <button onClick={markLatestAsPurchased} className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-green-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                          这波感觉能中，我已实购 <CheckCircle2 className="w-4 h-4" />
                       </button>
                    </div>
                 )}
              </div>
           </div>

           {/* Right Column: History */}
           <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-6 flex flex-col relative overflow-hidden h-[600px] lg:h-auto transition-colors duration-300">
              <div className="text-[11px] uppercase tracking-[1px] text-[var(--text-disabled)] mb-4 font-semibold flex justify-between items-center">
                <span>{isAdmin ? '云端记录 (Admin)' : '本地记录 (Guest)'}</span>
                {!isAdmin && history.length > 0 && (
                   <button onClick={clearGuestHistory} className="text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded text-[10px]">清空</button>
                )}
              </div>

              {isAdmin && supabaseError ? (
                <div className="text-left p-4 bg-red-500/10 rounded-xl border border-red-500/20 mb-4 flex flex-col gap-2">
                  <p className="text-xs text-red-500 font-bold mb-1 flex items-center gap-1">
                    <Database className="w-3 h-3"/> 数据库同步异常
                  </p>
                  <pre className="text-[10px] text-red-400 bg-red-500/5 p-2 rounded whitespace-pre-wrap word-break">{supabaseError}</pre>
                  <div className="text-[10px] text-[var(--text-disabled)] mt-1 space-y-1">
                    <p>如果是因为表不存在，请在 Supabase SQL Editor 中执行：</p>
                    <pre className="p-2 bg-[var(--bg-input)] rounded border border-[var(--border-card)] font-mono text-blue-400 select-all overflow-x-auto">
{`CREATE TABLE draw_history (
  id uuid default gen_random_uuid() primary key,
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
                {history.map((item) => {
                  const draws = parseHistoryRecord(item);
                  if (draws.length === 0) return null;
                  const mainDraw = draws[0];
                  const meta = getMetadata(item);
                  const genMethod = meta?.mode || '未知';
                  const methodLabels: Record<string, string> = {
                    'random': '随机漫步',
                    'iching': '易经理数',
                    'stats': '走势分析'
                  };
                  const methodLabel = methodLabels[genMethod] || genMethod;
                  
                  return (
                  <div key={item.id} className="flex flex-col p-3 border border-transparent border-b-[var(--border-card)] hover:bg-[var(--bg-hover)] transition-colors group relative cursor-pointer rounded-lg" onClick={(e) => toggleExpand(item.id, e)}>
                    <div className="font-mono text-[12px] flex flex-col gap-1.5 mb-2 relative pr-12">
                      <div className={`flex gap-1 transition-opacity flex-wrap items-center ${item.purchased ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
                        {mainDraw.front.map((n, i) => <span key={`fh-${i}`} className="text-red-500 dark:text-red-400 font-bold">{formatNumber(n)}</span>)}
                        <span className="text-[var(--text-muted)] mx-0.5">+</span>
                        {mainDraw.back.map((n, i) => <span key={`bh-${i}`} className="text-blue-500 dark:text-blue-400 font-bold">{formatNumber(n)}</span>)}
                        <span className="ml-2 text-[9px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-md font-sans">
                           模式: {methodLabel}
                        </span>
                      </div>

                      {expandedHistoryIds.has(item.id) && draws.length > 1 && (
                        <div className="flex flex-col gap-1.5 mt-1 border-t border-[var(--border-card)] pt-2 animate-fade-in">
                           {draws.slice(1).map((d, didx) => (
                              <div key={didx} className={`flex gap-1 transition-opacity flex-wrap ${item.purchased ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
                                {d.front.map((n, i) => <span key={`fhd-${i}`} className="text-red-500/80 dark:text-red-400/80 font-bold">{formatNumber(n)}</span>)}
                                <span className="text-[var(--text-muted)] mx-0.5">+</span>
                                {d.back.map((n, i) => <span key={`bhd-${i}`} className="text-blue-500/80 dark:text-blue-400/80 font-bold">{formatNumber(n)}</span>)}
                              </div>
                           ))}
                        </div>
                      )}
                      
                      <div className="absolute right-0 top-0 transition-all flex items-center justify-center gap-1 z-10">
                        <button 
                          className="p-1 rounded-full text-[var(--text-muted)] opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hover:text-red-500 hover:scale-110 transition-all" 
                          onClick={(e) => { e.stopPropagation(); deleteRecord(item.id); }}
                        >
                           <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                          className={`p-1 rounded-full ${item.purchased ? 'text-green-500 scale-100 opacity-100' : 'text-[var(--text-muted)] scale-90 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hover:text-green-500 hover:scale-110'} transition-all`} 
                          onClick={(e) => { e.stopPropagation(); togglePurchased(item.id, item.purchased); }}
                        >
                           <CheckCircle2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-[var(--text-disabled)]">
                      <span>{format(new Date(item.created_at), 'MM-dd HH:mm')}</span>
                      <div className="flex gap-2 items-center">
                        {meta?.pkg && <span className="bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">{meta.pkg}</span>}
                        {draws.length > 1 && <span className="text-[var(--text-muted)] px-1 mt-0.5 flex items-center gap-1">等 {draws.length} 组 <ChevronDown className={`w-3 h-3 transition-transform ${expandedHistoryIds.has(item.id) ? 'rotate-180' : ''}`} /></span>}
                        {item.purchased && <span className="text-green-600 font-bold mt-0.5">已实购</span>}
                      </div>
                    </div>
                  </div>
                )})}
                {history.length === 0 && <div className="text-[var(--text-disabled)] text-sm text-center mt-8 px-4 leading-relaxed">暂无记录<br/>点击记录右上方的对勾将其标记为【已购】即可参与回测</div>}
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {/* Settings Modal */}
        {showSettingsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--bg-modal)] backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:p-0"
            onClick={() => setShowSettingsModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-6 lg:p-8 max-w-[500px] w-full shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setShowSettingsModal(false)} className="absolute top-6 right-6 text-[var(--text-disabled)] hover:text-[var(--text-main)] transition-colors"><X className="w-5 h-5" /></button>
              
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-[var(--text-main)]">
                <Settings className="w-5 h-5" /> 系统配置中心
              </h2>

              <div className="space-y-6">
                 {/* Theme Controls */}
                 <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">主题偏好</div>
                    <div className="flex bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl p-1.5 gap-1">
                       <button onClick={() => setTheme('light')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${theme === 'light' ? 'bg-[var(--bg-card)] text-slate-800 shadow-sm border border-[var(--border-card)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-main)]'}`}>浅色模式</button>
                       <button onClick={() => setTheme('dark')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${theme === 'dark' ? 'bg-[var(--bg-hover)] text-white shadow-sm border border-[var(--border-card)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-main)]'}`}>深色模式</button>
                       <button onClick={() => setTheme('system')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${theme === 'system' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm border border-[var(--border-card)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-main)]'}`}>跟随系统</button>
                    </div>
                 </div>

                 {/* Supabase Controls */}
                 <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2">
                       外部数据库引擎配置 (Supabase)
                       {isAdmin ? (
                          <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded ml-auto">已激活</span>
                       ) : (
                          <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded ml-auto">未激活 (游客模式)</span>
                       )}
                    </div>
                    <div className="space-y-4">
                       <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-[var(--text-disabled)]">VITE_SUPABASE_URL</label>
                          <input 
                             type="text" 
                             value={setupUrl} 
                             onChange={(e) => setSetupUrl(e.target.value)} 
                             className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-green-500 transition-colors"
                             placeholder="https://xxx.supabase.co"
                          />
                       </div>
                       <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-[var(--text-disabled)]">VITE_SUPABASE_ANON_KEY</label>
                          <input 
                             type="password" 
                             value={setupKey} 
                             onChange={(e) => setSetupKey(e.target.value)} 
                             className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-green-500 transition-colors"
                             placeholder="eyJh..."
                          />
                       </div>
                       <p className="text-[10px] text-[var(--text-disabled)] leading-relaxed bg-[var(--bg-hover)] p-3 rounded-lg border border-[var(--border-card)]">
                         当且仅当填入以上配置后，系统方能保存数据至云端开启跨设备管理能力。配置信息仅保存在当前浏览器的 localStorage 中。留空则降级为游客模式使用本地存储。
                       </p>
                    </div>
                 </div>
                 {/* History API Control */}
                 <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2 mt-4 border-t border-[var(--border-card)] pt-4">
                       历史数据接口配置 (选填)
                    </div>
                    <div className="space-y-4">
                       <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-[var(--text-disabled)]">CUSTOM_HISTORY_API_URL</label>
                          <input 
                             type="text" 
                             value={historyApiUrl} 
                             onChange={(e) => setHistoryApiUrl(e.target.value)} 
                             className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-green-500 transition-colors"
                             placeholder="例如: https://api.allorigins.win/raw?url=..."
                          />
                       </div>
                       <p className="text-[10px] text-[var(--text-disabled)] leading-relaxed bg-[var(--bg-hover)] p-3 rounded-lg border border-[var(--border-card)]">
                         当因为网络限制或官方防盗链机制导致获取历史开奖数据失败（尤其在 Vercel/Netlify 等边缘节点环境中）时，可以手动指定第三方代理或者直连的源 URL。
                       </p>
                    </div>
                 </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button onClick={clearGuestHistory} className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20">清空本地历史</button>
                <div className="flex justify-end gap-3 w-full sm:w-auto">
                  <button onClick={() => setShowSettingsModal(false)} className="px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">取消</button>
                  <button onClick={saveSettings} className="px-6 py-2.5 bg-green-600 text-white font-semibold text-sm rounded-full hover:bg-green-700 shadow-lg shadow-green-500/20 transition-all">保存配置并重载</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Backtester Modal */}
        {showBacktestModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--bg-modal)] backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:p-0"
            onClick={() => setShowBacktestModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-6 lg:p-8 max-w-[600px] w-full shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setShowBacktestModal(false)} className="absolute top-6 right-6 text-[var(--text-disabled)] hover:text-[var(--text-main)] transition-colors"><X className="w-5 h-5" /></button>
              
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <History className="w-5 h-5" /> 实购历史防伪回测
              </h2>
              <p className="text-xs text-[var(--text-disabled)] mb-6">校验最新开奖结果与你标记为<span className="text-green-600 dark:text-green-500 font-medium ml-1">"已实购"</span>记录的匹配度。</p>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar border-t border-b border-[var(--border-card)] py-4 my-2">
                {isFetchingResults ? (
                  <div className="flex justify-center items-center py-10"><Dices className="animate-spin w-8 h-8 text-[var(--text-muted)]" /></div>
                ) : lotteryResults.length === 0 ? (
                  <div className="text-center py-12 flex flex-col items-center gap-4">
                     <p className="text-[var(--text-muted)] text-sm">暂未加载最新开奖数据，无法进行回测比对。</p>
                     <button onClick={loadDrawResults} className="px-6 py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:bg-amber-600 active:scale-95 transition-all">
                       加载官网最新开奖数据
                     </button>
                  </div>
                ) : history.filter(h => h.purchased).length === 0 ? (
                  <div className="text-center py-12">
                     <p className="text-[var(--text-muted)] text-sm">暂无标记为实购的记录，请先在记录列表中点亮对勾标志。</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                        const purchasedRecords = history.filter(h => h.purchased).sort((a,b) => {
                           const tA = getMetadata(a)?.purchased_at || a.created_at;
                           const tB = getMetadata(b)?.purchased_at || b.created_at;
                           return new Date(tB).getTime() - new Date(tA).getTime();
                        });
                        const totalPages = Math.ceil(purchasedRecords.length / 3);
                        const currentRecords = purchasedRecords.slice((backtestPage - 1) * 3, backtestPage * 3);

                        return (
                           <>
                             {currentRecords.map((record) => {
                               const matchRes = checkHits(record, lotteryResults);
                               const meta = getMetadata(record);
                               
                               return (
                                 <div key={"bt-" + record.id} className="bg-[var(--bg-input)] rounded-xl p-4 border border-[var(--border-card)]">
                                   <div className="flex justify-between items-center mb-3 border-b border-[var(--border-card)] pb-2">
                                     <div className="text-sm font-semibold flex gap-2 items-center text-[var(--text-main)]">
                                       {format(new Date(meta?.purchased_at || record.created_at), 'MM-dd HH:mm')} 购买记录
                                       {meta?.pkg && <span className="bg-[var(--bg-hover)] text-[10px] text-[var(--text-muted)] px-2 py-0.5 rounded-full">{meta.pkg}</span>}
                                     </div>
                                     <span className="text-[10px] text-green-700 dark:text-green-500 bg-green-500/10 px-2 py-1 rounded font-bold">已实购</span>
                                   </div>
                                   
                                   {matchRes && (matchRes.pLevel > 0 || matchRes.fHits?.length > 0 || matchRes.bHits?.length > 0) ? (
                                     <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-card)] shadow-sm">
                                       <div className="text-[11px] text-[var(--text-muted)] mb-2 flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                                          <span>校验开奖: 最新第 <span className="text-[var(--text-main)] font-mono font-bold mr-1">{matchRes.drawNum}</span>期 (第#{matchRes.comboNum}注)</span>
                                          {matchRes.bestPrize > 0 ? (
                                            <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded self-start sm:self-auto">🎉 {matchRes.bestPrize}等奖! (对中 {matchRes.fHits.length}+{matchRes.bHits.length})</span>
                                          ) : (
                                            <span className="text-[var(--text-disabled)] font-bold px-2 py-0.5 rounded self-start sm:self-auto border border-[var(--bg-hover)]">未中奖 (最高对 {matchRes.fHits.length}+{matchRes.bHits.length})</span>
                                          )}
                                       </div>
                                       <div className="flex flex-col gap-1 text-xs font-mono bg-[var(--bg-input)] border border-[var(--border-card)] p-2 rounded">
                                          <div className="text-[var(--text-disabled)] flex items-center">
                                            <span className="w-16">红球命中:</span> 
                                            <span className="text-red-500 dark:text-red-400 font-bold ml-2 tracking-widest">{matchRes.fHits.length > 0 ? matchRes.fHits.map(formatNumber).join(' ') : '--'}</span>
                                          </div>
                                          <div className="text-[var(--text-disabled)] flex items-center">
                                            <span className="w-16">蓝球命中:</span> 
                                            <span className="text-blue-500 dark:text-blue-400 font-bold ml-2 tracking-widest">{matchRes.bHits.length > 0 ? matchRes.bHits.map(formatNumber).join(' ') : '--'}</span>
                                          </div>
                                       </div>
                                     </div>
                                   ) : (
                                     <div className="text-xs text-[var(--text-disabled)] italic p-2 text-center bg-[var(--bg-card)] rounded-lg border border-[var(--border-card)]">无法匹配开奖数据，或者此套票中没有任何一注击中目标期号。</div>
                                   )}
                                 </div>
                               )
                             })}
                             
                             {totalPages > 1 && (
                               <div className="flex justify-center items-center gap-3 mt-6 border-t border-[var(--border-card)] pt-4">
                                 <button disabled={backtestPage <= 1} onClick={() => setBacktestPage(p=>p-1)} className="px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-md text-xs disabled:opacity-30 text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors">上一页</button>
                                 <span className="text-[11px] text-[var(--text-muted)] font-mono">{backtestPage} / {totalPages}</span>
                                 <button disabled={backtestPage >= totalPages} onClick={() => setBacktestPage(p=>p+1)} className="px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-md text-xs disabled:opacity-30 text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors">下一页</button>
                               </div>
                             )}
                           </>
                        );
                    })()}
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => setShowBacktestModal(false)} className="px-6 py-2.5 bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold text-sm rounded-full hover:bg-[var(--border-card)] transition-colors">关闭明细概览</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {/* Trend Modal */}
        {showTrendModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--bg-modal)] backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:p-0"
            onClick={() => setShowTrendModal(false)}
          >
            <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.9, y: 20 }}
               className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-6 lg:p-8 max-w-[800px] w-full shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col"
               onClick={e => e.stopPropagation()}
             >
               <button onClick={() => setShowTrendModal(false)} className="absolute top-6 right-6 text-[var(--text-disabled)] hover:text-[var(--text-main)] transition-colors"><X className="w-5 h-5" /></button>
               
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
                      <button onClick={loadDrawResults} className="px-6 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg hover:bg-blue-600 active:scale-95 transition-all">
                        从竞彩网 (Sporttery) 加载数据
                      </button>
                   </div>
                 ) : (
                   <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-4">
                     <div className="text-right text-[10px] text-[var(--text-muted)] mt-1">
                       成功从 竞彩网获取 {lotteryResults.length} 期数据
                     </div>
                     <div className="w-full h-[300px] shrink-0">
                       <ResponsiveContainer width="100%" height="100%">
                         <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-card)" />
                           <XAxis dataKey="num" tick={{fontSize: 10, fill: 'var(--text-disabled)'}} axisLine={false} tickLine={false} />
                           <YAxis tick={{fontSize: 10, fill: 'var(--text-disabled)'}} axisLine={false} tickLine={false} />
                           <Tooltip 
                             contentStyle={{backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-card)', borderRadius: '8px', fontSize: '12px'}} 
                             itemStyle={{color: 'var(--text-main)'}}
                           />
                           <Legend wrapperStyle={{fontSize: '12px', color: 'var(--text-disabled)'}} />
                           <Line type="monotone" dataKey="frontFreq" name="红球频率(折线)" stroke="#ef4444" strokeWidth={2} dot={{r: 2}} activeDot={{r: 5}} />
                           <Line type="monotone" dataKey="backFreq" name="蓝球频率(折线)" stroke="#3b82f6" strokeWidth={2} dot={{r: 2}} activeDot={{r: 5}} />
                           <Bar dataKey="frontFreq" name="红球频率(柱状)" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.3} />
                           <Bar dataKey="backFreq" name="蓝球频率(柱状)" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.3} />
                         </ComposedChart>
                       </ResponsiveContainer>
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
                 <button onClick={() => setShowTrendModal(false)} className="px-6 py-2.5 bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold text-sm rounded-full hover:bg-[var(--border-card)] transition-colors">关闭图表</button>
               </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
