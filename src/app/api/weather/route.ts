import { getStadium, getStadiumByKboName } from "@/data/stadiums";
import { GameStatus, WeatherSnapshotKind } from "@/generated/prisma/client";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { fetchKboSchedule } from "@/lib/kbo-schedule";
import { fetchStadiumForecast, getRiskForecast } from "@/lib/kma-forecast";
import { getCachedGameForecast } from "@/lib/weather-cache";
import { applyHistoricalRainoutAdjustment, calculateRainoutRisk, type HistoricalRainoutStats } from "@/lib/risk";

export const dynamic = "force-dynamic";
const DATE_WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;

type DateWeatherResponse = {
  weatherByGameId: Record<string, WeatherResponse>;
  issuedAt: string;
};

type WeatherResponse = {
  stadium: { isDome: boolean };
  forecast: {
    precipitationProbability: number;
    precipitationAmountMm: number;
    rainBeforeGame: boolean;
  };
  risk: ReturnType<typeof calculateRainoutRisk>;
  history: HistoricalRainoutStats | null;
  issuedAt: string;
};

type DateWeatherCacheEntry = {
  expiresAt: number;
  value: DateWeatherResponse;
};

const dateWeatherCache = new Map<string, DateWeatherCacheEntry>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const stadiumParam = searchParams.get("stadium");
  const time = searchParams.get("time");

  const parsedDate = parseDateParam(date);
  if (!parsedDate) {
    return Response.json(
      { message: "date(YYYYMMDD) 값을 확인해 주세요." },
      { status: 400 },
    );
  }

  const hasDetailedQuery = stadiumParam !== null || time !== null;
  if (!hasDetailedQuery) {
    if (!isDatabaseConfigured()) {
      return Response.json({ message: "기상청 예보 캐시가 아직 설정되지 않았습니다." }, { status: 503 });
    }

    return getDateWeather(parsedDate.gameDate);
  }

  if (!stadiumParam) {
    return Response.json({ message: "stadium 값을 확인해 주세요." }, { status: 400 });
  }

  const stadium = getStadium(stadiumParam);
  if (!stadium) {
    return Response.json({ message: "지원하지 않는 구장입니다." }, { status: 400 });
  }

  if (!time || !isValidTimeParam(time)) {
    return Response.json({ message: "time(HH:mm) 값을 확인해 주세요." }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    return Response.json({ message: "기상청 예보 캐시가 아직 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const gameForecast = await getCachedGameForecast(stadium.id, parsedDate.isoDate, time);
    if (!gameForecast) {
      return Response.json(
        { message: "최신 예보 캐시를 준비하고 있어요. 잠시 후 다시 확인해 주세요." },
        { status: 503 },
      );
    }

    let risk = calculateRainoutRisk({
      isDome: stadium.isDome,
      precipitationProbability: gameForecast.precipitationProbability,
      precipitationAmountMm: gameForecast.precipitationAmountMm,
      rainBeforeGame: gameForecast.rainBeforeGame,
    });
    const history = gameForecast.historicalRainout;
    if (history) risk = applyHistoricalRainoutAdjustment(risk, history, stadium.isDome);

    return Response.json(
      { stadium, forecast: gameForecast, risk, history, issuedAt: gameForecast.issuedAt.toISOString() },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("기상청 예보 캐시 조회 실패", error);
    return Response.json({ message: "기상청 예보 캐시를 불러오지 못했습니다." }, { status: 502 });
  }
}

function parseDateParam(date: string | null) {
  if (!date || !/^\d{8}$/.test(date)) return null;

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(4, 6));
  const day = Number(date.slice(6, 8));
  const gameDate = new Date(Date.UTC(year, month - 1, day));

  if (
    gameDate.getUTCFullYear() !== year ||
    gameDate.getUTCMonth() !== month - 1 ||
    gameDate.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    gameDate,
    isoDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
  };
}

function isValidTimeParam(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return false;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

async function getDateWeather(gameDate: Date) {
  try {
    const cacheKey = gameDate.toISOString().slice(0, 10);
    const cached = getCachedDateWeather(cacheKey);
    if (cached) {
      return Response.json(cached, {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=300",
          "X-Weather-Date-Cache": "HIT",
        },
      });
    }

    const prisma = getPrisma();
    const weatherByGameId = await getWeatherByGameId(prisma, gameDate);
    const payload: DateWeatherResponse = { weatherByGameId, issuedAt: new Date().toISOString() };
    setCachedDateWeather(cacheKey, payload);
    return Response.json(
      payload,
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=300", "X-Weather-Date-Cache": "MISS" } },
    );
  } catch (error) {
    console.error("날짜별 기상청 예보 캐시 조회 실패", error);
    return Response.json({ message: "날짜별 기상청 예보 캐시를 불러오지 못했습니다." }, { status: 502 });
  }
}

function getCachedDateWeather(cacheKey: string) {
  const entry = dateWeatherCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    dateWeatherCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

function setCachedDateWeather(cacheKey: string, value: DateWeatherResponse) {
  dateWeatherCache.set(cacheKey, {
    expiresAt: Date.now() + DATE_WEATHER_CACHE_TTL_MS,
    value,
  });
}

async function getWeatherByGameId(prisma: ReturnType<typeof getPrisma>, gameDate: Date) {
  const isoDate = gameDate.toISOString().slice(0, 10);
  const kmaDate = isoDate.replaceAll("-", "");
  const year = gameDate.getUTCFullYear();
  const month = gameDate.getUTCMonth() + 1;

  let games: Awaited<ReturnType<typeof fetchKboSchedule>> = [];
  try {
    games = await fetchKboSchedule({ year, month });
  } catch (error) {
    console.error("KBO 일정 조회 실패", error);
  }
  games = games.filter((game) => game.date === isoDate && ["scheduled", "played"].includes(game.status));

  if (games.length === 0) {
    const dbGames = await prisma.game.findMany({
      where: { gameDate, status: { in: [GameStatus.SCHEDULED, GameStatus.PLAYED] } },
      include: {
        stadium: true,
        historicalRainout: true,
        weatherSnapshots: {
          where: { kind: WeatherSnapshotKind.FORECAST },
          orderBy: { issuedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { startTime: "asc" },
    });

    return Object.fromEntries((await Promise.all(dbGames.map((game) => buildWeatherEntryFromDbGame(game)))).filter(Boolean) as Array<
      [string, WeatherResponse]
    >);
  }

  const entries = await Promise.all(
    games.map(async (game) => {
      const stadium = getStadiumByKboName(game.stadium);
      if (!stadium) return null;

      const dbGame = await prisma.game.findUnique({
        where: { kboGameId: game.id },
        include: {
          stadium: true,
          historicalRainout: true,
          weatherSnapshots: {
            where: { kind: WeatherSnapshotKind.FORECAST },
            orderBy: { issuedAt: "desc" },
            take: 1,
          },
        },
      });

      const cachedEntry = dbGame ? await buildWeatherEntryFromDbGame(dbGame) : null;
      if (cachedEntry) return cachedEntry;

      const forecast = await fetchStadiumForecast(stadium);
      const gameForecast = getRiskForecast(forecast.hours, kmaDate, game.startTime);
      if (!gameForecast) return null;

      return [
        game.id,
        {
          stadium: { isDome: stadium.isDome },
          forecast: {
            precipitationProbability: gameForecast.precipitationProbability,
            precipitationAmountMm: gameForecast.precipitationAmountMm,
            rainBeforeGame: gameForecast.rainBeforeGame,
          },
          risk: calculateRainoutRisk({
            isDome: stadium.isDome,
            precipitationProbability: gameForecast.precipitationProbability,
            precipitationAmountMm: gameForecast.precipitationAmountMm,
            rainBeforeGame: gameForecast.rainBeforeGame,
          }),
          history: null,
          issuedAt: forecast.issuedAt,
        },
      ] as const;
    }),
  );

  return Object.fromEntries(entries.filter(Boolean) as Array<[string, WeatherResponse]>);
}

async function buildWeatherEntryFromDbGame(game: {
  id: string;
  kboGameId: string;
  stadium: { isDome: boolean };
  historicalRainout: {
    forecastIssuedAt: Date;
    similarGames: number;
    similarRainCancelledGames: number;
    precipitationAmountBand: string;
    rainedBeforeGame: boolean;
    matchType: string;
  } | null;
  weatherSnapshots: Array<{
    issuedAt: Date;
    precipitationProbability: number | null;
    precipitationAmountMm: number | null;
    rainedBeforeGame: boolean;
  }>;
}) {
  const forecast = game.weatherSnapshots[0];
  if (!forecast) return null;

  const historicalRainout: HistoricalRainoutStats | null = game.historicalRainout?.forecastIssuedAt.getTime() === forecast.issuedAt.getTime()
    ? {
        similarGames: game.historicalRainout.similarGames,
        similarRainCancelledGames: game.historicalRainout.similarRainCancelledGames,
        rainoutRate: game.historicalRainout.similarRainCancelledGames / game.historicalRainout.similarGames,
        criteria: {
          precipitationAmount: game.historicalRainout.precipitationAmountBand,
          rainBeforeGame: game.historicalRainout.rainedBeforeGame,
        },
        matchType: game.historicalRainout.matchType === "PRECIPITATION_ONLY" ? "precipitation_only" : "exact",
      }
    : null;
  const risk = calculateRainoutRisk({
    isDome: game.stadium.isDome,
    precipitationProbability: forecast.precipitationProbability ?? 0,
    precipitationAmountMm: forecast.precipitationAmountMm ?? 0,
    rainBeforeGame: forecast.rainedBeforeGame,
  });
  const adjustedRisk = historicalRainout
    ? applyHistoricalRainoutAdjustment(risk, historicalRainout, game.stadium.isDome)
    : risk;

  return [
    game.kboGameId,
    {
      stadium: { isDome: game.stadium.isDome },
      forecast: {
        precipitationProbability: forecast.precipitationProbability ?? 0,
        precipitationAmountMm: forecast.precipitationAmountMm ?? 0,
        rainBeforeGame: forecast.rainedBeforeGame,
      },
      risk: adjustedRisk,
      history: historicalRainout,
      issuedAt: forecast.issuedAt.toISOString(),
    },
  ] as const;
}
