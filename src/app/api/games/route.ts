import { fetchKboSchedule } from "@/lib/kbo-schedule";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = getNumberParam(searchParams.get("year"), now.getFullYear());
  const month = getNumberParam(searchParams.get("month"), now.getMonth() + 1);

  if (year < 1982 || year > 2100 || month < 1 || month > 12) {
    return Response.json({ message: "유효하지 않은 연도 또는 월입니다." }, { status: 400 });
  }

  try {
    const games = await fetchKboSchedule({ year, month });
    return Response.json(
      {
        games,
        source: "KBO 경기일정/결과",
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.error("KBO 일정 조회 실패", error);
    return Response.json(
      { message: "KBO 일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}

function getNumberParam(value: string | null, fallback: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  return Number(value);
}
