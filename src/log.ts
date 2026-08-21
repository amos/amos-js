import { createMessage } from "./types";

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
]);

const SENSITIVE_BODY_KEYS = new Set([
  "authorization",
  "encrypted_account_number",
  "link_token",
  "public_token",
  "token",
]);

function redactHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SENSITIVE_HEADER_NAMES.has(key.toLowerCase())
      ? "[REDACTED]"
      : value;
  }
  return redacted;
}

function redactBody(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body.map(redactBody);
  }
  if (body !== null && typeof body === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      redacted[key] = SENSITIVE_BODY_KEYS.has(key)
        ? "[REDACTED]"
        : redactBody(value);
    }
    return redacted;
  }
  return body;
}

/**
 * Forward an info log to the embed iframe so Rollbar records it with
 * Amos credentials. Payload shape matches dashboard/embed API traces:
 * `endpoint`, `headers`, `body`.
 */
export function reportParentInfoLog({
  iframe,
  message,
  endpoint,
  headers = {},
  body,
}: {
  iframe: HTMLIFrameElement;
  message: string;
  endpoint: string;
  headers?: Record<string, string>;
  body?: unknown;
}): void {
  iframe.contentWindow?.postMessage(
    createMessage({
      type: "PARENT_INFO_LOG",
      message,
      endpoint,
      headers: redactHeaders(headers),
      body: redactBody(body),
    }),
    new URL(iframe.src).origin,
  );
}
