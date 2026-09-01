/// <reference types="googlepay" />

import type { components } from "@amos.com/node";
import { appearanceWithDefaults } from "./appearance-defaults";
import { embedIframeSearchParams } from "./embed-src";
import { armIframeHandshakeReload } from "./handshake-reload";
import { getEmbedOrigin } from "./jwt";
import {
  confirmPayment,
  sendParentReadyMessage,
  updateAmount as sendUpdateAmount,
  updateAppearance as sendUpdateAppearance,
  updateGooglePayButton as sendUpdateGooglePayButton,
  updateMerchantName as sendUpdateMerchantName,
} from "./messaging";
import type {
  ConfirmPaymentResult,
  GooglePayButtonElementProps,
  Message,
} from "./types";

/**
 * Build the iframe `src` URL for the embedded Google Pay button.
 */
export function getGooglePayButtonSrc(renderToken: string): string {
  const params = embedIframeSearchParams({ token: renderToken });
  return `${getEmbedOrigin(renderToken)}/iframe/google-pay?${params}`;
}

/**
 * Default iframe pixel height for the Google Pay button.
 */
export function getGooglePayButtonInitialHeight(): string {
  return "48px";
}

/**
 * Options accepted by {@link attachGooglePayButtonListeners}.
 */
export type GooglePayButtonListenerOptions = {
  /**
   * Major-currency decimal string shown in the Google Pay sheet
   * (e.g. `"50.00"` for $50.00). Converted to cents in
   * `paymentIntentCreateAttributes.amount`.
   */
  amount: string;
  /** A user-visible merchant name. */
  merchantName: string;
  /**
   * Painted Google Pay button height. CSS length (e.g. `"48px"`).
   * @default "48px"
   */
  height?: string;
  /**
   * Native Google Pay button attributes and inner style. Omitted fields
   * keep Amos paint defaults (`buttonType: "plain"`,
   * `buttonSizeMode: "fill"`). The button fills the iframe — size the
   * mount slot, not the button. Compact: `buttonSizeMode: "static"` and
   * `style.width`.
   */
  buttonProps?: GooglePayButtonElementProps;
  /**
   * Called whenever the iframe asks the host page to resize it. Update
   * the iframe's `height` style here.
   */
  onHeightChange?: (height: string) => void;
  /**
   * Called once the iframe has applied the requested appearance and is
   * ready to be revealed.
   */
  onAppearanceReady?: () => void;
  /**
   * Called when the iframe posts `IFRAME_READY` (embed JS is running).
   */
  onIframeReady?: () => void;
  /**
   * Called when the buyer authorizes in the Google Pay sheet. Create a
   * payment intent on your server, then `await confirmPayment(token)`.
   */
  onConfirm: ({
    paymentIntentCreateAttributes,
    customerCreateAttributes,
    confirmPayment,
  }: {
    paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"];
    customerCreateAttributes: components["schemas"]["CreateCustomerInput"];
    confirmPayment: (token: string) => Promise<ConfirmPaymentResult>;
  }) => Promise<ConfirmPaymentResult>;
};

/**
 * Controller returned by {@link attachGooglePayButtonListeners} and
 * {@link mountAmosGooglePayButton}.
 */
export type GooglePayButtonController = {
  /**
   * Update one or more listener options without re-attaching the
   * message listener. Pass `amount` or `merchantName` to push the new
   * value into the iframe; pass `height` or `buttonProps` to restyle
   * the Google Pay button.
   */
  update: (patch: Partial<GooglePayButtonListenerOptions>) => void;
  /**
   * Detach the iframe message listener.
   */
  destroy: () => void;
};

/**
 * Wire up the host-page side of the Google Pay iframe message protocol
 * on an existing `<iframe>` element. Returns a controller for updating
 * options and tearing down the listener.
 *
 * The iframe is expected to have already been added to the DOM with the
 * correct `src` (see {@link getGooglePayButtonSrc}).
 */
export function attachGooglePayButtonListeners(
  iframe: HTMLIFrameElement,
  { height = "48px", ...options }: GooglePayButtonListenerOptions,
): GooglePayButtonController {
  let current: GooglePayButtonListenerOptions = {
    ...options,
    height,
  };
  // React calls `update()` on first paint, before the iframe has left
  // about:blank. Queue until IFRAME_READY so postMessage targetOrigin matches.
  let ready = false;
  const handshakeReload = armIframeHandshakeReload(iframe, {
    onBeforeReload: () => {
      ready = false;
    },
  });

  function pushAmount() {
    sendUpdateAmount({ iframe, amount: current.amount });
  }

  function pushMerchantName() {
    sendUpdateMerchantName({ iframe, merchantName: current.merchantName });
  }

  function pushButtonProps() {
    sendUpdateGooglePayButton({
      iframe,
      height: current.height ?? "48px",
      props: current.buttonProps ?? {},
    });
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
          appearance: appearanceWithDefaults({}, { initial: true }),
        });
        pushAmount();
        pushMerchantName();
        pushButtonProps();
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

      case "CREATE_PAYMENT_INTENT":
        void current
          .onConfirm({
            paymentIntentCreateAttributes:
              event.data.paymentIntentCreateAttributes,
            customerCreateAttributes: event.data.customerCreateAttributes,
            confirmPayment: (token) => confirmPayment({ iframe, token }),
          })
          .catch(() => ({ status: "failed" as const }));
        break;
    }
  }

  window.addEventListener("message", handleMessage);

  return {
    update(patch) {
      const hadAmount = "amount" in patch;
      const hadMerchantName = "merchantName" in patch;
      const hadButtonProps = "height" in patch || "buttonProps" in patch;
      current = { ...current, ...patch };
      if (!ready) {
        return;
      }
      if (hadAmount) {
        pushAmount();
      }
      if (hadMerchantName) {
        pushMerchantName();
      }
      if (hadButtonProps) {
        pushButtonProps();
      }
    },
    destroy() {
      handshakeReload.cancel();
      window.removeEventListener("message", handleMessage);
    },
  };
}

/**
 * Result of {@link formatGooglePayPaymentData}.
 */
export type FormattedGooglePayPaymentData = {
  paymentMethod: components["schemas"]["EmbedConfirmGooglePayPaymentMethodInput"];
};

/**
 * Transform raw Google Pay payment data into an Amos-compatible
 * `paymentMethod` payload. Use this when integrating with the raw
 * Google Pay API directly instead of through
 * {@link mountAmosGooglePayButton} (or the React equivalent).
 */
export function formatGooglePayPaymentData({
  paymentData,
}: {
  paymentData: google.payments.api.PaymentData;
}): FormattedGooglePayPaymentData {
  return {
    paymentMethod: {
      type: "googlepay",
      billing_address_attributes: {
        name: paymentData.shippingAddress?.name,
        address_line1: paymentData.shippingAddress?.address1,
        address_line2: paymentData.shippingAddress?.address2,
        city: paymentData.shippingAddress?.locality,
        state: paymentData.shippingAddress?.administrativeArea,
        postal_code: paymentData.shippingAddress?.postalCode,
        country: paymentData.shippingAddress?.countryCode,
        email: paymentData.email,
        phone: paymentData.shippingAddress?.phoneNumber,
      },
      card_profile_attributes: {
        wallet_payload: paymentData.paymentMethodData.tokenizationData.token,
      },
    },
  };
}
