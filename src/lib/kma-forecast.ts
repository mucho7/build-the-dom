import type { Stadium } from "@/data/stadiums";

const KMA_FORECAST_ENDPOINT =
  "https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst";
const BASE_TIMES = ["2300", "2000", "1700", "1400", "1100", "0800", "0500", "0200"];

export type HourlyForecast = {
  date: string;
  time: string;
  precipitationProbability: number;
  precipitationAmountMm: number;
  precipitationType: string;
  humidity: number | null;
  temperature: number | null;
};

type KmaItem = {
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
};

type KmaResponse = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: { item?: KmaItem[] } };
  };
};

export async function fetchStadiumForecast(
  stadium: Stadium,
  now = new Date(),
): Promise<{ issuedAt: string; hours: HourlyForecast[] }> {
  const authKey = process.env.KMA_AUTH_KEY;
  if (!authKey) throw new KmaConfigurationError();

  const { baseDate, baseTime } = getLatestBaseTime(now);
  const grid = toKmaGrid(stadium.latitude, stadium.longitude);
  const url = new URL(KMA_FORECAST_ENDPOINT);
  url.search = new URLSearchParams({
    authKey,
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: String(grid.x),
    ny: String(grid.y),
  }).toString();

  const response = await fetch(url, { next: { revalidate: 600 } });
  if (!response.ok) throw new Error(`기상청 예보 조회 실패: ${response.status}`);

  const payload = (await response.json()) as KmaResponse;
  const header = payload.response?.header;
  if (header?.resultCode && header.resultCode !== "00") {
    throw new Error(`기상청 예보 오류: ${header.resultMsg ?? header.resultCode}`);
  }

  const items = payload.response?.body?.items?.item ?? [];
  return { issuedAt: `${baseDate}T${baseTime}:00+09:00`, hours: toHourlyForecasts(items) };
}

export function getRiskForecast(hours: HourlyForecast[], date: string, time: string) {
  const targetTime = `${time.slice(0, 2)}00`;
  const target = hours.find((hour) => hour.date === date && hour.time === targetTime);
  if (!target) return null;

  const gameStart = new Date(`${date}T${targetTime.slice(0, 2)}:${targetTime.slice(2)}:00+09:00`);
  const rainBeforeGame = hours.some((hour) => {
    const forecastAt = new Date(
      `${hour.date.slice(0, 4)}-${hour.date.slice(4, 6)}-${hour.date.slice(6)}T${hour.time.slice(0, 2)}:${hour.time.slice(2)}:00+09:00`,
    );
    const hoursUntilGame = (gameStart.getTime() - forecastAt.getTime()) / 3_600_000;
    return hoursUntilGame >= 0 && hoursUntilGame <= 6 && isRaining(hour);
  });

  return { ...target, rainBeforeGame };
}

function toHourlyForecasts(items: KmaItem[]): HourlyForecast[] {
  const grouped = new Map<string, Partial<Record<string, string>>>();

  for (const item of items) {
    if (!["POP", "PCP", "PTY", "REH", "TMP"].includes(item.category)) continue;
    const key = `${item.fcstDate}-${item.fcstTime}`;
    grouped.set(key, { ...grouped.get(key), [item.category]: item.fcstValue });
  }

  return Array.from(grouped, ([key, values]) => {
    const [date, time] = key.split("-");
    return {
      date,
      time,
      precipitationProbability: toNumber(values.POP) ?? 0,
      precipitationAmountMm: parsePrecipitationAmount(values.PCP),
      precipitationType: values.PTY ?? "0",
      humidity: toNumber(values.REH),
      temperature: toNumber(values.TMP),
    };
  });
}

function getLatestBaseTime(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  const availableHour = minute < 10 ? hour - 1 : hour;
  const baseTime = BASE_TIMES.find((time) => Number(time.slice(0, 2)) <= availableHour);

  if (baseTime) return { baseDate: `${value("year")}${value("month")}${value("day")}`, baseTime };

  const previousDay = new Date(Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day")) - 1));
  return {
    baseDate: previousDay.toISOString().slice(0, 10).replaceAll("-", ""),
    baseTime: "2300",
  };
}

function isRaining(forecast: HourlyForecast) {
  return forecast.precipitationType !== "0" || forecast.precipitationAmountMm > 0;
}

function toNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePrecipitationAmount(value: string | undefined) {
  if (!value || value.includes("없음")) return 0;
  if (value.includes("미만")) return 0.5;
  const matched = value.match(/[\d.]+/);
  return matched ? Number(matched[0]) : 0;
}

function toKmaGrid(latitude: number, longitude: number) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;
  const sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) /
    Math.log(Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5));
  const sf = (Math.tan(Math.PI * 0.25 + slat1 * 0.5) ** sn * Math.cos(slat1)) / sn;
  const ro = (re * sf) / Math.tan(Math.PI * 0.25 + olat * 0.5) ** sn;
  const ra = (re * sf) / Math.tan(Math.PI * 0.25 + latitude * DEGRAD * 0.5) ** sn;
  let theta = longitude * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  return {
    x: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    y: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

export class KmaConfigurationError extends Error {
  constructor() {
    super("KMA_AUTH_KEY 환경 변수가 설정되지 않았습니다.");
  }
}
