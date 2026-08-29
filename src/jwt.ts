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

/**
 * Resolve the Amos embed origin (production vs. sandbox) from a render
 * token's decoded payload.
 *
 * Production: `https://js.amos.com`. Sandbox: `https://js-sandbox.amos.com`.
 */
export function getEmbedOrigin(renderToken: string): string {
  const { env = "sandbox" }: components["schemas"]["RenderTokenJwt"] =
    decodeJwt(renderToken).payload;

  switch (env) {
    case "production":
      return "https://js.amos.com";
    case "sandbox":
      return "https://js-sandbox.amos.com";
    default:
      return "https://js-sandbox.amos.com";
  }
}
