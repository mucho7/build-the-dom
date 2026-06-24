import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://build-the-dom.vercel.app"),
  title: "우취될까? | KBO 직관 날씨 가이드",
  description: "경기 시간대 날씨를 바탕으로 직관 준비를 돕습니다.",
  openGraph: {
    title: "우취될까? | KBO 직관 날씨 가이드",
    description: "야구장 가기 전, 날씨부터 확인해요.",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/og.png", width: 1774, height: 887, alt: "우취될까? 야구장 직관 날씨 가이드" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "우취될까? | KBO 직관 날씨 가이드",
    description: "야구장 가기 전, 날씨부터 확인해요.",
    images: ["/og.png"],
  },
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
