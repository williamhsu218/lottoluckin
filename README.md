# 大乐透猜猜猜

大乐透猜猜猜是一个基于 React + Vite 的大乐透号码生成和购买记录工具。它支持随机选号、走势分析、易经理数、历史开奖记录同步、购买记录回测和中奖结果估算。

> 仅供娱乐和个人记录使用，不构成任何购彩建议。

## 功能

- 多种彩票套餐：单式和常见复式组合
- 三种生成模式：随机漫步、走势分析、易经理数
- 开奖历史抓取：优先使用 Sporttery 接口，失败后回退到 500.com 抓取
- 购买记录：游客模式写入浏览器本地存储，配置 Supabase 后可跨设备保存
- 中奖回测：按大乐透中奖等级规则展开复式票并计算命中结果
- 趋势图：历史开奖频率图表按需加载，降低首屏体积

## 技术栈

- React 19
- Vite 8
- TypeScript
- Tailwind CSS
- Express
- Netlify Functions
- Supabase
- Google Gemini 或 OpenAI-compatible LLM API
- Vitest

## 本地运行

```bash
npm install
npm run dev
```

默认服务地址是 `http://localhost:3000`。

## 环境变量

复制 `.env.example` 为 `.env.local` 或 `.env`，按需填写。

```bash
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
GEMINI_MODEL_NAME="gemini-3.1-pro-preview"

LLM_API_URL=""
LLM_API_KEY=""
LLM_MODEL_NAME=""
```

AI 密钥只在服务端使用。前端会请求 `/api/ai/generate`，不会把 Gemini 或 LLM key 存入浏览器。

Supabase URL 和 anon key 仍由界面设置写入浏览器本地存储；这是浏览器端允许使用的公开 key。云端生成记录需要先通过 Supabase Auth 邮箱密码登录，应用会按登录用户写入 `draw_history.user_id`，不会使用邮箱验证码或魔法链接。

## Supabase 表结构

个人使用时，可以先在 Supabase SQL Editor 中创建两张表：

```sql
create table if not exists draw_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  front text not null,
  back text default '[]',
  excluded text default '{}',
  purchased boolean default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists official_draws (
  lotteryDrawNum text primary key,
  lotteryDrawResult text not null,
  lotteryDrawTime text not null,
  poolBalanceAfterdraw text
);
```

本仓库包含一份安全加固迁移：

```text
supabase/migrations/20260613091831_harden_lottoluck_rls.sql
```

这份迁移会：

- 为 `draw_history` 增加 `user_id` 并启用 RLS
- 让用户只能读写自己的生成记录
- 移除 `official_draws` 的公开写入策略
- 保留 `official_draws` 对匿名和登录用户的公开只读访问

建议先部署包含 Supabase Auth 登录的应用版本，再应用这份迁移。旧的无 `user_id` 记录会在 RLS 下默认不可见，可以按需要手动归属给某个用户。

## 常用命令

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run start
```

## 部署

Netlify 部署时使用 `netlify.toml` 中的重定向：

- `/api/lottery/history` -> `/.netlify/functions/history`
- `/api/ai/generate` -> `/.netlify/functions/ai`

部署环境中配置 `GEMINI_API_KEY`，或者配置兼容 OpenAI 的 `LLM_API_URL`、`LLM_API_KEY`、`LLM_MODEL_NAME`。

## 项目结构

```text
src/
  App.tsx                  # 主界面和业务交互
  components/TrendChart.tsx # 按需加载的趋势图
  shared/lottery.ts        # 彩票套餐、组合展开、中奖等级规则
  shared/ai.ts             # AI prompt 和响应解析
  server/ai-service.ts     # Express AI 服务逻辑
  server/lottery-data.cjs  # 开奖历史和奖池抓取
netlify/functions/
  ai.js
  history.js
```

## 测试范围

当前单元测试覆盖：

- 组合展开
- 大乐透中奖等级映射
- AI prompt 生成
- AI JSON/Markdown 响应解析

后续建议继续补充购买时间和开奖日匹配、奖金金额估算、Supabase 读写边界测试。
