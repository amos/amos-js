import type { components } from "@amos.com/node";
import { decodeJwt } from "./jwt";
import { reportParentInfoLog } from "./log";
import { getBankPlaidSession } from "./plaid-session";
import {
  type Appearance,
  type ApplePayButtonElementProps,
  createMessage,
  type GooglePayButtonElementProps,
  type Message,
} from "./types";

type Iframe = HTMLIFrameElement | null | undefined;

/**
 * Resolve the Amos embed origin from an iframe's configured `src`.
 *
 * Integrators are expected to set `src` via the SDK's `get*Src` helpers
 * before calling messaging functions.
 */
export function getIframeTargetOrigin(iframe: HTMLIFrameElement): string {
  return new URL(iframe.src).origin;
}

/**
 * Notify the embedded iframe that the host page is ready to receive
 * messages. The SDK calls this internally after receiving an
 * `IFRAME_READY` event from the iframe.
 */
export function sendParentReadyMessage(iframe: Iframe): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({ type: "PARENT_ACKNOWLEDGED_IFRAME_READY" }),
    getIframeTargetOrigin(iframe),
  );
}

/**
 * Push appearance overrides into the embedded iframe.
 *
 * Uses a replace model for `themeVariables`: each message that includes
 * `themeVariables` sets the full override set. Only the listed variables
 * are overridden; unlisted variables revert to iframe defaults. Omit
 * `themeVariables` entirely to leave existing overrides unchanged.
 */
export function updateAppearance({
  iframe,
  appearance = {},
}: {
  iframe: Iframe;
  appearance?: Appearance;
}): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({ type: "UPDATE_APPEARANCE", appearance }),
    getIframeTargetOrigin(iframe),
  );
}

/**
 * Push Apple Pay button visual options into the embedded iframe.
 */
export function updateApplePayButton({
  iframe,
  props,
  height,
}: {
  iframe: Iframe;
  props: ApplePayButtonElementProps;
  height?: string;
}): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({
      type: "UPDATE_APPLE_PAY_BUTTON",
      height,
      props,
    }),
    getIframeTargetOrigin(iframe),
  );
}

/**
 * Push Google Pay button visual options into the embedded iframe.
 */
export function updateGooglePayButton({
  iframe,
  props,
  height,
}: {
  iframe: Iframe;
  props: GooglePayButtonElementProps;
  height?: string;
}): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({
      type: "UPDATE_GOOGLE_PAY_BUTTON",
      height,
      props,
    }),
    getIframeTargetOrigin(iframe),
  );
}

/**
 * Push the express-checkout amount into the embedded wallet iframe.
 * `amount` is a major-currency decimal string (e.g. `"50.00"` for $50.00).
 */
export function updateAmount({
  iframe,
  amount,
}: {
  iframe: Iframe;
  amount: string;
}): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({ type: "UPDATE_AMOUNT", amount }),
    getIframeTargetOrigin(iframe),
  );
}

/**
 * Push the user-visible merchant name into the embedded Google Pay
 * iframe.
 */
export function updateMerchantName({
  iframe,
  merchantName,
}: {
  iframe: Iframe;
  merchantName: string;
}): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({ type: "UPDATE_MERCHANT_NAME", merchantName }),
    getIframeTargetOrigin(iframe),
  );
}

/**
 * Ask the embedded credit-card or bank-account iframe form to validate
 * its inputs.
 *
 * Resolves to `true` if the form is valid, `false` if it is not, or
 * `false` if the iframe does not respond within 5 seconds.
 */
export function validateForm({ iframe }: { iframe: Iframe }): Promise<boolean> {
  const session = getBankPlaidSession(iframe);
  if (session?.requiresVerification) {
    return Promise.resolve(Boolean(session.plaid));
  }

  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        createMessage({ type: "VALIDATE_FORM", requestId }),
        getIframeTargetOrigin(iframe),
      );
    }

    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      resolve(false);
    }, 5000);

    function handleMessage(event: MessageEvent<Message>) {
      if (
        event.data.type === "VALIDATE_FORM" &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handleMessage);
        clearTimeout(timeoutId);
        resolve(event.data.isValid ?? false);
      }
    }

    window.addEventListener("message", handleMessage);
  });
}

const PLAID_LINK_TOKEN_TIMEOUT_MS = 10_000;

/**
 * Ask the bank iframe to mint a Plaid Link token (`POST /plaid_link_tokens`
 * on embed). Resolves with `link_token`, or rejects on error / timeout.
 */
export function requestPlaidLinkToken({
  iframe,
}: {
  iframe: Iframe;
}): Promise<string> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    if (!iframe?.contentWindow) {
      reject(new Error("Bank form is not ready."));
      return;
    }

    const contentWindow = iframe.contentWindow;
    contentWindow.postMessage(
      createMessage({ type: "CREATE_PLAID_LINK_TOKEN", requestId }),
      getIframeTargetOrigin(iframe),
    );

    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      reject(new Error("Timed out waiting for Plaid Link token."));
    }, PLAID_LINK_TOKEN_TIMEOUT_MS);

    function handleMessage(event: MessageEvent<Message>) {
      if (event.source !== contentWindow) {
        return;
      }
      if (
        event.data.type !== "PLAID_LINK_TOKEN" ||
        event.data.requestId !== requestId
      ) {
        return;
      }
      window.removeEventListener("message", handleMessage);
      clearTimeout(timeoutId);
      if (event.data.link_token) {
        resolve(event.data.link_token);
        return;
      }
      reject(
        new Error(event.data.error ?? "Could not create Plaid Link token."),
      );
    }

    window.addEventListener("message", handleMessage);
  });
}

/**
 * Clear all field values and API errors in the embedded credit-card or
 * bank-account iframe form.
 */
export function resetForm({ iframe }: { iframe: Iframe }): void {
  getBankPlaidSession(iframe)?.clearLinked?.();
  resetIframeFields(iframe);
}

function resetIframeFields(iframe: Iframe): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({ type: "RESET_FORM" }),
    getIframeTargetOrigin(iframe),
  );
}

function postConfirmIntent({
  iframe,
  type,
  token,
  id,
}: {
  iframe: HTMLIFrameElement;
  type: "CONFIRM_PAYMENT_INTENT" | "CONFIRM_SETUP_INTENT";
  token: string | undefined;
  id: string | undefined;
}): void {
  const session = getBankPlaidSession(iframe);
  const plaid = session?.plaid;
  // Plaid mode: do not confirm leftover routing/account numbers.
  if (session?.requiresVerification && !plaid) {
    resetIframeFields(iframe);
  }

  const origin = getIframeTargetOrigin(iframe);
  reportParentInfoLog({
    iframe,
    message:
      type === "CONFIRM_PAYMENT_INTENT"
        ? "confirmPaymentIntent"
        : "confirmSetupIntent",
    endpoint:
      type === "CONFIRM_PAYMENT_INTENT"
        ? "POST /embed/payment_intents/{id}/confirm_with_payment_method"
        : "POST /embed/setup_intents/{id}/confirm_with_payment_method",
    headers: {
      origin: window.location.origin,
      "iframe-origin": origin,
    },
    body: { id, token, ...(plaid ? { plaid } : {}) },
  });

  iframe.contentWindow?.postMessage(
    createMessage({
      type,
      token,
      id,
      ...(plaid ? { plaid } : {}),
    }),
    getIframeTargetOrigin(iframe),
  );
}

/**
 * Confirm a payment intent in the embedded iframe flow.
 *
 * Pass the embed JWT (`token`) returned by your server's
 * `POST /payment_intents` call. The matching `payment_intent_id` is
 * extracted from the JWT payload and forwarded to the iframe.
 */
export function confirmPaymentIntent({
  iframe,
  token,
}: {
  iframe: Iframe;
} & Pick<components["schemas"]["EmbedToken"], "token">): void {
  if (!iframe?.contentWindow) {
    return;
  }

  const { payment_intent_id: id }: components["schemas"]["EmbedTokenJwt"] =
    decodeJwt(token).payload;
  postConfirmIntent({
    iframe,
    type: "CONFIRM_PAYMENT_INTENT",
    token,
    id: id ?? undefined,
  });
}

/**
 * Confirm a setup intent in the embedded iframe flow.
 *
 * Pass the embed JWT (`token`) returned by your server's
 * `POST /setup_intents` call. The matching `setup_intent_id` is
 * extracted from the JWT payload and forwarded to the iframe.
 */
export function confirmSetupIntent({
  iframe,
  token,
}: {
  iframe: Iframe;
} & Pick<components["schemas"]["EmbedToken"], "token">): void {
  if (!iframe?.contentWindow) {
    return;
  }

  const { setup_intent_id: id }: components["schemas"]["EmbedTokenJwt"] =
    decodeJwt(token).payload;
  postConfirmIntent({
    iframe,
    type: "CONFIRM_SETUP_INTENT",
    token,
    id: id ?? undefined,
  });
}

/**
 * Notify the iframe that confirmation finished with a failure (used by
 * express-checkout flows after `onInitiatePaymentIntentRequest` rejects).
 */
export function sendConfirmationResult({
  iframe,
  result,
}: {
  iframe: Iframe;
  result: Extract<Message, { type: "CONFIRMATION_RESULT" }>["result"];
}): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({
      type: "CONFIRMATION_RESULT",
      result,
    }),
    getIframeTargetOrigin(iframe),
  );
}
