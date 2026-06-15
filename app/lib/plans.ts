export const PLANS = {
  BASIC: "BASIC Monthly",
  PRO: "PRO Monthly",
} as const;

export type PlanName = (typeof PLANS)[keyof typeof PLANS];
