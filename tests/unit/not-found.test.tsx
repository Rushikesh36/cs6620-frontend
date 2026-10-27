import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfigErrorScreen } from '@/components/config/config-error-screen';
import NotFound from '@/app/not-found';
import { ConfigError } from '@/lib/config';

describe('404 page', () => {
  it('says the page was not found, in friendly words, and links to the dashboard', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText(/couldn't find the page you were looking for/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the dashboard' }).getAttribute('href')).toMatch(
      /^\/dashboard\/?$/,
    );
  });

  it('is a landmark with a single heading', () => {
    render(<NotFound />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });
});

describe('configuration error screen', () => {
  it('is a landmark with one top heading, announced as an alert, with a Try again button', () => {
    render(
      <ConfigErrorScreen
        error={new ConfigError('config.json was not found on this site.')}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Configuration error' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('config.json was not found on this site.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
