/**
 * Query string the embed `_renderToken` route canonicalizes via
 * `validateSearch`. Omitting any of these keys makes TanStack Router
 * 307 to a URL that includes the defaults.
 */
export function embedIframeSearchParams({
  token,
  additionalFields = "",
  billingAddressRequirement = "country",
  intent = "payment",
}: {
  token: string;
  additionalFields?: string;
  billingAddressRequirement?: string;
  intent?: "payment" | "setup";
}): URLSearchParams {
  return new URLSearchParams({
    token,
    additionalFields,
    billingAddressRequirement,
    intent,
  });
}
