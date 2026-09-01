import type { components } from "@amos.com/node";
import {
  hideApplePayWaitingOverlay,
  setApplePayWaitingOverlayCompleting,
  showApplePayWaitingOverlay,
} from "./apple-pay-waiting-overlay";
import { embedIframeSearchParams } from "./embed-src";
import { armIframeHandshakeReload } from "./handshake-reload";
import { getEmbedOrigin } from "./jwt";
import {
  confirmPayment,
  getIframeTargetOrigin,
  sendParentReadyMessage,
  updateAmount as sendUpdateAmount,
  updateAppearance as sendUpdateAppearance,
  updateApplePayButton as sendUpdateApplePayButton,
  updateMerchantName as sendUpdateMerchantName,
} from "./messaging";
import {
  type ApplePayButtonElementProps,
  type ConfirmPaymentResult,
  createMessage,
  type Message,
} from "./types";

/**
 * Build the iframe `src` URL for the embedded Apple Pay button.
 */
export function getApplePayButtonSrc(renderToken: string): string {
  const params = embedIframeSearchParams({ token: renderToken });
  return `${getEmbedOrigin(renderToken)}/iframe/apple-pay?${params}`;
}

/**
 * Default iframe pixel height for the Apple Pay button.
 */
export function getApplePayButtonInitialHeight(): string {
  return "48px";
}

/**
 * Options accepted by {@link attachApplePayButtonListeners}.
 */
export type ApplePayButtonListenerOptions = {
  /**
   * Major-currency decimal string shown in the Apple Pay sheet
   * (e.g. `"50.00"` for $50.00). Converted to cents in
   * `paymentIntentCreateAttributes.amount`.
   */
  amount: string;
  /** A user-visible merchant name. */
  merchantName: string;
  /**
   * Painted Apple Pay button height. CSS length (e.g. `"48px"`).
   * @default "48px"
   */
  height?: string;
  /**
   * Native `<apple-pay-button>` attributes and inner style. Omitted
   * fields keep Apple's defaults (`black` / `plain` / `en-US`). The
   * button fills the iframe — size the mount slot, not the button.
   */
  buttonProps?: ApplePayButtonElementProps;
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
   * Called when the buyer authorizes in the Apple Pay sheet. Create a
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
 * Controller returned by {@link attachApplePayButtonListeners} and
 * {@link mountAmosApplePayButton}.
 */
export type ApplePayButtonController = {
  /**
   * Update one or more listener options without re-attaching the
   * message listener. Pass `amount` or `merchantName` to push the new
   * value into the iframe; pass `height` or `buttonProps` to restyle
   * the Apple Pay button.
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
 * waiting overlay. Cancel (via {@link Message} `APPLE_PAY_CANCEL`) is
 * available until the buyer authorizes; after `CREATE_PAYMENT_INTENT`
 * the overlay switches to a completing state with no Cancel, then hides
 * when `onConfirm` settles.
 */
export function attachApplePayButtonListeners(
  iframe: HTMLIFrameElement,
  { height = "48px", ...options }: ApplePayButtonListenerOptions,
): ApplePayButtonController {
  let current: ApplePayButtonListenerOptions = {
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
    sendUpdateApplePayButton({
      iframe,
      height: current.height ?? "48px",
      props: current.buttonProps ?? {},
    });
  }

  function handleMessage(event: MessageEvent<Message>) {
    // Ignore messages from other frames / windows.
    if (event.source !== iframe.contentWindow) {
      return;
    }

    switch (event.data.type) {
      case "IFRAME_READY":
        handshakeReload.noteReady();
        ready = true;
        sendParentReadyMessage(iframe);
        sendUpdateAppearance({ iframe, appearance: {} });
        pushAmount();
        pushMerchantName();
        pushButtonProps();
        current.onIframeReady?.();
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
        setApplePayWaitingOverlayCompleting();
        void current
          .onConfirm({
            paymentIntentCreateAttributes:
              event.data.paymentIntentCreateAttributes,
            customerCreateAttributes: event.data.customerCreateAttributes,
            confirmPayment: (token) => confirmPayment({ iframe, token }),
          })
          .catch(() => ({ status: "failed" as const }))
          .finally(() => {
            hideApplePayWaitingOverlay();
          });
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
      hideApplePayWaitingOverlay();
    },
  };
}
