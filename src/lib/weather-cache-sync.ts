import { GameStatus, WeatherSnapshotKind } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";
import { syncKboScheduleMonth } from "@/lib/kbo-history-sync";
import { fetchStadiumForecast, getRiskForecast } from "@/lib/kma-forecast";

export type WeatherCacheSyncResult = {
  gameCount: number;
  cachedCount: number;
  failedGameIds: string[];
};

export async function refreshTodayGameForecasts(now = new Date()): Promise<WeatherCacheSyncResult> {
  const { year, month, date } = getKoreanDate(now);
  await syncKboScheduleMonth(year, month);

  const prisma = getPrisma();
  const games = await prisma.game.findMany({
    where: {
      gameDate: new Date(`${date}T00:00:00.000Z`),
      status: GameStatus.SCHEDULED,
    },
    include: { stadium: true },
    orderBy: { startTime: "asc" },
    take: 5,
  });
  const results = await Promise.allSettled(games.map((game) => cacheGameForecast(game)));
  const failedGameIds = results.flatMap((result, index) =>
    result.status === "rejected" ? [games[index].kboGameId] : [],
  );

  return { gameCount: games.length, cachedCount: games.length - failedGameIds.length, failedGameIds };
}

async function cacheGameForecast(game: {
  id: string;
  gameDate: Date;
  startTime: string;
  stadium: { latitude: number; longitude: number };
}) {
  const date = game.gameDate.toISOString().slice(0, 10).replaceAll("-", "");
  const forecast = await fetchStadiumForecast(game.stadium);
  const gameForecast = getRiskForecast(forecast.hours, date, game.startTime);
  if (!gameForecast) throw new Error("경기 시간대 예보가 없습니다.");

  const forecastFor = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${game.startTime}:00+09:00`);
  const issuedAt = new Date(forecast.issuedAt);
  const data = {
    precipitationProbability: gameForecast.precipitationProbability,
    precipitationAmountMm: gameForecast.precipitationAmountMm,
    precipitationType: gameForecast.precipitationType,
    humidity: gameForecast.humidity,
    temperature: gameForecast.temperature,
    rainedBeforeGame: gameForecast.rainBeforeGame,
  };

  const prisma = getPrisma();
  await prisma.weatherSnapshot.upsert({
    where: {
      gameId_kind_forecastFor_issuedAt: {
        gameId: game.id,
        kind: WeatherSnapshotKind.FORECAST,
        forecastFor,
        issuedAt,
      },
    },
    create: { gameId: game.id, kind: WeatherSnapshotKind.FORECAST, forecastFor, issuedAt, ...data },
    update: data,
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
  return { year: Number(value("year")), month: Number(value("month")), date: `${value("year")}-${value("month")}-${value("day")}` };
}
