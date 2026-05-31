# 哆啦理財 — finance-saas（v2 from scratch）

個人財務 SaaS — Next.js 15 + Supabase + Tailwind + React Native（Mobile，Phase 8）

## 🎯 目標

> 取代舊 Streamlit app（Extract invoice），用 modern stack 重寫，
> 提供：多用戶、雲端同步、Mobile App、毫秒級互動。

舊 app 仲 work：`C:\Users\xavie\Extract invoice\` — 純 Python + Streamlit。

## 🛠️ Stack

| 層 | 技術 |
|---|---|
| Web 前端 | Next.js 15 + React 19 + TypeScript + Tailwind |
| Backend / DB | Supabase（PostgreSQL + Auth + Storage） |
| 多用戶隔離 | Row Level Security (RLS) |
| 部署 | Vercel（Web）+ Expo EAS（Mobile）|
| Mobile（Phase 8）| React Native + Expo |

---

## 🚀 Phase 0 設定（今晚做完）

### 1. 裝 Node + dependencies
```powershell
# 確認 Node 20+
node -v

cd C:\Users\xavie\finance-saas
npm install
```

### 2. 建立 Supabase Project

> **建議**：開新 project，唔好用舊 Extract invoice 嘅同個 Supabase（避免互相干擾）。

1. https://supabase.com/dashboard → New project
2. Region 揀 `Southeast Asia (Singapore)` 同舊一樣
3. Database password 自己揀，記低
4. 等 1-2 分鐘 provision 完成
5. 入 **Settings → API**，攞兩個值：
   - `Project URL` → 即係 `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → 即係 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. 跑 Migration（建立 schema + RLS）

1. Supabase Studio → **SQL Editor** → **New query**
2. 開 `supabase/migrations/0001_initial_schema.sql` copy 全文
3. 貼入 → Run
4. 等 5 秒，確認尾部 SELECT 顯示 11 張表都 `rls_enabled = true`、`policies = 4`

### 4. 開 Auth provider

Supabase Studio → **Authentication → Sign In / Up → Email**:
- 開啟 「Confirm email」（建議）或關咗（更快測試）
- Magic Link → 同樣可以
- **Site URL** 設 `http://localhost:3000`（本地）+ Vercel URL（部署後加）

### 5. 設環境變數

```powershell
cp .env.local.example .env.local
# 編輯 .env.local 填入 Supabase URL + anon key
```

### 6. 本機行
```powershell
npm run dev
```

打開 http://localhost:3000：
- 應該 redirect 到 `/login`
- 註冊一個 account（或 Magic Link）
- 登入後跳 `/dashboard` 見到 user email + 8 個 Phase placeholder

### 7. 部署去 Vercel

1. Push 個 repo 上 GitHub（**新 repo**，例如 `finance-saas`）
2. https://vercel.com/new → Import → 揀個 repo
3. **Environment Variables** 填埋 `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → 通常 1-2 分鐘
5. **重要**：返 Supabase → Authentication → Site URL → 加埋 Vercel URL（例 `https://finance-saas.vercel.app`）

完成！🎉

---

## 📋 Phase 路線圖

| Phase | 內容 | 預計周末 |
|---|---|---|
| 0 ✅ | 建立 repo + Auth + Dashboard skeleton + RLS schema | 1 |
| 1 | 帳戶管理（CRUD + 父子樹 + 子分類）| 1 |
| 2 | 個人記賬（雙式分錄 + 帳戶總覽）| 2 |
| 3 | AI 單據提取（Gemini）+ 自動入賬 | 2 |
| 4 | 預算 + 報表（P&L + 資產負債表）| 2 |
| 5 | 公司報銷 + AR 工作流 | 1 |
| 6 | 信用卡 + 還款行事曆 + 回贈 | 1 |
| 7 | 貸款 EMI 試算 + 還款追蹤 | 1 |
| 8 | Mobile App（React Native + Expo）| 3-5 |

---

## 📁 Repo 結構

```
finance-saas/
├── app/                       # Next.js 15 App Router
│   ├── (protected)/           # 受保護 routes（須 login）
│   │   └── dashboard/
│   ├── auth/callback/         # Supabase OAuth/Magic Link callback
│   ├── login/                 # 登入頁
│   ├── layout.tsx             # Root layout
│   ├── globals.css            # 全域 CSS（含 Doraemon gradient）
│   └── page.tsx               # 根路徑 → redirect
├── lib/
│   └── supabase/              # Supabase client wrappers
│       ├── client.ts          # Browser
│       ├── server.ts          # Server Component / Action
│       └── middleware.ts      # Edge middleware
├── middleware.ts              # Next.js middleware（route protection）
├── supabase/
│   └── migrations/            # SQL migrations
│       └── 0001_initial_schema.sql
├── tailwind.config.ts         # 哆啦 A 夢主題色
└── package.json
```

---

## 🔒 Security 設計

1. **Row Level Security (RLS)** — 每張表 enable，policies 強制 `user_id = auth.uid()`
2. **Anon key** — 只放公開 site URL；無 service role key 上 client
3. **Middleware** — 每個 request refresh session + redirect 未登入
4. **Server Components** — 預設 server-side render，敏感資料不會 leak 去 browser bundle

---

## 🧪 本地開發

```powershell
npm run dev          # 開 dev server (http://localhost:3000)
npm run build        # production build
npm run start        # 跑 production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

---

## 🐞 Troubleshooting

- **`Module not found '@/lib/...'`** → 確認 `tsconfig.json` 嘅 `paths` 設定咗 `@/*`
- **登入後仍 redirect 去 /login** → 檢查 Supabase Site URL 包含目前 origin
- **Magic Link 點完 redirect 失敗** → 檢查 `/auth/callback/route.ts` 有冇 deploy；確認 Site URL 設正確
- **CORS 錯誤** → Supabase 預設允許所有 origin，唔應該見；如有 → Settings → API → CORS

---

## 🤝 Contributing（畀未來嘅自己）

呢個 repo follow Next.js 15 conventions + Supabase best practices。
每個 phase 完成後：
1. 新一個 git branch
2. Run `npm run type-check` 同 `npm run lint`
3. Merge 入 main → Vercel auto deploy
