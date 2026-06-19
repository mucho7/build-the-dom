"use client";

import { useEffect, useMemo, useState } from "react";
import { getStadiumByKboName } from "@/data/stadiums";
import type { KboGame } from "@/lib/kbo-schedule";
import type { RiskAssessment } from "@/lib/risk";

type WeatherResponse = {
  issuedAt: string;
  stadium: { isDome: boolean };
  forecast: {
    precipitationProbability: number;
    precipitationAmountMm: number;
    rainBeforeGame: boolean;
  };
  risk: RiskAssessment;
  history: { totalGames: number; rainCancelledGames: number; rainoutRate: number } | null;
};

export default function Home() {
  const today = useMemo(() => getKoreanDate(), []);
  const [games, setGames] = useState<KboGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [isGamesLoading, setIsGamesLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);

  const selectedGame = games.find((game) => game.id === selectedGameId) ?? null;

  useEffect(() => {
    const controller = new AbortController();

    async function loadGames() {
      try {
        setIsGamesLoading(true);
        const response = await fetch(`/api/games?year=${today.year}&month=${today.month}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { games?: KboGame[]; message?: string };
        if (!response.ok || !data.games) throw new Error(data.message ?? "경기 일정을 불러오지 못했습니다.");

        const upcomingGames = data.games
          .filter((game) => game.status === "scheduled" && game.date >= today.date)
          .slice(0, 5);
        setGames(upcomingGames);
        setSelectedGameId(upcomingGames[0]?.id ?? null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGamesError(error instanceof Error ? error.message : "경기 일정을 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setIsGamesLoading(false);
      }
    }

    void loadGames();
    return () => controller.abort();
  }, [today]);

  useEffect(() => {
    const game = selectedGame;
    if (!game) return;

    const controller = new AbortController();
    async function loadWeather(selected: KboGame) {
      const stadium = getStadiumByKboName(selected.stadium);
      if (!stadium) {
        setWeather(null);
        setWeatherError("이 구장의 예보 위치를 아직 준비하고 있어요.");
        return;
      }

      try {
        setIsWeatherLoading(true);
        setWeatherError(null);
        setWeather(null);
        const response = await fetch(
          `/api/weather?stadium=${stadium.id}&date=${selected.date.replaceAll("-", "")}&time=${selected.startTime}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as WeatherResponse & { message?: string };
        if (!response.ok) throw new Error(data.message ?? "예보를 불러오지 못했습니다.");
        setWeather(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setWeatherError(error instanceof Error ? error.message : "예보를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setIsWeatherLoading(false);
      }
    }

    void loadWeather(game);
    return () => controller.abort();
  }, [selectedGame]);

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
          <p className="mb-3 text-sm font-semibold">가장 가까운 경기를 골라보세요</p>
          {isGamesLoading ? (
            <div className="h-11 animate-pulse rounded-full bg-[#e6eae3]" />
          ) : gamesError ? (
            <p className="rounded-2xl bg-[#fff0ed] px-4 py-3 text-sm text-[#9d3728]">{gamesError}</p>
          ) : games.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#687167]">예정된 경기가 없어요.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
              {games.map((game) => {
                const isSelected = game.id === selectedGameId;
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => setSelectedGameId(game.id)}
                    className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                      isSelected
                        ? "border-[#182017] bg-[#182017] text-white shadow-sm"
                        : "border-[#dfe3db] bg-white text-[#596157] hover:border-[#a3ad9e]"
                    }`}
                  >
                    {game.awayTeam} vs {game.homeTeam}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedGame ? (
          <RiskCard
            game={selectedGame}
            weather={weather}
            isLoading={isWeatherLoading}
            error={weatherError}
          />
        ) : (
          <EmptyCard />
        )}

        <p className="px-3 pt-6 text-center text-xs leading-5 text-[#8a9388]">
          날씨 예보는 바뀔 수 있어요. 최종 경기 진행 여부는 KBO 공식 공지를 확인해 주세요.
        </p>
      </div>
    </main>
  );
}

function RiskCard({
  game,
  weather,
  isLoading,
  error,
}: {
  game: KboGame;
  weather: WeatherResponse | null;
  isLoading: boolean;
  error: string | null;
}) {
  const assessment = weather?.risk;
  const cardStyle = assessment
    ? { safe: "bg-[#183b2a]", prepare: "bg-[#31523a]", caution: "bg-[#765a1b]", risky: "bg-[#782e2a]" }[
        assessment.level
      ]
    : "bg-[#48514a]";
  const icon = assessment?.level === "risky" ? "🌧️" : assessment?.level === "caution" ? "🌦️" : assessment?.level === "prepare" ? "🌂" : "🌤️";

  return (
    <>
      <section className={`overflow-hidden rounded-[28px] text-white shadow-[0_18px_45px_rgba(24,59,42,0.16)] ${cardStyle}`}>
        <div className="border-b border-white/15 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-[#c8d8c6]">{formatDateLabel(game.date)} · {game.startTime}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">{game.awayTeam} vs {game.homeTeam}</h2>
              <p className="mt-1 text-sm text-[#c8d8c6]">{game.stadium}</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#d9ebd5]">
              {weather ? `예보 기준 ${formatIssuedTime(weather.issuedAt)}` : "예보 확인 중"}
            </span>
          </div>
        </div>

        <div className="px-6 py-9 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[#d9f071] text-4xl shadow-[0_8px_22px_rgba(0,0,0,0.14)]">{icon}</div>
          {isLoading ? (
            <p className="mt-6 text-sm text-[#d8e5d6]">경기 시간대 예보를 확인하고 있어요.</p>
          ) : error ? (
            <>
              <p className="mt-6 text-sm font-semibold text-[#ffe0a8]">예보 확인 필요</p>
              <h3 className="mt-2 text-2xl font-bold tracking-[-0.055em]">아직 판단하기 어려워요</h3>
              <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-6 text-[#d8e5d6]">{error}</p>
            </>
          ) : assessment ? (
            <>
              <p className="mt-6 text-sm font-semibold text-[#d9f071]">{assessment.label}</p>
              <h3 className="mt-2 text-[34px] font-bold tracking-[-0.075em]">{assessment.headline}</h3>
              <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-6 text-[#d8e5d6]">{assessment.summary}</p>
              {assessment.historicalNote && <p className="mt-3 text-xs text-[#c8d8c6]">{assessment.historicalNote}</p>}
            </>
          ) : null}
        </div>

        <div className="grid grid-cols-3 border-t border-white/15 bg-black/10">
          <Fact label="경기 전 비" value={weather?.forecast.rainBeforeGame ? "있음" : weather ? "없음" : "-"} />
          <Fact label="경기 중 비" value={weather ? `${weather.forecast.precipitationProbability}%` : "-"} />
          <Fact label="구장" value={weather?.stadium.isDome ? "돔" : "야외"} />
        </div>
      </section>

      {assessment && (
        <section className="mt-5 rounded-[24px] border border-[#e3e6e0] bg-white p-5">
          <div className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eef3e9] text-sm">💡</span>
            <div>
              <h2 className="font-semibold tracking-[-0.035em]">이렇게 준비하면 좋아요</h2>
              <p className="mt-1.5 text-sm leading-6 text-[#687167]">{assessment.preparation}</p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function EmptyCard() {
  return (
    <section className="rounded-[28px] bg-white px-6 py-12 text-center shadow-sm">
      <div className="text-4xl">⚾</div>
      <h2 className="mt-5 text-xl font-bold tracking-[-0.05em]">확인할 경기를 골라주세요</h2>
      <p className="mt-2 text-sm leading-6 text-[#687167]">예정된 경기가 보이면 직관 판단을 바로 알려드릴게요.</p>
    </section>
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

function getKoreanDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts();
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
  return { year: value("year"), month: value("month"), date: `${value("year")}-${value("month")}-${value("day")}` };
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(
    new Date(`${date}T00:00:00+09:00`),
  );
}

function formatIssuedTime(issuedAt: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(issuedAt));
}
