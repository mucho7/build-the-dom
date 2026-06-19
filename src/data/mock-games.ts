import { calculateRainoutRisk, type RiskInput } from "@/lib/risk";

type GameWeather = RiskInput & {
  rainBeforeGameLabel: string;
  rainDuringGameLabel: string;
};

export type MockGame = {
  id: string;
  label: string;
  stadium: string;
  time: string;
  stadiumType: "돔" | "야외";
  weather: GameWeather;
};

export const mockGames: MockGame[] = [
  {
    id: "lg-doosan",
    label: "LG vs 두산",
    stadium: "잠실야구장",
    time: "18:30",
    stadiumType: "야외",
    weather: {
      isDome: false,
      precipitationProbability: 30,
      precipitationAmountMm: 0.4,
      rainBeforeGame: true,
      rainBeforeGameLabel: "조금",
      rainDuringGameLabel: "낮음",
    },
  },
  {
    id: "hanwha-ssg",
    label: "한화 vs SSG",
    stadium: "대전 한화생명 볼파크",
    time: "18:30",
    stadiumType: "야외",
    weather: {
      isDome: false,
      precipitationProbability: 80,
      precipitationAmountMm: 7,
      rainBeforeGame: true,
      rainBeforeGameLabel: "강함",
      rainDuringGameLabel: "높음",
    },
  },
  {
    id: "kiwoom-nc",
    label: "키움 vs NC",
    stadium: "고척스카이돔",
    time: "18:30",
    stadiumType: "돔",
    weather: {
      isDome: true,
      precipitationProbability: 90,
      precipitationAmountMm: 12,
      rainBeforeGame: true,
      rainBeforeGameLabel: "강함",
      rainDuringGameLabel: "영향 적음",
    },
  },
];

export function getMockGameAssessment(game: MockGame) {
  return calculateRainoutRisk(game.weather);
}
