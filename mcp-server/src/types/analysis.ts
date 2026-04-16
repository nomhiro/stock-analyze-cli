export type JudgmentVerdict = "買い検討" | "注目" | "様子見" | "見送り";

export interface JudgmentScores {
  value: number;
  momentum: number;
  growth: number;
  total: number;
}

export interface JudgmentEntry {
  date: string;
  verdict: JudgmentVerdict;
  scores: JudgmentScores;
  summary: string;
  analysis: string;
}

export interface JudgmentFile {
  symbol: string;
  history: JudgmentEntry[];
}

export interface UserSettings {
  anomaly: {
    dividendYieldThreshold: number;
    perThreshold: number;
    pbrThreshold: number;
  };
  updatedAt: string;
}
