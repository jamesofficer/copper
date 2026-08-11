import {
  type ReviewPersonality,
  reviewPersonalities,
} from "../../../shared/types";

export const personalityOptions: Array<{
  value: ReviewPersonality;
  label: string;
  description: string;
}> = [
  {
    value: "standard",
    label: "Standard",
    description: "Clear, balanced prose for a working engineer.",
  },
  {
    value: "technical",
    label: "Technical",
    description: "Dense and precise, written for a staff-level engineer.",
  },
  {
    value: "non_technical",
    label: "Non-technical",
    description: "Product and user impact, no jargon.",
  },
  {
    value: "simplified",
    label: "Simplified",
    description: "Short sentences and everyday words, first-week friendly.",
  },
  {
    value: "ste",
    label: "Simplified Technical English",
    description: "ASD-STE100: approved words, short sentences, active voice.",
  },
  {
    value: "grug",
    label: "Grug",
    description: "grug see complexity. grug worry.",
  },
  {
    value: "mentor",
    label: "Mentor",
    description: "Explains the why behind each finding, names the patterns.",
  },
  {
    value: "concise",
    label: "Concise",
    description: "As few words as possible, nothing dropped.",
  },
];

export const defaultPersonality: ReviewPersonality = "standard";

const STORAGE_KEY = "reviewPersonality";

function isPersonality(value: string | null): value is ReviewPersonality {
  return reviewPersonalities.includes(value as ReviewPersonality);
}

export function getReviewPersonality(): ReviewPersonality {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isPersonality(stored) ? stored : defaultPersonality;
}

export function setReviewPersonality(personality: ReviewPersonality): void {
  localStorage.setItem(STORAGE_KEY, personality);
}
