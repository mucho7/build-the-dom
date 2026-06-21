import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const [yearArg, monthArg] = process.argv.slice(2);
const now = new Date();
const year = Number(yearArg) || now.getFullYear();
const month = Number(monthArg) || now.getMonth() + 1;

if (month < 1 || month > 12) {
  throw new Error("월은 1부터 12 사이의 숫자여야 합니다.");
}

async function main() {
  const { syncKboScheduleMonth } = await import("../lib/kbo-history-sync");
  const result = await syncKboScheduleMonth(year, month);

  console.log(
    JSON.stringify(
      {
        year,
        month,
        totalGames: result.totalGames,
        savedGames: result.savedGames,
        skippedGames: result.skippedGames,
      },
      null,
      2,
    ),
  );
}

void main();
