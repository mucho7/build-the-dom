"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStadiumByKboName } from "@/data/stadiums";
import type { KboGame } from "@/lib/kbo-schedule";
import type { RiskAssessment } from "@/lib/risk";

const FAVORITE_TEAM_STORAGE_KEY = "rainout:favorite-team";
const KBO_TEAMS = ["KIA", "KT", "LG", "NC", "SSG", "두산", "롯데", "삼성", "키움", "한화"];

type WeatherResponse = {
  issuedAt: string;
  stadium: { isDome: boolean };
  forecast: {
    precipitationProbability: number;
    precipitationAmountMm: number;
    rainBeforeGame: boolean;
  };
  risk: RiskAssessment;
  history: { similarGames: number; similarRainCancelledGames: number; rainoutRate: number } | null;
};

export default function Home() {
  const dateOptions = useMemo(() => getKoreanDateOptions(), []);
  const [games, setGames] = useState<KboGame[]>([]);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].date);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [isGamesLoading, setIsGamesLoading] = useState(true);
  const [weatherByDate, setWeatherByDate] = useState<Record<string, Record<string, WeatherResponse>>>({});
  const [weatherErrors, setWeatherErrors] = useState<Record<string, string>>({});
  const [loadingWeatherDate, setLoadingWeatherDate] = useState<string | null>(null);
  const weatherByDateRef = useRef<Record<string, Record<string, WeatherResponse>>>({});
  const loadingWeatherDateRef = useRef<string | null>(null);

  const gamesForSelectedDate = games.filter((game) => game.date === selectedDate);
  const selectedGame = gamesForSelectedDate.find((game) => game.id === selectedGameId)
    ?? getPreferredGame(gamesForSelectedDate, favoriteTeam)
    ?? null;
  const weather = selectedGame ? weatherByDate[selectedDate]?.[selectedGame.id] ?? null : null;
  const weatherError = selectedGame && weatherByDate[selectedDate] ? weatherErrors[selectedDate] ?? (weather ? null : "최신 예보 캐시를 준비하고 있어요. 잠시 후 다시 확인해 주세요.") : weatherErrors[selectedDate] ?? null;
  const isWeatherLoading = Boolean(selectedGame) && loadingWeatherDate === selectedDate && !weatherByDate[selectedDate];

  useEffect(() => {
    const storedTeam = window.localStorage.getItem(FAVORITE_TEAM_STORAGE_KEY);
    if (!storedTeam || !KBO_TEAMS.includes(storedTeam)) return;
    const timer = window.setTimeout(() => setFavoriteTeam(storedTeam), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGames() {
      try {
        setIsGamesLoading(true);
        const months = Array.from(
          new Map(dateOptions.map((option) => [`${option.year}-${option.month}`, option])).values(),
        );
        const responses = await Promise.all(
          months.map((option) =>
            fetch(`/api/games?year=${option.year}&month=${option.month}`, { signal: controller.signal }),
          ),
        );
        const datasets = await Promise.all(
          responses.map(async (response) => {
            const data = (await response.json()) as { games?: KboGame[]; message?: string };
            if (!response.ok || !data.games) throw new Error(data.message ?? "경기 일정을 불러오지 못했습니다.");
            return data.games;
          }),
        );
        const availableDates = new Set(dateOptions.map((option) => option.date));
        const upcomingGames = datasets
          .flat()
          .filter((game) => ["scheduled", "played"].includes(game.status) && availableDates.has(game.date));
        setGames(upcomingGames);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGamesError(error instanceof Error ? error.message : "경기 일정을 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setIsGamesLoading(false);
      }
    }

    void loadGames();
    return () => controller.abort();
  }, [dateOptions]);

  useEffect(() => {
    if (weatherByDateRef.current[selectedDate] || loadingWeatherDateRef.current === selectedDate) return;

    const controller = new AbortController();
    async function loadDateWeather() {
      try {
        loadingWeatherDateRef.current = selectedDate;
        setLoadingWeatherDate(selectedDate);
        setWeatherErrors((current) => ({ ...current, [selectedDate]: "" }));
        const response = await fetch(`/api/weather?date=${selectedDate.replaceAll("-", "")}`, { signal: controller.signal });
        const data = (await response.json()) as { weatherByGameId?: Record<string, WeatherResponse>; message?: string };
        if (!response.ok || !data.weatherByGameId) throw new Error(data.message ?? "예보를 불러오지 못했습니다.");
        weatherByDateRef.current = { ...weatherByDateRef.current, [selectedDate]: data.weatherByGameId };
        setWeatherByDate((current) => ({ ...current, [selectedDate]: data.weatherByGameId! }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setWeatherErrors((current) => ({ ...current, [selectedDate]: error instanceof Error ? error.message : "예보를 불러오지 못했습니다." }));
      } finally {
        if (!controller.signal.aborted) {
          loadingWeatherDateRef.current = null;
          setLoadingWeatherDate((current) => current === selectedDate ? null : current);
        }
      }
    }

    void loadDateWeather();
    return () => controller.abort();
  }, [selectedDate]);

  function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedGameId(getPreferredGame(games.filter((game) => game.date === date), favoriteTeam)?.id ?? null);
  }

  function changeFavoriteTeam(team: string) {
    const nextTeam = team || null;
    setFavoriteTeam(nextTeam);
    if (nextTeam) window.localStorage.setItem(FAVORITE_TEAM_STORAGE_KEY, nextTeam);
    else window.localStorage.removeItem(FAVORITE_TEAM_STORAGE_KEY);
    setSelectedGameId(getPreferredGame(gamesForSelectedDate, nextTeam)?.id ?? null);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-5 py-6 text-[#182017] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-xl">
        <header className="mb-9 flex items-center justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-[#697367]">KBO 직관 날씨 가이드</p>
            <h1 className="text-2xl font-bold tracking-tighter">우취될까?</h1>
          </div>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#e4eddc] text-xl" aria-label="비 예보">
            ☂️
          </div>
        </header>

        <section aria-label="경기 선택" className="mb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">언제 직관을 가나요?</p>
            <label className="flex items-center gap-2 text-xs font-medium text-[#687167]">
              응원팀
              <select
                value={favoriteTeam ?? ""}
                onChange={(event) => changeFavoriteTeam(event.target.value)}
                className="rounded-xl border border-[#dfe3db] bg-white px-2 py-1.5 text-xs font-semibold text-[#465044] outline-none transition focus:border-[#182017]"
              >
                <option value="">설정 안 함</option>
                {KBO_TEAMS.map((team) => <option key={team} value={team}>{team}</option>)}
              </select>
            </label>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {dateOptions.map((option) => {
              const isSelected = option.date === selectedDate;
              return (
                <button
                  key={option.date}
                  type="button"
                  onClick={() => {
                    selectDate(option.date);
                  }}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    isSelected ? "border-[#182017] bg-[#182017] text-white" : "border-[#dfe3db] bg-white text-[#596157]"
                  }`}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className={`mt-0.5 block text-xs ${isSelected ? "text-white/70" : "text-[#8a9388]"}`}>{option.shortDate}</span>
                </button>
              );
            })}
          </div>
          {isGamesLoading ? (
            <div className="h-11 animate-pulse rounded-full bg-[#e6eae3]" />
          ) : gamesError ? (    
            <p className="rounded-2xl bg-[#fff0ed] px-4 py-3 text-sm text-[#9d3728]">{gamesError}</p>
          ) : gamesForSelectedDate.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#687167]">이 날짜에는 예정된 경기가 없어요.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] scrollbar-none">
              {gamesForSelectedDate.map((game) => {
                const isSelected = game.id === selectedGame?.id;
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
                    {game.status === "played" && game.awayScore !== null && game.homeScore !== null
                      ? `${game.awayTeam} ${game.awayScore} : ${game.homeScore} ${game.homeTeam}`
                      : `${game.awayTeam} vs ${game.homeTeam}`}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedGame ? (
          selectedGame.status === "played" ? (
            <ScoreCard game={selectedGame} />
          ) : (
            <RiskCard
              key={selectedGame.id}
              game={selectedGame}
              weather={weather}
              isLoading={isWeatherLoading}
              error={weatherError}
            />
          )
        ) : (
          <EmptyCard />
        )}

        <footer className="px-3 pt-6 text-center text-xs leading-5 text-[#8a9388]">
          <p>
            날씨 예보는 바뀔 수 있어요. 최종 경기 진행 여부는
            <a
              href="https://www.koreabaseball.com/Schedule/Schedule.aspx"
              target="_blank"
              rel="noreferrer"
              className="ml-1 font-semibold text-[#4c6346] underline underline-offset-2 transition hover:text-[#182017]"
            >
              KBO 경기일정
            </a>를 확인해 주세요.
          </p>
          <a
            href="https://github.com/mucho7/build-the-dom"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub에서 프로젝트 보기"
            title="GitHub에서 프로젝트 보기"
            className="mt-3 inline-flex size-9 items-center justify-center rounded-full text-[#4c6346] transition hover:bg-[#e4eddc] hover:text-[#182017] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#182017]"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
              <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.5v-1.85c-2.94.64-3.56-1.25-3.56-1.25-.48-1.22-1.18-1.55-1.18-1.55-.96-.66.07-.65.07-.65 1.06.08 1.62 1.09 1.62 1.09.95 1.61 2.48 1.15 3.08.88.1-.68.37-1.15.67-1.42-2.35-.27-4.82-1.18-4.82-5.23 0-1.16.41-2.1 1.09-2.85-.11-.27-.47-1.35.1-2.82 0 0 .89-.29 2.89 1.09A10.06 10.06 0 0 1 12 6.6c.9 0 1.8.12 2.65.36 2-1.38 2.88-1.09 2.88-1.09.58 1.47.22 2.55.11 2.82.68.75 1.08 1.69 1.08 2.85 0 4.06-2.48 4.95-4.83 5.21.38.33.72.97.72 1.96v2.91c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5Z" />
            </svg>
          </a>
        </footer>
      </div>
    </main>
  );
}

function ScoreCard({ game }: { game: KboGame }) {
  const hasScore = game.awayScore !== null && game.homeScore !== null;
  const scoreLabel = getScoreLabel(game);
  const stadiumName = getFullStadiumName(game.stadium);

  return (
    <section className="overflow-hidden rounded-[28px] bg-[#26364d] text-white shadow-[0_18px_45px_rgba(24,59,42,0.16)]">
      <div className="border-b border-white/15 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[#c7d4e3]">{formatDateLabel(game.date)} · {game.startTime}</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">{game.awayTeam} vs {game.homeTeam}</h2>
            <p className="mt-1 text-sm text-[#c7d4e3]">{stadiumName}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#d5e7f5]">KBO 스코어</span>
        </div>
      </div>
      <div className="flex h-[380px] flex-col items-center justify-center px-6 py-9 text-center">
        <div className="flex w-full items-center justify-center gap-4 text-3xl font-bold tracking-[-0.06em] sm:gap-7 sm:text-4xl">
          <span className="max-w-[110px] break-keep">{game.awayTeam}</span>
          <span className="rounded-2xl bg-white/10 px-4 py-3 tabular-nums">{hasScore ? `${game.awayScore} : ${game.homeScore}` : "- : -"}</span>
          <span className="max-w-[110px] break-keep">{game.homeTeam}</span>
        </div>
        <p className="mt-7 text-lg font-semibold text-[#d7eaff]">{scoreLabel}</p>
        <p className="mt-3 max-w-[320px] text-sm leading-6 text-[#c7d4e3]">KBO 일정에 경기 진행 또는 결과로 표시된 스코어예요.<br />최종 결과는 KBO 공식 기록을 확인해 주세요.</p>
      </div>
    </section>
  );
}

function getScoreLabel(game: KboGame) {
  if (game.awayScore === null || game.homeScore === null) return "스코어 집계 중";
  if (game.awayScore === game.homeScore) return "현재 동점";
  return game.awayScore > game.homeScore ? `${game.awayTeam} 우세` : `${game.homeTeam} 우세`;
}

function getPreferredGame(games: KboGame[], favoriteTeam: string | null) {
  return games.find((game) => favoriteTeam && (game.awayTeam === favoriteTeam || game.homeTeam === favoriteTeam))
    ?? games[0]
    ?? null;
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
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const stadiumName = getFullStadiumName(game.stadium);
  const assessment = weather?.risk;
  const cardStyle = assessment
    ? { safe: "bg-[#183b2a]", prepare: "bg-[#31523a]", caution: "bg-[#765a1b]", risky: "bg-[#782e2a]" }[
        assessment.level
      ]
    : "bg-[#48514a]";
  const icon = assessment?.level === "risky" ? "🌧️" : assessment?.level === "caution" ? "🌦️" : assessment?.level === "prepare" ? "🌂" : "🌤️";

  return (
    <section className={`overflow-hidden rounded-[28px] text-white shadow-[0_18px_45px_rgba(24,59,42,0.16)] ${cardStyle}`}>
        <div className="border-b border-white/15 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-[#c8d8c6]">{formatDateLabel(game.date)} · {game.startTime}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">{game.awayTeam} vs {game.homeTeam}</h2>
              <p className="mt-1 text-sm text-[#c8d8c6]">{stadiumName}</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#d9ebd5]">
              {weather ? `예보 기준 ${formatIssuedTime(weather.issuedAt)}` : "예보 확인 중"}
            </span>
          </div>
        </div>

        <div className="flex h-[320px] flex-col items-center justify-center px-6 py-9 text-center">
          <div className={`mx-auto flex size-20 shrink-0 items-center justify-center rounded-full bg-[#d9f071] text-4xl shadow-[0_8px_22px_rgba(0,0,0,0.14)] ${isLoading ? "animate-pulse" : ""}`}>
            {isLoading ? <span className="size-8 rounded-full bg-[#183b2a]/15" /> : icon}
          </div>
          {isLoading ? (
            <div className="mt-6 flex min-h-[132px] w-full flex-col items-center" aria-label="예보 판단을 불러오는 중">
              <div className="h-4 w-24 animate-pulse rounded-full bg-white/15" />
              <div className="mt-3 h-9 w-44 animate-pulse rounded-full bg-white/15" />
              <div className="mt-5 h-4 w-full max-w-[280px] animate-pulse rounded-full bg-white/10" />
              <div className="mt-2 h-4 w-4/5 max-w-[224px] animate-pulse rounded-full bg-white/10" />
            </div>
          ) : error ? (
            <div className="mt-6 flex min-h-[132px] flex-col items-center">
              <p className="text-sm font-semibold text-[#ffe0a8]">예보 확인 필요</p>
              <h3 className="mt-2 text-2xl font-bold tracking-[-0.055em]">아직 판단하기 어려워요</h3>
              <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-6 text-[#d8e5d6]">{error}</p>
            </div>
          ) : assessment ? (
            <div className="mt-6 flex min-h-[132px] flex-col items-center justify-center">
              <p className="text-sm font-semibold text-[#d9f071]">{assessment.label}</p>
              <h3 className="mt-2 text-[34px] font-bold tracking-[-0.075em]">{assessment.headline}</h3>
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-between border-t border-white/15 bg-black/10 px-6 py-3" aria-label="상세 판단 근거를 불러오는 중">
            <div className="h-4 w-28 animate-pulse rounded-full bg-white/15" />
            <div className="size-9 animate-pulse rounded-full bg-white/15" />
          </div>
        ) : assessment && (
          <>
            <div className="flex items-center justify-between border-t border-white/15 bg-black/10 px-6 py-3">
              <p className="text-sm font-semibold text-[#e6f0e3]">자세한 판단 근거</p>
              <button
                type="button"
                aria-expanded={isDetailsOpen}
                aria-controls={`risk-details-${game.id}`}
                aria-label={isDetailsOpen ? "상세 정보 접기" : "상세 정보 펼치기"}
                title={isDetailsOpen ? "상세 정보 접기" : "상세 정보 펼치기"}
                onClick={() => setIsDetailsOpen((current) => !current)}
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronDown className={`size-5 transition-transform ${isDetailsOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
            {isDetailsOpen && (
              <div id={`risk-details-${game.id}`} className="border-t border-white/15 bg-black/15 px-6 py-5">
                <table className="w-full border-collapse text-left text-sm">
                  <tbody>
                    <DetailRow label="경기 전 비" value={weather?.forecast.rainBeforeGame ? "비 예상" : "비 예상 없음"} />
                    <DetailRow label="경기 중 강수확률" value={`${weather?.forecast.precipitationProbability ?? 0}%`} />
                    <DetailRow label="예상 강수량" value={`${weather?.forecast.precipitationAmountMm ?? 0}mm`} />
                    <DetailRow label="최근 3년 유사 경기" value={weather?.history ? `${weather.history.similarGames}경기` : "표본 없음"} />
                    <DetailRow
                      label="유사 경기 처리"
                      value={weather?.history
                        ? `우천취소 ${weather.history.similarRainCancelledGames}경기 · 진행 ${weather.history.similarGames - weather.history.similarRainCancelledGames}경기`
                        : "집계할 표본 없음"}
                    />
                    <DetailRow label="판단 근거" value={assessment.summary} />
                    <DetailRow label="준비 팁" value={assessment.preparation} />
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
    </section>
  );
}

function EmptyCard() {
  return (
    <section className="rounded-[28px] bg-white px-6 py-12 text-center shadow-sm">
      <div className="text-4xl">⚾</div>
      <h2 className="mt-5 text-xl font-bold tracking-tighter">확인할 경기를 골라주세요</h2>
      <p className="mt-2 text-sm leading-6 text-[#687167]">예정된 경기가 보이면 직관 판단을 바로 알려드릴게요.</p>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-white/10 last:border-0">
      <th scope="row" className="w-[42%] py-3 pr-4 align-top text-xs font-medium text-[#c8d8c6]">{label}</th>
      <td className="py-3 align-top text-sm leading-5 text-white">{value}</td>
    </tr>
  );
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function getFullStadiumName(kboStadiumName: string) {
  return getStadiumByKboName(kboStadiumName)?.name ?? kboStadiumName;
}

function getKoreanDateOptions() {
  const today = getKoreanDate(new Date());
  const todayAt = new Date(`${today.date}T00:00:00+09:00`);
  return ["오늘", "내일", "모레"].map((label, offset) => {
    const date = getKoreanDate(new Date(todayAt.getTime() + offset * 86_400_000));
    return { ...date, label, shortDate: `${Number(date.month)}.${Number(date.day)}` };
  });
}

function getKoreanDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    date: `${value("year")}-${value("month")}-${value("day")}`,
  };
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(
    new Date(`${date}T00:00:00+09:00`),
  );
}

function formatIssuedTime(issuedAt: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(issuedAt));
}
