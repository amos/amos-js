import type { components } from "@amos.com/node";
import {
  hideApplePayWaitingOverlay,
  showApplePayWaitingOverlay,
} from "./apple-pay-waiting-overlay";
import { getEmbedOrigin } from "./jwt";
import {
  confirmPaymentIntent,
  getIframeTargetOrigin,
  sendParentReadyMessage,
  updateAmount as sendUpdateAmount,
  updateAppearance as sendUpdateAppearance,
  updateApplePayButton as sendUpdateApplePayButton,
  updateMerchantName as sendUpdateMerchantName,
} from "./messaging";
import {
  type Appearance,
  type ApplePayButtonElementProps,
  type ConfirmationResult,
  createMessage,
  type Message,
} from "./types";

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
export type ApplePayButtonListenerOptions = ApplePayButtonElementProps & {
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
   * Called when the interactive confirmation flow finishes (success or
   * terminal failure). Not settlement proof — verify via webhooks.
   */
  onResult: (result: ConfirmationResult) => void;
};

/**
 * Controller returned by {@link attachApplePayButtonListeners} and
 * {@link mountAmosApplePayButton}.
 */
export type ApplePayButtonController = {
  /**
   * Update one or more listener options without re-attaching the
   * message listener. Pass `amount` or `merchantName` to push the new
   * value into the iframe; pass `appearance` to update theme variables;
   * pass `buttonstyle`, `type`, `locale`, or `style` to restyle the
   * Apple Pay button.
   */
  update: (patch: Partial<ApplePayButtonListenerOptions>) => void;
  /**
   * Detach the iframe message listener.
   */
  destroy: () => void;
};

function sendApplePayCancel(iframe: HTMLIFrameElement): void {
  iframe.contentWindow?.postMessage(
    createMessage({ type: "APPLE_PAY_CANCEL" }),
    getIframeTargetOrigin(iframe),
  );
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
 * iframe so only Amos domains need Apple merchant registration. While
 * Apple Pay Code is open in a separate window, this host paints a
 * waiting overlay and can cancel via {@link Message} `APPLE_PAY_CANCEL`.
 */
export function attachApplePayButtonListeners(
  iframe: HTMLIFrameElement,
  options: ApplePayButtonListenerOptions,
): ApplePayButtonController {
  let current = { ...options };

  function pushAmount() {
    sendUpdateAmount({ iframe, amount: current.amount });
  }

  function pushMerchantName() {
    sendUpdateMerchantName({ iframe, merchantName: current.merchantName });
  }

  function pushButtonProps() {
    sendUpdateApplePayButton({ iframe, props: current });
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
        pushAmount();
        pushMerchantName();
        pushButtonProps();
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

      case "APPLE_PAY_WINDOW_OPEN":
        showApplePayWaitingOverlay({
          onCancel: () => {
            sendApplePayCancel(iframe);
            hideApplePayWaitingOverlay();
          },
        });
        break;

      case "APPLE_PAY_WINDOW_CLOSE":
        hideApplePayWaitingOverlay();
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
            hideApplePayWaitingOverlay();
            current.onResult({
              status: "failed",
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            });
          });
        break;

      case "CONFIRMATION_RESULT":
        hideApplePayWaitingOverlay();
        current.onResult(event.data.result);
        break;
    }
  }

  window.addEventListener("message", handleMessage);

  return {
    update(patch) {
      const hadAppearance = "appearance" in patch;
      const hadAmount = "amount" in patch;
      const hadMerchantName = "merchantName" in patch;
      const hadButtonProps =
        "fullWidth" in patch ||
        "buttonstyle" in patch ||
        "type" in patch ||
        "locale" in patch ||
        "style" in patch;
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
      if (hadButtonProps) {
        pushButtonProps();
      }
    },
    destroy() {
      window.removeEventListener("message", handleMessage);
      hideApplePayWaitingOverlay();
    },
  };
}
