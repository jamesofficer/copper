// Maps a GitHub label's hex colour to the closest Chakra colour palette, so
// labels render as properly themed chips (readable fg/bg pairs in both colour
// modes) instead of raw hex text that fights the app's backgrounds.
export function labelPalette(hex: string): string {
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "gray";
  const value = Number.parseInt(hex, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 510;
  const saturation =
    delta === 0 ? 0 : delta / (255 - Math.abs(max + min - 255));
  if (saturation < 0.15 || lightness < 0.08 || lightness > 0.95) return "gray";

  let hue: number;
  if (max === r) hue = 60 * (((g - b) / delta + 6) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);

  if (hue < 15) return "red";
  if (hue < 42) return "orange";
  if (hue < 70) return "yellow";
  if (hue < 165) return "green";
  if (hue < 200) return "teal";
  if (hue < 220) return "cyan";
  if (hue < 265) return "blue";
  if (hue < 305) return "purple";
  if (hue < 345) return "pink";
  return "red";
}
