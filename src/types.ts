/// <reference types="googlepay" />

import type { components } from "@amos.com/node";

/**
 * Why an interactive confirmation attempt ended with `status: "incomplete"`.
 *
 * Helps hosts distinguish recoverable iframe states for analytics and
 * support without exposing PCI data.
 */
export type ConfirmationIncompleteReason =
  /** Pay API field errors were mapped onto iframe inputs for retry. */
  | "field_errors"
  /** Client-side / HTML5 validation failed when confirm was requested. */
  | "validation_failed";

/**
 * Outcome of an interactive confirmation flow inside the Amos iframe.
 *
 * `onResult` / `CONFIRMATION_RESULT` means the host should stop waiting
 * (e.g. dismiss a spinner). It is **not** proof that funds were
 * received — verify settlement on your backend via webhooks (or by
 * retrieving the PaymentIntent / SetupIntent with your secret key),
 * the same way Stripe recommends.
 *
 * Recoverable validation (field errors shown in the iframe, or client-side
 * validation on confirm) posts `status: "incomplete"` with a `reason` so
 * the host can unlock its UI; the customer can fix the form and retry.
 */
export type ConfirmationResult =
  | {
      status: "succeeded";
      intent: "payment";
      paymentIntent: components["schemas"]["PaymentIntent"];
    }
  | {
      status: "succeeded";
      intent: "setup";
      setupIntent: components["schemas"]["SetupIntent"];
    }
  | {
      /**
       * Recoverable validation was shown in the iframe or confirm was
       * blocked by client-side validation. Unlock the host UI; the customer
       * can fix fields and retry. Do not treat as settlement.
       */
      status: "incomplete";
      reason: ConfirmationIncompleteReason;
    }
  | {
      status: "failed";
      errorMessage: string;
    };

/**
 * CSS custom properties that control the appearance of the embedded
 * Amos iframe UI. Only the variables you provide are sent; omitted
 * variables keep their defaults.
 */
export type ThemeVariable =
  /*
   * Page body and base surface color.
   *
   * Default: oklch(1 0 0) (white)
   */
  | "--background"
  /*
   * Default text color applied to the body.
   *
   * Default: oklch(0.145 0 0) (near-black)
   */
  | "--foreground"
  /*
   * Default button fill and input text-selection highlight.
   *
   * Default: oklch(0.205 0 0)
   */
  | "--primary"
  /*
   * Text on primary-colored surfaces (buttons, selections).
   *
   * Default: oklch(0.985 0 0)
   */
  | "--primary-foreground"
  /*
   * Secondary button fill.
   *
   * Default: oklch(0.97 0 0)
   */
  | "--secondary"
  /*
   * Text on secondary-colored surfaces.
   *
   * Default: oklch(0.205 0 0)
   */
  | "--secondary-foreground"
  /*
   * Muted surface color (e.g. chips, subdued fills).
   *
   * Default: oklch(0.97 0 0)
   */
  | "--muted"
  /*
   * Placeholder text, helper labels, and muted icons.
   *
   * Default: oklch(0.556 0 0)
   */
  | "--muted-foreground"
  /*
   * Hover/focus highlight for interactive items (buttons, dropdown rows,
   * skeleton pulse).
   *
   * Default: oklch(0.97 0 0)
   */
  | "--accent"
  /*
   * Text color on accent-highlighted items.
   *
   * Default: oklch(0.205 0 0)
   */
  | "--accent-foreground"
  /*
   * Error/invalid state borders, icons, and field error text.
   *
   * Default: oklch(0.577 0.245 27.325)
   */
  | "--destructive"
  /*
   * Text on destructive-colored surfaces (e.g. destructive buttons).
   *
   * Default: oklch(0.45 0.24 27.325)
   */
  | "--destructive-foreground"
  /*
   * General border color applied to all elements via the base layer.
   *
   * Default: oklch(0.922 0 0)
   */
  | "--border"
  /*
   * Dropdown / popover panel background.
   *
   * Default: oklch(1 0 0)
   */
  | "--popover"
  /*
   * Dropdown / popover panel text color.
   *
   * Default: oklch(0.145 0 0)
   */
  | "--popover-foreground"
  /*
   * Input field border color.
   *
   * Default: oklch(0.922 0 0)
   */
  | "--input"
  /*
   * Input field background fill. Falls back to `--background` when unset.
   *
   * Default: var(--background)
   */
  | "--input-background"
  /*
   * Height of text inputs and form controls (e.g. `2.25rem`, `48px`).
   *
   * Default: 2.25rem
   */
  | "--input-height"
  /*
   * Font size of text inputs and dropdown fields (e.g. `0.875rem`, `16px`).
   *
   * Default: 0.875rem
   */
  | "--input-font-size"
  /*
   * Font weight of typed input values and dropdown fields (e.g. `400`, `normal`).
   *
   * Default: 400
   */
  | "--input-font-weight"
  /*
   * Horizontal padding inside inputs and aligned floating labels (e.g. `0.75rem`, `12px`).
   *
   * Default: 0.75rem
   */
  | "--input-padding"
  /*
   * Input field border width (e.g. `1px`).
   *
   * Default: 1px
   */
  | "--input-border-width"
  /*
   * Input field box shadow (e.g. `none`, `0 1px 2px 0 rgb(0 0 0 / 0.05)`).
   *
   * Default: 0 1px 2px 0 rgb(0 0 0 / 0.05)
   */
  | "--input-shadow"
  /*
   * Height of text inputs when labels are floating (e.g. `3.25rem`, `52px`).
   *
   * Default: 3.25rem
   */
  | "--floating-input-height"
  /*
   * Font size of floating labels when the field is focused or filled
   * (e.g. `0.75rem`, `12px`). Does not affect the typed input value.
   *
   * Default: 0.75rem
   */
  | "--floating-label-font-size"
  /*
   * Font weight of floating labels (e.g. `400`, `500`, `normal`, `bold`).
   *
   * Default: 500
   */
  | "--floating-label-font-weight"
  /*
   * Color of floating labels. Defaults to `--muted-foreground`.
   *
   * Default: var(--muted-foreground)
   */
  | "--floating-label-color"
  /*
   * Top offset of the shrunk floating label inside the control (e.g. `0.625rem`).
   *
   * Default: 0.625rem
   */
  | "--floating-label-offset"
  /*
   * Font size of above-style field labels and radio option labels.
   *
   * Default: 0.875rem
   */
  | "--label-font-size"
  /*
   * Font weight of above-style field labels and radio option labels.
   *
   * Default: 500
   */
  | "--label-font-weight"
  /*
   * Vertical gap between stacked form fields (e.g. `1rem`, `16px`).
   *
   * Default: 1rem
   */
  | "--field-gap"
  /*
   * Horizontal gap between side-by-side controls (e.g. expiry + CVC).
   *
   * Default: 0.5rem
   */
  | "--control-gap"
  /*
   * Font size of field-level error messages.
   *
   * Default: 0.875rem
   */
  | "--error-font-size"
  /*
   * Size of radio buttons on the bank account form (e.g. `1rem`, `16px`).
   *
   * Default: 1rem
   */
  | "--radio-size"
  /*
   * Focus ring and outline color for inputs and buttons.
   *
   * Default: oklch(0.708 0 0)
   */
  | "--ring"
  /*
   * Focus ring width for inputs (e.g. `3px`).
   *
   * Default: 3px
   */
  | "--ring-width"
  /*
   * Base border-radius; derived into --radius-sm/md/lg/xl.
   *
   * Default: 0.625rem
   */
  | "--radius";

/**
 * Placement of field labels in payment method forms.
 *
 * - `above` — label text is rendered above the control (default).
 * - `floating` — label sits inside the control and shrinks when focused or filled.
 * - `placeholder` — no visible label; use placeholder text and `aria-label` only.
 */
export type AppearanceLabels = "above" | "floating" | "placeholder";

/**
 * Appearance overrides for the embedded Amos iframe UI.
 */
export type Appearance = {
  themeVariables?: Partial<Record<ThemeVariable, string>>;
  /**
   * Field label placement for card and bank account forms.
   *
   * @default "above"
   */
  labels?: AppearanceLabels;
};

/**
 * Inline style bag sent through `postMessage` to the wallet-button iframe.
 *
 * Matches the serializable subset of a CSSStyleDeclaration / React
 * `CSSProperties` object (string or number values). Custom properties such
 * as `--apple-pay-button-height` are allowed.
 */
export type WalletButtonStyle = {
  [property: string]: string | number | undefined;
};

/**
 * `buttonstyle` attribute on Apple's `<apple-pay-button>`.
 *
 * @see https://developer.apple.com/documentation/apple_pay_on_the_web/apple-pay-button
 */
export type ApplePayButtonStyle = "black" | "white" | "white-outline";

/**
 * `type` attribute on Apple's `<apple-pay-button>`.
 *
 * @see https://developer.apple.com/documentation/apple_pay_on_the_web/apple-pay-button
 */
export type ApplePayButtonType =
  | "plain"
  | "buy"
  | "set-up"
  | "donate"
  | "check-out"
  | "book"
  | "subscribe"
  | "reload"
  | "add-money"
  | "top-up"
  | "order"
  | "rent"
  | "support"
  | "contribute"
  | "tip";

/**
 * Visual props for Apple's `<apple-pay-button>`, using Apple's attribute
 * names. Applied inside the Amos embed iframe.
 *
 * @see https://developer.apple.com/documentation/apple_pay_on_the_web/apple-pay-button
 */
export type ApplePayButtonElementProps = {
  /**
   * Apple Pay button color.
   *
   * @default "black"
   */
  buttonstyle?: ApplePayButtonStyle;
  /**
   * Apple Pay button label / verb.
   *
   * @default "plain"
   */
  type?: ApplePayButtonType;
  /**
   * BCP 47 locale for the button label (e.g. `"en-US"`).
   *
   * @default "en-US"
   */
  locale?: string;
  /**
   * Inline style for the `<apple-pay-button>`. Height is controlled with
   * `--apple-pay-button-height` (Apple ignores CSS `height`). Width uses
   * `--apple-pay-button-width` or CSS `width`.
   */
  style?: WalletButtonStyle;
};

/**
 * Visual props for Google's Pay button, using `@google-pay/button-react`
 * / Google Pay API names. Applied inside the Amos embed iframe.
 *
 * @see https://developers.google.com/pay/api/web/guides/resources/customize
 */
export type GooglePayButtonElementProps = {
  /**
   * Button label / verb.
   *
   * @default "short"
   */
  buttonType?: google.payments.api.ButtonType;
  /** Button color. */
  buttonColor?: google.payments.api.ButtonColor;
  /** Corner radius in pixels (0–20). */
  buttonRadius?: number;
  /**
   * `"fill"` stretches the button to the container width; `"static"`
   * uses Google's default size.
   */
  buttonSizeMode?: google.payments.api.ButtonSizeMode;
  /** BCP 47 locale for the button label (e.g. `"en"`). */
  buttonLocale?: string;
  /** Whether the button draws a border. */
  buttonBorderType?: google.payments.api.ButtonBorderType;
  /**
   * Inline style for the Google Pay button wrapper. Use `height` /
   * `width` here (unlike Apple Pay, Google honors CSS `height`).
   */
  style?: WalletButtonStyle;
};

/**
 * Keep only JSON-cloneable string/number declarations from a style object
 * before sending it through `postMessage`.
 */
export function serializeWalletButtonStyle(
  style: WalletButtonStyle | undefined,
): Record<string, string | number> | undefined {
  if (!style || typeof style !== "object") {
    return undefined;
  }

  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(style)) {
    if (typeof value === "string") {
      if (value.length === 0) {
        continue;
      }
      result[key] = value;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function pickApplePayButtonElementProps(
  options: ApplePayButtonElementProps,
): ApplePayButtonElementProps {
  const props: ApplePayButtonElementProps = {};
  if (options.buttonstyle !== undefined) {
    props.buttonstyle = options.buttonstyle;
  }
  if (options.type !== undefined) {
    props.type = options.type;
  }
  if (options.locale !== undefined) {
    props.locale = options.locale;
  }
  if (options.style !== undefined) {
    const style = serializeWalletButtonStyle(options.style);
    if (style) {
      props.style = style;
    }
  }
  return props;
}

export function pickGooglePayButtonElementProps(
  options: GooglePayButtonElementProps,
): GooglePayButtonElementProps {
  const props: GooglePayButtonElementProps = {};
  if (options.buttonType !== undefined) {
    props.buttonType = options.buttonType;
  }
  if (options.buttonColor !== undefined) {
    props.buttonColor = options.buttonColor;
  }
  if (options.buttonRadius !== undefined) {
    props.buttonRadius = options.buttonRadius;
  }
  if (options.buttonSizeMode !== undefined) {
    props.buttonSizeMode = options.buttonSizeMode;
  }
  if (options.buttonLocale !== undefined) {
    props.buttonLocale = options.buttonLocale;
  }
  if (options.buttonBorderType !== undefined) {
    props.buttonBorderType = options.buttonBorderType;
  }
  if (options.style !== undefined) {
    const style = serializeWalletButtonStyle(options.style);
    if (style) {
      props.style = style;
    }
  }
  return props;
}

/**
 * Typed `postMessage` payloads exchanged between the host page and the
 * embedded Amos iframe.
 */
export type Message =
  | {
      /** Embed → parent: iframe finished loading and is ready for messages. */
      type: "IFRAME_READY";
    }
  | {
      /** Parent → embed: host acknowledged `IFRAME_READY`. */
      type: "PARENT_ACKNOWLEDGED_IFRAME_READY";
    }
  | {
      /** Embed → parent: iframe content height changed (resize container). */
      type: "UPDATE_HEIGHT";
      height: string;
    }
  | {
      /** Parent → embed: express-checkout amount changed. */
      type: "UPDATE_AMOUNT";
      amount: string;
    }
  | {
      /** Parent → embed: express-checkout merchant display name changed. */
      type: "UPDATE_MERCHANT_NAME";
      merchantName: string;
    }
  | {
      /** Parent → embed: push appearance overrides into the iframe. */
      type: "UPDATE_APPEARANCE";
      appearance: Appearance;
    }
  | {
      /**
       * Parent → embed: visual options for the Apple Pay button. Nested
       * under `props` so Apple's `type` attribute does not collide with
       * this message discriminant.
       */
      type: "UPDATE_APPLE_PAY_BUTTON";
      props: ApplePayButtonElementProps;
    }
  | {
      /** Parent → embed: visual options for the Google Pay button. */
      type: "UPDATE_GOOGLE_PAY_BUTTON";
      props: GooglePayButtonElementProps;
    }
  | {
      /**
       * Parent → embed: validate form inputs (`requestId` only).
       * Embed → parent: validation response (`isValid` set).
       */
      type: "VALIDATE_FORM";
      requestId: string;
      isValid?: boolean;
    }
  | {
      /** Embed → parent: express checkout requests a payment intent from the host. */
      type: "CREATE_PAYMENT_INTENT";
      paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"];
      customerCreateAttributes: components["schemas"]["CreateCustomerInput"];
    }
  | ({
      /** Parent → embed: confirm a payment intent with an embed token. */
      type: "CONFIRM_PAYMENT_INTENT";
    } & Pick<components["schemas"]["PaymentIntent"], "id"> &
      Pick<components["schemas"]["EmbedToken"], "token">)
  | ({
      /** Parent → embed: confirm a setup intent with an embed token. */
      type: "CONFIRM_SETUP_INTENT";
    } & Pick<components["schemas"]["SetupIntent"], "id"> &
      Pick<components["schemas"]["EmbedToken"], "token">)
  | {
      /**
       * Embed → parent: the interactive confirmation flow finished.
       * Parent → embed: express-checkout initiation failed on the host.
       * Not settlement proof — verify payment/setup success on your
       * backend via webhooks (or by retrieving the intent).
       */
      type: "CONFIRMATION_RESULT";
      result: ConfirmationResult;
    }
  | {
      /** Embed → parent: appearance overrides were applied in the iframe. */
      type: "UPDATED_APPEARANCE";
    }
  | {
      /** Embed → parent: Apple Pay Code window / waiting UI should show. */
      type: "APPLE_PAY_WINDOW_OPEN";
    }
  | {
      /** Embed → parent: waiting UI should dismiss. */
      type: "APPLE_PAY_WINDOW_CLOSE";
    }
  | {
      /** Parent → embed: user cancelled from the host-page waiting overlay. */
      type: "APPLE_PAY_CANCEL";
    }
  | {
      /** Parent → embed: clear all form field values and API errors. */
      type: "RESET_FORM";
    };

/**
 * Identity helper that brands an object as a typed `Message`.
 *
 * Useful when constructing `postMessage` payloads to ensure they conform
 * to the schema understood by the embedded Amos iframe.
 */
export function createMessage(message: Message): Message {
  return message;
}
