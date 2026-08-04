import { getEmbedOrigin } from "./jwt";
import {
  sendParentReadyMessage,
  updateAppearance as sendUpdateAppearance,
} from "./messaging";
import type { Appearance, ConfirmationResult, Message } from "./types";

/**
 * The additional fields beyond the standard card number, expiration
 * date, CVV, and billing address fields that are required to be filled
 * out in the embedded credit-card form.
 */
export type CreditCardAdditionalFields = {
  cardholderName: boolean;
};

/**
 * How much billing address the embedded credit-card or bank-account form
 * collects.
 *
 * - `country` — country / region, plus postal / ZIP when that selection
 *   collects one (CA, PR, GB, US). Default.
 * - `full` — full street address (Smarty autocomplete on line 1).
 */
export type BillingAddressRequirement = "country" | "full";

const CREDIT_CARD_ADDRESS_HEIGHT_PX: Record<BillingAddressRequirement, number> =
  {
    country: 212,
    full: 452,
  };

const CREDIT_CARD_CARDHOLDER_NAME_HEIGHT_PX = 80;

const BANK_ACCOUNT_HEIGHT_PX: Record<BillingAddressRequirement, number> = {
  country: 400,
  full: 640,
};

/**
 * Build the iframe `src` URL for the embedded credit-card form.
 */
export function getCreditCardFormSrc(
  renderToken: string,
  additionalFields: CreditCardAdditionalFields = { cardholderName: false },
  billingAddressRequirement: BillingAddressRequirement = "country",
): string {
  const enabled = Object.entries(additionalFields)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join(",");

  const params = new URLSearchParams({
    token: renderToken,
    additionalFields: enabled,
    billingAddressRequirement,
  });

  return `${getEmbedOrigin(renderToken)}/iframe/card?${params}`;
}

/**
 * Build the iframe `src` URL for the embedded bank-account form.
 */
export function getBankAccountFormSrc(
  renderToken: string,
  billingAddressRequirement: BillingAddressRequirement = "country",
): string {
  const params = new URLSearchParams({
    token: renderToken,
    billingAddressRequirement,
  });

  return `${getEmbedOrigin(renderToken)}/iframe/bank?${params}`;
}

/**
 * Default iframe pixel height for the credit-card form, taking the
 * configured `additionalFields` and `billingAddressRequirement` into
 * account.
 */
export function getCreditCardFormInitialHeight(
  additionalFields: CreditCardAdditionalFields = { cardholderName: false },
  billingAddressRequirement: BillingAddressRequirement = "country",
): string {
  const addressHeight =
    CREDIT_CARD_ADDRESS_HEIGHT_PX[billingAddressRequirement] ??
    CREDIT_CARD_ADDRESS_HEIGHT_PX.country;
  const cardholderExtra = additionalFields.cardholderName
    ? CREDIT_CARD_CARDHOLDER_NAME_HEIGHT_PX
    : 0;
  return `${addressHeight + cardholderExtra}px`;
}

/**
 * Default iframe pixel height for the bank-account form, taking
 * `billingAddressRequirement` into account.
 */
export function getBankAccountFormInitialHeight(
  billingAddressRequirement: BillingAddressRequirement = "country",
): string {
  return `${BANK_ACCOUNT_HEIGHT_PX[billingAddressRequirement] ?? BANK_ACCOUNT_HEIGHT_PX.country}px`;
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
   * Called when the interactive confirmation flow finishes (success or
   * terminal failure). Not settlement proof — verify via webhooks.
   * Recoverable field errors stay in the iframe and do not invoke this.
   */
  onResult: (result: ConfirmationResult) => void;
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

      case "CONFIRMATION_RESULT":
        current.onResult(event.data.result);
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
