import { getStadium } from "@/data/stadiums";
import { getHistoricalRainoutStats } from "@/lib/historical-rainout";
import { fetchStadiumForecast, getRiskForecast, KmaConfigurationError } from "@/lib/kma-forecast";
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

  try {
    const forecast = await fetchStadiumForecast(stadium);
    const gameForecast = getRiskForecast(forecast.hours, date, time);
    if (!gameForecast) {
      return Response.json(
        { message: "요청한 경기 시간대의 예보가 아직 제공되지 않았습니다." },
        { status: 404 },
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
      { stadium, forecast: gameForecast, risk, history, issuedAt: forecast.issuedAt },
      { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=600" } },
    );
  } catch (error) {
    if (error instanceof KmaConfigurationError) {
      return Response.json({ message: error.message }, { status: 503 });
    }

    console.error("기상청 예보 조회 실패", error);
    return Response.json({ message: "기상청 예보를 불러오지 못했습니다." }, { status: 502 });
  }
}
