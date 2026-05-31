"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage("✉️ 已寄出 Magic Link，請查閱電郵");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        // Middleware 會 redirect 去 /dashboard
        window.location.href = "/dashboard";
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage(
          "✅ 註冊成功！請查閱電郵點擊確認連結，然後返回登入",
        );
      }
    } catch (ex: unknown) {
      const msg = ex instanceof Error ? ex.message : String(ex);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🔔🐱</div>
          <h1 className="text-2xl font-bold text-doraemon-700">
            哆啦理財
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            個人財務 SaaS · 多裝置雲端同步
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-6 bg-slate-100 rounded-lg p-1">
          {(["signin", "signup", "magic"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setMessage(null);
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                mode === m
                  ? "bg-white text-doraemon-700 shadow"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m === "signin" && "登入"}
              {m === "signup" && "註冊"}
              {m === "magic" && "Magic Link"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              電郵
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-doraemon-500 focus:border-transparent outline-none"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          {mode !== "magic" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                密碼
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-doraemon-500 focus:border-transparent outline-none"
                placeholder="至少 6 個字元"
                disabled={loading}
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ❌ {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-doraemon-500 hover:bg-doraemon-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading
              ? "處理中..."
              : mode === "signin"
              ? "登入"
              : mode === "signup"
              ? "註冊"
              : "寄出 Magic Link"}
          </button>
        </form>
      </div>
    </div>
  );
}
