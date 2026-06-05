import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "哆啦理財 — 個人財務",
  description: "AI 單據提取 + 雙式記賬 + 多裝置雲端同步",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true, // iOS：加主畫面後全螢幕（冇 Safari 網址列）
    statusBarStyle: "black-translucent",
    title: "哆啦理財",
  },
  icons: {
    icon: "/icons/favicon-32.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#00A6E0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // 防止 iOS 雙擊放大（更似 native）
  userScalable: false,
  viewportFit: "cover", // 配合 iPhone 瀏海 / 圓角
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
