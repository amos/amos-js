import type { components } from "@amos.com/node";

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
   * Error/invalid state borders and icons.
   *
   * Default: oklch(0.577 0.245 27.325)
   */
  | "--destructive"
  /*
   * General border color applied to all elements via the base layer.
   *
   * Default: oklch(0.922 0 0)
   */
  | "--border"
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
   * Focus ring and outline color for inputs and buttons.
   *
   * Default: oklch(0.708 0 0)
   */
  | "--ring"
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
 * Typed `postMessage` payloads exchanged between the host page and the
 * embedded Amos iframe.
 */
export type Message =
  | {
      type: "IFRAME_READY";
    }
  | {
      type: "PARENT_ACKNOWLEDGED_IFRAME_READY";
    }
  | {
      type: "UPDATE_HEIGHT";
      height: string;
    }
  | {
      type: "UPDATE_AMOUNT";
      amount: string;
    }
  | {
      type: "UPDATE_MERCHANT_NAME";
      merchantName: string;
    }
  | {
      type: "UPDATE_APPEARANCE";
      appearance: Appearance;
    }
  | {
      type: "VALIDATE_FORM";
      requestId: string;
      isValid?: boolean;
    }
  | {
      type: "CREATE_PAYMENT_INTENT";
      paymentIntentCreateAttributes: components["schemas"]["CreatePaymentIntentInput"];
      customerCreateAttributes: components["schemas"]["CreateCustomerInput"];
    }
  | ({
      type: "CONFIRM_PAYMENT_INTENT";
    } & Pick<components["schemas"]["PaymentIntent"], "id"> &
      Pick<components["schemas"]["EmbedToken"], "token">)
  | ({
      type: "CONFIRM_SETUP_INTENT";
    } & Pick<components["schemas"]["SetupIntent"], "id"> &
      Pick<components["schemas"]["EmbedToken"], "token">)
  | {
      type: "PAYMENT_INTENT_CONFIRMATION_SUCCEEDED";
      paymentIntent: components["schemas"]["PaymentIntent"];
    }
  | {
      type: "SETUP_INTENT_CONFIRMATION_SUCCEEDED";
      setupIntent: components["schemas"]["SetupIntent"];
    }
  | {
      type: "CONFIRMATION_FAILED";
      errorMessage: string;
    }
  | {
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
