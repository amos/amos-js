/// <reference types="googlepay" />

import type { components } from "@amos.com/node";

/**
 * PCI-safe snapshot of card/bank form validity, posted when HTML
 * constraint validation changes. Use this to enable or disable a host
 * checkout button.
 */
export type PaymentMethodFormValidityChangeEvent = {
  isValid: boolean;
};

/**
 * Detected card network from the PAN prefix inside the iframe.
 * `null` when the field is empty or the digits do not match a known brand.
 */
export type CardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "diners"
  | "jcb";

/**
 * PCI-safe card brand update from the credit-card iframe. Does not
 * include the PAN, last4, or BIN.
 */
export type PaymentMethodFormCardBrandChangeEvent = {
  brand: CardBrand | null;
};

/**
 * Outcome of `confirmPayment` / `confirmSetup`. Hosts already know which
 * function they called; this is not settlement proof — capture may still
 * finish asynchronously after a succeeded authorization.
 *
 * Recoverable field errors stay in the iframe. The Promise still
 * resolves `{ status: "failed" }`.
 */
export type ConfirmResult = { status: "succeeded" } | { status: "failed" };

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
   * Font size of floating labels in the empty / unfocused position
   * (e.g. `0.9375rem`, `15px`). Falls back to `--input-font-size` when unset.
   *
   * Default: var(--input-font-size)
   */
  | "--floating-label-empty-font-size"
  /*
   * Font weight of floating labels (e.g. `400`, `500`, `normal`, `bold`).
   *
   * Default: 500
   */
  | "--floating-label-font-weight"
  /*
   * Color of floating labels in the empty / unfocused position.
   *
   * Default: var(--muted-foreground)
   */
  | "--floating-label-color"
  /*
   * Color of floating labels when focused or filled. Falls back to
   * `--floating-label-color` when unset, so overriding only
   * `--floating-label-color` still recolors both states.
   *
   * Default: var(--floating-label-color)
   */
  | "--floating-label-floated-color"
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
 * Apple's `<apple-pay-button>` attributes. `@types/applepayjs` only
 * covers `ApplePaySession`, so this bag is the custom element's HTML
 * attributes plus inner `style`. Posted as-is on `buttonProps`.
 *
 * Omitted fields keep the painted button's defaults. Height belongs on
 * the mount `height` option.
 *
 * @see https://developer.apple.com/documentation/apple_pay_on_the_web/apple-pay-button
 */
export type ApplePayButtonElementProps = {
  /**
   * Apple Pay button color.
   *
   * @default "black"
   */
  buttonstyle?: string;
  /**
   * Apple Pay button label / verb.
   *
   * @default "plain"
   */
  type?: string;
  /**
   * BCP 47 locale for the button label (e.g. `"en-US"`).
   *
   * @default "en-US"
   */
  locale?: string;
  /**
   * Inline style for the `<apple-pay-button>`. Omitted keys keep fill
   * (`width: 100%` and `--apple-pay-button-width`).
   */
  style?: Record<string, string | number | undefined>;
};

/**
 * Google Pay button visuals: {@link google.payments.api.ButtonOptions}
 * without the fields that cannot go through `postMessage`, plus inner
 * `style`. Posted as-is on `buttonProps`.
 *
 * Omitted fields keep the painted button's defaults (`buttonType:
 * "plain"`, `buttonSizeMode: "fill"`). Height belongs on the mount
 * `height` option.
 *
 * @see https://developers.google.com/pay/api/web/guides/resources/customize
 */
export type GooglePayButtonElementProps = Omit<
  google.payments.api.ButtonOptions,
  "onClick" | "buttonRootNode" | "allowedPaymentMethods"
> & {
  /**
   * Inline style for the Google Pay button wrapper. Omitted keys keep
   * fill (`width: 100%`).
   */
  style?: Record<string, string | number | undefined>;
};

/**
 * Non-PCI fields the host may push into a card/bank iframe.
 *
 * PAN, CVC, expiration, and bank account numbers are not in this type
 * and must never be sent over `postMessage`.
 */
export type PaymentMethodFormValues = {
  postalCode?: string;
  country?: string;
  state?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  cardholderName?: string;
};

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
      /**
       * Parent → embed: express-checkout amount changed. Major-currency
       * decimal string (e.g. `"50.00"` for $50.00).
       */
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
      /** Parent → embed: visual options for the Apple Pay button. */
      type: "UPDATE_APPLE_PAY_BUTTON";
      height?: string;
      props: ApplePayButtonElementProps;
    }
  | {
      /** Parent → embed: visual options for the Google Pay button. */
      type: "UPDATE_GOOGLE_PAY_BUTTON";
      height?: string;
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
      Pick<components["schemas"]["EmbedToken"], "token"> & {
        /** Present when ACH verification completed via Plaid Link in the parent. */
        plaid?: components["schemas"]["PlaidCredentialsInput"];
      })
  | ({
      /** Parent → embed: confirm a setup intent with an embed token. */
      type: "CONFIRM_SETUP_INTENT";
    } & Pick<components["schemas"]["SetupIntent"], "id"> &
      Pick<components["schemas"]["EmbedToken"], "token"> & {
        /** Present when ACH verification completed via Plaid Link in the parent. */
        plaid?: components["schemas"]["PlaidCredentialsInput"];
      })
  | {
      /**
       * Embed → parent: the interactive confirmation flow finished.
       * Parent → embed: express-checkout initiation failed on the host.
       * Not settlement proof — verify payment/setup success on your
       * backend via webhooks (or by retrieving the intent).
       */
      type: "CONFIRMATION_RESULT";
      result: ConfirmResult;
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
    }
  | {
      /**
       * Parent → embed: set non-PCI billing fields without remounting.
       * Never includes PAN, CVC, expiration, or bank account numbers.
       * Omitted keys are left unchanged; empty strings clear a field.
       */
      type: "SET_FORM_VALUES";
      values: PaymentMethodFormValues;
    }
  | {
      /**
       * Embed → parent: card/bank form validity changed.
       * `isValid` is true when all required fields are present and
       * valid. Does not include PCI data.
       */
      type: "FORM_VALIDITY_CHANGE";
      isValid: boolean;
    }
  | {
      /**
       * Embed → parent: detected card brand changed. `brand` is the
       * matched network, or `null` when the field is empty or the
       * digits do not match a known brand. Does not include PCI data.
       */
      type: "CARD_BRAND_CHANGE";
      brand: CardBrand | null;
    }
  | {
      /**
       * Embed → parent: ACH verification policy for this bank iframe.
       * `achThreshold` is cents, or `null` when the merchant has no
       * threshold (manual ACH). `requireVerification` is true for setup
       * intents (always Plaid, no merchant lookup), and when a payment
       * threshold fetch failed in production (fail closed).
       */
      type: "ACH_THRESHOLD";
      achThreshold?: number | null;
      requireVerification?: boolean;
    }
  | {
      /** Parent → embed: mint a Plaid Link token for Connect. */
      type: "CREATE_PLAID_LINK_TOKEN";
      requestId: string;
    }
  | {
      /** Embed → parent: minted Plaid Link token, or `error`. */
      type: "PLAID_LINK_TOKEN";
      requestId: string;
      link_token?: string;
      error?: string;
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
