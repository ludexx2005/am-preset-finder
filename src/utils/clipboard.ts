/**
 * Reliably copies the exact, complete URL string (including all path segments,
 * query parameters, and hash fragments) to the clipboard across desktop, mobile,
 * and cross-origin iframe environments.
 */
export async function copyFullUrlToClipboard(fullUrl: string): Promise<boolean> {
  const exactString = String(fullUrl);
  if (!exactString) return false;

  // 1. Try modern Clipboard API first
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(exactString);
      return true;
    } catch {
      // Proceed to textarea execCommand fallback (common inside cross-origin iframes)
    }
  }

  // 2. Fallback for iframe / mobile webviews where navigator.clipboard is restricted
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = exactString;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, exactString.length);
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }

  return false;
}
