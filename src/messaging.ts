import type { components } from "@amos.com/node";
import { decodeJwt } from "./jwt";
import { getBankPlaidSession } from "./plaid-session";
import { randomRequestId } from "./random-id";
import {
  type Appearance,
  type ApplePayButtonElementProps,
  type ConfirmPaymentResult,
  type ConfirmSetupResult,
  createMessage,
  type GooglePayButtonElementProps,
  type Message,
  type PaymentMethodFormDefaultValues,
  type PaymentMethodFormField,
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
 * Uses a replace model for `themeVariables`, `fonts`, and `rules`: each
 * message that includes those keys sets the full override set. Omit a
 * key to leave the previous value unchanged. Pass `fonts: []` or
 * `rules: {}` to clear.
 *
 * Card, bank, and wallet listeners send Inter (`fonts` +
 * `--font-family`) on the first handshake when the merchant omitted
 * them. This function posts the payload as given.
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
 * Push name and billing-address defaults into the embedded card or bank
 * iframe. Provided keys overwrite matching form fields, including ones
 * the customer already edited. Omitted keys are left as-is.
 */
export function updateDefaultValues({
  iframe,
  defaultValues = {},
}: {
  iframe: Iframe;
  defaultValues?: PaymentMethodFormDefaultValues;
}): void {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({ type: "UPDATE_DEFAULT_VALUES", defaultValues }),
    getIframeTargetOrigin(iframe),
  );
}

/**
 * Focus a named control inside the embedded card or bank iframe.
 *
 * No-op if the iframe is not ready, the field is not rendered (for
 * example hidden cardholder name, or street fields in `country` billing
 * mode), or Plaid Embedded Institution Search is showing instead of
 * the bank form. Call from a user-gesture handler; some browsers
 * ignore focus that is not tied to a click or keydown.
 */
export function focusField({
  iframe,
  field,
}: {
  iframe: Iframe;
  field: PaymentMethodFormField;
}): void {
  if (!iframe?.contentWindow) {
    return;
  }
  // Same branch as validateForm: the routing/account iframe is hidden
  // behind Plaid, and focusing it steals input from Institution Search.
  if (getBankPlaidSession(iframe)?.requiresVerification) {
    return;
  }

  iframe.contentWindow.postMessage(
    createMessage({ type: "FOCUS_FIELD", field }),
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

  const requestId = randomRequestId();

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
  const requestId = randomRequestId();

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
  defaultValues,
}: {
  iframe: HTMLIFrameElement;
  type: "CONFIRM_PAYMENT_INTENT" | "CONFIRM_SETUP_INTENT";
  token: string | undefined;
  id: string | undefined;
  defaultValues?: PaymentMethodFormDefaultValues;
}): void {
  const session = getBankPlaidSession(iframe);
  const plaid = session?.plaid;
  // Plaid mode: do not confirm leftover routing/account numbers.
  if (session?.requiresVerification && !plaid) {
    resetIframeFields(iframe);
  }

  iframe.contentWindow?.postMessage(
    createMessage({
      type,
      token,
      id,
      ...(plaid ? { plaid } : {}),
      ...(defaultValues ? { defaultValues } : {}),
    }),
    getIframeTargetOrigin(iframe),
  );
}

const CONFIRM_TIMEOUT_MS = 60_000;

function fromConfirmationMessage(
  result: Extract<Message, { type: "CONFIRMATION_RESULT" }>["result"],
): ConfirmPaymentResult | ConfirmSetupResult {
  if (result.status === "succeeded") {
    if ("paymentIntent" in result) {
      return { status: "succeeded", paymentIntent: result.paymentIntent };
    }
    if ("setupIntent" in result) {
      return { status: "succeeded", setupIntent: result.setupIntent };
    }
    return { status: "failed" };
  }

  if ("paymentIntent" in result && result.paymentIntent !== undefined) {
    return { status: "failed", paymentIntent: result.paymentIntent };
  }
  if ("setupIntent" in result && result.setupIntent !== undefined) {
    return { status: "failed", setupIntent: result.setupIntent };
  }
  return { status: "failed" };
}

function toConfirmPaymentResult(
  result: ConfirmPaymentResult | ConfirmSetupResult,
): ConfirmPaymentResult {
  if (result.status === "succeeded") {
    if ("paymentIntent" in result) {
      return result;
    }
    return { status: "failed" };
  }
  if ("paymentIntent" in result) {
    return { status: "failed", paymentIntent: result.paymentIntent };
  }
  return { status: "failed" };
}

function toConfirmSetupResult(
  result: ConfirmPaymentResult | ConfirmSetupResult,
): ConfirmSetupResult {
  if (result.status === "succeeded") {
    if ("setupIntent" in result) {
      return result;
    }
    return { status: "failed" };
  }
  if ("setupIntent" in result) {
    return { status: "failed", setupIntent: result.setupIntent };
  }
  return { status: "failed" };
}

function waitForConfirmResult(
  iframe: HTMLIFrameElement,
): Promise<ConfirmPaymentResult | ConfirmSetupResult> {
  const contentWindow = iframe.contentWindow;
  if (!contentWindow) {
    return Promise.resolve({ status: "failed" });
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      resolve({ status: "failed" });
    }, CONFIRM_TIMEOUT_MS);

    function handleMessage(event: MessageEvent<Message>) {
      if (event.source !== contentWindow) {
        return;
      }
      if (event.data.type !== "CONFIRMATION_RESULT") {
        return;
      }
      window.removeEventListener("message", handleMessage);
      clearTimeout(timeoutId);
      resolve(fromConfirmationMessage(event.data.result));
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
 *
 * Optional `defaultValues` are applied immediately before building the
 * payment method payload (including hidden name and extra billing
 * fields). They do not replace the last mount/`update` defaults used by
 * {@link resetForm}.
 *
 * Resolves `{ status: "succeeded", paymentIntent }` after processor
 * authorization, or `{ status: "failed", paymentIntent? }` otherwise.
 * Capture may still finish asynchronously.
 */
export function confirmPayment({
  iframe,
  token,
  defaultValues,
}: {
  iframe: Iframe;
  defaultValues?: PaymentMethodFormDefaultValues;
} & Pick<
  components["schemas"]["EmbedToken"],
  "token"
>): Promise<ConfirmPaymentResult> {
  if (!iframe?.contentWindow) {
    return Promise.resolve({ status: "failed" });
  }

  const { payment_intent_id: id }: components["schemas"]["EmbedTokenJwt"] =
    decodeJwt(token).payload;
  const result = waitForConfirmResult(iframe);
  postConfirmIntent({
    iframe,
    type: "CONFIRM_PAYMENT_INTENT",
    token,
    id: id ?? undefined,
    defaultValues,
  });
  return result.then(toConfirmPaymentResult);
}

/**
 * Confirm a setup intent in the embedded iframe flow.
 *
 * Pass the embed JWT (`token`) returned by your server's
 * `POST /setup_intents` call. The matching `setup_intent_id` is
 * extracted from the JWT payload and forwarded to the iframe.
 *
 * Optional `defaultValues` are applied immediately before building the
 * payment method payload. They do not replace the last mount/`update`
 * defaults used by {@link resetForm}.
 *
 * Resolves `{ status: "succeeded", setupIntent }` after verification,
 * or `{ status: "failed", setupIntent? }` otherwise.
 */
export function confirmSetup({
  iframe,
  token,
  defaultValues,
}: {
  iframe: Iframe;
  defaultValues?: PaymentMethodFormDefaultValues;
} & Pick<
  components["schemas"]["EmbedToken"],
  "token"
>): Promise<ConfirmSetupResult> {
  if (!iframe?.contentWindow) {
    return Promise.resolve({ status: "failed" });
  }

  const { setup_intent_id: id }: components["schemas"]["EmbedTokenJwt"] =
    decodeJwt(token).payload;
  const result = waitForConfirmResult(iframe);
  postConfirmIntent({
    iframe,
    type: "CONFIRM_SETUP_INTENT",
    token,
    id: id ?? undefined,
    defaultValues,
  });
  return result.then(toConfirmSetupResult);
}

/**
 * Notify the iframe that confirmation finished with a failure (used by
 * wallet `onConfirm` when creating the payment intent rejects).
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
