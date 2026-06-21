import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { refreshUpcomingGameForecasts } = await import("../lib/weather-cache-sync");
  const result = await refreshUpcomingGameForecasts();
  console.log(JSON.stringify(result, null, 2));
}

void main();
