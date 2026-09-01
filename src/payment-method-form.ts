import { appearanceWithDefaults } from "./appearance-defaults";
import { embedIframeSearchParams } from "./embed-src";
import { armIframeHandshakeReload } from "./handshake-reload";
import { getEmbedOrigin } from "./jwt";
import {
  focusField as sendFocusField,
  sendParentReadyMessage,
  updateAppearance as sendUpdateAppearance,
  updateDefaultValues as sendUpdateDefaultValues,
} from "./messaging";
import { getBankPlaidSession } from "./plaid-session";
import type {
  Appearance,
  Message,
  PaymentMethodFormCardBrandChangeEvent,
  PaymentMethodFormDefaultValues,
  PaymentMethodFormField,
  PaymentMethodFormValidityChangeEvent,
} from "./types";

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

  const params = embedIframeSearchParams({
    token: renderToken,
    additionalFields: enabled,
    billingAddressRequirement,
  });

  return `${getEmbedOrigin(renderToken)}/iframe/card?${params}`;
}

/**
 * Build the iframe `src` URL for the embedded bank-account form.
 *
 * Pass `intent: "setup"` so the iframe is tagged as a setup flow.
 */
export function getBankAccountFormSrc(
  renderToken: string,
  billingAddressRequirement: BillingAddressRequirement = "country",
  intent: "payment" | "setup" = "payment",
): string {
  const params = embedIframeSearchParams({
    token: renderToken,
    billingAddressRequirement,
    intent,
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
   * returned controller's `update({ appearance })` method. Omitted
   * `fonts` / `--font-family` on first paint default to Inter.
   */
  appearance?: Appearance;
  /**
   * Name and billing address to seed into the iframe. Can be updated
   * later via `update({ defaultValues })`. Provided keys overwrite
   * matching fields, including ones the customer already edited.
   */
  defaultValues?: PaymentMethodFormDefaultValues;
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
   * Called when the iframe posts `IFRAME_READY` (embed JS is running).
   */
  onIframeReady?: () => void;
  /**
   * Called when card/bank form validity changes. `isValid` is true
   * when all required fields are present and valid. Does not include
   * PCI data. Use this to enable or disable a host checkout button.
   */
  onValidityChange?: (event: PaymentMethodFormValidityChangeEvent) => void;
  /**
   * Called when the detected card brand changes. `brand` is the matched
   * network, or `null` when the field is empty or the digits do not
   * match a known brand. Does not include PCI data. Credit-card form
   * only — never fired for bank account.
   */
  onCardBrandChanged?: (event: PaymentMethodFormCardBrandChangeEvent) => void;
  /**
   * Called when the customer presses Escape in the iframe. PCI-safe —
   * no field values. Use this to close a host modal that contains the
   * iframe. Not fired while an iframe dropdown or address suggestion
   * list is open (that Escape dismisses the overlay first), or while
   * Plaid Embedded Institution Search is showing.
   */
  onEscapeKeyPressed?: () => void;
};

/**
 * Controller returned by {@link attachPaymentMethodFormListeners} and
 * the credit-card / bank-account `mount*` helpers.
 */
export type PaymentMethodFormController = {
  /**
   * Update one or more listener options without re-attaching the
   * message listener. Pass `{ appearance }` to push new appearance
   * overrides into the iframe. Pass `{ defaultValues }` to overwrite
   * matching name and billing fields.
   */
  update: (patch: Partial<PaymentMethodFormListenerOptions>) => void;
  /**
   * Focus a named control inside the iframe. No-op if the field is not
   * rendered, or while Plaid Embedded Institution Search is showing.
   * Queued until `IFRAME_READY` if called before handshake.
   */
  focus: (field: PaymentMethodFormField) => void;
  /**
   * Detach the iframe message listener.
   */
  destroy: () => void;
};

/**
 * Submit the host `<form>` that wraps this iframe, if any.
 *
 * Mirrors Stripe Elements: Enter inside the cross-origin iframe cannot
 * be observed by the parent, so the iframe posts `FORM_SUBMIT_REQUEST`
 * and the SDK calls `requestSubmit()` on the enclosing form. No-op when
 * there is no host form, or while Plaid Embedded Institution Search is
 * showing instead of the bank fields.
 */
function submitEnclosingHostForm(iframe: HTMLIFrameElement): void {
  if (getBankPlaidSession(iframe)?.requiresVerification) {
    return;
  }
  iframe.closest("form")?.requestSubmit();
}

/**
 * Notify the host that Escape was pressed inside the iframe.
 *
 * Mirrors Stripe Elements `escape`: the parent cannot observe keys
 * while focus is in the cross-origin iframe, so the iframe posts
 * `ESCAPE_KEY_PRESSED`. No-op while Plaid Embedded Institution Search
 * is showing instead of the bank fields.
 */
function notifyEscapeKeyPressed(
  iframe: HTMLIFrameElement,
  onEscapeKeyPressed?: () => void,
): void {
  if (getBankPlaidSession(iframe)?.requiresVerification) {
    return;
  }
  onEscapeKeyPressed?.();
}

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
  // React calls `update()` on first paint, before the iframe has left
  // about:blank. Queue until IFRAME_READY so postMessage targetOrigin matches.
  let ready = false;
  let pendingFocus: PaymentMethodFormField | undefined;
  const handshakeReload = armIframeHandshakeReload(iframe, {
    onBeforeReload: () => {
      ready = false;
    },
  });

  function sendQueuedDefaultValues(): void {
    if (current.defaultValues !== undefined) {
      sendUpdateDefaultValues({
        iframe,
        defaultValues: current.defaultValues,
      });
    }
  }

  function sendQueuedFocus(): void {
    if (pendingFocus === undefined) {
      return;
    }
    const field = pendingFocus;
    pendingFocus = undefined;
    // IFRAME_READY is handled here before Plaid's listener hides the
    // bank iframe; skip if verification UI is already in session.
    if (getBankPlaidSession(iframe)?.requiresVerification) {
      return;
    }
    sendFocusField({ iframe, field });
  }

  function handleMessage(event: MessageEvent<Message>) {
    if (event.source !== iframe.contentWindow) {
      return;
    }

    switch (event.data.type) {
      case "IFRAME_READY":
        handshakeReload.noteReady();
        ready = true;
        sendParentReadyMessage(iframe);
        sendUpdateAppearance({
          iframe,
          appearance: appearanceWithDefaults(current.appearance, {
            initial: true,
          }),
        });
        sendQueuedDefaultValues();
        sendQueuedFocus();
        current.onIframeReady?.();
        break;

      case "UPDATE_HEIGHT":
        current.onHeightChange?.(event.data.height);
        break;

      case "UPDATE_APPEARANCE":
        sendUpdateAppearance({
          iframe,
          appearance: appearanceWithDefaults(event.data.appearance, {
            initial: false,
          }),
        });
        break;

      case "UPDATED_APPEARANCE":
        current.onAppearanceReady?.();
        break;

      case "FORM_VALIDITY_CHANGE":
        if (getBankPlaidSession(iframe)?.requiresVerification) {
          break;
        }
        current.onValidityChange?.({ isValid: event.data.isValid });
        break;

      case "FORM_SUBMIT_REQUEST":
        submitEnclosingHostForm(iframe);
        break;

      case "ESCAPE_KEY_PRESSED":
        notifyEscapeKeyPressed(iframe, current.onEscapeKeyPressed);
        break;

      case "CARD_BRAND_CHANGE":
        current.onCardBrandChanged?.({ brand: event.data.brand });
        break;
    }
  }

  window.addEventListener("message", handleMessage);

  return {
    update(patch) {
      const hadAppearance = "appearance" in patch;
      const hadDefaultValues = "defaultValues" in patch;
      current = { ...current, ...patch };
      if (hadAppearance && ready) {
        sendUpdateAppearance({
          iframe,
          appearance: appearanceWithDefaults(current.appearance, {
            initial: false,
          }),
        });
      }
      if (hadDefaultValues && ready) {
        sendUpdateDefaultValues({
          iframe,
          defaultValues: current.defaultValues ?? {},
        });
      }
    },
    focus(field) {
      if (getBankPlaidSession(iframe)?.requiresVerification) {
        return;
      }
      if (ready) {
        sendFocusField({ iframe, field });
        return;
      }
      pendingFocus = field;
    },
    destroy() {
      handshakeReload.cancel();
      window.removeEventListener("message", handleMessage);
    },
  };
}
