import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "哆啦理財 — 個人財務 SaaS",
  description: "AI 單據提取 + 雙式記賬 + 多用戶雲端同步",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
