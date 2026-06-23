import { GameStatus, WeatherSnapshotKind } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";
import { getHistoricalRainoutStats, getPrecipitationBand } from "@/lib/historical-rainout";
import { syncKboScheduleMonth } from "@/lib/kbo-history-sync";
import { fetchStadiumForecast, getRiskForecast } from "@/lib/kma-forecast";

export type WeatherCacheSyncResult = {
  gameCount: number;
  cachedCount: number;
  failedGameIds: string[];
};

export async function refreshUpcomingGameForecasts(now = new Date()): Promise<WeatherCacheSyncResult> {
  const dates = getKoreanDateRange(now);
  const targetMonths = Array.from(
    new Map(dates.map((date) => [`${date.year}-${date.month}`, { year: date.year, month: date.month }])).values(),
  );
  await Promise.all(targetMonths.map(({ year, month }) => syncKboScheduleMonth(year, month)));

  const prisma = getPrisma();
  const games = await prisma.game.findMany({
    where: {
      gameDate: { in: dates.map(({ date }) => new Date(`${date}T00:00:00.000Z`)) },
      status: { in: [GameStatus.SCHEDULED, GameStatus.PLAYED] },
    },
    include: { stadium: true },
    orderBy: { startTime: "asc" },
    take: 15,
  });
  const results = await Promise.allSettled(games.map((game) => cacheGameForecast(game)));
  const failedGameIds = results.flatMap((result, index) =>
    result.status === "rejected" ? [games[index].kboGameId] : [],
  );

  return { gameCount: games.length, cachedCount: games.length - failedGameIds.length, failedGameIds };
}

async function cacheGameForecast(game: {
  id: string;
  stadiumId: string;
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

  const historicalRainout = await getHistoricalRainoutStats(
    game.stadiumId,
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    {
      precipitationProbability: gameForecast.precipitationProbability,
      precipitationAmountMm: gameForecast.precipitationAmountMm,
      rainBeforeGame: gameForecast.rainBeforeGame,
    },
  );

  if (!historicalRainout) {
    await prisma.historicalRainout.deleteMany({ where: { gameId: game.id } });
    return;
  }

  await prisma.historicalRainout.upsert({
    where: { gameId: game.id },
    create: {
      gameId: game.id,
      forecastIssuedAt: issuedAt,
      similarGames: historicalRainout.similarGames,
      similarRainCancelledGames: historicalRainout.similarRainCancelledGames,
      precipitationAmountBand: getPrecipitationBand(gameForecast.precipitationAmountMm),
      rainedBeforeGame: gameForecast.rainBeforeGame,
      matchType: historicalRainout.matchType === "precipitation_only" ? "PRECIPITATION_ONLY" : "EXACT",
    },
    update: {
      forecastIssuedAt: issuedAt,
      similarGames: historicalRainout.similarGames,
      similarRainCancelledGames: historicalRainout.similarRainCancelledGames,
      precipitationAmountBand: getPrecipitationBand(gameForecast.precipitationAmountMm),
      rainedBeforeGame: gameForecast.rainBeforeGame,
      matchType: historicalRainout.matchType === "precipitation_only" ? "PRECIPITATION_ONLY" : "EXACT",
    },
  });
}

function getKoreanDateRange(now: Date) {
  const start = getKoreanDate(now);
  const startAt = new Date(`${start.date}T00:00:00+09:00`);
  return Array.from({ length: 3 }, (_, offset) => getKoreanDate(new Date(startAt.getTime() + offset * 86_400_000)));
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
    year: Number(value("year")),
    month: Number(value("month")),
    date: `${value("year")}-${value("month")}-${value("day")}`,
  };
}
