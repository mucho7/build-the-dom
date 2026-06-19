import { CancellationReason, GameStatus } from "@/generated/prisma/client";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import type { HistoricalRainoutStats } from "@/lib/risk";

export async function getHistoricalRainoutStats(
  stadiumId: string,
  referenceDate: string,
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
  const [totalGames, rainCancelledGames] = await Promise.all([
    prisma.game.count({ where: completedGames }),
    prisma.game.count({
      where: {
        ...completedGames,
        cancellation: { is: { reason: CancellationReason.RAIN } },
      },
    }),
  ]);

  if (totalGames === 0) return null;
  return { totalGames, rainCancelledGames, rainoutRate: rainCancelledGames / totalGames };
}
