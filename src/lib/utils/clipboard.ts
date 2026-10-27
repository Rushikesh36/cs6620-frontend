/**
 * Copies text and says whether it worked.
 *
 * The site is served over plain HTTP, where `navigator.clipboard` does not exist (browsers only
 * offer it on secure pages). So there is a fallback that uses a hidden text box.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or the page is not focused: try the older way.
    }
  }
  return copyWithTextArea(text);
}

function copyWithTextArea(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  // Off-screen, so nothing flashes or scrolls.
  box.style.position = 'fixed';
  box.style.top = '0';
  box.style.left = '-9999px';
  document.body.appendChild(box);
  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  try {
    box.select();
    box.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(box);
    previouslyFocused?.focus();
  }
}
