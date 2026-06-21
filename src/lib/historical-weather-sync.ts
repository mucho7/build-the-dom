import { GameStatus, WeatherSnapshotKind } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";
import { getGameObservation } from "@/lib/kma-observation";

export type HistoricalWeatherSyncResult = {
  attemptedGames: number;
  cachedGames: number;
  skippedGames: number;
  failedGameIds: string[];
};

export async function syncHistoricalGameObservations(limit?: number): Promise<HistoricalWeatherSyncResult> {
  const prisma = getPrisma();
  const games = await prisma.game.findMany({
    where: {
      status: { in: [GameStatus.PLAYED, GameStatus.CANCELLED] },
      weatherSnapshots: { none: { kind: WeatherSnapshotKind.OBSERVED } },
    },
    include: { stadium: true },
    orderBy: { gameDate: "desc" },
    ...(limit ? { take: limit } : {}),
  });
  const failedGameIds: string[] = [];
  let cachedGames = 0;
  let skippedGames = 0;

  for (const game of games) {
    try {
      const observation = await getGameObservation(game.stadium.id, game.gameDate, game.startTime);
      if (!observation) {
        skippedGames += 1;
        continue;
      }

      await prisma.weatherSnapshot.create({
        data: {
          gameId: game.id,
          kind: WeatherSnapshotKind.OBSERVED,
          issuedAt: observation.observedAt,
          forecastFor: observation.observedAt,
          precipitationAmountMm: observation.precipitationAmountMm,
          precipitationType: observation.precipitationType,
          humidity: observation.humidity,
          temperature: observation.temperature,
          rainedBeforeGame: observation.rainedBeforeGame,
        },
      });
      cachedGames += 1;
      await wait(100);
    } catch (error) {
      failedGameIds.push(game.kboGameId);
      console.error(`과거 관측 수집 실패: ${game.kboGameId}`, error);
    }
  }

  return { attemptedGames: games.length, cachedGames, skippedGames, failedGameIds };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
