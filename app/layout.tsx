import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "訪問看護 自動スケジュール最適化ツール",
  description: "訪問看護サービス向けの動的自動スケジューラー"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
