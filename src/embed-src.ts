/**
 * Query string the embed `_renderToken` route canonicalizes via
 * `validateSearch`. Omitting any of these keys makes TanStack Router
 * 307 to a URL that includes the defaults.
 *
 * `amosDebug=1` is copied from the host page when present. The embed
 * keeps it through that canonicalization and shows the iframe timeline.
 * Absent on every other load, so existing iframe URLs stay the same.
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
  const params = new URLSearchParams({
    token,
    additionalFields,
    billingAddressRequirement,
    intent,
  });

  if (hostRequestsAmosDebug()) {
    params.set("amosDebug", "1");
  }

  return params;
}

function hostRequestsAmosDebug(): boolean {
  if (typeof location === "undefined") {
    return false;
  }

  try {
    return new URLSearchParams(location.search).get("amosDebug") === "1";
  } catch {
    return false;
  }
}
