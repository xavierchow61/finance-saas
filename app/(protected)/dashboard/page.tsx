import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LogoutButton from "./LogoutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 md:p-8 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-3xl mb-2">🔔🐱</div>
              <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700">
                哆啦理財
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                個人財務 SaaS
              </p>
            </div>
            <LogoutButton />
          </div>

          {/* User info */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="text-sm text-slate-600">
              已登入：
              <span className="font-semibold text-slate-800 ml-1">
                {user.email}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">
              user_id: {user.id}
            </div>
          </div>
        </div>

        {/* Empty state */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-3">🚧</div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">
            Phase 0 完成 — Auth 已通
          </h2>
          <p className="text-slate-500 mb-6">
            下一步：Phase 1 將加入「帳戶管理」module
          </p>

          {/* Coming soon list */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {[
              { icon: "🏦", label: "帳戶管理", status: "Phase 1" },
              { icon: "💰", label: "個人記賬", status: "Phase 2" },
              { icon: "🎯", label: "預算追蹤", status: "Phase 3" },
              { icon: "📈", label: "財務報表", status: "Phase 4" },
              { icon: "🏢", label: "公司報銷", status: "Phase 5" },
              { icon: "💳", label: "信用卡", status: "Phase 6" },
              { icon: "💸", label: "貸款管理", status: "Phase 7" },
              { icon: "📱", label: "Mobile App", status: "Phase 8" },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4"
              >
                <div className="text-2xl mb-1">{m.icon}</div>
                <div className="text-sm font-semibold text-slate-700">
                  {m.label}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {m.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
