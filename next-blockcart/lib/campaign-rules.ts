import type { Campaign, CampaignRule, CampaignRewardType } from "@/lib/types";

export type CampaignGenderOption = "female" | "male" | "non-binary" | "unspecified";

export interface CampaignRuleFormState {
  version: number;
  rewardType: CampaignRewardType;
  rewardValue: string;
  minSpend: string;
  eligibleStores: string[];
  includeAllStores: boolean;
  multiplierDouble: boolean;
  multiplierStack: boolean;
  demographics: {
    ageMin: string;
    ageMax: string;
    genders: CampaignGenderOption[];
    kycVerified: boolean;
  };
  referral: {
    required: boolean;
    bonusAmount: string;
  };
}

export interface CampaignRuleParseResult {
  form: CampaignRuleFormState;
  extras: Record<string, unknown>;
}

const DEFAULT_FORM_STATE: CampaignRuleFormState = {
  version: 1,
  rewardType: "multiplier",
  rewardValue: "",
  minSpend: "",
  eligibleStores: [],
  includeAllStores: true,
  multiplierDouble: false,
  multiplierStack: false,
  demographics: {
    ageMin: "",
    ageMax: "",
    genders: [],
    kycVerified: false,
  },
  referral: {
    required: false,
    bonusAmount: "",
  },
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function coerceStringNumber(value: unknown): string {
  if (value === null || value === undefined) return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return String(num);
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return false;
}

function ensureGender(value: string): CampaignGenderOption {
  const normalized = value.toLowerCase();
  if (normalized === "female" || normalized === "male" || normalized === "non-binary") {
    return normalized;
  }
  return "unspecified";
}

export function cloneRuleFormState(state: CampaignRuleFormState): CampaignRuleFormState {
  return {
    ...state,
    eligibleStores: [...state.eligibleStores],
    demographics: {
      ...state.demographics,
      genders: [...state.demographics.genders],
    },
    referral: { ...state.referral },
  };
}

export function defaultRuleFormState(): CampaignRuleFormState {
  return cloneRuleFormState(DEFAULT_FORM_STATE);
}

export function parseCampaignRule(rule: CampaignRule | null | undefined): CampaignRuleParseResult {
  const form = defaultRuleFormState();
  const extras: Record<string, unknown> = {};

  if (!rule || typeof rule !== "object") {
    return { form, extras };
  }

  const knownKeys = new Set([
    "version",
    "reward_type",
    "reward_value",
    "min_spend",
    "eligible_stores",
    "multiplier_overrides",
    "demographics",
    "referral",
  ]);

  if (isFiniteNumber(rule.version)) {
    form.version = rule.version;
  }

  if (typeof rule.reward_type === "string") {
    const candidate = rule.reward_type as CampaignRewardType;
    if (candidate === "multiplier" || candidate === "fixed_bonus" || candidate === "referral_boost") {
      form.rewardType = candidate;
    }
  }

  if (rule.reward_value !== undefined) {
    form.rewardValue = coerceStringNumber(rule.reward_value);
  }

  if (rule.min_spend !== undefined) {
    form.minSpend = coerceStringNumber(rule.min_spend);
  }

  if (Array.isArray(rule.eligible_stores)) {
    form.eligibleStores = rule.eligible_stores
      .map((value) => (typeof value === "string" ? value : null))
      .filter((value): value is string => !!value);
    form.includeAllStores = form.eligibleStores.length === 0;
  }

  if (rule.multiplier_overrides && typeof rule.multiplier_overrides === "object") {
    const overrides = rule.multiplier_overrides as Record<string, unknown>;
    form.multiplierDouble = coerceBoolean(overrides.double_base);
    form.multiplierStack = coerceBoolean(overrides.stack_with_existing);
  }

  if (rule.demographics && typeof rule.demographics === "object") {
    const demographics = rule.demographics as Record<string, unknown>;
    if (demographics.age_min !== undefined) {
      form.demographics.ageMin = coerceStringNumber(demographics.age_min);
    }
    if (demographics.age_max !== undefined) {
      form.demographics.ageMax = coerceStringNumber(demographics.age_max);
    }
    if (Array.isArray(demographics.genders)) {
      form.demographics.genders = demographics.genders
        .map((value) => (typeof value === "string" ? ensureGender(value) : null))
        .filter((value): value is CampaignGenderOption => !!value);
    }
    if (demographics.kyc_verified !== undefined) {
      form.demographics.kycVerified = coerceBoolean(demographics.kyc_verified);
    }
  }

  if (rule.referral && typeof rule.referral === "object") {
    const referral = rule.referral as Record<string, unknown>;
    if (referral.required !== undefined) {
      form.referral.required = coerceBoolean(referral.required);
    }
    if (referral.bonus_amount !== undefined) {
      form.referral.bonusAmount = coerceStringNumber(referral.bonus_amount);
    }
  }

  for (const [key, value] of Object.entries(rule)) {
    if (!knownKeys.has(key)) {
      extras[key] = value as unknown;
    }
  }

  return { form, extras };
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildCampaignRulePayload(
  form: CampaignRuleFormState,
  extras: Record<string, unknown> = {}
): CampaignRule {
  const payload: CampaignRule = {
    version: form.version,
    reward_type: form.rewardType,
  };

  const minSpend = toNumber(form.minSpend);
  if (minSpend !== null) {
    payload.min_spend = minSpend;
  }

  if (!form.includeAllStores) {
    payload.eligible_stores = [...form.eligibleStores];
  } else {
    payload.eligible_stores = [];
  }

  if (form.rewardType === "fixed_bonus" || form.rewardType === "referral_boost") {
    const rewardValue = toNumber(form.rewardValue);
    if (rewardValue !== null) {
      payload.reward_value = rewardValue;
    }
  }

  if (form.multiplierDouble || form.multiplierStack) {
    payload.multiplier_overrides = {
      double_base: form.multiplierDouble || undefined,
      stack_with_existing: form.multiplierStack || undefined,
    };
  }

  const hasDemographics =
    form.demographics.ageMin.trim() ||
    form.demographics.ageMax.trim() ||
    form.demographics.genders.length > 0 ||
    form.demographics.kycVerified;

  if (hasDemographics) {
    payload.demographics = {};
    const min = toNumber(form.demographics.ageMin);
    const max = toNumber(form.demographics.ageMax);
    if (min !== null) {
      payload.demographics.age_min = min;
    }
    if (max !== null) {
      payload.demographics.age_max = max;
    }
    if (form.demographics.genders.length > 0) {
      payload.demographics.genders = [...form.demographics.genders];
    }
    if (form.demographics.kycVerified) {
      payload.demographics.kyc_verified = true;
    }
  }

  if (form.rewardType === "referral_boost") {
    payload.referral = {
      required: form.referral.required || undefined,
    };
    const bonus = toNumber(form.referral.bonusAmount);
    if (bonus !== null) {
      payload.referral.bonus_amount = bonus;
    }
  }

  return Object.assign({}, extras, payload);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);

  return `{${entries.join(",")}}`;
}

export function createDraftFromCampaign(
  campaign: Campaign
): { form: CampaignRuleFormState; extras: Record<string, unknown> } {
  return parseCampaignRule(campaign.rule_json);
}

export interface CampaignRuleTemplate {
  id: string;
  name: string;
  description: string;
  rule: CampaignRuleFormState;
  recommendedMultiplier?: number;
}

export const CAMPAIGN_RULE_TEMPLATES: CampaignRuleTemplate[] = [
  {
    id: "double-rewards-weekend",
    name: "Double Rewards Weekend",
    description: "Apply 2x rewards for shoppers who spend at least $25 at any store.",
    rule: {
      ...defaultRuleFormState(),
      multiplierDouble: true,
      minSpend: "25",
      includeAllStores: true,
      eligibleStores: [],
    },
    recommendedMultiplier: 2,
  },
  {
    id: "fixed-bonus-grocery",
    name: "Grocery Basket Bonus",
    description: "Grant a fixed 5 token bonus for approved grocery receipts above $40.",
    rule: {
      ...defaultRuleFormState(),
      rewardType: "fixed_bonus",
      rewardValue: "5",
      minSpend: "40",
      includeAllStores: false,
      eligibleStores: ["Blockcart Fresh", "City Grocers"],
    },
  },
  {
    id: "referral-boost",
    name: "Referral Boost",
    description: "Reward referred shoppers with a 10 token welcome bonus once KYC is verified.",
    rule: {
      ...defaultRuleFormState(),
      rewardType: "referral_boost",
      rewardValue: "10",
      referral: { required: true, bonusAmount: "10" },
      demographics: { ageMin: "", ageMax: "", genders: [], kycVerified: true },
      includeAllStores: true,
      eligibleStores: [],
    },
  },
];

export function applyTemplateToForm(
  template: CampaignRuleTemplate,
  baseExtras: Record<string, unknown>
): { form: CampaignRuleFormState; extras: Record<string, unknown> } {
  const form = cloneRuleFormState(template.rule);
  return { form, extras: { ...baseExtras } };
}

export const DEFAULT_GENDER_OPTIONS: CampaignGenderOption[] = [
  "female",
  "male",
  "non-binary",
  "unspecified",
];
