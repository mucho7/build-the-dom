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
  historicalNote?: string;
};

type RiskCopy = Pick<RiskAssessment, "label" | "headline" | "summary" | "preparation">;

const FORECAST_RISK_COPY = {
  safe: {
    label: "우취 걱정 낮음",
    headline: "출발해도 좋아요",
    summary: "경기 시간에는 비가 내릴 가능성이 낮아요.",
    preparation: "평소처럼 여유 있게 출발해도 좋아요.",
  },
  prepare: {
    label: "우산은 챙겨요",
    headline: "우산 챙기고 출발!",
    summary: "약한 비가 예상되지만 경기 진행에는 큰 영향이 없어 보여요.",
    preparation: "접이식 우산과 방수 가방을 챙기면 좋아요.",
  },
  caution: {
    label: "출발 전 확인 필요",
    headline: "출발 전 한 번 더 확인해요",
    summary: "경기 시간에 비가 이어질 가능성이 있어요.",
    preparation: "출발 직전에 예보와 KBO 공지를 다시 확인해 주세요.",
  },
  risky: {
    label: "우취 걱정 높음",
    headline: "집관도 고려해보세요",
    summary: "경기 전후로 강한 비가 이어질 가능성이 높아요.",
    preparation: "출발 전 KBO 공식 경기 공지를 꼭 확인해 주세요.",
  },
} as const satisfies Record<RiskLevel, RiskCopy>;

const HISTORY_RISK_COPY = {
  safe: FORECAST_RISK_COPY.safe,
  prepare: {
    label: "우산은 챙겨요",
    headline: "우산 챙기고 출발!",
    summary: "경기 진행에는 큰 영향이 없어 보이지만, 비에 대비하면 좋아요.",
    preparation: "접이식 우산과 방수 가방을 챙기면 좋아요.",
  },
  caution: {
    label: "출발 전 확인 필요",
    headline: "출발 전 한 번 더 확인해요",
    summary: "예보와 과거 우천취소 이력을 함께 확인할 필요가 있어요.",
    preparation: "출발 직전에 예보와 KBO 공지를 다시 확인해 주세요.",
  },
  risky: {
    label: "우취 걱정 높음",
    headline: "집관도 고려해보세요",
    summary: "예보와 과거 우천취소 이력을 함께 보면 취소 위험이 높아요.",
    preparation: "출발 전 KBO 공식 경기 공지를 꼭 확인해 주세요.",
  },
} as const satisfies Record<RiskLevel, RiskCopy>;

const DOME_RISK_COPY = {
  label: "강수 영향 낮음",
  headline: "갈 만해요",
  summary: "돔 구장이라 비가 와도 경기 진행에는 영향이 적어요.",
  preparation: "평소처럼 여유 있게 출발해도 좋아요.",
} as const satisfies RiskCopy;

export type HistoricalRainoutStats = {
  similarGames: number;
  similarRainCancelledGames: number;
  rainoutRate: number;
  criteria: {
    precipitationAmount: string;
    rainBeforeGame: boolean;
  };
  matchType: "exact" | "precipitation_only";
};

export function calculateRainoutRisk(input: RiskInput): RiskAssessment {
  if (input.isDome) {
    return createRiskAssessment("safe", 5, DOME_RISK_COPY);
  }

  let score = 0;
  if (input.precipitationProbability >= 70) score += 40;
  else if (input.precipitationProbability >= 40) score += 22;
  else if (input.precipitationProbability >= 20) score += 10;

  if (input.precipitationAmountMm >= 5) score += 35;
  else if (input.precipitationAmountMm >= 2) score += 20;
  else if (input.precipitationAmountMm > 0) score += 8;

  if (input.rainBeforeGame) score += 12;

  const level = getRiskLevel(score);
  return createRiskAssessment(level, score, FORECAST_RISK_COPY[level]);
}

export function applyHistoricalRainoutAdjustment(
  assessment: RiskAssessment,
  history: HistoricalRainoutStats,
  isDome: boolean,
): RiskAssessment {
  if (isDome) return assessment;

  const rate = history.rainoutRate;
  // 완전 일치 표본은 5경기 이상일 때, 강수량 보조 표본은 60% 이상 취소됐을 때만
  // 실제 우천취소율을 위험도의 하한으로 삼는다.
  // 예: 6경기 중 5경기 취소라면 예보 점수가 낮아도 최소 83점으로 표시한다.
  const shouldPrioritizeHistory = history.similarGames >= 5 && (
    history.matchType === "exact" || rate >= 0.6
  );
  const historicalScore = shouldPrioritizeHistory
    ? Math.round(rate * 100)
    : null;
  const historicalNote = history.matchType === "exact"
    ? `최근 3년간 예상 강수량과 경기 전 비가 비슷했던 ${history.similarGames}경기 중 ${history.similarRainCancelledGames}경기가 우천취소됐어요.`
    : `최근 3년간 강수량이 비슷했던 ${history.similarGames}경기 중 ${history.similarRainCancelledGames}경기가 우천취소됐어요. 경기 전 비 조건은 제외한 보조 참고예요.`;
  const score = historicalScore === null
    ? assessment.score
    : Math.max(assessment.score, historicalScore);
  const level = getRiskLevel(score);

  if (level === assessment.level) return { ...assessment, score, historicalNote };

  return { ...createRiskAssessment(level, score, HISTORY_RISK_COPY[level]), historicalNote };
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 65) return "risky";
  if (score >= 38) return "caution";
  if (score >= 15) return "prepare";
  return "safe";
}

function createRiskAssessment(level: RiskLevel, score: number, copy: RiskCopy): RiskAssessment {
  return { level, score, ...copy };
}
