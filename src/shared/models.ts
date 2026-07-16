import type { LlmTask } from "./types";

export interface LlmModelOption {
  id: string;
  label: string;
  description: string;
}

// The models offered in settings, for both analysis and chat.
export const MODEL_OPTIONS: LlmModelOption[] = [
  {
    id: "claude-fable-5",
    label: "Fable 5",
    description: "The most intelligent model — slowest and most expensive.",
  },
  {
    id: "claude-opus-4-8",
    label: "Opus 4.8",
    description: "Most capable — the deepest analyses, slower and priciest.",
  },
  {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    description: "Fast and capable — a strong default.",
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Haiku 4.5",
    description: "Fastest and cheapest — fine for straightforward PRs.",
  },
];

export const DEFAULT_MODELS: Record<LlmTask, string> = {
  analysis: "claude-opus-4-8",
  chat: "claude-sonnet-5",
};

export function isKnownModel(id: string): boolean {
  return MODEL_OPTIONS.some((option) => option.id === id);
}
