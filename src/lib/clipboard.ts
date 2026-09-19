'use client';

/**
 * Copying text, with somewhere to go when the clipboard says no.
 *
 * `navigator.clipboard.writeText` rejects in more situations than people
 * expect: an insecure origin, a denied permission, an embedded frame, or a
 * browser that wants the call closer to the user gesture than React's event
 * handling puts it. When that happened the copy button simply did nothing and
 * said nothing, which leaves someone clicking it again.
 *
 * So: try the real API, fall back to a selection and `execCommand`, and tell
 * the caller which of the three outcomes it got so the interface can say so.
 */

export type CopyResult = 'copied' | 'failed';

export async function copyText(text: string): Promise<CopyResult> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      /* Fall through to the older path rather than giving up here. */
    }
  }

  if (typeof document === 'undefined') return 'failed';

  /*
   * The deprecated path still works where the modern one is refused. The
   * textarea is positioned off-screen rather than hidden, because a display:
   * none element cannot be selected.
   */
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  document.body.appendChild(area);

  try {
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    return ok ? 'copied' : 'failed';
  } catch {
    return 'failed';
  } finally {
    area.remove();
  }
}
