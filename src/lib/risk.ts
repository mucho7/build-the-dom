export type RiskLevel = "safe" | "prepare" | "caution" | "risky";

export type RiskInput = {
  isDome: boolean;
  precipitationProbability: number;
  precipitationAmountMm: number;
  rainBeforeGame: boolean;
};

export type RiskAssessment = {
  level: RiskLevel;
  label: string;
  headline: string;
  summary: string;
  preparation: string;
  score: number;
};

export function calculateRainoutRisk(input: RiskInput): RiskAssessment {
  if (input.isDome) {
    return {
      level: "safe",
      label: "강수 영향 낮음",
      headline: "갈 만해요",
      summary: "돔 구장이라 비가 와도 경기 진행에는 영향이 적어요.",
      preparation: "평소처럼 여유 있게 출발해도 좋아요.",
      score: 5,
    };
  }

  let score = 0;
  if (input.precipitationProbability >= 70) score += 40;
  else if (input.precipitationProbability >= 40) score += 22;
  else if (input.precipitationProbability >= 20) score += 10;

  if (input.precipitationAmountMm >= 5) score += 35;
  else if (input.precipitationAmountMm >= 2) score += 20;
  else if (input.precipitationAmountMm > 0) score += 8;

  if (input.rainBeforeGame) score += 12;

  if (score >= 65) {
    return {
      level: "risky",
      label: "우천 걱정 높음",
      headline: "다시 생각해보세요",
      summary: "경기 전후로 강한 비가 이어질 가능성이 높아요.",
      preparation: "출발 전 KBO 공식 경기 공지를 꼭 확인해 주세요.",
      score,
    };
  }

  if (score >= 38) {
    return {
      level: "caution",
      label: "출발 전 확인 필요",
      headline: "조금 더 지켜봐요",
      summary: "경기 시간에 비가 이어질 가능성이 있어요.",
      preparation: "출발 직전에 예보와 KBO 공지를 다시 확인해 주세요.",
      score,
    };
  }

  if (score >= 15) {
    return {
      level: "prepare",
      label: "우산은 챙겨요",
      headline: "갈 만해요",
      summary: "약한 비가 예상되지만 경기 진행에는 큰 영향이 없어 보여요.",
      preparation: "접이식 우산과 방수 가방을 챙기면 좋아요.",
      score,
    };
  }

  return {
    level: "safe",
    label: "우천 걱정 낮음",
    headline: "갈 만해요",
    summary: "경기 시간에는 비가 내릴 가능성이 낮아요.",
    preparation: "평소처럼 여유 있게 출발해도 좋아요.",
    score,
  };
}
