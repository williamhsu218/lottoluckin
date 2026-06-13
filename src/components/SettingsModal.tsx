import { motion } from 'motion/react';
import { Settings, X } from 'lucide-react';

export type Theme = 'light' | 'dark' | 'system';

interface SettingsModalProps {
  isAdmin: boolean;
  theme: Theme;
  setupUrl: string;
  setupKey: string;
  historyApiUrl: string;
  authEmail: string;
  authPassword: string;
  signedInEmail: string;
  onThemeChange: (theme: Theme) => void;
  onSetupUrlChange: (value: string) => void;
  onSetupKeyChange: (value: string) => void;
  onHistoryApiUrlChange: (value: string) => void;
  onAuthEmailChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onClearHistory: () => void;
  onClose: () => void;
  onSave: () => void;
}

export default function SettingsModal({
  isAdmin,
  theme,
  setupUrl,
  setupKey,
  historyApiUrl,
  authEmail,
  authPassword,
  signedInEmail,
  onThemeChange,
  onSetupUrlChange,
  onSetupKeyChange,
  onHistoryApiUrlChange,
  onAuthEmailChange,
  onAuthPasswordChange,
  onSignIn,
  onSignOut,
  onClearHistory,
  onClose,
  onSave,
}: SettingsModalProps) {
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
        className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[24px] p-6 lg:p-8 max-w-[500px] w-full shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        <button aria-label="关闭系统配置" onClick={onClose} className="absolute top-6 right-6 text-[var(--text-disabled)] hover:text-[var(--text-main)] transition-colors">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-[var(--text-main)]">
          <Settings className="w-5 h-5" /> 系统配置中心
        </h2>

        <div className="space-y-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">主题偏好</div>
            <div className="flex bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl p-1.5 gap-1">
              <button onClick={() => onThemeChange('light')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${theme === 'light' ? 'bg-[var(--bg-card)] text-slate-800 shadow-sm border border-[var(--border-card)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-main)]'}`}>浅色模式</button>
              <button onClick={() => onThemeChange('dark')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${theme === 'dark' ? 'bg-[var(--bg-hover)] text-white shadow-sm border border-[var(--border-card)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-main)]'}`}>深色模式</button>
              <button onClick={() => onThemeChange('system')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${theme === 'system' ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm border border-[var(--border-card)]' : 'text-[var(--text-disabled)] hover:text-[var(--text-main)]'}`}>跟随系统</button>
            </div>
          </div>

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
                  onChange={e => onSetupUrlChange(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-green-500 transition-colors"
                  placeholder="https://xxx.supabase.co"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-disabled)]">VITE_SUPABASE_ANON_KEY</label>
                <input
                  type="password"
                  value={setupKey}
                  onChange={e => onSetupKeyChange(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-green-500 transition-colors"
                  placeholder="eyJh..."
                />
              </div>
              <p className="text-[10px] text-[var(--text-disabled)] leading-relaxed bg-[var(--bg-hover)] p-3 rounded-lg border border-[var(--border-card)]">
                填入以上配置后，还需要使用 Supabase Auth 邮箱密码登录，系统才会把生成记录保存到云端。anon key 可以放在浏览器端；service role key 不要填写在这里。
              </p>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2 mt-4 border-t border-[var(--border-card)] pt-4">
              云端账号登录
              {signedInEmail ? (
                <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded ml-auto">已登录</span>
              ) : (
                <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded ml-auto">未登录</span>
              )}
            </div>
            {signedInEmail ? (
              <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] p-4">
                <div className="text-sm text-[var(--text-main)] break-all">{signedInEmail}</div>
                <button onClick={onSignOut} className="w-fit px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20">退出登录</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[var(--text-disabled)]">登录邮箱</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={e => onAuthEmailChange(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-green-500 transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[var(--text-disabled)]">登录密码</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={e => onAuthPasswordChange(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-green-500 transition-colors"
                    placeholder="输入密码"
                    autoComplete="current-password"
                  />
                </div>
                <button onClick={onSignIn} className="px-5 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-full hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all">登录云端账号</button>
              </div>
            )}
          </div>

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
                  onChange={e => onHistoryApiUrlChange(e.target.value)}
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
          <button onClick={onClearHistory} className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20">清空本地历史</button>
          <div className="flex justify-end gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">取消</button>
            <button onClick={onSave} className="px-6 py-2.5 bg-green-600 text-white font-semibold text-sm rounded-full hover:bg-green-700 shadow-lg shadow-green-500/20 transition-all">保存配置并重载</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
