import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { refreshTodayGameForecasts } = await import("../lib/weather-cache-sync");
const result = await refreshTodayGameForecasts();
console.log(JSON.stringify(result, null, 2));
