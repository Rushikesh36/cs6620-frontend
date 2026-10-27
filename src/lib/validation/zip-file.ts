import { formatFileSize } from '@/lib/utils/format';

export const MAX_ZIP_BYTES = 50 * 1024 * 1024;
export const MAX_ZIP_LABEL = formatFileSize(MAX_ZIP_BYTES);

// What browsers call a zip file. Windows says "x-zip-compressed", and some systems say nothing.
const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'multipart/x-zip',
  'application/octet-stream',
  '',
]);

/** For the file picker's `accept` hint. It only filters the dialog, so we still check below. */
export const ZIP_ACCEPT = '.zip,application/zip,application/x-zip-compressed';

/**
 * A plain-words problem with the chosen file, or null when it is fine.
 *
 * This only saves the user a wasted upload. The browser can't tell what is really inside a
 * file, so the backend must check it too.
 */
export function validateZipFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const looksLikeZip = file.name.toLowerCase().endsWith('.zip') && ZIP_MIME_TYPES.has(file.type);
  if (!looksLikeZip) {
    return `"${file.name}" is not a .zip file. Compress your code into a .zip and choose that.`;
  }
  if (file.size === 0) return `"${file.name}" is empty. Choose a .zip that contains your code.`;
  if (file.size > MAX_ZIP_BYTES) {
    return `"${file.name}" is ${formatFileSize(file.size)}, which is over the ${MAX_ZIP_LABEL} limit. Remove large files such as build output and try again.`;
  }
  return null;
}
