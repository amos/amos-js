import type { components } from "@amos.com/node";
import { getEmbedOrigin } from "./jwt";
import {
  confirmPaymentIntent,
  hasNativeApplePaySession,
  sendConfirmationFailed,
  sendParentReadyMessage,
  updateAmount as sendUpdateAmount,
  updateAppearance as sendUpdateAppearance,
  updateMerchantName as sendUpdateMerchantName,
  updateNativeApplePaySession as sendUpdateNativeApplePaySession,
} from "./messaging";
import type { Appearance, Message } from "./types";

/**
 * Build the iframe `src` URL for the embedded Apple Pay button.
 */
export function getApplePayButtonSrc(renderToken: string): string {
  return `${getEmbedOrigin(renderToken)}/iframe/apple-pay?token=${renderToken}`;
}

/**
 * Default iframe pixel height for the Apple Pay button.
 */
export function getApplePayButtonInitialHeight(): string {
  return "40px";
}

/**
 * Options accepted by {@link attachApplePayButtonListeners}.
 */
export type ApplePayButtonListenerOptions = {
  /** The amount of the payment, in the same format passed in props. */
  amount: string;
  /** A user-visible merchant name. */
  merchantName: string;
  /**
   * Custom appearance to apply when the iframe first becomes ready and
   * whenever the appearance changes.
   */
  appearance?: Appearance;
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
   * Called when the user initiates a payment intent request via the
   * Apple Pay button. Your implementation should create a payment
   * intent on your server and resolve with the resulting embed token.
   */
  onInitiatePaymentIntentRequest: ({
    paymentIntentCreateAttributes,
    customerCreateAttributes,
  }: {
    paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"];
    customerCreateAttributes: components["schemas"]["CreateCustomerInput"];
  }) => Promise<components["schemas"]["EmbedToken"]["token"]>;
  /**
   * Called when payment intent confirmation succeeds.
   */
  onPaymentIntentConfirmationSucceeded: (
    paymentIntent: components["schemas"]["PaymentIntent"],
  ) => void;
  /**
   * Called when payment intent confirmation fails.
   */
  onConfirmationFailed: (errorMessage: string) => void;
};

/**
 * Controller returned by {@link attachApplePayButtonListeners} and
 * {@link mountAmosApplePayButton}.
 */
export type ApplePayButtonController = {
  /**
   * Update one or more listener options without re-attaching the
   * message listener. Pass `amount` or `merchantName` to push the new
   * value into the iframe; pass `appearance` to update theme variables.
   */
  update: (patch: Partial<ApplePayButtonListenerOptions>) => void;
  /**
   * Detach the iframe message listener.
   */
  destroy: () => void;
};

type SavedIframeLayout = {
  cssText: string;
  bodyOverflow: string;
};

/**
 * Expand the Apple Pay iframe to a full-viewport overlay so Chrome's QR
 * handoff UI (rendered inside the iframe) is not clipped to the button
 * height. Safari's native sheet is OS-level and unaffected.
 */
function expandApplePayIframe(iframe: HTMLIFrameElement): SavedIframeLayout {
  const saved: SavedIframeLayout = {
    cssText: iframe.style.cssText,
    bodyOverflow: document.body.style.overflow,
  };
  document.body.style.overflow = "hidden";
  Object.assign(iframe.style, {
    position: "fixed",
    inset: "0px",
    width: "100vw",
    height: "100vh",
    maxWidth: "none",
    maxHeight: "none",
    margin: "0",
    border: "0",
    zIndex: "2147483647",
    opacity: "1",
    background: "#ffffff",
  });
  return saved;
}

function collapseApplePayIframe(
  iframe: HTMLIFrameElement,
  saved: SavedIframeLayout | null,
): void {
  if (!saved) {
    return;
  }
  document.body.style.overflow = saved.bodyOverflow;
  iframe.style.cssText = saved.cssText;
}

/**
 * Wire up the host-page side of the Apple Pay iframe message protocol
 * on an existing `<iframe>` element. Returns a controller for updating
 * options and tearing down the listener.
 *
 * The iframe is expected to have already been added to the DOM with the
 * correct `src` (see {@link getApplePayButtonSrc}).
 *
 * The Apple Pay button and `ApplePaySession` run inside the Amos embed
 * iframe (so only Amos domains need Apple merchant registration). On
 * `EXPAND_IFRAME`, the parent temporarily overlays that iframe
 * full-viewport for Chrome's in-iframe QR handoff UI.
 */
export function attachApplePayButtonListeners(
  iframe: HTMLIFrameElement,
  options: ApplePayButtonListenerOptions,
): ApplePayButtonController {
  let current = { ...options };
  let savedLayout: SavedIframeLayout | null = null;

  function pushAmount() {
    sendUpdateAmount({ iframe, amount: current.amount });
  }

  function pushMerchantName() {
    sendUpdateMerchantName({ iframe, merchantName: current.merchantName });
  }

  function pushNativeApplePaySession() {
    sendUpdateNativeApplePaySession({
      iframe,
      hasNativeApplePaySession: hasNativeApplePaySession(),
    });
  }

  function handleMessage(event: MessageEvent<Message>) {
    // Ignore messages from other frames / windows.
    if (event.source !== iframe.contentWindow) {
      return;
    }

    switch (event.data.type) {
      case "IFRAME_READY":
        sendParentReadyMessage(iframe);
        sendUpdateAppearance({ iframe, appearance: current.appearance });
        pushNativeApplePaySession();
        pushAmount();
        pushMerchantName();
        break;

      case "UPDATE_HEIGHT":
        // Ignore height updates while the session overlay is open.
        if (!savedLayout) {
          current.onHeightChange?.(event.data.height);
        }
        break;

      case "UPDATE_APPEARANCE":
        sendUpdateAppearance({ iframe, appearance: event.data.appearance });
        break;

      case "UPDATED_APPEARANCE":
        current.onAppearanceReady?.();
        break;

      case "EXPAND_IFRAME":
        if (!savedLayout) {
          savedLayout = expandApplePayIframe(iframe);
        }
        break;

      case "COLLAPSE_IFRAME":
        collapseApplePayIframe(iframe, savedLayout);
        savedLayout = null;
        break;

      case "CREATE_PAYMENT_INTENT":
        current
          .onInitiatePaymentIntentRequest({
            paymentIntentCreateAttributes:
              event.data.paymentIntentCreateAttributes,
            customerCreateAttributes: event.data.customerCreateAttributes,
          })
          .then((token) => {
            confirmPaymentIntent({ iframe, token });
          })
          .catch((error: unknown) => {
            sendConfirmationFailed({
              iframe,
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            });
          });
        break;

      case "PAYMENT_INTENT_CONFIRMATION_SUCCEEDED":
        current.onPaymentIntentConfirmationSucceeded(event.data.paymentIntent);
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
      const hadAmount = "amount" in patch;
      const hadMerchantName = "merchantName" in patch;
      current = { ...current, ...patch };
      if (hadAppearance) {
        sendUpdateAppearance({ iframe, appearance: current.appearance });
      }
      if (hadAmount) {
        pushAmount();
      }
      if (hadMerchantName) {
        pushMerchantName();
      }
    },
    destroy() {
      window.removeEventListener("message", handleMessage);
      collapseApplePayIframe(iframe, savedLayout);
      savedLayout = null;
    },
  };
}
