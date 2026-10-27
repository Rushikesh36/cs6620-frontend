import { format, formatDistanceStrict } from 'date-fns';

export type DateInput = string | number | Date;

const numberFormat = new Intl.NumberFormat('en-US');

/** 12345 becomes "12,345". */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** "2m 14s", "45s", "1h 5m". Shows the two largest units. Negative or invalid input shows "0s". */
export function formatDuration(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** "3 minutes ago". A time slightly in the future (clock differences) counts as "just now". */
export function formatRelativeTime(date: DateInput, now: DateInput = Date.now()): string {
  const target = new Date(date);
  const reference = new Date(now);
  if (Number.isNaN(target.getTime())) return 'Unknown time';
  if (target.getTime() >= reference.getTime() - 5000) return 'just now';
  return formatDistanceStrict(target, reference, { addSuffix: true });
}

/** The full local date and time, for tooltips: "Mar 1, 2026, 12:00:00 PM". */
export function formatFullDateTime(date: DateInput): string {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? 'Unknown time' : format(value, 'PPpp');
}
