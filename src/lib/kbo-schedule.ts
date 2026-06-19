const KBO_SCHEDULE_ENDPOINT =
  "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList";

export type KboGameStatus = "scheduled" | "played" | "cancelled";

export type KboGame = {
  id: string;
  date: string;
  startTime: string;
  awayTeam: string;
  homeTeam: string;
  stadium: string;
  status: KboGameStatus;
  note: string | null;
  sourceUrl: string;
};

type KboCell = {
  Text: string;
  Class: string | null;
};

type KboResponse = {
  rows: Array<{ row: KboCell[] }>;
};

type FetchLike = typeof fetch;

export async function fetchKboSchedule(
  { year, month }: { year: number; month: number },
  fetchImpl: FetchLike = fetch,
): Promise<KboGame[]> {
  const response = await fetchImpl(KBO_SCHEDULE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://www.koreabaseball.com/Schedule/Schedule.aspx",
      "User-Agent": "RainoutGuide/0.1 (+https://github.com)",
    },
    body: new URLSearchParams({
      leId: "1",
      srIdList: "0,9,6",
      seasonId: String(year),
      gameMonth: String(month),
      teamId: "",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`KBO 일정 조회 실패: ${response.status}`);
  }

  const payload = (await response.json()) as KboResponse;
  return parseKboSchedule(payload, year);
}

export function parseKboSchedule(payload: KboResponse, year: number): KboGame[] {
  let currentDate: string | null = null;

  return payload.rows.flatMap(({ row }) => {
    const date = parseDate(row.find((cell) => cell.Class === "day")?.Text, year);
    if (date) currentDate = date;

    const timeIndex = row.findIndex((cell) => cell.Class === "time");
    const timeCell = row[timeIndex];
    const matchupCell = row.find((cell) => cell.Class === "play");
    const stadiumCell = row[timeIndex + 6];
    const noteCell = row[timeIndex + 7];
    const matchup = parseMatchup(matchupCell?.Text);
    const startTime = getText(timeCell?.Text);
    if (!currentDate || !matchup || !/^\d{2}:\d{2}$/.test(startTime)) return [];

    const note = getText(noteCell?.Text);
    const status = getStatus(matchupCell?.Text ?? "", note);
    const kboGameId = getGameId(row);
    const gameId = kboGameId ?? `${currentDate}-${matchup.awayTeam}-${matchup.homeTeam}`;

    return [
      {
        id: gameId,
        date: currentDate,
        startTime,
        awayTeam: matchup.awayTeam,
        homeTeam: matchup.homeTeam,
        stadium: getText(stadiumCell?.Text),
        status,
        note: note === "-" || note === "" ? null : note,
        sourceUrl: kboGameId
          ? `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${currentDate.replaceAll("-", "")}&gameId=${kboGameId}`
          : "https://www.koreabaseball.com/Schedule/Schedule.aspx",
      },
    ];
  });
}

function parseDate(value: string | undefined, year: number) {
  const matched = getText(value).match(/(\d{2})\.(\d{2})/);
  if (!matched) return null;

  const [, month, day] = matched;
  return `${year}-${month}-${day}`;
}

function parseMatchup(value: string | undefined) {
  if (!value) return null;
  const teams = Array.from(value.matchAll(/<span[^>]*>(.*?)<\/span>/g), (match) =>
    getText(match[1]),
  ).filter((text) => text && text !== "vs" && !/^\d+$/.test(text));

  if (teams.length < 2) return null;
  return { awayTeam: teams[0], homeTeam: teams.at(-1)! };
}

function getGameId(row: KboCell[]) {
  const gameCenterCell = row.find((cell) => cell.Text.includes("gameId="))?.Text ?? "";
  return gameCenterCell.match(/gameId=([^&'"]+)/)?.[1] ?? null;
}

function getStatus(matchupHtml: string, note: string): KboGameStatus {
  if (/우천취소|취소/.test(note)) return "cancelled";
  if (/class=["'][^"']*(win|lose|same)/.test(matchupHtml)) return "played";
  return "scheduled";
}

function getText(value: string | undefined) {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
