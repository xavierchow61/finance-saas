-- ============================================================
-- Migration 0003: 單據圖片 Storage bucket + RLS
-- ============================================================
-- 跑法：Supabase Studio → SQL Editor → 貼入 → Run
-- ============================================================

-- 1. 建 private bucket（如未存在）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,                              -- private（要 RLS + signed URL）
  10485760,                          -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies — 只能存取自己 folder（路徑首段 = user_id）
--    路徑格式：<user_id>/<檔名>
--    storage.foldername(name)[1] = 第一層 folder = user_id

CREATE POLICY "receipts_select_own"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "receipts_insert_own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "receipts_update_own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "receipts_delete_own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 驗證
SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'receipts';
