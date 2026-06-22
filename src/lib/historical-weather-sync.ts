import { GameStatus, WeatherSnapshotKind } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";
import { getGameObservation } from "@/lib/kma-observation";

export type HistoricalWeatherSyncResult = {
  attemptedGames: number;
  cachedGames: number;
  skippedGames: number;
  failedGameIds: string[];
};

const CONCURRENCY = 4;

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

  console.log(`과거 관측 적재 시작: ${games.length}경기, 동시 ${CONCURRENCY}건 처리`);

  for (let offset = 0; offset < games.length; offset += CONCURRENCY) {
    const batch = games.slice(offset, offset + CONCURRENCY);
    const results = await Promise.all(batch.map((game) => syncGameObservation(game)));

    for (const result of results) {
      if (result.status === "cached") cachedGames += 1;
      if (result.status === "skipped") skippedGames += 1;
      if (result.status === "failed") {
        failedGameIds.push(result.kboGameId);
        console.error(`과거 관측 수집 실패: ${result.kboGameId}`, result.error);
      }
    }

    const processed = Math.min(offset + batch.length, games.length);
    if (processed === games.length || processed % 20 === 0) {
      console.log(`[${processed}/${games.length}] 저장 ${cachedGames}건 · 건너뜀 ${skippedGames}건 · 실패 ${failedGameIds.length}건`);
    }
    await wait(100);
  }

  return { attemptedGames: games.length, cachedGames, skippedGames, failedGameIds };
}

async function syncGameObservation(game: {
  id: string;
  kboGameId: string;
  gameDate: Date;
  startTime: string;
  stadium: { id: string };
}): Promise<{ status: "cached" | "skipped" } | { status: "failed"; kboGameId: string; error: unknown }> {
  try {
    const observation = await getGameObservation(game.stadium.id, game.gameDate, game.startTime);
    if (!observation) return { status: "skipped" };

    const prisma = getPrisma();
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
    return { status: "cached" };
  } catch (error) {
    return { status: "failed", kboGameId: game.kboGameId, error };
  }
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
