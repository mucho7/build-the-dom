import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

type Month = { year: number; month: number };

async function main() {
  const years = getYears(process.argv[2]);
  const months = getRecentMonths(years);
  const { syncKboScheduleMonth } = await import("../lib/kbo-history-sync");
  const results: Array<{ year: number; month: number; savedGames: number; skippedGames: number }> = [];
  const failures: Array<{ year: number; month: number; message: string }> = [];

  for (const { year, month } of months) {
    try {
      const result = await syncKboScheduleMonth(year, month);
      results.push({ year, month, savedGames: result.savedGames, skippedGames: result.skippedGames.length });
      console.log(`${year}-${String(month).padStart(2, "0")}: ${result.savedGames}경기 저장`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      failures.push({ year, month, message });
      console.error(`${year}-${String(month).padStart(2, "0")}: ${message}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        period: `${months[0].year}-${String(months[0].month).padStart(2, "0")} ~ ${months.at(-1)!.year}-${String(months.at(-1)!.month).padStart(2, "0")}`,
        savedGames: results.reduce((sum, result) => sum + result.savedGames, 0),
        skippedGames: results.reduce((sum, result) => sum + result.skippedGames, 0),
        failures,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) process.exitCode = 1;
}

function getYears(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 10 ? parsed : 3;
}

function getRecentMonths(years: number) {
  const now = getKoreanDate(new Date());
  const start = new Date(Date.UTC(now.year - years, now.month - 1, 1));
  const end = new Date(Date.UTC(now.year, now.month - 1, 1));
  const months: Month[] = [];

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    months.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
  }
  return months;
}

function getKoreanDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
  return { year: Number(value("year")), month: Number(value("month")) };
}

void main();
