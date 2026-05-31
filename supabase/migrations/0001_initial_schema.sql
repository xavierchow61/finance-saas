-- ============================================================
-- finance-saas Initial Schema (Phase 0)
-- ============================================================
-- 用 RLS（Row Level Security）做多用戶隔離。
-- 每張表都有 user_id UUID 欄 → auth.users(id)，policy 強制
-- user_id = auth.uid() 先可以 SELECT/INSERT/UPDATE/DELETE。
--
-- 跑法：
--   1. Supabase Studio → SQL Editor → New query
--   2. 貼入整個檔案 → Run
--   3. 確認尾部 SELECT 出 11 張表都有 rls_enabled = true
-- ============================================================

-- ============ ACCOUNTS（帳戶 master）============
CREATE TABLE IF NOT EXISTS public.accounts (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL,         -- asset/liability/expense/income
    sub_type TEXT,                       -- 銀行/現金/投資/...
    parent_code TEXT,                    -- 父帳戶 code（樹狀結構）
    opening_balance NUMERIC(15, 2) DEFAULT 0,
    currency TEXT DEFAULT 'HKD',
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    color TEXT,
    icon TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, code)
);

-- ============ PROJECTS（標籤式專案）============
CREATE TABLE IF NOT EXISTS public.projects (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id BIGINT NOT NULL,           -- 由 app 生成（per-user MAX+1）
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    total_budget NUMERIC(15, 2),
    status TEXT DEFAULT 'active',
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, project_id)
);

-- ============ INVOICES（單據）============
CREATE TABLE IF NOT EXISTS public.invoices (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_id BIGINT NOT NULL,
    purchase_date DATE,
    store_name TEXT,
    category TEXT,
    expense_type TEXT DEFAULT '私人',     -- 私人/公司報銷/可扣稅
    reimbursed BOOLEAN DEFAULT false,
    total_amount NUMERIC(15, 2),
    currency TEXT DEFAULT 'HKD',
    payment_method TEXT,
    items_json JSONB,                    -- 用 JSONB（PG native）
    tax NUMERIC(15, 2),
    receipt_number TEXT,
    notes TEXT,
    source_file TEXT,
    image_path TEXT,
    extracted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, invoice_id)
);

-- ============ JOURNAL ENTRIES（分錄 header）============
CREATE TABLE IF NOT EXISTS public.journal_entries (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_id BIGINT NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT,
    invoice_id BIGINT,                    -- 鬆綁，唔強制 FK
    project_id BIGINT,
    notes TEXT,
    currency TEXT DEFAULT 'HKD',
    fx_rate NUMERIC(10, 6) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, entry_id),
    FOREIGN KEY (user_id, project_id)
        REFERENCES public.projects(user_id, project_id) ON DELETE SET NULL
);

-- ============ JOURNAL LINES（分錄 lines，雙式記賬）============
CREATE TABLE IF NOT EXISTS public.journal_lines (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    line_id BIGINT NOT NULL,
    entry_id BIGINT NOT NULL,
    account_code TEXT NOT NULL,
    debit NUMERIC(15, 2) DEFAULT 0,
    credit NUMERIC(15, 2) DEFAULT 0,
    PRIMARY KEY (user_id, line_id),
    FOREIGN KEY (user_id, entry_id)
        REFERENCES public.journal_entries(user_id, entry_id)
        ON DELETE CASCADE,
    FOREIGN KEY (user_id, account_code)
        REFERENCES public.accounts(user_id, code)
);

-- ============ BUDGETS（預算）============
CREATE TABLE IF NOT EXISTS public.budgets (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    period TEXT NOT NULL,                 -- 'YYYY-MM' 或 'YYYY'
    amount NUMERIC(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, account_code, period),
    FOREIGN KEY (user_id, account_code)
        REFERENCES public.accounts(user_id, code) ON DELETE CASCADE
);

-- ============ CLOSED PERIODS（期間鎖定）============
CREATE TABLE IF NOT EXISTS public.closed_periods (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    closed_by TEXT,
    notes TEXT,
    PRIMARY KEY (user_id, period)
);

-- ============ PAYMENT ALIASES（付款方式對應）============
CREATE TABLE IF NOT EXISTS public.payment_aliases (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    account_code TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, keyword),
    FOREIGN KEY (user_id, account_code)
        REFERENCES public.accounts(user_id, code) ON DELETE CASCADE
);

-- ============ FX RATES ============
CREATE TABLE IF NOT EXISTS public.fx_rates (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    rate_to_hkd NUMERIC(15, 6) NOT NULL,
    as_of_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, currency, as_of_date)
);

-- ============ CREDIT CARDS ============
CREATE TABLE IF NOT EXISTS public.credit_cards (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    card_last4 TEXT,
    credit_limit NUMERIC(15, 2),
    statement_day INT,
    due_day INT,
    interest_rate NUMERIC(6, 4),
    annual_fee NUMERIC(15, 2),
    rewards TEXT,
    rewards_rate NUMERIC(6, 4),
    rewards_type TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, account_code),
    FOREIGN KEY (user_id, account_code)
        REFERENCES public.accounts(user_id, code) ON DELETE CASCADE
);

-- ============ LOANS ============
CREATE TABLE IF NOT EXISTS public.loans (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    loan_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    loan_type TEXT NOT NULL,              -- mortgage/auto/personal/instalment
    bank TEXT,
    principal NUMERIC(15, 2) NOT NULL,
    interest_rate NUMERIC(6, 4) NOT NULL,
    term_months INT NOT NULL,
    monthly_payment NUMERIC(15, 2),
    start_date DATE NOT NULL,
    due_day INT,
    account_code TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, loan_id)
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closed_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES — 每張表 4 條（SELECT/INSERT/UPDATE/DELETE）
-- 規則：只能讀寫自己（user_id = auth.uid()）嘅 row
-- ============================================================
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'accounts', 'projects', 'invoices', 'journal_entries',
        'journal_lines', 'budgets', 'closed_periods',
        'payment_aliases', 'fx_rates', 'credit_cards', 'loans'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT '
            'USING (user_id = auth.uid())',
            t || '_select_own', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR INSERT '
            'WITH CHECK (user_id = auth.uid())',
            t || '_insert_own', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR UPDATE '
            'USING (user_id = auth.uid()) '
            'WITH CHECK (user_id = auth.uid())',
            t || '_update_own', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR DELETE '
            'USING (user_id = auth.uid())',
            t || '_delete_own', t);
    END LOOP;
END $$;

-- ============================================================
-- VERIFY
-- ============================================================
SELECT
    tablename,
    rowsecurity AS rls_enabled,
    (SELECT count(*) FROM pg_policies p
     WHERE p.schemaname='public' AND p.tablename = t.tablename) AS policies
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;
-- 期望：11 張表，每張 rls_enabled=true, policies=4
