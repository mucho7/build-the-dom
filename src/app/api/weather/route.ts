import { getStadium } from "@/data/stadiums";
import { isDatabaseConfigured } from "@/lib/db";
import { getHistoricalRainoutStats } from "@/lib/historical-rainout";
import { getCachedGameForecast } from "@/lib/weather-cache";
import { applyHistoricalRainoutAdjustment, calculateRainoutRisk } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stadium = getStadium(searchParams.get("stadium") ?? "");
  const date = searchParams.get("date");
  const time = searchParams.get("time");

  if (!stadium || !date || !/^\d{8}$/.test(date) || !time || !/^\d{2}:\d{2}$/.test(time)) {
    return Response.json(
      { message: "stadium, date(YYYYMMDD), time(HH:MM) 값을 확인해 주세요." },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured()) {
    return Response.json({ message: "기상청 예보 캐시가 아직 설정되지 않았습니다." }, { status: 503 });
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
    let history = null;
    try {
      history = await getHistoricalRainoutStats(stadium.id, `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`);
      if (history) risk = applyHistoricalRainoutAdjustment(risk, history, stadium.isDome);
    } catch (error) {
      console.warn("우천취소 이력 보정 생략", error);
    }

    return Response.json(
      { stadium, forecast: gameForecast, risk, history, issuedAt: gameForecast.issuedAt.toISOString() },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("기상청 예보 캐시 조회 실패", error);
    return Response.json({ message: "기상청 예보 캐시를 불러오지 못했습니다." }, { status: 502 });
  }
}
