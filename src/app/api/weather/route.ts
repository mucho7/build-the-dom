import { getStadium } from "@/data/stadiums";
import { GameStatus, WeatherSnapshotKind } from "@/generated/prisma/client";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { getCachedGameForecast } from "@/lib/weather-cache";
import { applyHistoricalRainoutAdjustment, calculateRainoutRisk } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stadium = getStadium(searchParams.get("stadium") ?? "");
  const date = searchParams.get("date");
  const time = searchParams.get("time");

  if (!date || !/^\d{8}$/.test(date)) {
    return Response.json(
      { message: "date(YYYYMMDD) 값을 확인해 주세요." },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured()) {
    return Response.json({ message: "기상청 예보 캐시가 아직 설정되지 않았습니다." }, { status: 503 });
  }

  if (!stadium || !time || !/^\d{2}:\d{2}$/.test(time)) {
    return getDateWeather(date);
  }

  try {
    const gameForecast = await getCachedGameForecast(stadium.id, `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`, time);
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

async function getDateWeather(date: string) {
  const gameDate = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00.000Z`);
  try {
    const prisma = getPrisma();
    const games = await prisma.game.findMany({
      where: { gameDate, status: GameStatus.SCHEDULED },
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
    const weatherByGameId = Object.fromEntries(
      games.flatMap((game) => {
        const forecast = game.weatherSnapshots[0];
        if (!forecast) return [];
        const historicalRainout = game.historicalRainout?.forecastIssuedAt.getTime() === forecast.issuedAt.getTime()
          ? {
              similarGames: game.historicalRainout.similarGames,
              similarRainCancelledGames: game.historicalRainout.similarRainCancelledGames,
              rainoutRate: game.historicalRainout.similarRainCancelledGames / game.historicalRainout.similarGames,
              criteria: {
                precipitationAmount: game.historicalRainout.precipitationAmountBand,
                rainBeforeGame: game.historicalRainout.rainedBeforeGame,
              },
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
        return [[
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
        ]];
      }),
    );
    return Response.json(
      { weatherByGameId, issuedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("날짜별 기상청 예보 캐시 조회 실패", error);
    return Response.json({ message: "날짜별 기상청 예보 캐시를 불러오지 못했습니다." }, { status: 502 });
  }
}
