import { readFileSync } from 'node:fs';
import path from 'node:path';

// Colour maths for the accessibility tests. Everything is converted to what a screen would
// show (sRGB), then compared with the WCAG formula.

export type Rgb = [number, number, number]; // sRGB, 0 to 1

const root = path.resolve(import.meta.dirname, '../../..');

function oklchToRgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const gamma = (v: number) => {
    const x = Math.min(1, Math.max(0, v));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return [gamma(linear[0] ?? 0), gamma(linear[1] ?? 0), gamma(linear[2] ?? 0)];
}

/** "oklch(0.5 0.1 195)", "oklch(93.6% 0.032 17.7)" or "oklch(1 0 0 / 15%)". */
export function parseOklch(value: string): { rgb: Rgb; alpha: number } {
  const match =
    /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+|none)(?:\s*\/\s*([\d.]+)(%?))?\s*\)/.exec(value);
  if (!match) throw new Error(`Cannot read colour: ${value}`);
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const alpha = match[5] === undefined ? 1 : Number(match[5]) / (match[6] ? 100 : 1);
  return {
    rgb: oklchToRgb(lightness, Number(match[3]), match[4] === 'none' ? 0 : Number(match[4])),
    alpha,
  };
}

/** Lays a colour with some transparency over another, the way the browser does. */
export function over(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return [0, 1, 2].map((i) => (top[i] ?? 0) * alpha + (bottom[i] ?? 0) * (1 - alpha)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio, from 1 (none) to 21 (black on white). */
export function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

// ---- our theme (src/app/globals.css) ----

const css = readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');

function readBlock(selector: RegExp): Record<string, string> {
  const block = selector.exec(css)?.[1] ?? '';
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    if (name && value) tokens[name] = value.trim();
  }
  return tokens;
}

export const lightTokens = readBlock(/^:root\s*\{([^}]*)\}/m);
export const darkTokens = readBlock(/^\.dark\s*\{([^}]*)\}/m);

export function token(mode: 'light' | 'dark', name: string): Rgb {
  const value = (mode === 'light' ? lightTokens : darkTokens)[name];
  if (!value) throw new Error(`No ${mode} token named ${name}`);
  const { rgb, alpha } = parseOklch(value);
  // A see-through token (like a dark-mode border) is judged as it looks over the page.
  return alpha === 1 ? rgb : over(rgb, alpha, token(mode, 'background'));
}

// ---- Tailwind's palette, for the badge and banner colours ----

const palette = readFileSync(path.join(root, 'node_modules/tailwindcss/theme.css'), 'utf8');

export function paletteColour(name: string): Rgb {
  const match = new RegExp(`--color-${name}:\\s*(oklch\\([^)]*\\))`).exec(palette);
  if (!match?.[1]) throw new Error(`No palette colour named ${name}`);
  return parseOklch(match[1]).rgb;
}

/** "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" into the colours for each mode. */
export function colourPairs(
  classes: string,
): Record<'light' | 'dark', { bg: string; text: string }> {
  const pick = (prefix: string, kind: 'bg' | 'text') => {
    const match = new RegExp(`(?:^|\\s)${prefix}${kind}-([a-z]+-\\d+)(?=\\s|$)`).exec(classes);
    if (!match?.[1]) throw new Error(`No ${prefix}${kind} colour in: ${classes}`);
    return match[1];
  };
  return {
    light: { bg: pick('', 'bg'), text: pick('', 'text') },
    dark: { bg: pick('dark:', 'bg'), text: pick('dark:', 'text') },
  };
}
