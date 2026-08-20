// The body font size changes the root rem unit. Text and its controls scale
// together, so larger text does not overflow fixed-size controls.
export const bodyFontSizes = [14, 16, 18, 20] as const;

export type BodyFontSize = (typeof bodyFontSizes)[number];

export const defaultBodyFontSize: BodyFontSize = 16;

const STORAGE_KEY = "bodyFontSize";

function isBodyFontSize(value: number): value is BodyFontSize {
  return bodyFontSizes.includes(value as BodyFontSize);
}

export function getBodyFontSize(): BodyFontSize {
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  return isBodyFontSize(stored) ? stored : defaultBodyFontSize;
}

export function applyBodyFontSize(size: BodyFontSize): void {
  document.documentElement.dataset.bodyFontSize = String(size);
  localStorage.setItem(STORAGE_KEY, String(size));
}
