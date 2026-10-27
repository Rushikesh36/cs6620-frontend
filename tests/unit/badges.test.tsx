import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeverityBadge } from '@/components/findings/severity-badge';
import { StatusBadge } from '@/components/scans/status-badge';
import { scanStatusSchema, severitySchema } from '@/lib/api/schemas';

describe('StatusBadge', () => {
  it.each([
    ['CREATED', 'Created'],
    ['QUEUED', 'Queued'],
    ['RUNNING', 'Running'],
    ['COMPLETED', 'Completed'],
    ['FAILED', 'Failed'],
  ] as const)('shows the label "%s" as "%s"', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('covers every status the API can return', () => {
    expect(scanStatusSchema.options).toHaveLength(5);
    for (const status of scanStatusSchema.options) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      expect(container.textContent?.trim()).toBeTruthy();
      unmount();
    }
  });

  it('uses the colours from the spec: gray, gray, blue, green, red', () => {
    const colourOf = (status: Parameters<typeof StatusBadge>[0]['status']) => {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const classes = container.firstElementChild?.className ?? '';
      unmount();
      return classes;
    };
    expect(colourOf('CREATED')).toContain('slate');
    expect(colourOf('QUEUED')).toContain('slate');
    expect(colourOf('RUNNING')).toContain('blue');
    expect(colourOf('COMPLETED')).toContain('green');
    expect(colourOf('FAILED')).toContain('red');
  });

  it('pulses only while running, and respects reduced motion', () => {
    const { container, rerender } = render(<StatusBadge status="RUNNING" />);
    const pulse = container.querySelector('.animate-pulse');
    expect(pulse).toBeInTheDocument();
    expect(pulse?.className).toContain('motion-reduce:animate-none');

    rerender(<StatusBadge status="COMPLETED" />);
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });
});

describe('SeverityBadge', () => {
  it.each([
    ['HIGH', 'High'],
    ['MEDIUM', 'Medium'],
    ['LOW', 'Low'],
    ['INFO', 'Info'],
  ] as const)('shows the label "%s" as "%s"', (severity, label) => {
    render(<SeverityBadge severity={severity} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('covers every severity the API can return', () => {
    expect(severitySchema.options).toHaveLength(4);
  });

  it('uses the colours from the spec: red, orange, yellow, gray', () => {
    const colourOf = (severity: Parameters<typeof SeverityBadge>[0]['severity']) => {
      const { container, unmount } = render(<SeverityBadge severity={severity} />);
      const classes = container.firstElementChild?.className ?? '';
      unmount();
      return classes;
    };
    expect(colourOf('HIGH')).toContain('red');
    expect(colourOf('MEDIUM')).toContain('orange');
    expect(colourOf('LOW')).toContain('yellow');
    expect(colourOf('INFO')).toContain('slate');
  });
});
