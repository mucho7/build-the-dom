const ASOS_ENDPOINT = "https://apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList";

const ASOS_STATION_IDS: Record<string, string> = {
  jamsil: "108",
  gocheok: "108",
  incheon: "112",
  suwon: "119",
  daejeon: "133",
  daegu: "143",
  gwangju: "156",
  busan: "159",
  changwon: "155",
};

type AsosItem = {
  tm?: string;
  rn?: string;
  ta?: string;
  hm?: string;
  ww?: string;
};

type AsosResponse = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: { item?: AsosItem[] } };
  };
};

export type GameObservation = {
  observedAt: Date;
  precipitationAmountMm: number;
  precipitationType: string;
  humidity: number | null;
  temperature: number | null;
  rainedBeforeGame: boolean;
};

export async function getGameObservation(
  stadiumId: string,
  gameDate: Date,
  startTime: string,
): Promise<GameObservation | null> {
  const stationId = ASOS_STATION_IDS[stadiumId];
  if (!stationId) return null;

  const gameStart = new Date(`${formatKstDate(gameDate)}T${startTime}:00+09:00`);
  const targetAt = new Date(gameStart);
  targetAt.setMinutes(0, 0, 0);
  const from = new Date(targetAt.getTime() - 6 * 3_600_000);
  const observations = await fetchHourlyObservations(stationId, from, targetAt);
  const target = observations.find((item) => toKstDate(item.tm).getTime() === targetAt.getTime());
  if (!target) return null;

  return {
    observedAt: targetAt,
    precipitationAmountMm: toNumber(target.rn) ?? 0,
    precipitationType: isRainy(target) ? "1" : "0",
    humidity: toNumber(target.hm),
    temperature: toNumber(target.ta),
    rainedBeforeGame: observations.some((item) => {
      const observedAt = toKstDate(item.tm);
      return observedAt >= from && observedAt <= targetAt && isRainy(item);
    }),
  };
}

export async function fetchHourlyObservations(stationId: string, from: Date, to: Date): Promise<AsosItem[]> {
  const serviceKey = process.env.KMA_ASOS_SERVICE_KEY;
  if (!serviceKey) throw new Error("KMA_ASOS_SERVICE_KEY 환경 변수가 설정되지 않았습니다.");

  const url = new URL(ASOS_ENDPOINT);
  url.search = new URLSearchParams({
    serviceKey,
    pageNo: "1",
    numOfRows: "24",
    dataType: "JSON",
    dataCd: "ASOS",
    dateCd: "HR",
    startDt: formatKstDate(from).replaceAll("-", ""),
    startHh: formatKstHour(from),
    endDt: formatKstDate(to).replaceAll("-", ""),
    endHh: formatKstHour(to),
    stnIds: stationId,
  }).toString();

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`기상청 관측자료 조회 실패: ${response.status}`);
      const payload = (await response.json()) as AsosResponse;
      const header = payload.response?.header;
      if (header?.resultCode && header.resultCode !== "00") {
        throw new Error(`기상청 관측자료 오류: ${header.resultMsg ?? header.resultCode}`);
      }
      return payload.response?.body?.items?.item ?? [];
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 500);
    }
  }
  throw lastError;
}

function isRainy(item: AsosItem) {
  return (toNumber(item.rn) ?? 0) > 0 || /비|rain/i.test(item.ww ?? "");
}

function toNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatKstDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatKstHour(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return parts.find((part) => part.type === "hour")!.value;
}

function toKstDate(value: string | undefined) {
  if (!value) return new Date(0);
  return new Date(`${value.replace(" ", "T")}:00+09:00`);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
