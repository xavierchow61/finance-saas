import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractInvoice } from "@/lib/gemini";

export const maxDuration = 60; // Vercel：畀 Gemini 多啲時間

/**
 * POST /api/extract
 * Body: multipart/form-data，欄位 "file"（圖片或 PDF）
 * Return: ExtractedInvoice JSON
 */
export async function POST(request: Request) {
  // 1. 驗證登入（防止匿名濫用 API）
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  // 2. 攞檔案
  let file: File | null = null;
  try {
    const form = await request.formData();
    file = form.get("file") as File | null;
  } catch {
    return NextResponse.json(
      { error: "無法解析上傳檔案" },
      { status: 400 },
    );
  }
  if (!file) {
    return NextResponse.json({ error: "冇收到檔案" }, { status: 400 });
  }

  // 3. 檔案 → base64
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "application/pdf",
  ];
  const mimeType = file.type || "image/jpeg";
  if (!allowed.includes(mimeType)) {
    return NextResponse.json(
      { error: `唔支援嘅檔案類型：${mimeType}` },
      { status: 400 },
    );
  }
  // 上限 10 MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "檔案太大（上限 10 MB）" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  // 4. Call Gemini
  try {
    const result = await extractInvoice(base64, mimeType);
    return NextResponse.json({ ok: true, data: result });
  } catch (ex: unknown) {
    const msg = ex instanceof Error ? ex.message : String(ex);
    return NextResponse.json(
      { error: `AI 提取失敗：${msg}` },
      { status: 500 },
    );
  }
}
