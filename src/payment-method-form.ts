import type { components } from "@amos.com/node";
import { getEmbedOrigin } from "./jwt";
import {
  sendParentReadyMessage,
  updateAppearance as sendUpdateAppearance,
} from "./messaging";
import type { Appearance, Message } from "./types";

/**
 * The additional fields beyond the standard card number, expiration
 * date, CVV, country, and postal code that are required to be filled
 * out in the embedded credit-card form.
 */
export type CreditCardAdditionalFields = {
  cardholderName: boolean;
};

/**
 * Build the iframe `src` URL for the embedded credit-card form.
 */
export function getCreditCardFormSrc(
  renderToken: string,
  additionalFields: CreditCardAdditionalFields = { cardholderName: false },
): string {
  const enabled = Object.entries(additionalFields)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join(",");

  return `${getEmbedOrigin(renderToken)}/iframe/card?token=${renderToken}&additionalFields=${enabled}`;
}

/**
 * Build the iframe `src` URL for the embedded bank-account form.
 */
export function getBankAccountFormSrc(renderToken: string): string {
  return `${getEmbedOrigin(renderToken)}/iframe/bank?token=${renderToken}`;
}

/**
 * Default iframe pixel height for the credit-card form, taking the
 * configured `additionalFields` into account.
 */
export function getCreditCardFormInitialHeight(
  additionalFields: CreditCardAdditionalFields = { cardholderName: false },
): string {
  return additionalFields.cardholderName ? "292px" : "212px";
}

/**
 * Default iframe pixel height for the bank-account form.
 */
export function getBankAccountFormInitialHeight(): string {
  return "400px";
}

/**
 * Options accepted by {@link attachPaymentMethodFormListeners}.
 *
 * Used by both the credit-card and bank-account forms, which share the
 * same message protocol.
 */
export type PaymentMethodFormListenerOptions = {
  /**
   * Custom appearance to apply when the iframe first becomes ready and
   * whenever the appearance changes. Can be updated later via the
   * returned controller's `update({ appearance })` method.
   */
  appearance?: Appearance;
  /**
   * Called whenever the iframe asks the host page to resize it. Update
   * the iframe's `height` style here.
   */
  onHeightChange?: (height: string) => void;
  /**
   * Called once the iframe has applied the requested appearance and is
   * ready to be revealed. A common implementation is to set the
   * iframe's opacity from `0` to `1` to fade it in.
   */
  onAppearanceReady?: () => void;
  /**
   * Called when payment intent confirmation succeeds.
   */
  onPaymentIntentConfirmationSucceeded?: (
    paymentIntent: components["schemas"]["PaymentIntent"],
  ) => void;
  /**
   * Called when setup intent confirmation succeeds.
   */
  onSetupIntentConfirmationSucceeded?: (
    setupIntent: components["schemas"]["SetupIntent"],
  ) => void;
  /**
   * Called when payment or setup intent confirmation fails.
   */
  onConfirmationFailed: (errorMessage: string) => void;
};

/**
 * Controller returned by {@link attachPaymentMethodFormListeners} and
 * the credit-card / bank-account `mount*` helpers.
 */
export type PaymentMethodFormController = {
  /**
   * Update one or more listener options without re-attaching the
   * message listener. Pass `{ appearance }` to push new appearance
   * overrides into the iframe.
   */
  update: (patch: Partial<PaymentMethodFormListenerOptions>) => void;
  /**
   * Detach the iframe message listener.
   */
  destroy: () => void;
};

/**
 * Wire up the host-page side of the credit-card or bank-account iframe
 * message protocol on an existing `<iframe>` element. Returns a
 * controller for updating options and tearing down the listener.
 *
 * The iframe is expected to have already been added to the DOM with the
 * correct `src` (see {@link getCreditCardFormSrc} /
 * {@link getBankAccountFormSrc}).
 */
export function attachPaymentMethodFormListeners(
  iframe: HTMLIFrameElement,
  options: PaymentMethodFormListenerOptions,
): PaymentMethodFormController {
  let current = { ...options };

  function handleMessage(event: MessageEvent<Message>) {
    switch (event.data.type) {
      case "IFRAME_READY":
        sendParentReadyMessage(iframe);
        sendUpdateAppearance({ iframe, appearance: current.appearance });
        break;

      case "UPDATE_HEIGHT":
        current.onHeightChange?.(event.data.height);
        break;

      case "UPDATE_APPEARANCE":
        sendUpdateAppearance({ iframe, appearance: event.data.appearance });
        break;

      case "UPDATED_APPEARANCE":
        current.onAppearanceReady?.();
        break;

      case "PAYMENT_INTENT_CONFIRMATION_SUCCEEDED":
        current.onPaymentIntentConfirmationSucceeded?.(
          event.data.paymentIntent,
        );
        break;

      case "SETUP_INTENT_CONFIRMATION_SUCCEEDED":
        current.onSetupIntentConfirmationSucceeded?.(event.data.setupIntent);
        break;

      case "CONFIRMATION_FAILED":
        current.onConfirmationFailed(event.data.errorMessage);
        break;
    }
  }

  window.addEventListener("message", handleMessage);

  return {
    update(patch) {
      const hadAppearance = "appearance" in patch;
      current = { ...current, ...patch };
      if (hadAppearance) {
        sendUpdateAppearance({ iframe, appearance: current.appearance });
      }
    },
    destroy() {
      window.removeEventListener("message", handleMessage);
    },
  };
}
