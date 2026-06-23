import { CancellationReason, GameStatus } from "@/generated/prisma/client";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import type { HistoricalRainoutStats, RiskInput } from "@/lib/risk";

export async function getHistoricalRainoutStats(
  stadiumId: string,
  referenceDate: string,
  currentWeather: Pick<RiskInput, "precipitationProbability" | "precipitationAmountMm" | "rainBeforeGame">,
): Promise<HistoricalRainoutStats | null> {
  if (!isDatabaseConfigured()) return null;

  const reference = new Date(`${referenceDate}T00:00:00.000Z`);
  const since = new Date(reference);
  since.setUTCFullYear(since.getUTCFullYear() - 3);

  const prisma = getPrisma();
  const completedGames = {
    stadiumId,
    gameDate: { gte: since, lt: reference },
    status: { in: [GameStatus.PLAYED, GameStatus.CANCELLED] },
  };
  const games = await prisma.game.findMany({
    where: completedGames,
    include: {
      cancellation: true,
      weatherSnapshots: {
        where: { kind: "OBSERVED" },
        orderBy: { issuedAt: "desc" },
        take: 1,
      },
    },
  });
  const exactSimilarGames = games.filter((game) => {
    const forecast = game.weatherSnapshots[0];
    return forecast ? isSimilarWeather(forecast, currentWeather) : false;
  });
  const similarGames = exactSimilarGames.length > 0
    ? exactSimilarGames
    : games.filter((game) => {
        const forecast = game.weatherSnapshots[0];
        return forecast ? isSimilarPrecipitation(forecast, currentWeather) : false;
      });
  const rainCancelledGames = similarGames.filter(
    (game) => game.cancellation?.reason === CancellationReason.RAIN,
  ).length;

  if (similarGames.length === 0) return null;
  return {
    similarGames: similarGames.length,
    similarRainCancelledGames: rainCancelledGames,
    rainoutRate: rainCancelledGames / similarGames.length,
    criteria: {
      precipitationAmount: getPrecipitationBand(currentWeather.precipitationAmountMm),
      rainBeforeGame: currentWeather.rainBeforeGame,
    },
    matchType: exactSimilarGames.length > 0 ? "exact" : "precipitation_only",
  };
}

function isSimilarWeather(
  forecast: { precipitationProbability: number | null; precipitationAmountMm: number | null; rainedBeforeGame: boolean },
  current: Pick<RiskInput, "precipitationProbability" | "precipitationAmountMm" | "rainBeforeGame">,
) {
  const precipitationMatch = isSimilarPrecipitation(forecast, current);
  const beforeGameMatch = forecast.rainedBeforeGame === current.rainBeforeGame;
  return precipitationMatch && beforeGameMatch;
}

function isSimilarPrecipitation(
  forecast: { precipitationAmountMm: number | null },
  current: Pick<RiskInput, "precipitationAmountMm">,
) {
  return getPrecipitationBand(forecast.precipitationAmountMm ?? 0) === getPrecipitationBand(current.precipitationAmountMm);
}

export function getPrecipitationBand(value: number) {
  if (value === 0) return "강수 없음";
  if (value < 1) return "1mm 미만";
  if (value < 5) return "1~4.9mm";
  return "5mm 이상";
}
