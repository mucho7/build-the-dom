"use client";

import { useState } from "react";
import { getMockGameAssessment, mockGames } from "@/data/mock-games";

export default function Home() {
  const [selectedGame, setSelectedGame] = useState(mockGames[0].id);
  const game = mockGames.find((item) => item.id === selectedGame) ?? mockGames[0];
  const assessment = getMockGameAssessment(game);
  const cardStyle = {
    safe: "bg-[#183b2a]",
    prepare: "bg-[#31523a]",
    caution: "bg-[#765a1b]",
    risky: "bg-[#782e2a]",
  }[assessment.level];
  const icon = assessment.level === "risky" ? "🌧️" : assessment.level === "caution" ? "🌦️" : assessment.level === "prepare" ? "🌂" : "🌤️";

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-5 py-6 text-[#182017] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-xl">
        <header className="mb-9 flex items-center justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-[#697367]">KBO 직관 날씨 가이드</p>
            <h1 className="text-2xl font-bold tracking-[-0.05em]">우취될까?</h1>
          </div>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#e4eddc] text-xl" aria-label="비 예보">
            ☂️
          </div>
        </header>

        <section aria-label="경기 선택" className="mb-5">
          <p className="mb-3 text-sm font-semibold">어느 경기를 보러 가나요?</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
            {mockGames.map((item) => {
              const isSelected = item.id === selectedGame;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedGame(item.id)}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                    isSelected
                      ? "border-[#182017] bg-[#182017] text-white shadow-sm"
                      : "border-[#dfe3db] bg-white text-[#596157] hover:border-[#a3ad9e]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className={`overflow-hidden rounded-[28px] text-white shadow-[0_18px_45px_rgba(24,59,42,0.16)] ${cardStyle}`}>
          <div className="border-b border-white/15 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#c8d8c6]">오늘 · {game.time}</p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">{game.label}</h2>
                <p className="mt-1 text-sm text-[#c8d8c6]">{game.stadium}</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#d9ebd5]">예보 기준 11:00</span>
            </div>
          </div>

          <div className="px-6 py-9 text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[#d9f071] text-4xl shadow-[0_8px_22px_rgba(0,0,0,0.14)]">
              {icon}
            </div>
            <p className="mt-6 text-sm font-semibold text-[#d9f071]">{assessment.label}</p>
            <h3 className="mt-2 text-[34px] font-bold tracking-[-0.075em]">{assessment.headline}</h3>
            <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-6 text-[#d8e5d6]">
              {assessment.summary}
            </p>
          </div>

          <div className="grid grid-cols-3 border-t border-white/15 bg-black/10">
            <Fact label="경기 전 비" value={game.weather.rainBeforeGameLabel} />
            <Fact label="경기 중 비" value={game.weather.rainDuringGameLabel} />
            <Fact label="구장" value={game.stadiumType} />
          </div>
        </section>

        <section className="mt-5 rounded-[24px] border border-[#e3e6e0] bg-white p-5">
          <div className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eef3e9] text-sm">💡</span>
            <div>
              <h2 className="font-semibold tracking-[-0.035em]">이렇게 준비하면 좋아요</h2>
              <p className="mt-1.5 text-sm leading-6 text-[#687167]">
                {assessment.preparation}
              </p>
            </div>
          </div>
        </section>

        <p className="px-3 pt-6 text-center text-xs leading-5 text-[#8a9388]">
          날씨 예보는 바뀔 수 있어요. 최종 경기 진행 여부는 KBO 공식 공지를 확인해 주세요.
        </p>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-5 text-center [&:not(:last-child)]:border-r [&:not(:last-child)]:border-white/15">
      <p className="text-xs text-[#b7cbb7]">{label}</p>
      <p className="mt-1.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
