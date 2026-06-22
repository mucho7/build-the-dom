import { WeatherSnapshotKind } from "@/generated/prisma/client";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import type { HistoricalRainoutStats } from "@/lib/risk";

export type CachedGameForecast = {
  issuedAt: Date;
  precipitationProbability: number;
  precipitationAmountMm: number;
  precipitationType: string;
  humidity: number | null;
  temperature: number | null;
  rainBeforeGame: boolean;
  historicalRainout: HistoricalRainoutStats | null;
};

export async function getCachedGameForecast(
  stadiumId: string,
  date: string,
  startTime: string,
): Promise<CachedGameForecast | null> {
  if (!isDatabaseConfigured()) return null;

  const prisma = getPrisma();
  const game = await prisma.game.findFirst({
    where: {
      stadiumId,
      gameDate: new Date(`${date}T00:00:00.000Z`),
      startTime,
    },
    include: {
      historicalRainout: true,
      weatherSnapshots: {
        where: { kind: WeatherSnapshotKind.FORECAST },
        orderBy: { issuedAt: "desc" },
        take: 1,
      },
    },
  });
  const snapshot = game?.weatherSnapshots[0];
  if (!snapshot) return null;

  const historicalRainout = game.historicalRainout?.forecastIssuedAt.getTime() === snapshot.issuedAt.getTime()
    ? {
        similarGames: game.historicalRainout.similarGames,
        similarRainCancelledGames: game.historicalRainout.similarRainCancelledGames,
        rainoutRate: game.historicalRainout.similarRainCancelledGames / game.historicalRainout.similarGames,
        criteria: {
          precipitationAmount: game.historicalRainout.precipitationAmountBand,
          rainBeforeGame: game.historicalRainout.rainedBeforeGame,
        },
      }
    : null;

  return {
    issuedAt: snapshot.issuedAt,
    precipitationProbability: snapshot.precipitationProbability ?? 0,
    precipitationAmountMm: snapshot.precipitationAmountMm ?? 0,
    precipitationType: snapshot.precipitationType ?? "0",
    humidity: snapshot.humidity,
    temperature: snapshot.temperature,
    rainBeforeGame: snapshot.rainedBeforeGame,
    historicalRainout,
  };
}
