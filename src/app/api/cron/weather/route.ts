import { isDatabaseConfigured } from "@/lib/db";
import { refreshTodayGameForecasts } from "@/lib/weather-cache-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ message: "권한이 없습니다." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return Response.json({ message: "DATABASE_URL 환경 변수가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const result = await refreshTodayGameForecasts();
    return Response.json({ ...result, refreshedAt: new Date().toISOString() });
  } catch (error) {
    console.error("날씨 캐시 갱신 실패", error);
    return Response.json({ message: "날씨 캐시를 갱신하지 못했습니다." }, { status: 502 });
  }
}
