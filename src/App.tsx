import { useState, useEffect, lazy, Suspense } from 'react';
import { Dices, CheckCircle2, History, Database, Sparkles, BarChart3, Activity, Settings, User, TrendingUp } from 'lucide-react';
import { createClient, type User as SupabaseUser } from '@supabase/supabase-js';
import RecentHistoryPanel from './components/RecentHistoryPanel';
import type { Theme } from './components/SettingsModal';
import { PACKAGES, formatNumber, type DrawSet, type GenMode, type LottoResult, type PackageDef } from './shared/lottery';

const ConfirmDialog = lazy(() => import('./components/ConfirmDialog'));
const HistoryModal = lazy(() => import('./components/HistoryModal'));
const NoticeDialog = lazy(() => import('./components/NoticeDialog'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const TrendModal = lazy(() => import('./components/TrendModal'));



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
  user_id?: string;
}

export default function App() {
  const [currentDraws, setCurrentDraws] = useState<DrawSet[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const [mode, setMode] = useState<GenMode>('random');
  const [pkg, setPkg] = useState<PackageDef>(PACKAGES[0]);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTab, setHistoryTab] = useState<'purchased' | 'generated'>('purchased');
  const [backtestPage, setBacktestPage] = useState(1);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  
  const [lotteryResults, setLotteryResults] = useState<LottoResult[]>([]);
  const [isFetchingResults, setIsFetchingResults] = useState(false);
  
  const [isAdmin] = useState<boolean>(isAdminInit);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
  
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const HISTORY_PAGE_SIZE = 50;

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
  const isCloudReady = Boolean(isAdmin && supabase && supabaseUser);

  useEffect(() => {
    if (!isAdmin || !supabase) return;

    supabase.auth.getSession().then(({ data }: any) => {
      setSupabaseUser(data.session?.user ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setSupabaseUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, [isAdmin]);

  const signInWithPassword = async () => {
    if (!supabase) {
      setNoticeMessage('请先保存 Supabase URL 和 anon key 配置。');
      return;
    }

    const email = authEmail.trim();
    if (!email || !authPassword) {
      setNoticeMessage('请输入云端账号的邮箱和密码。');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: authPassword,
    });

    if (error) {
      setNoticeMessage('登录失败：' + error.message);
      return;
    }

    setAuthPassword('');
    setNoticeMessage('云端账号已登录。');
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSupabaseUser(null);
    fetchHistory(1, false);
  };

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
  }, [supabase, isAdmin, supabaseUser?.id]);

  // Fetch missing prizeInfo for purchased records
  useEffect(() => {
    if (lotteryResults.length === 0 || history.length === 0) return;

    const purchasedRecords = history.filter(r => r.purchased);
    if (purchasedRecords.length === 0) return;

    let updated = false;
    const fetchMissing = async () => {
      for (const record of purchasedRecords) {
        let meta: any = {};
        try { meta = JSON.parse(record.excluded || '{}'); } catch(e){}
        const recDate = meta.date || record.created_at;
        
        // Find if this record matches any draw
        const drawDateTarget = new Date(recDate);
        drawDateTarget.setHours(0,0,0,0);
        
        let targetResult = lotteryResults.find(r => r.lotteryDrawTime === recDate);
        if (!targetResult) {
          targetResult = lotteryResults.find(r => {
            const resDateStr = r.lotteryDrawTime.split(' ')[0] || r.lotteryDrawTime;
            return resDateStr >= recDate && resDateStr <= new Date(drawDateTarget.getTime() + 3*24*60*60*1000).toISOString().split('T')[0];
          });
        }
        
        if (targetResult) {
          const targetIdx = lotteryResults.findIndex(r => r.lotteryDrawNum === targetResult!.lotteryDrawNum);
          const previousResult = lotteryResults[targetIdx + 1];

          for (const resItem of [targetResult, previousResult]) {
            if (resItem && (!resItem.poolBalanceAfterdraw || resItem.poolBalanceAfterdraw === '0')) {
              try {
                const res = await fetch(`/api/lottery/prizeInfo?drawNum=${resItem.lotteryDrawNum}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.poolBalanceAfterdraw) {
                     resItem.poolBalanceAfterdraw = data.poolBalanceAfterdraw;
                     updated = true;
                  } else {
                     resItem.poolBalanceAfterdraw = '0'; // Avoid infinite loop
                  }
                }
              } catch(e) {}
            }
          }
        }
      }

      if (updated) {
        setLotteryResults([...lotteryResults]);
        localStorage.setItem('official_lottery_results', JSON.stringify(lotteryResults));
      }
    };

    fetchMissing();
  }, [lotteryResults.length, history.length]);

  const fetchHistory = async (page = 1, append = false) => {
    setIsFetchingHistory(true);
    if (isCloudReady && supabase) {
      try {
        const from = (page - 1) * HISTORY_PAGE_SIZE;
        const to = from + HISTORY_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('draw_history')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        if (data) {
          if (append) {
             setHistory(prev => {
                const existingMap = new Map<string, HistoryRecord>(prev.map(item => [item.id, item]));
                data.forEach(item => existingMap.set(item.id, item as HistoryRecord));
                return Array.from(existingMap.values()).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
             });
          } else {
             setHistory(data);
          }
          setHasMoreHistory(data.length === HISTORY_PAGE_SIZE);
          setHistoryPage(page);
        }
      } catch (err: any) {
        setSupabaseError(err.message || "Failed to fetch from Supabase");
      }
    } else {
      // Guest mode
      try {
        const localData = JSON.parse(localStorage.getItem('lotto_history_v2') || '[]');
        setHistory(localData);
        setHasMoreHistory(false);
      } catch(e) {}
    }
    setIsFetchingHistory(false);
  };

  const loadMoreHistory = () => {
    if (!isFetchingHistory && hasMoreHistory) {
       fetchHistory(historyPage + 1, true);
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
    
    if (isCloudReady && supabase) {
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
    
    if (isCloudReady && supabase) {
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
      try {
        let finalDraws: DrawSet[] = [];
        const isStats = mode === 'stats' && activeResults.length > 0;
        const isIChing = mode === 'iching';

        if (isStats || isIChing) {
          try {
            const res = await fetch('/api/ai/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mode, pkg, results: activeResults }),
            });

            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data?.draws)) {
                finalDraws = data.draws;
              }
            } else if (res.status !== 503) {
              const errStr = await res.text();
              console.warn('AI generation failed:', errStr);
            }
          } catch (err) {
            console.warn('Server AI generation unavailable, falling back to local generation', err);
          }
        }

        if (finalDraws.length === 0) {
          const newDraws: DrawSet[] = [];
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
          finalDraws = newDraws;
        }

        setCurrentDraws(finalDraws);
        setIsAnimating(false);

        const tempId = String(Date.now());
        const record = {
          front: JSON.stringify(finalDraws),
          back: '[]', 
          excluded: JSON.stringify({ mode: mode, pkg: pkg.name }), 
          purchased: false,
        };

        const newLocalRecord = { ...record, id: tempId, created_at: new Date().toISOString() };
        const updated = [newLocalRecord as HistoryRecord, ...history].slice(0, 50);
        setHistory(updated);

        if (isCloudReady && supabase && supabaseUser) {
          try {
            const { data, error } = await supabase.from('draw_history').insert({
              ...record,
              user_id: supabaseUser.id,
            }).select('*').single();
            if (!error && data) {
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
      } catch (err: any) {
         setIsAnimating(false);
         setNoticeMessage("大模型推算过程发生了异常：" + err.message);
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

  const requestClearGuestHistory = () => setShowClearHistoryConfirm(true);

  const clearGuestHistory = () => {
    localStorage.removeItem('lotto_history_v2');
    setHistory([]);
    setShowClearHistoryConfirm(false);
  }

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
                {isCloudReady ? (
                   <span className="text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded border border-green-500/20 flex items-center gap-1"><Database className="w-3 h-3"/> 云端同步</span>
                ) : isAdmin ? (
                   <span className="text-xs text-blue-600 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 flex items-center gap-1"><Database className="w-3 h-3"/> 待登录</span>
                ) : (
                   <span className="text-xs text-amber-600 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 flex items-center gap-1"><User className="w-3 h-3"/> 游客模式</span>
                )}
                
                <button aria-label="打开系统配置" onClick={() => setShowSettingsModal(true)} className="p-2 border border-[var(--border-card)] rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors bg-[var(--bg-card)]">
                  <Settings className="w-4 h-4" />
                </button>
             </div>
             
             <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
               <button onClick={() => setShowTrendModal(true)} className="flex items-center justify-center gap-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors py-2 px-4 border border-[var(--border-card)] rounded-full hover:bg-[var(--bg-hover)] bg-[var(--bg-input)]">
                 <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
                 频率走势
               </button>
               <button onClick={() => setShowHistoryModal(true)} className="flex items-center justify-center gap-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors py-2 px-4 border border-[var(--border-card)] rounded-full hover:bg-[var(--bg-hover)] bg-[var(--bg-input)]">
                 <History className="w-4 h-4 text-amber-500 shrink-0" />
                 查看历史数据
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
                      <button
                         onClick={generateLotto}
                         className={`w-full py-5 md:h-[88px] bg-gradient-to-tr from-red-600 to-red-500 rounded-2xl relative overflow-hidden flex items-center justify-center transition-all ${isAnimating ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer shadow-lg shadow-red-500/30 hover:scale-[0.98] active:scale-[0.96]'}`}
                       >
                         <Dices className={`w-8 h-8 mr-3 text-white ${isAnimating ? 'animate-spin' : ''}`} />
                         <span className="text-xl font-bold text-white tracking-widest drop-shadow-md">
                           {isAnimating ? '推演阵列中...' : '生成幸运号码'}
                         </span>
                      </button>
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
                        <div
                          key={`draw-${i}`}
                          className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-card)] hover:border-[var(--text-muted)] w-full overflow-hidden transition-colors animate-fade-in"
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
                        </div>
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

           <RecentHistoryPanel
             history={history}
             isAdmin={isCloudReady}
             supabaseError={supabaseError}
             expandedHistoryIds={expandedHistoryIds}
             onClearHistory={requestClearGuestHistory}
             onOpenHistory={() => setShowHistoryModal(true)}
             onToggleExpand={toggleExpand}
             onDeleteRecord={deleteRecord}
             onTogglePurchased={togglePurchased}
           />
        </div>
      </div>

      <Suspense fallback={null}>
          {showSettingsModal && (
            <SettingsModal
              isAdmin={isAdmin}
              theme={theme}
              setupUrl={setupUrl}
              setupKey={setupKey}
              historyApiUrl={historyApiUrl}
              authEmail={authEmail}
              authPassword={authPassword}
              signedInEmail={supabaseUser?.email ?? ''}
              onThemeChange={setTheme}
              onSetupUrlChange={setSetupUrl}
              onSetupKeyChange={setSetupKey}
              onHistoryApiUrlChange={setHistoryApiUrl}
              onAuthEmailChange={setAuthEmail}
              onAuthPasswordChange={setAuthPassword}
              onSignIn={signInWithPassword}
              onSignOut={signOut}
              onClearHistory={requestClearGuestHistory}
              onClose={() => setShowSettingsModal(false)}
              onSave={saveSettings}
            />
          )}

          {showClearHistoryConfirm && (
            <ConfirmDialog
              title="清空本地历史"
              message="这会删除当前浏览器里的游客模式生成记录。云端 Supabase 记录不会受影响。"
              confirmLabel="清空"
              onConfirm={clearGuestHistory}
              onCancel={() => setShowClearHistoryConfirm(false)}
            />
          )}

          {noticeMessage && (
            <NoticeDialog
              title="操作未完成"
              message={noticeMessage}
              onClose={() => setNoticeMessage(null)}
            />
          )}

          {showHistoryModal && (
            <HistoryModal
              history={history}
              lotteryResults={lotteryResults}
              isFetchingResults={isFetchingResults}
              historyTab={historyTab}
              backtestPage={backtestPage}
              expandedHistoryIds={expandedHistoryIds}
              hasMoreHistory={hasMoreHistory}
              isFetchingHistory={isFetchingHistory}
              onClose={() => setShowHistoryModal(false)}
              onHistoryTabChange={setHistoryTab}
              onBacktestPageChange={setBacktestPage}
              onLoadDrawResults={loadDrawResults}
              onToggleExpand={toggleExpand}
              onTogglePurchased={togglePurchased}
              onDeleteRecord={deleteRecord}
              onLoadMoreHistory={loadMoreHistory}
            />
          )}
      </Suspense>

      {showTrendModal && (
        <Suspense fallback={null}>
          <TrendModal
            trendData={trendData}
            lotteryResults={lotteryResults}
            isFetchingResults={isFetchingResults}
            onClose={() => setShowTrendModal(false)}
            onLoadDrawResults={loadDrawResults}
          />
        </Suspense>
      )}
    </div>
  );
}
