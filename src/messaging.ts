import type { components } from "@amos.com/node";
import { decodeJwt } from "./jwt";
import { type Appearance, createMessage, type Message } from "./types";

type Iframe = HTMLIFrameElement | null | undefined;

/**
 * Notify the embedded iframe that the host page is ready to receive
 * messages. The SDK calls this internally after receiving an
 * `IFRAME_READY` event from the iframe.
 */
export function sendParentReadyMessage(iframe: Iframe): void {
  iframe?.contentWindow?.postMessage(
    createMessage({ type: "PARENT_ACKNOWLEDGED_IFRAME_READY" }),
    "*",
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
  iframe?.contentWindow?.postMessage(
    createMessage({ type: "UPDATE_APPEARANCE", appearance }),
    "*",
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
  iframe?.contentWindow?.postMessage(
    createMessage({ type: "UPDATE_AMOUNT", amount }),
    "*",
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
  iframe?.contentWindow?.postMessage(
    createMessage({ type: "UPDATE_MERCHANT_NAME", merchantName }),
    "*",
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
    iframe?.contentWindow?.postMessage(
      createMessage({ type: "VALIDATE_FORM", requestId }),
      "*",
    );

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
  const { payment_intent_id: id }: components["schemas"]["EmbedTokenJwt"] =
    decodeJwt(token).payload;
  iframe?.contentWindow?.postMessage(
    createMessage({
      type: "CONFIRM_PAYMENT_INTENT",
      token,
      id: id ?? undefined,
    }),
    "*",
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
  const { setup_intent_id: id }: components["schemas"]["EmbedTokenJwt"] =
    decodeJwt(token).payload;
  iframe?.contentWindow?.postMessage(
    createMessage({
      type: "CONFIRM_SETUP_INTENT",
      token,
      id: id ?? undefined,
    }),
    "*",
  );
}

/**
 * Notify the iframe that confirmation failed (used by express-checkout
 * flows after `onInitiatePaymentIntentRequest` rejects).
 */
export function sendConfirmationFailed({
  iframe,
  errorMessage,
}: {
  iframe: Iframe;
  errorMessage: string;
}): void {
  iframe?.contentWindow?.postMessage(
    createMessage({
      type: "CONFIRMATION_FAILED",
      errorMessage,
    }),
    "*",
  );
}
