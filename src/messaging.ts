import type { components } from "@amos.com/node";
import { decodeJwt } from "./jwt";
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
 * Push the express-checkout amount into the embedded Google Pay iframe.
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

/**
 * Clear all field values and API errors in the embedded credit-card or
 * bank-account iframe form.
 */
export function resetForm({ iframe }: { iframe: Iframe }): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({ type: "RESET_FORM" }),
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
  iframe.contentWindow.postMessage(
    createMessage({
      type: "CONFIRM_PAYMENT_INTENT",
      token,
      id: id ?? undefined,
    }),
    getIframeTargetOrigin(iframe),
  );
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
  iframe.contentWindow.postMessage(
    createMessage({
      type: "CONFIRM_SETUP_INTENT",
      token,
      id: id ?? undefined,
    }),
    getIframeTargetOrigin(iframe),
  );
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
