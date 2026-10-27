/** Saves text as a file, entirely in the browser. Nothing is sent anywhere. */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv'): void {
  // The byte order mark makes Excel read the file as UTF-8 instead of garbling accented letters.
  const blob = new Blob(['﻿', content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Some browsers need a moment to start the download before the address is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
