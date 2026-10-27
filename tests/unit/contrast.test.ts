import { describe, expect, it } from 'vitest';
import { FINDING_STATE_STYLES } from '@/components/findings/finding-state-badge';
import { SEVERITY_BADGE_STYLES } from '@/components/findings/severity-badge';
import { STATUS_BADGE_STYLES } from '@/components/scans/status-badge';
import {
  colourPairs,
  contrast,
  over,
  paletteColour,
  parseOklch,
  token,
  type Rgb,
} from './support/contrast';

// WCAG 2.1 AA: 4.5 to 1 for normal text, 3 to 1 for large text, icons and the edges of controls.
const TEXT = 4.5;
const NON_TEXT = 3;
const modes = ['light', 'dark'] as const;

const ratio = (a: Rgb, b: Rgb) => Math.round(contrast(a, b) * 100) / 100;

describe('the colour maths', () => {
  it('knows black on white is 21 to 1, and a colour on itself is 1 to 1', () => {
    const black = parseOklch('oklch(0 0 0)').rgb;
    const white = parseOklch('oklch(1 0 0)').rgb;
    expect(contrast(black, white)).toBeCloseTo(21, 1);
    expect(contrast(white, white)).toBeCloseTo(1, 5);
  });

  it('matches a known pair: #767676 on white is about 4.54 to 1', () => {
    // #767676 is oklch(0.5686 0 0) to four digits.
    expect(
      contrast(parseOklch('oklch(0.5686 0 0)').rgb, parseOklch('oklch(1 0 0)').rgb),
    ).toBeCloseTo(4.54, 1);
  });

  it('mixes a see-through colour over a background', () => {
    expect(over([1, 1, 1], 0.5, [0, 0, 0])).toEqual([0.5, 0.5, 0.5]);
  });
});

describe.each(modes)('theme text colours (%s mode)', (mode) => {
  const pairs: [string, string, string][] = [
    ['foreground', 'background', 'body text'],
    ['card-foreground', 'card', 'card text'],
    ['popover-foreground', 'popover', 'menu text'],
    ['primary-foreground', 'primary', 'text on a primary button'],
    ['secondary-foreground', 'secondary', 'text on a secondary button'],
    ['accent-foreground', 'accent', 'text on a hovered item'],
    ['muted-foreground', 'background', 'hint text on the page'],
    ['muted-foreground', 'card', 'hint text on a card'],
    ['muted-foreground', 'muted', 'hint text on a muted area'],
    ['primary', 'background', 'links and headings in the accent colour'],
    ['primary', 'card', 'accent text on a card'],
    ['destructive', 'background', 'error messages'],
    ['destructive', 'card', 'error messages on a card'],
    ['sidebar-foreground', 'sidebar', 'sidebar text'],
  ];

  it.each(pairs)('%s on %s (%s) is at least 4.5 to 1', (fg, bg) => {
    expect(ratio(token(mode, fg), token(mode, bg))).toBeGreaterThanOrEqual(TEXT);
  });
});

describe.each(modes)('theme controls (%s mode)', (mode) => {
  it('the edge of an input is at least 3 to 1 against the page, so it can be seen', () => {
    expect(ratio(token(mode, 'input'), token(mode, 'background'))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it('the focus ring, drawn at half strength like the buttons do, is at least 3 to 1', () => {
    const half = over(token(mode, 'ring'), 0.5, token(mode, 'background'));
    expect(ratio(half, token(mode, 'background'))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it('the focus ring is at least 3 to 1 at full strength too', () => {
    expect(ratio(token(mode, 'ring'), token(mode, 'background'))).toBeGreaterThanOrEqual(NON_TEXT);
  });
});

describe('badge colours', () => {
  const badges: [string, string][] = [
    ...Object.entries(STATUS_BADGE_STYLES).map(
      ([key, value]) => [`status ${key}`, value.className] as [string, string],
    ),
    ...Object.entries(SEVERITY_BADGE_STYLES).map(
      ([key, value]) => [`severity ${key}`, value.className] as [string, string],
    ),
    ...Object.entries(FINDING_STATE_STYLES).map(
      ([key, value]) => [`state ${key}`, value] as [string, string],
    ),
  ];

  it('covers every status, severity and state', () => {
    expect(badges).toHaveLength(5 + 4 + 2);
  });

  it.each(badges)('%s is at least 4.5 to 1 in light and dark mode', (_name, classes) => {
    const pairs = colourPairs(classes);
    for (const mode of modes) {
      const { bg, text } = pairs[mode];
      expect(
        ratio(paletteColour(text), paletteColour(bg)),
        `${mode}: ${text} on ${bg}`,
      ).toBeGreaterThanOrEqual(TEXT);
    }
  });
});

describe('banner and highlight colours used around the app', () => {
  // [description, light text, light background, dark text, dark background]
  const pairs: [string, string, string, string, string][] = [
    [
      'amber notices (expiry, reconnecting, slow scan)',
      'amber-950',
      'amber-100',
      'amber-100',
      'amber-950',
    ],
    ['red results card (New HIGH)', 'red-900', 'red-50', 'red-100', 'red-950'],
    ['failed scan box', 'red-950', 'red-50', 'red-100', 'red-950'],
    [
      'New HIGH count in a table (on the page colour)',
      'red-700',
      'white',
      'red-300',
      'neutral-950',
    ],
    ['"Running for" counter (on the page colour)', 'blue-700', 'white', 'blue-300', 'neutral-950'],
  ];

  it.each(pairs)('%s is at least 4.5 to 1', (_name, lightText, lightBg, darkText, darkBg) => {
    const colour = (name: string) => (name === 'white' ? ([1, 1, 1] as Rgb) : paletteColour(name));
    expect(ratio(colour(lightText), colour(lightBg)), 'light').toBeGreaterThanOrEqual(TEXT);
    expect(ratio(colour(darkText), colour(darkBg)), 'dark').toBeGreaterThanOrEqual(TEXT);
  });

  it('the check mark and cross in the timeline are at least 3 to 1 on their circles', () => {
    expect(ratio([1, 1, 1], paletteColour('green-600')), 'done, light').toBeGreaterThanOrEqual(
      NON_TEXT,
    );
    expect(ratio([1, 1, 1], paletteColour('red-600')), 'failed, light').toBeGreaterThanOrEqual(
      NON_TEXT,
    );
    expect(
      ratio(paletteColour('green-950'), paletteColour('green-500')),
      'done, dark',
    ).toBeGreaterThanOrEqual(NON_TEXT);
    expect(
      ratio(paletteColour('red-950'), paletteColour('red-500')),
      'failed, dark',
    ).toBeGreaterThanOrEqual(NON_TEXT);
  });
});
