/**
 * Parent-side recovery when the embed document loads but never posts
 * `IFRAME_READY` (stale HTML naming a deleted entry chunk, HTML 404
 * body instead of JS, etc.).
 *
 * Clock starts on iframe `load` — not at mount — so a slow download is
 * not treated as a failed handshake. After load, wait
 * {@link HANDSHAKE_RELOAD_GRACE_MS} for READY, then rewrite `src` once
 * with {@link HANDSHAKE_RELOAD_PARAM} so the next document is a real
 * navigation (same-src assignment is unreliable).
 */

export const HANDSHAKE_RELOAD_PARAM = "amosReload";
export const HANDSHAKE_RELOAD_GRACE_MS = 1500;

export function withHandshakeReloadParam(
  src: string,
  timestamp: number = Date.now(),
): string {
  const url = new URL(src);
  url.searchParams.set(HANDSHAKE_RELOAD_PARAM, String(timestamp));
  return url.toString();
}

/**
 * Arm a one-shot handshake reload on `iframe`.
 *
 * Attach **before** inserting the iframe into the document so the
 * `load` event is not missed. Call `noteReady()` from the `IFRAME_READY`
 * handler and `cancel()` from `destroy()`.
 */
export function armIframeHandshakeReload(
  iframe: HTMLIFrameElement,
  options?: { onBeforeReload?: () => void },
): { noteReady: () => void; cancel: () => void } {
  let cancelled = false;
  let reloaded = false;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;

  function clearGrace(): void {
    if (graceTimer !== undefined) {
      clearTimeout(graceTimer);
      graceTimer = undefined;
    }
  }

  function stop(): void {
    cancelled = true;
    iframe.removeEventListener("load", onLoad);
    clearGrace();
  }

  function onLoad(): void {
    if (cancelled || reloaded) {
      return;
    }
    clearGrace();
    graceTimer = setTimeout(() => {
      if (cancelled || reloaded) {
        return;
      }
      reloaded = true;
      options?.onBeforeReload?.();
      iframe.src = withHandshakeReloadParam(iframe.src);
    }, HANDSHAKE_RELOAD_GRACE_MS);
  }

  iframe.addEventListener("load", onLoad);

  return {
    noteReady: stop,
    cancel: stop,
  };
}
