import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { refreshUpcomingGameForecasts } = await import("../lib/weather-cache-sync");
const result = await refreshUpcomingGameForecasts();
console.log(JSON.stringify(result, null, 2));
