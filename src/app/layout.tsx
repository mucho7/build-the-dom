import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우취될까? | KBO 직관 날씨 가이드",
  description: "경기 시간대 날씨를 바탕으로 직관 준비를 돕습니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
