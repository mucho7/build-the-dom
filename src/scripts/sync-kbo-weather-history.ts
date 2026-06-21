import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const value = Number(process.argv[2]);
  const limit = Number.isInteger(value) && value > 0 ? value : undefined;
  const { syncHistoricalGameObservations } = await import("../lib/historical-weather-sync");
  const result = await syncHistoricalGameObservations(limit);
  console.log(JSON.stringify(result, null, 2));
}

void main();
