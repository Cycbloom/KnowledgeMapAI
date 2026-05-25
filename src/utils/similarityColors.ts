export const GROUP_COLOR_PALETTE = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
];

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function generateGroupColors(count: number): string[] {
  if (count <= 0) return [];
  if (count <= GROUP_COLOR_PALETTE.length) {
    return GROUP_COLOR_PALETTE.slice(0, count);
  }

  const colors = [...GROUP_COLOR_PALETTE];
  const baseHues = colors.map(hexToHsl).map(hsl => hsl.h);

  for (let i = GROUP_COLOR_PALETTE.length; i < count; i++) {
    const baseIndex = i % GROUP_COLOR_PALETTE.length;
    const cycle = Math.floor(i / GROUP_COLOR_PALETTE.length);
    const baseHue = baseHues[baseIndex];
    const hueShift = (cycle * 30 + 15) % 60 - 30;
    const newHue = (baseHue + hueShift + 360) % 360;
    const saturation = 70 + (cycle % 3) * 10;
    const lightness = 50 + (cycle % 2) * 10;
    colors.push(hslToHex(newHue, saturation, lightness));
  }

  return colors;
}

export function getSimilarityOpacity(similarity: number): number {
  const clamped = Math.max(0, Math.min(1, similarity));
  return 0.3 + clamped * 0.7;
}
