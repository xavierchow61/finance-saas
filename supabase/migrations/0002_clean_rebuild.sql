-- ============================================================
-- finance-saas Clean Rebuild (Phase 1+2)
-- ============================================================
-- 改進 0001：
--   1. 用 PG identity keys（auto-increment）取代 app-generated id
--      → 避免並發撞 id
--   2. user_id 用 DEFAULT auth.uid()
--      → client INSERT 時唔使每次都傳 user_id
--   3. RLS WITH CHECK 仍然保護（只可以插/改自己嘅 row）
--
-- ⚠️ 因為係全新 app 冇資料，直接 DROP + CREATE（idempotent）。
--
-- 跑法：Supabase Studio → SQL Editor → 貼入 → Run
-- ============================================================

-- ============ DROP（順序：child 先）============
DROP TABLE IF EXISTS public.journal_lines CASCADE;
DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.closed_periods CASCADE;
DROP TABLE IF EXISTS public.payment_aliases CASCADE;
DROP TABLE IF EXISTS public.fx_rates CASCADE;
DROP TABLE IF EXISTS public.credit_cards CASCADE;
DROP TABLE IF EXISTS public.loans CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;


-- ============ ACCOUNTS（帳戶 master）============
CREATE TABLE public.accounts (
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL,          -- asset/liability/expense/income
    sub_type TEXT,                        -- 銀行/現金/投資/應收戶口/...
    parent_code TEXT,                     -- 父帳戶 code
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

-- ============ PROJECTS ============
CREATE TABLE public.projects (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    total_budget NUMERIC(15, 2),
    status TEXT DEFAULT 'active',
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_projects_user ON public.projects(user_id);

-- ============ INVOICES（單據）============
CREATE TABLE public.invoices (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    purchase_date DATE,
    store_name TEXT,
    category TEXT,
    expense_type TEXT DEFAULT '私人',
    reimbursed BOOLEAN DEFAULT false,
    total_amount NUMERIC(15, 2),
    currency TEXT DEFAULT 'HKD',
    payment_method TEXT,
    items_json JSONB,
    tax NUMERIC(15, 2),
    receipt_number TEXT,
    notes TEXT,
    source_file TEXT,
    image_path TEXT,
    extracted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_invoices_user_date
    ON public.invoices(user_id, purchase_date);

-- ============ JOURNAL ENTRIES（分錄 header）============
CREATE TABLE public.journal_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    description TEXT,
    invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE SET NULL,
    project_id BIGINT REFERENCES public.projects(id) ON DELETE SET NULL,
    notes TEXT,
    currency TEXT DEFAULT 'HKD',
    fx_rate NUMERIC(10, 6) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_je_user_date
    ON public.journal_entries(user_id, entry_date);

-- ============ JOURNAL LINES（分錄 lines，雙式記賬）============
CREATE TABLE public.journal_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_id BIGINT NOT NULL
        REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    debit NUMERIC(15, 2) DEFAULT 0,
    credit NUMERIC(15, 2) DEFAULT 0,
    FOREIGN KEY (user_id, account_code)
        REFERENCES public.accounts(user_id, code)
);
CREATE INDEX idx_jl_user_entry
    ON public.journal_lines(user_id, entry_id);
CREATE INDEX idx_jl_user_account
    ON public.journal_lines(user_id, account_code);

-- ============ BUDGETS ============
CREATE TABLE public.budgets (
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    period TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, account_code, period),
    FOREIGN KEY (user_id, account_code)
        REFERENCES public.accounts(user_id, code) ON DELETE CASCADE
);

-- ============ CLOSED PERIODS ============
CREATE TABLE public.closed_periods (
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    closed_by TEXT,
    notes TEXT,
    PRIMARY KEY (user_id, period)
);

-- ============ PAYMENT ALIASES ============
CREATE TABLE public.payment_aliases (
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    account_code TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, keyword),
    FOREIGN KEY (user_id, account_code)
        REFERENCES public.accounts(user_id, code) ON DELETE CASCADE
);

-- ============ FX RATES ============
CREATE TABLE public.fx_rates (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    rate_to_hkd NUMERIC(15, 6) NOT NULL,
    as_of_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, currency, as_of_date)
);

-- ============ CREDIT CARDS ============
CREATE TABLE public.credit_cards (
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE TABLE public.loans (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    loan_type TEXT NOT NULL,
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_loans_user_status ON public.loans(user_id, status);


-- ============================================================
-- ENABLE RLS + POLICIES
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
            'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT '
            'USING (user_id = auth.uid())', t || '_sel', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR INSERT '
            'WITH CHECK (user_id = auth.uid())', t || '_ins', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR UPDATE '
            'USING (user_id = auth.uid()) '
            'WITH CHECK (user_id = auth.uid())', t || '_upd', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR DELETE '
            'USING (user_id = auth.uid())', t || '_del', t);
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
