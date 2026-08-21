import type { components } from "@amos.com/node";

/**
 * Decode a JWT into its `{ header, payload, signature }` parts without
 * verifying the signature.
 *
 * Works in both browser (`atob`) and Node (`Buffer`) environments.
 */
export function decodeJwt(token: string | undefined): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
} {
  const [header = "", payload = "", signature = ""] = token?.split(".") ?? [];

  const decoder =
    typeof atob === "function"
      ? atob
      : (encoded: string) => Buffer.from(encoded, "base64").toString("utf8");

  return {
    header: JSON.parse(decoder(header)),
    payload: JSON.parse(decoder(payload)),
    signature,
  };
}

// --- BEGIN amos-ui sdk:link localhost embed origin ---
/**
 * True when the parent page is running on localhost / *.localhost
 * (e.g. https://dashboard.localhost via portless).
 *
 * Injected by amos-ui `pnpm sdk:link`; removed by `pnpm sdk:unlink`.
 * Do not commit this block to amos-js.
 */
function isLocalhostParent(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const { hostname } = window.location;
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

/**
 * Resolve the Amos embed origin (production vs. sandbox) from a render
 * token's decoded payload.
 *
 * When the parent page is on localhost / *.localhost, always target the
 * local embed app (https://embed.localhost) so dashboard + embed can be
 * developed together without pointing at sandbox/production iframes.
 */
export function getEmbedOrigin(renderToken: string): string {
  if (isLocalhostParent()) {
    return "https://embed.localhost";
  }

  const { env = "sandbox" }: components["schemas"]["RenderTokenJwt"] =
    decodeJwt(renderToken).payload;

  switch (env) {
    case "production":
      return "https://embed.amos.com";
    case "sandbox":
      return "https://embed-sandbox.amos.com";
    default:
      return "https://embed-sandbox.amos.com";
  }
}
// --- END amos-ui sdk:link localhost embed origin ---
