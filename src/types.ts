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
 * Billing postal code committed inside the card or bank iframe.
 *
 * `postalCode` is a finished code, or `null` when a finished code
 * becomes incomplete. Incomplete keystrokes are not posted. US and PR
 * are 5 digits, Canada is `A1A 1A1`, and the UK is a full postcode.
 * Not sent for `defaultValues` writes.
 */
export type PaymentMethodFormPostalCodeChangeEvent = {
  postalCode: string | null;
  country: string;
};

/**
 * Confirm never heard back from the iframe (or the iframe aborted
 * hung `/confirm`). Not a processor decline — the charge may still
 * settle. Do not retry as a new payment.
 */
export const CONFIRM_TIMEOUT_ERROR = "timeout" as const;

export type ConfirmTimeoutError = typeof CONFIRM_TIMEOUT_ERROR;

export type ConfirmTimeoutResult = {
  status: "failed";
  error: ConfirmTimeoutError;
};

/**
 * Dead-iframe backstop for `confirmPayment` / `confirmSetup`.
 *
 * Embed aborts hung `/confirm` at 10s and posts
 * `{ status: "failed", error: "timeout" }`. This wait must stay strictly
 * above that abort plus `postMessage` — do not set it to 10s.
 */
export const CONFIRM_TIMEOUT_MS = 15_000;

/**
 * Outcome of `confirmPayment`. This is not settlement proof — capture
 * may still finish asynchronously after a succeeded authorization.
 *
 * Recoverable field errors stay in the iframe. The Promise still
 * resolves `{ status: "failed" }`. `paymentIntent` is present when the
 * confirm API returned a body (success or processor decline).
 *
 * `{ status: "failed", error: "timeout" }` means the iframe did not
 * post `CONFIRMATION_RESULT` within {@link CONFIRM_TIMEOUT_MS}, or
 * posted a `/confirm` abort. That is uncertain, not a decline.
 */
export type ConfirmPaymentResult =
  | {
      status: "succeeded";
      paymentIntent: components["schemas"]["PaymentIntent"];
    }
  | ConfirmTimeoutResult
  | {
      status: "failed";
      paymentIntent?: components["schemas"]["PaymentIntent"];
    };

/**
 * Outcome of `confirmSetup`. This is not settlement proof — verify
 * setup success on your backend via webhooks.
 *
 * Recoverable field errors stay in the iframe. The Promise still
 * resolves `{ status: "failed" }`. `setupIntent` is present when the
 * confirm API returned a body (success or failure).
 *
 * `{ status: "failed", error: "timeout" }` is the same uncertain
 * confirm as on {@link ConfirmPaymentResult}.
 */
export type ConfirmSetupResult =
  | {
      status: "succeeded";
      setupIntent: components["schemas"]["SetupIntent"];
    }
  | ConfirmTimeoutResult
  | {
      status: "failed";
      setupIntent?: components["schemas"]["SetupIntent"];
    };

/** True when confirm settled as a timeout, not a processor decline. */
export function isConfirmTimeout(
  result: ConfirmPaymentResult | ConfirmSetupResult | null | undefined,
): result is ConfirmTimeoutResult {
  return (
    result?.status === "failed" &&
    "error" in result &&
    result.error === CONFIRM_TIMEOUT_ERROR
  );
}

/**
 * Street fields on {@link WalletCustomerCreateAttributes} billing and
 * shipping addresses. Names match Amos `BillingAddressInput`
 * (`address_line1`, `state`, `postal_code`).
 */
export type WalletPostalAddress = Pick<
  components["schemas"]["BillingAddressInput"],
  | "address_line1"
  | "address_line2"
  | "city"
  | "state"
  | "postal_code"
  | "country"
>;

/**
 * Customer snapshot posted on wallet `CREATE_PAYMENT_INTENT` and passed
 * to Apple Pay / Google Pay `onConfirm`. Name, email, and billing
 * address are always requested; `phone` and `shippingAddress` are only
 * present when the host opted in (`phoneRequired` /
 * `shippingAddressRequired`).
 *
 * Nested `billingAddress` / `shippingAddress` use Amos billing field
 * names (`address_line1`, `state`, `postal_code`). This is not Amos API
 * `CreateCustomerInput`.
 */
export type WalletCustomerCreateAttributes = {
  email?: string;
  name?: string;
  phone?: string;
  billingAddress?: WalletPostalAddress;
  shippingAddress?: WalletPostalAddress;
};

/**
 * Optional wallet sheet contact fields. Name, email, and billing
 * address are always required. Omitted flags default to `false`.
 * These are top-level mount / listener options, not `buttonProps`.
 */
export type WalletContactRequirements = {
  /**
   * Collect a phone number in the wallet sheet.
   * @default false
   */
  phoneRequired?: boolean;
  /**
   * Collect a shipping postal address in the wallet sheet.
   * @default false
   */
  shippingAddressRequired?: boolean;
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
   * Top padding of the typed value when the floating label is floated
   * (e.g. `1.5rem`).
   *
   * Default: calc(var(--floating-label-offset) + var(--floating-label-font-size) + 0.125rem)
   */
  | "--floating-value-padding-top"
  /*
   * Bottom padding of the typed value when the floating label is floated
   * (e.g. `0.625rem`).
   *
   * Default: var(--floating-label-offset)
   */
  | "--floating-value-padding-bottom"
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
  | "--radius"
  /*
   * Font stack for the iframe UI. Pair with `appearance.fonts` so the
   * named family is actually loaded. When omitted, the SDK sends Inter
   * (`Inter, ui-sans-serif, system-ui, sans-serif`) on first paint and
   * on any `themeVariables` replace that does not set this key, unless
   * this payload has `fonts: []` (system stack instead).
   *
   * Default: Inter, ui-sans-serif, system-ui, sans-serif
   */
  | "--font-family";

/**
 * A stylesheet that declares `@font-face` rules (Google Fonts CSS, a
 * self-hosted CSS file, etc.). `cssSrc` must be an `https:` URL.
 */
export type CssFontSource = {
  cssSrc: string;
};

/**
 * A single custom `@font-face` rule. `src` is a CSS `src` list of
 * `url("https://…")` / `url(https://…)` plus optional `format(…)`.
 */
export type CustomFontSource = {
  family: string;
  src: string;
  /**
   * @default "swap"
   */
  display?: string;
  style?: string;
  unicodeRange?: string;
  weight?: string;
};

/**
 * A webfont to load inside the payment iframe. Either a CSS stylesheet
 * URL or a custom `@font-face` descriptor.
 */
export type FontSource = CssFontSource | CustomFontSource;

/**
 * Stripe-style class names for {@link Appearance.rules}. Mapped onto
 * iframe `data-slot` targets internally; the DOM is not the public API.
 */
export type AppearanceRuleSelector =
  | ".Input"
  | ".Input:hover"
  | ".Input:focus"
  | ".Input:disabled"
  | ".Input--invalid"
  | ".Input::placeholder"
  | ".Label"
  | ".Label--floating"
  | ".Error"
  | ".Dropdown"
  | ".DropdownItem"
  | ".DropdownItem--highlight"
  | ".RadioIcon"
  | ".RadioIcon--checked"
  | ".RadioIconInner";

/**
 * CamelCase CSS properties allowed on {@link Appearance.rules}.
 */
export type AppearanceRuleProperty =
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "fontStyle"
  | "lineHeight"
  | "letterSpacing"
  | "textTransform"
  | "color"
  | "backgroundColor"
  | "border"
  | "borderColor"
  | "borderWidth"
  | "borderStyle"
  | "borderRadius"
  | "boxShadow"
  | "outline"
  | "padding"
  | "margin"
  | "opacity";

export type AppearanceRuleDeclarations = Partial<
  Record<AppearanceRuleProperty, string>
>;

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
  /**
   * CSS custom properties to override. Each update that includes
   * `themeVariables` **replaces** the full override set: only the
   * variables you list are overridden; unlisted variables revert to
   * iframe defaults. Omit `themeVariables` to keep the previous set.
   * A payload that omits `--font-family` still gets Inter filled in
   * (system stack if that payload also has `fonts: []`).
   */
  themeVariables?: Partial<Record<ThemeVariable, string>>;
  /**
   * Field label placement for card and bank account forms.
   *
   * @default "above"
   */
  labels?: AppearanceLabels;
  /**
   * Webfonts to load in the iframe. Omitted on first paint, the SDK
   * sends Google Fonts Inter. Omitted on `update({ appearance })` keeps
   * the previous set; a provided array replaces it. `[]` clears the
   * webfont; omitted `--font-family` on that payload uses a system
   * stack instead of Inter.
   */
  fonts?: Array<FontSource>;
  /**
   * Per-part CSS, keyed by Stripe-style class names (`.Input`, `.Label`,
   * `.Error`, …). Overrides `themeVariables` for the properties it sets.
   * Values may use `var(--token)` for allowlisted theme variables.
   * Omitted on `update({ appearance })` keeps the previous set; a
   * provided object replaces it (`{}` clears).
   */
  rules?: Partial<Record<AppearanceRuleSelector, AppearanceRuleDeclarations>>;
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
 * Non-PCI values the host can seed into the card or bank iframe.
 *
 * `accountHolderName` prefills the bank account-holder input.
 * `cardholderName` prefills the cardholder input and is sent on confirm
 * only when that field is shown (`additionalFields.cardholderName`).
 *
 * Billing fields that are not shown still go on the confirm payload when
 * present, including `billingAddress.name`, `email`, and `phone`.
 *
 * Never send PAN, CVC, account number, or routing number here.
 */
export type PaymentMethodFormDefaultValues = {
  /** Bank account-holder prefill. */
  accountHolderName?: string;
  /**
   * Cardholder-name prefill. Applied and confirmed only when the
   * cardholder input is shown.
   */
  cardholderName?: string;
  billingAddress?: {
    name?: string;
    email?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
};

/**
 * Named controls inside the card or bank iframe. Card-only ids are a
 * no-op on the bank form and vice versa. Hidden / unmounted controls
 * are also a no-op.
 */
export type PaymentMethodFormField =
  | "cardNumber"
  | "expiration"
  | "cvc"
  | "cardholderName"
  | "accountHolderName"
  | "accountNumber"
  | "confirmAccountNumber"
  | "routingNumber"
  | "accountType"
  | "accountHolderType"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "state"
  | "postalCode"
  | "country";

/**
 * Echoed on embed → parent messages as `window.name` so the host can
 * match the sender when `event.source === iframe.contentWindow` disagrees
 * (Firefox / some WebKit WindowProxy identity). Host → embed messages
 * omit this.
 */
export type EmbedIframeName = {
  iframeName?: string;
};

/**
 * Which Plaid session a token can open.
 *
 * `new` mounts Embedded Institution Search. `update` re-enters an existing
 * connection (micro-deposit code entry) and Plaid only allows that in a regular
 * Link session, so the iframe has to say which one it means — the parent cannot
 * infer it from the token.
 */
export type ExternalBankAccountLinkMode = "new" | "update";

/** Intent state, as reported by the API. */
export type ExternalBankAccountState =
  | "requires_bank_account"
  | "requires_verification"
  | "succeeded"
  | "failed"
  | "cancelled";

/** Plaid verification status. `null` means nothing to verify yet. */
export type ExternalBankAccountVerificationStatus =
  | "pending_manual_verification"
  | "pending_automatic_verification"
  | "automatically_verified"
  | "manually_verified"
  | "verification_failed"
  | "verification_expired";

/**
 * What the iframe is showing and what the host can do next. Derived from the
 * intent, never stored: a returning visitor re-reads the intent and lands on
 * the right screen without any saved session.
 */
export type ExternalBankAccountView = {
  screen:
    | "connect"
    | "code"
    | "verifying"
    | "finish"
    | "done"
    | "failed"
    | "closed";
  /** Link must open for this step. */
  needsLink: boolean;
  /** A `link_token` is worth asking for. False while pending or finished. */
  canRequestLinkToken: boolean;
  /** Nothing further happens in this iframe. */
  terminal: boolean;
  linkMode?: ExternalBankAccountLinkMode;
};

/**
 * Outcome of a confirm, posted to the host.
 *
 * `requires_verification` is not a failure: micro-deposits are pending and the
 * intent simply waits, so treating it as a decline closes the only path that
 * finishes the connection.
 */
export type ExternalBankAccountConfirmResult =
  | { status: "succeeded"; externalAccountId?: string; mask?: string }
  | { status: "requires_verification"; verificationStatus?: string }
  | {
      status: "failed";
      /** `"timeout"` means unconfirmed, not declined. Never retry blindly. */
      error?: string;
    };

/**
 * Typed `postMessage` payloads exchanged between the host page and the
 * embedded Amos iframe.
 */
export type Message = EmbedIframeName &
  (
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
        /** Parent → embed: Apple Pay button visuals and contact flags. */
        type: "UPDATE_APPLE_PAY_BUTTON";
        height?: string;
        props: ApplePayButtonElementProps;
        phoneRequired?: boolean;
        shippingAddressRequired?: boolean;
      }
    | {
        /** Parent → embed: Google Pay button visuals and contact flags. */
        type: "UPDATE_GOOGLE_PAY_BUTTON";
        height?: string;
        props: GooglePayButtonElementProps;
        phoneRequired?: boolean;
        shippingAddressRequired?: boolean;
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
        customerCreateAttributes: WalletCustomerCreateAttributes;
      }
    | ({
        /** Parent → embed: confirm a payment intent with an embed token. */
        type: "CONFIRM_PAYMENT_INTENT";
      } & Pick<components["schemas"]["PaymentIntent"], "id"> &
        Pick<components["schemas"]["EmbedToken"], "token"> & {
          /** Present when ACH verification completed via Plaid Link in the parent. */
          plaid?: components["schemas"]["PlaidCredentialsInput"];
          /**
           * Applied immediately before building `payment_method`. Does not
           * replace the last mount/`update` defaultValues used by RESET_FORM.
           */
          defaultValues?: PaymentMethodFormDefaultValues;
        })
    | ({
        /** Parent → embed: confirm a setup intent with an embed token. */
        type: "CONFIRM_SETUP_INTENT";
      } & Pick<components["schemas"]["SetupIntent"], "id"> &
        Pick<components["schemas"]["EmbedToken"], "token"> & {
          /** Present when ACH verification completed via Plaid Link in the parent. */
          plaid?: components["schemas"]["PlaidCredentialsInput"];
          /**
           * Applied immediately before building `payment_method`. Does not
           * replace the last mount/`update` defaultValues used by RESET_FORM.
           */
          defaultValues?: PaymentMethodFormDefaultValues;
        })
    | {
        /** Parent → embed: seed or overwrite name and billing address fields. */
        type: "UPDATE_DEFAULT_VALUES";
        defaultValues: PaymentMethodFormDefaultValues;
      }
    | {
        /** Parent → embed: focus a named form control. No-op if unmounted. */
        type: "FOCUS_FIELD";
        field: PaymentMethodFormField;
      }
    | {
        /**
         * Embed → parent: the interactive confirmation flow finished.
         * Parent → embed: express-checkout initiation failed on the host.
         * Not settlement proof — verify payment/setup success on your
         * backend via webhooks (or by retrieving the intent).
         */
        type: "CONFIRMATION_RESULT";
        result: ConfirmPaymentResult | ConfirmSetupResult;
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
        /**
         * Embed → parent: waiting UI should dismiss (cancel before authorize,
         * abort, or session error — not authorize). After authorize the
         * overlay stays until `onConfirm` settles.
         */
        type: "APPLE_PAY_WINDOW_CLOSE";
      }
    | {
        /**
         * Parent → embed: user cancelled from the host-page waiting overlay.
         * Only offered before authorize; the overlay hides Cancel once
         * `CREATE_PAYMENT_INTENT` arrives.
         */
        type: "APPLE_PAY_CANCEL";
      }
    | {
        /** Parent → embed: clear all form field values and API errors. */
        type: "RESET_FORM";
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
         * Embed → parent: the customer pressed Enter in the iframe form.
         * PCI-safe — no field values. The SDK submits the enclosing host
         * `<form>` (same as Stripe Elements). No-op without a host form,
         * or while Plaid Embedded Institution Search is showing.
         */
        type: "FORM_SUBMIT_REQUEST";
      }
    | {
        /**
         * Embed → parent: the customer pressed Escape in the iframe.
         * PCI-safe — no field values. Use `onEscapeKeyPressed` to close a
         * host modal. Not posted while an iframe dropdown or address
         * suggestion list is open (that Escape dismisses the overlay
         * first). No-op while Plaid Embedded Institution Search is
         * showing.
         */
        type: "ESCAPE_KEY_PRESSED";
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
         * Embed → parent: the customer committed a billing postal code,
         * or cleared one that was previously committed. `postalCode` is
         * null when a finished code becomes incomplete. Incomplete
         * keystrokes are not posted. Not sent for `defaultValues`.
         * Includes the postal code and country, and no PCI data.
         */
        type: "POSTAL_CODE_CHANGE";
        postalCode: string | null;
        country: string;
      }
    | {
        /** Parent → embed: mint a Plaid Link token for Embedded Link. */
        type: "CREATE_PLAID_LINK_TOKEN";
        requestId: string;
      }
    | {
        /** Embed → parent: minted Plaid Link token, or `error`. */
        type: "PLAID_LINK_TOKEN";
        requestId: string;
        link_token?: string;
        error?: string;
      }
    | {
        /**
         * Parent → embed: which external bank account intent this iframe is
         * working on, plus whatever the host already knows. `token` is a fresh
         * embed token (they last about 10 seconds, so they are never cached and
         * never sit in a URL): with one, the iframe re-reads the intent before
         * rendering. Without one it falls back to `state` /
         * `verificationStatus`.
         */
        type: "EXTERNAL_BANK_ACCOUNT_INTENT";
        intentId: string;
        token?: string;
        state?: ExternalBankAccountState;
        verificationStatus?: ExternalBankAccountVerificationStatus | null;
        institutionName?: string | null;
        mask?: string | null;
      }
    | {
        /**
         * Parent → embed: confirm the intent. Sent once, from the user's
         * submit. `plaid` is present on the first confirm only; a resume has no
         * new account to hand over. Account holder name and type are not here —
         * the iframe owns those fields and reads them from its own form.
         * `idempotencyKey` is one key per submit so a replay cannot repeat the
         * Plaid calls.
         */
        type: "CONFIRM_EXTERNAL_BANK_ACCOUNT_INTENT";
        intentId: string;
        token: string;
        idempotencyKey?: string;
        plaid?: { public_token: string; account_id: string };
        metadata?: Record<string, string>;
      }
    | {
        /**
         * Embed → parent: current screen and options. Re-posted whenever the
         * intent is re-read, including after a link token attempt that turned
         * out to be a 422, which is a state rather than an error.
         */
        type: "EXTERNAL_BANK_ACCOUNT_STATE";
        intentId: string;
        view: ExternalBankAccountView;
        institutionName?: string | null;
        mask?: string | null;
      }
    | {
        /**
         * Embed → parent: this step needs Plaid Link, and it can only be
         * mounted in the host page. `mode` says which kind of session; `error`
         * means Link cannot run for this intent at all.
         */
        type: "EXTERNAL_BANK_ACCOUNT_LINK_TOKEN";
        intentId: string;
        linkToken?: string;
        mode?: ExternalBankAccountLinkMode;
        error?: string;
      }
    | {
        /** Embed → parent: how the confirm ended. */
        type: "EXTERNAL_BANK_ACCOUNT_INTENT_RESULT";
        result: ExternalBankAccountConfirmResult;
      }
  );

/**
 * Identity helper that brands an object as a typed `Message`.
 *
 * Useful when constructing `postMessage` payloads to ensure they conform
 * to the schema understood by the embedded Amos iframe.
 */
export function createMessage(message: Message): Message {
  return message;
}
