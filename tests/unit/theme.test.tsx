import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '@/components/theme/theme-provider';
import { ThemeToggle } from '@/components/theme/theme-toggle';

// A stand-in for the operating system's light/dark setting.
let systemDark = false;
let onSystemChange: (() => void) | null = null;

beforeEach(() => {
  systemDark = false;
  onSystemChange = null;
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return systemDark;
      },
      addEventListener: (_type: string, listener: () => void) => (onSystemChange = listener),
      removeEventListener: () => (onSystemChange = null),
    })),
  );
});
afterEach(() => vi.unstubAllGlobals());

const isDark = () => document.documentElement.classList.contains('dark');
const renderToggle = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
async function choose(name: 'Light' | 'Dark' | 'System') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Change colour theme' }));
  await user.click(await screen.findByRole('menuitemradio', { name }));
}

describe('theme: default is the system setting', () => {
  it('is light when the system is light, and dark when the system is dark', () => {
    renderToggle();
    expect(isDark()).toBe(false);

    systemDark = true;
    renderToggle();
    expect(isDark()).toBe(true);
  });

  it('follows the system while on "System", and stops following once you choose', async () => {
    renderToggle();
    expect(isDark()).toBe(false);

    systemDark = true;
    act(() => onSystemChange?.());
    expect(isDark()).toBe(true);

    await choose('Light');
    expect(isDark()).toBe(false);
    expect(onSystemChange).toBeNull(); // no longer listening
  });
});

describe('theme: your choice is saved in localStorage', () => {
  it('Dark is applied at once and remembered', async () => {
    renderToggle();
    await choose('Dark');
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('Light is remembered, even when the system is dark', async () => {
    systemDark = true;
    renderToggle();
    expect(isDark()).toBe(true);

    await choose('Light');
    expect(isDark()).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('System forgets the choice and goes back to following the system', async () => {
    localStorage.setItem('theme', 'dark');
    renderToggle();
    expect(isDark()).toBe(true);

    await choose('System');
    expect(isDark()).toBe(false);
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('starts with what was saved, over the system setting', () => {
    localStorage.setItem('theme', 'dark');
    renderToggle();
    expect(isDark()).toBe(true);
  });

  it('ignores a saved value that is not light or dark', () => {
    localStorage.setItem('theme', 'purple');
    renderToggle();
    expect(isDark()).toBe(false);
  });

  it('still works when storage is blocked, for this visit', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderToggle();
    await choose('Dark');
    expect(isDark()).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('theme toggle', () => {
  it('is a labelled button that opens Light, Dark and System, with the current one marked', async () => {
    localStorage.setItem('theme', 'dark');
    renderToggle();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Change colour theme' }));

    expect(await screen.findByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeInTheDocument();
  });

  it('useTheme refuses to work outside the provider', () => {
    function Lonely() {
      useTheme();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Lonely />)).toThrow('useTheme must be used inside ThemeProvider');
    spy.mockRestore();
  });
});
