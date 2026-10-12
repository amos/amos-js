import {
  type ApplePayButtonController,
  type ApplePayButtonListenerOptions,
  attachApplePayButtonListeners,
  getApplePayButtonInitialHeight,
  getApplePayButtonSrc,
} from "./apple-pay";
import {
  createPaymentMethodFormSkeleton,
  createWalletButtonSkeleton,
  type PaymentMethodFormSkeletonOptions,
  resolveWalletButtonSkeletonBorderRadius,
  type WalletButtonSkeleton,
  type WalletButtonSkeletonOptions,
} from "./form-skeleton";
import {
  attachGooglePayButtonListeners,
  type GooglePayButtonController,
  type GooglePayButtonListenerOptions,
  getGooglePayButtonInitialHeight,
  getGooglePayButtonSrc,
} from "./google-pay";
import {
  attachPaymentMethodFormListeners,
  type BillingAddressRequirement,
  type CreditCardAdditionalFields,
  getBankAccountFormInitialHeight,
  getBankAccountFormSrc,
  getCreditCardFormInitialHeight,
  getCreditCardFormSrc,
  type PaymentMethodFormController,
  type PaymentMethodFormListenerOptions,
} from "./payment-method-form";
import { attachPlaidBankUi } from "./plaid-bank-ui";

type Container = HTMLElement | string;

function resolveContainer(container: Container): HTMLElement {
  if (typeof container === "string") {
    const element = document.querySelector(container);
    if (!(element instanceof HTMLElement)) {
      throw new Error(
        `[amos-js] Container "${container}" did not match any HTMLElement.`,
      );
    }
    return element;
  }
  return container;
}

/**
 * Host skeleton is removed this long after mount if appearance never
 * acks. The clock starts when the form is inserted, not on
 * `IFRAME_READY`, so a dropped handshake still uncovers the iframe.
 */
export const SKELETON_REVEAL_TIMEOUT_MS = 1500;

/**
 * Sandbox for card and bank frames.
 *
 * The embed origin differs from the merchant page, so `allow-scripts`
 * together with `allow-same-origin` cannot be used to remove this
 * sandbox. `allow-same-origin` keeps `postMessage` on the embed origin
 * and lets the frame use its own storage. `allow-forms` lets the card
 * and bank forms submit. Top-level navigation stays blocked.
 */
export const PAYMENT_IFRAME_SANDBOX =
  "allow-forms allow-same-origin allow-scripts";

/**
 * Wallet frames open Apple Pay Code and the Google Pay sheet in a new
 * window. That window has to leave the sandbox, or the sheet cannot run.
 */
export const WALLET_IFRAME_SANDBOX = `${PAYMENT_IFRAME_SANDBOX} allow-popups allow-popups-to-escape-sandbox`;

const FORM_IFRAME_STYLE: Partial<CSSStyleDeclaration> = {
  transition: "height 200ms ease-in-out",
  margin: "0 -4px",
  opacity: "1",
  border: "0",
};

const WALLET_IFRAME_STYLE: Partial<CSSStyleDeclaration> = {
  transition: "height 200ms ease-in-out",
  margin: "0",
  opacity: "1",
  border: "0",
};

const WALLET_SKELETON_IFRAME_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  top: "0",
  left: "0",
  margin: "0",
  opacity: "1",
  zIndex: "0",
  // Width and height are assigned as pixels below. A 0px frame,
  // a percentage, or visibility:hidden can pause iframe JS.
  transition: "none",
  pointerEvents: "none",
};

const SKELETON_IFRAME_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  top: "0",
  left: "-4px",
  margin: "0",
  opacity: "1",
  zIndex: "0",
  // Same box the iframe uses after reveal. The wrapper clips the 4px
  // bleed on each side. Width and height stay explicit pixels so
  // WebKit does not pause layout under the skeleton.
  transition: "none",
  pointerEvents: "none",
};

/**
 * Card and bank frames extend 4px past each side of the mount so the
 * focus ring is not clipped. The wrapper's overflow hides that bleed.
 */
const FORM_IFRAME_BLEED_PX = 8;

const CSS_PX = /^(\d+(?:\.\d+)?)px$/u;

function positiveCssPx(value: string): number | undefined {
  const match = CSS_PX.exec(value.trim());
  if (!match?.[1]) {
    return undefined;
  }
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

/**
 * WebKit pauses an iframe's layout engine unless both axes are definite
 * pixel lengths. Percentage and calc() widths do not count, and a
 * missing content attribute is treated like an empty box. Keep the HTML
 * width/height attributes and the used CSS lengths in positive pixels.
 */
function setExplicitIframeBox(
  iframe: HTMLIFrameElement,
  widthPx: number,
  heightPx: number,
): void {
  const width = String(Math.max(1, Math.round(widthPx)));
  const height = String(Math.max(1, Math.round(heightPx)));
  if (iframe.width !== width) {
    iframe.width = width;
  }
  if (iframe.height !== height) {
    iframe.height = height;
  }
  const widthCss = `${width}px`;
  const heightCss = `${height}px`;
  if (iframe.style.width !== widthCss) {
    iframe.style.width = widthCss;
  }
  if (iframe.style.height !== heightCss) {
    iframe.style.height = heightCss;
  }
}

function explicitWidthPx(container: HTMLElement, extraPx: number): number {
  const measured = container.getBoundingClientRect().width;
  const base = measured > 0 ? measured : container.clientWidth;
  return Math.max(1, (base > 0 ? base : 1) + extraPx);
}

function currentHeightPx(iframe: HTMLIFrameElement): number {
  const fromStyle = positiveCssPx(iframe.style.height);
  if (fromStyle != null) {
    return fromStyle;
  }
  const measured = iframe.getBoundingClientRect().height;
  if (measured > 0) {
    return measured;
  }
  return positiveCssPx(`${iframe.height}px`) ?? 1;
}

function trackExplicitIframeBox(
  iframe: HTMLIFrameElement,
  container: HTMLElement,
  extraWidthPx: number,
): { apply: () => void; stop: () => void } {
  const apply = () => {
    setExplicitIframeBox(
      iframe,
      explicitWidthPx(container, extraWidthPx),
      currentHeightPx(iframe),
    );
  };
  apply();
  if (typeof ResizeObserver === "undefined") {
    return { apply, stop: () => {} };
  }
  const observer = new ResizeObserver(() => {
    apply();
  });
  observer.observe(container);
  return {
    apply,
    stop: () => {
      observer.disconnect();
    },
  };
}

function setIframeCovered(iframe: HTMLIFrameElement, covered: boolean): void {
  iframe.inert = covered;
  iframe.style.pointerEvents = covered ? "none" : "";
}

function createIframe({
  src,
  title,
  name,
  height,
  allow,
  sandbox,
  className,
  style = FORM_IFRAME_STYLE,
}: {
  src: string;
  title: string;
  name: string;
  height: string;
  allow?: string;
  sandbox: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
}): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.title = title;
  iframe.name = name;
  iframe.setAttribute("role", "presentation");
  iframe.scrolling = "no";
  // Apply sandbox before `src` so the first navigation is already restricted.
  iframe.setAttribute("sandbox", sandbox);
  if (allow) {
    iframe.allow = allow;
  }
  if (className != null) {
    iframe.className = className;
  }
  const heightPx = Math.max(1, Math.round(positiveCssPx(height) ?? 1));
  // A non-zero pixel box before the mount measures the container. A
  // percentage here is not an explicit size, so WebKit may skip layout.
  Object.assign(iframe.style, style, {
    width: "1px",
    height: `${heightPx}px`,
  });
  iframe.width = "1";
  iframe.height = String(heightPx);
  iframe.src = src;
  return iframe;
}

function mountPaymentMethodFormWithSkeleton({
  host,
  iframe,
  listenerOptions,
  skeletonOptions,
}: {
  host: HTMLElement;
  iframe: HTMLIFrameElement;
  listenerOptions: PaymentMethodFormListenerOptions;
  skeletonOptions: PaymentMethodFormSkeletonOptions;
}): AmosPaymentMethodFormMountController {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = "100%";
  wrapper.style.isolation = "isolate";
  // Clip the iframe's focus-ring bleed and any extra height. The skeleton
  // is the content width, so this clip does not cut its corner radius.
  wrapper.style.overflow = "hidden";
  wrapper.setAttribute("aria-busy", "true");

  const skeleton = createPaymentMethodFormSkeleton(skeletonOptions);
  const defaultHeight = iframe.style.height;
  Object.assign(iframe.style, SKELETON_IFRAME_STYLE);
  iframe.style.height = defaultHeight;
  setIframeCovered(iframe, true);
  let explicitBox: { apply: () => void; stop: () => void } = {
    apply: () => {},
    stop: () => {},
  };

  let revealed = false;
  let lastHeight: string | undefined;
  let appearance = skeletonOptions.appearance;
  let heightTransitionTimer: ReturnType<typeof setTimeout> | undefined;
  let fallbackRevealTimer: ReturnType<typeof setTimeout> | undefined;
  let currentOptions = listenerOptions;

  function skeletonHeightPx(): number {
    return wrapper.getBoundingClientRect().height;
  }

  function reportedHeightPx(): number {
    return lastHeight ? Number.parseFloat(lastHeight) : Number.NaN;
  }

  function reveal(): void {
    if (revealed) {
      return;
    }
    revealed = true;
    if (fallbackRevealTimer !== undefined) {
      clearTimeout(fallbackRevealTimer);
      fallbackRevealTimer = undefined;
    }

    const skeletonPx = skeletonHeightPx();
    const reportedPx = reportedHeightPx();
    // lastHeight can still be the pre-appearance measure and shorter than
    // the host skeleton. Never shrink on first paint; a later UPDATE_HEIGHT
    // applies the post-appearance size.
    const revealPx = Number.isFinite(reportedPx)
      ? Math.max(reportedPx, skeletonPx)
      : skeletonPx;

    iframe.style.transition = "none";
    iframe.style.position = "";
    iframe.style.top = "";
    iframe.style.left = "";
    iframe.style.margin = FORM_IFRAME_STYLE.margin ?? "";
    iframe.style.height = `${revealPx}px`;
    iframe.style.opacity = "1";
    explicitBox.apply();
    setIframeCovered(iframe, false);
    wrapper.style.overflow = "";
    skeleton.element.remove();
    wrapper.removeAttribute("aria-busy");

    // Height easing is for later layout changes (ZIP show/hide, errors),
    // not the first paint — that would animate the last row into place.
    heightTransitionTimer = setTimeout(() => {
      iframe.style.transition = "height 200ms ease-in-out";
    }, 400);
  }

  function startFallbackReveal(): void {
    if (revealed || fallbackRevealTimer !== undefined) {
      return;
    }
    fallbackRevealTimer = setTimeout(() => {
      reveal();
    }, SKELETON_REVEAL_TIMEOUT_MS);
  }

  const controller = attachPaymentMethodFormListeners(iframe, {
    ...listenerOptions,
    onHeightChange: (height) => {
      lastHeight = height;
      if (revealed) {
        iframe.style.height = height;
        explicitBox.apply();
      }
      currentOptions.onHeightChange?.(height);
    },
    onAppearanceReady: () => {
      reveal();
      currentOptions.onAppearanceReady?.();
    },
    onIframeReady: () => {
      currentOptions.onIframeReady?.();
    },
  });

  wrapper.append(skeleton.element, iframe);
  host.appendChild(wrapper);
  explicitBox.stop();
  explicitBox = trackExplicitIframeBox(iframe, wrapper, FORM_IFRAME_BLEED_PX);
  startFallbackReveal();

  return {
    iframe,
    update(patch) {
      currentOptions = { ...currentOptions, ...patch };
      // Keep the wrapped reveal listeners. Forwarding these would replace
      // them and leave the iframe covered by the skeleton.
      const rest = { ...patch };
      delete rest.onAppearanceReady;
      delete rest.onHeightChange;
      delete rest.onIframeReady;
      controller.update(rest);
      if (!revealed && "appearance" in patch) {
        appearance = patch.appearance;
        skeleton.update({ ...skeletonOptions, appearance });
      }
    },
    focus(field) {
      controller.focus(field);
    },
    destroy() {
      if (heightTransitionTimer !== undefined) {
        clearTimeout(heightTransitionTimer);
      }
      if (fallbackRevealTimer !== undefined) {
        clearTimeout(fallbackRevealTimer);
      }
      explicitBox.stop();
      controller.destroy();
      wrapper.remove();
    },
  };
}

type WalletListenerOptions = {
  height?: string;
  onHeightChange?: (height: string) => void;
  onAppearanceReady?: () => void;
  onIframeReady?: () => void;
  buttonProps?: {
    buttonRadius?: number;
    style?: Record<string, string | number | undefined>;
  };
};

type WalletListenerController<TOptions> = {
  update: (patch: Partial<TOptions>) => void;
  destroy: () => void;
};

function mountWalletButtonWithSkeleton<TOptions extends WalletListenerOptions>({
  host,
  iframe,
  listenerOptions,
  iframeStyle,
  attachListeners,
}: {
  host: HTMLElement;
  iframe: HTMLIFrameElement;
  listenerOptions: TOptions;
  iframeStyle?: Partial<CSSStyleDeclaration>;
  attachListeners: (
    iframe: HTMLIFrameElement,
    options: TOptions,
  ) => WalletListenerController<TOptions>;
}): {
  iframe: HTMLIFrameElement;
  update: (patch: Partial<TOptions>) => void;
  destroy: () => void;
} {
  const initialHeight = listenerOptions.height ?? "48px";
  let skeletonOptions: WalletButtonSkeletonOptions = {
    height: initialHeight,
    borderRadius: resolveWalletButtonSkeletonBorderRadius({
      iframeStyle,
      buttonProps: listenerOptions.buttonProps,
    }),
  };
  const skeleton: WalletButtonSkeleton =
    createWalletButtonSkeleton(skeletonOptions);

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = "100%";
  wrapper.style.height = skeletonOptions.height;
  wrapper.style.overflow = "hidden";
  wrapper.style.isolation = "isolate";
  wrapper.setAttribute("aria-busy", "true");

  Object.assign(iframe.style, WALLET_SKELETON_IFRAME_STYLE);
  iframe.style.height = initialHeight;
  setIframeCovered(iframe, true);
  let explicitBox: { apply: () => void; stop: () => void } = {
    apply: () => {},
    stop: () => {},
  };

  let revealed = false;
  let appearanceReady = false;
  let fallbackRevealTimer: ReturnType<typeof setTimeout> | undefined;
  let currentOptions = listenerOptions;

  function reveal(): void {
    if (revealed) {
      return;
    }
    revealed = true;
    if (fallbackRevealTimer !== undefined) {
      clearTimeout(fallbackRevealTimer);
      fallbackRevealTimer = undefined;
    }

    iframe.style.opacity = "1";
    setIframeCovered(iframe, false);
    skeleton.element.remove();
    wrapper.removeAttribute("aria-busy");
  }

  function tryReveal(): void {
    if (revealed || !appearanceReady) {
      return;
    }
    reveal();
  }

  function startFallbackReveal(): void {
    if (revealed || fallbackRevealTimer !== undefined) {
      return;
    }
    fallbackRevealTimer = setTimeout(() => {
      reveal();
    }, SKELETON_REVEAL_TIMEOUT_MS);
  }

  const controller = attachListeners(iframe, {
    ...listenerOptions,
    onHeightChange: (height) => {
      currentOptions.onHeightChange?.(height);
    },
    onAppearanceReady: () => {
      appearanceReady = true;
      tryReveal();
      currentOptions.onAppearanceReady?.();
    },
    onIframeReady: () => {
      currentOptions.onIframeReady?.();
    },
  } as TOptions);

  wrapper.append(skeleton.element, iframe);
  host.appendChild(wrapper);
  explicitBox = trackExplicitIframeBox(iframe, wrapper, 0);
  startFallbackReveal();

  return {
    iframe,
    update(patch) {
      currentOptions = { ...currentOptions, ...patch };
      // Keep the wrapped reveal listeners. Forwarding these would replace
      // them and leave the iframe covered by the skeleton.
      const rest = { ...patch };
      delete rest.onAppearanceReady;
      delete rest.onHeightChange;
      delete rest.onIframeReady;
      controller.update(rest);
      skeletonOptions = {
        height: currentOptions.height ?? skeletonOptions.height,
        borderRadius: resolveWalletButtonSkeletonBorderRadius({
          iframeStyle,
          buttonProps: currentOptions.buttonProps,
        }),
      };
      wrapper.style.height = skeletonOptions.height;
      iframe.style.height = skeletonOptions.height;
      explicitBox.apply();
      if (!revealed) {
        skeleton.update(skeletonOptions);
      }
    },
    destroy() {
      if (fallbackRevealTimer !== undefined) {
        clearTimeout(fallbackRevealTimer);
      }
      explicitBox.stop();
      controller.destroy();
      wrapper.remove();
    },
  };
}

/**
 * Options accepted by {@link mountAmosCreditCardPaymentMethodForm}.
 */
export type AmosCreditCardPaymentMethodFormOptions =
  PaymentMethodFormListenerOptions & {
    /**
     * The Amos render token for the credit-card payment method form.
     *
     * It is safe to pass this to the client. Create this on
     * https://dashboard.amos.com.
     */
    renderToken: string;
    /**
     * The additional fields that are required to be filled out in the
     * form in addition to the card number, expiration date, CVV, and
     * billing address fields.
     *
     * @default { cardholderName: false }
     */
    additionalFields?: CreditCardAdditionalFields;
    /**
     * How much billing address the form collects.
     *
     * @default "country"
     */
    billingAddressRequirement?: BillingAddressRequirement;
  };

/**
 * Controller returned by {@link mountAmosCreditCardPaymentMethodForm}
 * and {@link mountAmosBankAccountPaymentMethodForm}.
 */
export type AmosPaymentMethodFormMountController =
  PaymentMethodFormController & {
    /**
     * The underlying `<iframe>` element. Pass this as the `iframe`
     * argument to {@link validateForm}, {@link confirmPayment}, or
     * {@link confirmSetup}.
     */
    iframe: HTMLIFrameElement;
  };

/**
 * Controller returned by {@link mountAmosBankAccountPaymentMethodForm}.
 * `update()` also accepts `requireAchVerification` when the host's ACH
 * policy changes.
 */
export type AmosBankAccountPaymentMethodFormMountController = Omit<
  AmosPaymentMethodFormMountController,
  "update"
> & {
  update: (patch: Partial<AmosBankAccountPaymentMethodFormOptions>) => void;
};

/**
 * Mount the secure credit-card payment method form into a container
 * element. Returns a controller exposing the underlying iframe, an
 * `update()` method, and a `destroy()` method.
 *
 * A field-shaped skeleton with an opaque background covers the iframe
 * immediately. The iframe stays at opacity 1 with an explicit pixel
 * width and height so WebKit lays it out and runs its JS. It is inert
 * until the skeleton is removed, once appearance is applied or
 * {@link SKELETON_REVEAL_TIMEOUT_MS} after mount if appearance never acks.
 *
 * Use the returned `controller.iframe` when calling
 * {@link validateForm}, {@link confirmPayment}, or
 * {@link confirmSetup}.
 */
export function mountAmosCreditCardPaymentMethodForm(
  container: Container,
  options: AmosCreditCardPaymentMethodFormOptions,
): AmosPaymentMethodFormMountController {
  const host = resolveContainer(container);
  const {
    renderToken,
    additionalFields = { cardholderName: false },
    billingAddressRequirement = "country",
    ...listenerOptions
  } = options;

  const iframe = createIframe({
    src: getCreditCardFormSrc(
      renderToken,
      additionalFields,
      billingAddressRequirement,
    ),
    title: "Secure credit card payment method form powered by Amos",
    name: "amos-credit-card-payment-method-form",
    height: getCreditCardFormInitialHeight(
      additionalFields,
      billingAddressRequirement,
    ),
    sandbox: PAYMENT_IFRAME_SANDBOX,
  });

  return mountPaymentMethodFormWithSkeleton({
    host,
    iframe,
    listenerOptions,
    skeletonOptions: {
      kind: "card",
      appearance: listenerOptions.appearance,
      additionalFields,
      billingAddressRequirement,
    },
  });
}

/**
 * Options accepted by {@link mountAmosBankAccountPaymentMethodForm}.
 */
export type AmosBankAccountPaymentMethodFormOptions =
  PaymentMethodFormListenerOptions & {
    /**
     * The Amos render token for the bank-account payment method form.
     *
     * It is safe to pass this to the client. Create this on
     * https://dashboard.amos.com.
     */
    renderToken: string;
    /**
     * How much billing address the form collects.
     *
     * @default "country"
     */
    billingAddressRequirement?: BillingAddressRequirement;
    /**
     * When true, hide the routing/account iframe and mount Plaid
     * Embedded Institution Search in the parent. Ignored when
     * {@link AmosBankAccountPaymentMethodFormOptions.intent} is
     * `"setup"` (setup always shows Plaid) or when the render token
     * disables verification.
     *
     * Hosts that still have an ACH threshold should compute this
     * themselves (for example with `requiresAchVerification`).
     * `update({ requireAchVerification })` hides or shows Link; it does
     * not destroy the Embedded handler. `destroy()` tears it down.
     *
     * @default false
     */
    requireAchVerification?: boolean;
    /**
     * `"setup"` saves a bank account for later charges and always shows
     * Plaid (unless the render token disables verification). `"payment"`
     * uses {@link AmosBankAccountPaymentMethodFormOptions.requireAchVerification}.
     *
     * @default "payment"
     */
    intent?: "payment" | "setup";
  };

/**
 * Mount the secure bank-account payment method form into a container
 * element. Returns a controller exposing the underlying iframe, an
 * `update()` method, and a `destroy()` method.
 *
 * When {@link AmosBankAccountPaymentMethodFormOptions.requireAchVerification}
 * is true (or `intent` is `"setup"`), and the render token allows
 * verification, the SDK hides the routing/account iframe and mounts
 * [Plaid Embedded Institution Search](https://plaid.com/docs/link/embedded-institution-search/)
 * in the parent. `update({ requireAchVerification })` hides or shows
 * that handler; it does not destroy it. Hosts do not proxy Pay API
 * (`GET /merchants`, `POST /plaid_link_tokens`); embed does that with
 * `PAY_API_KEY`. Do not put Plaid secrets in the browser.
 *
 * Use the returned `controller.iframe` when calling
 * {@link validateForm}, {@link confirmPayment}, or
 * {@link confirmSetup}.
 */
export function mountAmosBankAccountPaymentMethodForm(
  container: Container,
  options: AmosBankAccountPaymentMethodFormOptions,
): AmosBankAccountPaymentMethodFormMountController {
  const host = resolveContainer(container);
  const {
    renderToken,
    billingAddressRequirement = "country",
    requireAchVerification = false,
    intent = "payment",
    ...listenerOptions
  } = options;

  const iframe = createIframe({
    src: getBankAccountFormSrc(renderToken, billingAddressRequirement, intent),
    title: "Secure bank account payment method form powered by Amos",
    name: "amos-bank-account-payment-method-form",
    height: getBankAccountFormInitialHeight(billingAddressRequirement),
    sandbox: PAYMENT_IFRAME_SANDBOX,
  });

  const iframeMount = mountPaymentMethodFormWithSkeleton({
    host,
    iframe,
    listenerOptions,
    skeletonOptions: {
      kind: "bank",
      appearance: listenerOptions.appearance,
      billingAddressRequirement,
    },
  });

  const plaidUi = attachPlaidBankUi({
    host,
    iframe,
    options: {
      renderToken,
      requireAchVerification,
      intent,
      appearance: listenerOptions.appearance,
      onValidityChange: listenerOptions.onValidityChange,
    },
  });

  return {
    iframe,
    update(patch) {
      iframeMount.update(patch as Partial<PaymentMethodFormListenerOptions>);
      plaidUi.update(patch);
    },
    focus(field) {
      iframeMount.focus(field);
    },
    destroy() {
      plaidUi.destroy();
      iframeMount.destroy();
    },
  };
}

/**
 * Options accepted by {@link mountAmosGooglePayButton}.
 */
export type AmosGooglePayButtonOptions = GooglePayButtonListenerOptions & {
  /**
   * The Amos render token for the Google Pay button.
   *
   * It is safe to pass this to the client. Create this on
   * https://dashboard.amos.com.
   */
  renderToken: string;
  /** Class names applied to the host-page `<iframe>` element. */
  iframeClassName?: string;
  /**
   * Inline style applied to the host-page `<iframe>` element. Use CSS
   * lengths with units (`{ borderRadius: "8px" }`).
   */
  iframeStyle?: Partial<CSSStyleDeclaration>;
};

/**
 * Controller returned by {@link mountAmosGooglePayButton}.
 */
export type AmosGooglePayButtonMountController = GooglePayButtonController & {
  /**
   * The underlying `<iframe>` element.
   */
  iframe: HTMLIFrameElement;
};

/**
 * Mount the secure Google Pay button (express checkout) into a
 * container element. Returns a controller exposing the underlying
 * iframe, an `update()` method, and a `destroy()` method.
 *
 * A button-shaped skeleton with an opaque background covers the iframe
 * immediately. The iframe stays at opacity 1 with an explicit pixel
 * width and height so WebKit lays it out and runs its JS. It is inert
 * until the skeleton is removed, once appearance is applied or
 * {@link SKELETON_REVEAL_TIMEOUT_MS} after mount if appearance never acks.
 */
export function mountAmosGooglePayButton(
  container: Container,
  options: AmosGooglePayButtonOptions,
): AmosGooglePayButtonMountController {
  const host = resolveContainer(container);
  const { renderToken, iframeClassName, iframeStyle, ...listenerOptions } =
    options;

  const iframe = createIframe({
    src: getGooglePayButtonSrc(renderToken),
    title: "Secure Google Pay button powered by Amos",
    name: "amos-google-pay-button",
    height: listenerOptions.height ?? getGooglePayButtonInitialHeight(),
    allow: "payment",
    sandbox: WALLET_IFRAME_SANDBOX,
    className: iframeClassName,
    style: WALLET_IFRAME_STYLE,
  });
  Object.assign(iframe.style, iframeStyle);

  return mountWalletButtonWithSkeleton({
    host,
    iframe,
    listenerOptions,
    iframeStyle,
    attachListeners: attachGooglePayButtonListeners,
  });
}

/**
 * Options accepted by {@link mountAmosApplePayButton}.
 */
export type AmosApplePayButtonOptions = ApplePayButtonListenerOptions & {
  /**
   * The Amos render token for the Apple Pay button.
   *
   * It is safe to pass this to the client. Create this on
   * https://dashboard.amos.com.
   */
  renderToken: string;
  /** Class names applied to the host-page `<iframe>` element. */
  iframeClassName?: string;
  /**
   * Inline style applied to the host-page `<iframe>` element. Use CSS
   * lengths with units (`{ borderRadius: "8px" }`).
   */
  iframeStyle?: Partial<CSSStyleDeclaration>;
};

/**
 * Controller returned by {@link mountAmosApplePayButton}.
 */
export type AmosApplePayButtonMountController = ApplePayButtonController & {
  /**
   * The underlying `<iframe>` element.
   */
  iframe: HTMLIFrameElement;
};

/**
 * Mount the secure Apple Pay button (express checkout) into a
 * container element. Returns a controller exposing the underlying
 * iframe, an `update()` method, and a `destroy()` method.
 *
 * A button-shaped skeleton with an opaque background covers the iframe
 * immediately. The iframe stays at opacity 1 with an explicit pixel
 * width and height so WebKit lays it out and runs its JS. It is inert
 * until the skeleton is removed, once appearance is applied or
 * {@link SKELETON_REVEAL_TIMEOUT_MS} after mount if appearance never acks.
 */
export function mountAmosApplePayButton(
  container: Container,
  options: AmosApplePayButtonOptions,
): AmosApplePayButtonMountController {
  const host = resolveContainer(container);
  const { renderToken, iframeClassName, iframeStyle, ...listenerOptions } =
    options;

  const iframe = createIframe({
    src: getApplePayButtonSrc(renderToken),
    title: "Secure Apple Pay button powered by Amos",
    name: "amos-apple-pay-button",
    height: listenerOptions.height ?? getApplePayButtonInitialHeight(),
    allow: "payment",
    sandbox: WALLET_IFRAME_SANDBOX,
    className: iframeClassName,
    style: WALLET_IFRAME_STYLE,
  });
  Object.assign(iframe.style, iframeStyle);

  return mountWalletButtonWithSkeleton({
    host,
    iframe,
    listenerOptions,
    iframeStyle,
    attachListeners: attachApplePayButtonListeners,
  });
}
