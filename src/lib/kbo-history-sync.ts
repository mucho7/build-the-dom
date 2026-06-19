import { CancellationReason, GameStatus } from "@/generated/prisma/client";
import { getStadiumByKboName, stadiums } from "@/data/stadiums";
import { fetchKboSchedule, type KboGame } from "@/lib/kbo-schedule";
import { prisma } from "@/lib/db";

export type KboSyncResult = {
  totalGames: number;
  savedGames: number;
  skippedGames: Array<{ kboGameId: string; stadium: string }>;
};

export async function syncKboScheduleMonth(year: number, month: number): Promise<KboSyncResult> {
  const syncRun = await prisma.syncRun.create({
    data: { source: "KBO", targetYear: year, targetMonth: month, status: "RUNNING" },
  });

  try {
    await Promise.all(
      stadiums.map((stadium) => {
        const { id, name, latitude, longitude, isDome } = stadium;
        return prisma.stadium.upsert({
          where: { id },
          create: { id, name, latitude, longitude, isDome },
          update: {
            name,
            latitude,
            longitude,
            isDome,
          },
        });
      }),
    );

    const games = await fetchKboSchedule({ year, month });
    const skippedGames: KboSyncResult["skippedGames"] = [];
    let savedGames = 0;

    for (const game of games) {
      const stadium = getStadiumByKboName(game.stadium);
      if (!stadium) {
        skippedGames.push({ kboGameId: game.id, stadium: game.stadium });
        continue;
      }

      await upsertGame(game, stadium.id);
      savedGames += 1;
    }

    const result = { totalGames: games.length, savedGames, skippedGames };
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: "COMPLETED", recordCount: savedGames, finishedAt: new Date() },
    });
    return result;
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "알 수 없는 동기화 오류",
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

async function upsertGame(game: KboGame, stadiumId: string) {
  const data = {
    gameDate: new Date(`${game.date}T00:00:00.000Z`),
    startTime: game.startTime,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    stadiumId,
    status: toGameStatus(game.status),
    sourceText: game.note,
    sourceUrl: game.sourceUrl,
    collectedAt: new Date(),
  };
  const cancellation = game.status === "cancelled" ? getCancellation(game) : null;

  await prisma.game.upsert({
    where: { kboGameId: game.id },
    create: {
      kboGameId: game.id,
      ...data,
      ...(cancellation ? { cancellation: { create: cancellation } } : {}),
    },
    update: {
      ...data,
      ...(cancellation
        ? {
            cancellation: {
              upsert: { create: cancellation, update: cancellation },
            },
          }
        : {}),
    },
  });
}

function toGameStatus(status: KboGame["status"]) {
  return {
    scheduled: GameStatus.SCHEDULED,
    played: GameStatus.PLAYED,
    cancelled: GameStatus.CANCELLED,
  }[status];
}

function getCancellation(game: KboGame) {
  return {
    reason: /우천|비/.test(game.note ?? "") ? CancellationReason.RAIN : CancellationReason.OTHER,
    sourceText: game.note,
  };
}
