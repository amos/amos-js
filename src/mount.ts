import {
  type ApplePayButtonController,
  type ApplePayButtonListenerOptions,
  attachApplePayButtonListeners,
  getApplePayButtonInitialHeight,
  getApplePayButtonSrc,
} from "./apple-pay";
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

const SHARED_IFRAME_STYLE: Partial<CSSStyleDeclaration> = {
  width: "calc(100% + 8px)",
  transition: "opacity 150ms ease-in, height 200ms ease-in-out",
  margin: "0 -4px",
  opacity: "0",
  border: "0",
};

function createIframe({
  src,
  title,
  name,
  height,
  allow,
}: {
  src: string;
  title: string;
  name: string;
  height: string;
  allow?: string;
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
  Object.assign(iframe.style, SHARED_IFRAME_STYLE, { height });
  return iframe;
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
  host.appendChild(iframe);

  const controller = attachPaymentMethodFormListeners(iframe, {
    ...listenerOptions,
    onHeightChange: (height) => {
      iframe.style.height = height;
      listenerOptions.onHeightChange?.(height);
    },
    onAppearanceReady: () => {
      iframe.style.opacity = "1";
      listenerOptions.onAppearanceReady?.();
    },
  });

  return {
    iframe,
    update: controller.update,
    destroy() {
      controller.destroy();
      iframe.remove();
    },
  };
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
  host.appendChild(iframe);

  const controller = attachPaymentMethodFormListeners(iframe, {
    ...listenerOptions,
    onHeightChange: (height) => {
      iframe.style.height = height;
      listenerOptions.onHeightChange?.(height);
    },
    onAppearanceReady: () => {
      iframe.style.opacity = "1";
      listenerOptions.onAppearanceReady?.();
    },
  });

  return {
    iframe,
    update: controller.update,
    destroy() {
      controller.destroy();
      iframe.remove();
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
 */
export function mountAmosGooglePayButton(
  container: Container,
  options: AmosGooglePayButtonOptions,
): AmosGooglePayButtonMountController {
  const host = resolveContainer(container);
  const { renderToken, ...listenerOptions } = options;

  const iframe = createIframe({
    src: getGooglePayButtonSrc(renderToken),
    title: "Secure Google Pay button powered by Amos",
    name: "amos-google-pay-button",
    height: getGooglePayButtonInitialHeight(),
    allow: "payment",
  });
  host.appendChild(iframe);

  const controller = attachGooglePayButtonListeners(iframe, {
    ...listenerOptions,
    onHeightChange: (height) => {
      iframe.style.height = height;
      listenerOptions.onHeightChange?.(height);
    },
    onAppearanceReady: () => {
      iframe.style.opacity = "1";
      listenerOptions.onAppearanceReady?.();
    },
  });

  return {
    iframe,
    update: controller.update,
    destroy() {
      controller.destroy();
      iframe.remove();
    },
  };
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
 */
export function mountAmosApplePayButton(
  container: Container,
  options: AmosApplePayButtonOptions,
): AmosApplePayButtonMountController {
  const host = resolveContainer(container);
  const { renderToken, ...listenerOptions } = options;

  const iframe = createIframe({
    src: getApplePayButtonSrc(renderToken),
    title: "Secure Apple Pay button powered by Amos",
    name: "amos-apple-pay-button",
    height: getApplePayButtonInitialHeight(),
    allow: "payment",
  });
  host.appendChild(iframe);

  const controller = attachApplePayButtonListeners(iframe, {
    ...listenerOptions,
    onHeightChange: (height) => {
      iframe.style.height = height;
      listenerOptions.onHeightChange?.(height);
    },
    onAppearanceReady: () => {
      iframe.style.opacity = "1";
      listenerOptions.onAppearanceReady?.();
    },
  });

  return {
    iframe,
    update: controller.update,
    destroy() {
      controller.destroy();
      iframe.remove();
    },
  };
}
