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

const FORM_IFRAME_STYLE: Partial<CSSStyleDeclaration> = {
  width: "calc(100% + 8px)",
  transition: "opacity 150ms ease-in, height 200ms ease-in-out",
  margin: "0 -4px",
  opacity: "0",
  border: "0",
};

const WALLET_IFRAME_STYLE: Partial<CSSStyleDeclaration> = {
  width: "100%",
  transition: "height 200ms ease-in-out",
  margin: "0",
  opacity: "0",
  border: "0",
};

const WALLET_SKELETON_IFRAME_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  top: "0",
  left: "0",
  width: "100%",
  height: "100%",
  margin: "0",
  opacity: "0",
  // Do not interpolate opacity while the skeleton is showing.
  transition: "none",
  pointerEvents: "none",
};

const SKELETON_IFRAME_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  top: "0",
  left: "-4px",
  width: "calc(100% + 8px)",
  height: "100%",
  margin: "0",
  // Do not interpolate opacity while the skeleton is showing.
  transition: "none",
  pointerEvents: "none",
};

function createIframe({
  src,
  title,
  name,
  height,
  allow,
  className,
  style = FORM_IFRAME_STYLE,
}: {
  src: string;
  title: string;
  name: string;
  height: string;
  allow?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
}): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = title;
  iframe.name = name;
  iframe.setAttribute("role", "presentation");
  iframe.scrolling = "no";
  if (allow) {
    iframe.allow = allow;
  }
  if (className != null) {
    iframe.className = className;
  }
  Object.assign(iframe.style, style, { height });
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
  wrapper.setAttribute("aria-busy", "true");

  const skeleton = createPaymentMethodFormSkeleton(skeletonOptions);
  Object.assign(iframe.style, SKELETON_IFRAME_STYLE);

  wrapper.append(skeleton.element, iframe);
  host.appendChild(wrapper);

  let revealed = false;
  let appearanceReady = false;
  let lastHeight: string | undefined;
  let appearance = skeletonOptions.appearance;
  let heightTransitionTimer: ReturnType<typeof setTimeout> | undefined;
  let fallbackRevealTimer: ReturnType<typeof setTimeout> | undefined;

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
    iframe.style.pointerEvents = "";
    skeleton.element.remove();
    wrapper.removeAttribute("aria-busy");

    // Height easing is for later layout changes (ZIP show/hide, errors),
    // not the first paint — that would animate the last row into place.
    heightTransitionTimer = setTimeout(() => {
      iframe.style.transition = "height 200ms ease-in-out";
    }, 400);
  }

  function tryReveal(): void {
    if (revealed || !appearanceReady) {
      return;
    }
    const reportedPx = reportedHeightPx();
    const skeletonPx = skeletonHeightPx();
    if (Number.isFinite(reportedPx) && reportedPx >= skeletonPx - 2) {
      reveal();
    }
  }

  const controller = attachPaymentMethodFormListeners(iframe, {
    ...listenerOptions,
    onHeightChange: (height) => {
      lastHeight = height;
      if (revealed) {
        iframe.style.height = height;
      } else {
        tryReveal();
      }
      listenerOptions.onHeightChange?.(height);
    },
    onAppearanceReady: () => {
      appearanceReady = true;
      tryReveal();
      if (!revealed && fallbackRevealTimer === undefined) {
        fallbackRevealTimer = setTimeout(() => {
          reveal();
        }, 1500);
      }
      listenerOptions.onAppearanceReady?.();
    },
  });

  return {
    iframe,
    update(patch) {
      controller.update(patch);
      if (!revealed && "appearance" in patch) {
        appearance = patch.appearance;
        skeleton.update({ ...skeletonOptions, appearance });
      }
    },
    destroy() {
      if (heightTransitionTimer !== undefined) {
        clearTimeout(heightTransitionTimer);
      }
      if (fallbackRevealTimer !== undefined) {
        clearTimeout(fallbackRevealTimer);
      }
      controller.destroy();
      wrapper.remove();
    },
  };
}

type WalletListenerOptions = {
  height?: string;
  onHeightChange?: (height: string) => void;
  onAppearanceReady?: () => void;
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
  wrapper.setAttribute("aria-busy", "true");

  Object.assign(iframe.style, WALLET_SKELETON_IFRAME_STYLE);
  iframe.style.height = "100%";

  wrapper.append(skeleton.element, iframe);
  host.appendChild(wrapper);

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
    iframe.style.pointerEvents = "";
    skeleton.element.remove();
    wrapper.removeAttribute("aria-busy");
  }

  function tryReveal(): void {
    if (revealed || !appearanceReady) {
      return;
    }
    reveal();
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
  } as TOptions);

  fallbackRevealTimer = setTimeout(() => {
    reveal();
  }, 1500);

  return {
    iframe,
    update(patch) {
      currentOptions = { ...currentOptions, ...patch };
      // Keep the wrapped reveal listeners. Forwarding these would replace
      // them and leave the iframe at opacity 0.
      const rest = { ...patch };
      delete rest.onAppearanceReady;
      delete rest.onHeightChange;
      controller.update(rest);
      skeletonOptions = {
        height: currentOptions.height ?? skeletonOptions.height,
        borderRadius: resolveWalletButtonSkeletonBorderRadius({
          iframeStyle,
          buttonProps: currentOptions.buttonProps,
        }),
      };
      wrapper.style.height = skeletonOptions.height;
      if (!revealed) {
        skeleton.update(skeletonOptions);
      }
    },
    destroy() {
      if (fallbackRevealTimer !== undefined) {
        clearTimeout(fallbackRevealTimer);
      }
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
     * argument to {@link validateForm}, {@link confirmPaymentIntent}, or
     * {@link confirmSetupIntent}.
     */
    iframe: HTMLIFrameElement;
  };

/**
 * Mount the secure credit-card payment method form into a container
 * element. Returns a controller exposing the underlying iframe, an
 * `update()` method, and a `destroy()` method.
 *
 * A field-shaped skeleton is shown immediately and replaced by the
 * iframe once appearance is applied.
 *
 * Use the returned `controller.iframe` when calling
 * {@link validateForm}, {@link confirmPaymentIntent}, or
 * {@link confirmSetupIntent}.
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
  };

/**
 * Mount the secure bank-account payment method form into a container
 * element. Returns a controller exposing the underlying iframe, an
 * `update()` method, and a `destroy()` method.
 *
 * A field-shaped skeleton is shown immediately and replaced by the
 * iframe once appearance is applied.
 *
 * Use the returned `controller.iframe` when calling
 * {@link validateForm}, {@link confirmPaymentIntent}, or
 * {@link confirmSetupIntent}.
 */
export function mountAmosBankAccountPaymentMethodForm(
  container: Container,
  options: AmosBankAccountPaymentMethodFormOptions,
): AmosPaymentMethodFormMountController {
  const host = resolveContainer(container);
  const {
    renderToken,
    billingAddressRequirement = "country",
    ...listenerOptions
  } = options;

  const iframe = createIframe({
    src: getBankAccountFormSrc(renderToken, billingAddressRequirement),
    title: "Secure bank account payment method form powered by Amos",
    name: "amos-bank-account-payment-method-form",
    height: getBankAccountFormInitialHeight(billingAddressRequirement),
  });

  return mountPaymentMethodFormWithSkeleton({
    host,
    iframe,
    listenerOptions,
    skeletonOptions: {
      kind: "bank",
      appearance: listenerOptions.appearance,
      billingAddressRequirement,
    },
  });
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
 * A button-shaped skeleton is shown immediately and replaced by the
 * iframe once appearance is applied.
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
 * A button-shaped skeleton is shown immediately and replaced by the
 * iframe once appearance is applied.
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
