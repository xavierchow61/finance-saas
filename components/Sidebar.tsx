"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS } from "@/lib/constants";
import { useState } from "react";

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="w-64 shrink-0 bg-doraemon-700 text-white flex flex-col min-h-screen sticky top-0">
      {/* Brand */}
      <div className="p-6">
        <div className="text-3xl mb-1">🔔🐱</div>
        <div className="text-xl font-bold">哆啦理財</div>
        <div className="text-xs text-doraemon-100 opacity-80">
          PERSONAL FINANCE
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${
                active
                  ? "bg-white text-doraemon-700 shadow-md"
                  : "text-white hover:bg-white/10"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="p-4 mt-auto">
        <div className="bg-white/10 rounded-xl p-3 mb-3">
          <div className="text-xs text-doraemon-100 opacity-80">
            已登入
          </div>
          <div className="text-sm font-medium truncate">{email}</div>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full bg-white text-slate-700 hover:bg-slate-100 font-medium py-2.5 rounded-xl transition disabled:opacity-50"
        >
          {loggingOut ? "登出中..." : "🚪 登出"}
        </button>
      </div>
    </aside>
  );
}
