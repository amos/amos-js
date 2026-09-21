/**
 * Identify `postMessage` traffic from a specific Amos embed iframe.
 *
 * `event.source === iframe.contentWindow` is the usual check, but Firefox
 * and some WebKit builds mint a distinct WindowProxy for the same frame
 * after a cross-origin navigation. Falling back to `event.origin` alone is
 * unsafe: card, bank, and wallet iframes share `js.amos.com`. Embed echoes
 * `window.name` as `iframeName` so the host can still match the sender.
 */

export type EmbedIframeMessage = {
  iframeName?: string;
};

export function iframeNameFromMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const name = (data as EmbedIframeMessage).iframeName;
  return typeof name === "string" && name.length > 0 ? name : undefined;
}

function iframeSrcOrigin(iframe: HTMLIFrameElement): string | null {
  try {
    const origin = new URL(iframe.src).origin;
    return origin.length > 0 ? origin : null;
  } catch {
    return null;
  }
}

/**
 * True when `event` was posted by `iframe`. Origin must match the iframe
 * src, then WindowProxy identity, then the embed-echoed iframe name.
 */
export function isMessageFromEmbedIframe(
  event: MessageEvent,
  iframe: HTMLIFrameElement,
): boolean {
  const expectedOrigin = iframeSrcOrigin(iframe);
  if (!expectedOrigin || event.origin !== expectedOrigin) {
    return false;
  }

  if (event.source === iframe.contentWindow) {
    return true;
  }

  const postedName = iframeNameFromMessage(event.data);
  const iframeName = iframe.name;
  return Boolean(postedName && iframeName && postedName === iframeName);
}
