# Amos JavaScript SDK

`@amos.com/amos-js` is a framework-agnostic JavaScript SDK for embedding Amos payment methods (credit card, bank account, Google Pay, Apple Pay) into your web app via secure iframes, and for communicating with those iframes from the host page.

It is the foundation for `@amos.com/react-amos-js`, but is fully usable on its own from vanilla JavaScript / TypeScript / any other framework.

## Installation

```bash
npm install @amos.com/amos-js
```

## What it gives you

- **Types** for the `postMessage` protocol used between your page and the Amos iframe (`Message`, `Appearance`, `ThemeVariable`). OpenAPI schema types (for example `components["schemas"]["PaymentIntent"]`) come from `@amos.com/node`.
- **Iframe-targeted helpers** to validate the form, confirm a payment intent, confirm a setup intent, update appearance, etc.
- **Mount functions** (`mountAmosCreditCardPaymentMethodForm`, `mountAmosBankAccountPaymentMethodForm`, `mountAmosGooglePayButton`, `mountAmosApplePayButton`) that create the iframe, wire up its message protocol, manage its height/opacity, show a field-shaped loading skeleton for card/bank forms, and return a small controller for updating options and tearing it down.
- **Lower-level building blocks** (`getCreditCardFormSrc`, `attachPaymentMethodFormListeners`, `attachGooglePayButtonListeners`, `attachApplePayButtonListeners`, ...) for integrators (such as `@amos.com/react-amos-js`) that want to render the iframe element themselves.

> **Note:** A server-side SDK (for example `@amos.com/node`) must be used alongside `@amos.com/amos-js` for end-to-end payment processing. `@amos.com/amos-js` is the client-side half.

## Requirements

```
1. Render token (created on dashboard.amos.com, safe to expose to clients)
2. Amos API key (created on dashboard.amos.com, do not expose this to clients)
3. Amos account ID (provided once your application has been approved)
```

The render token configures the iframe's allowed origin(s), allowed payment methods, accepted billing countries or US states, and the range of valid payment amounts. These settings come from the render template and are embedded in the token JWT (`RenderTokenJwt`); billing geography is controlled by `billing_address_options` (`allowed_countries` for international templates, `allowed_states` for US-only). If the render token does not allow an origin, the iframe will not render. Similarly, components corresponding to different payment method types will not render if not allowed by the render token, and billing addresses outside the configured countries or states will be rejected.

> **Note**: The render token also determines the environment (`production` or `sandbox`). Render tokens created on `dashboard.amos.com` have a `production` environment. Render tokens created on `dashboard-sandbox.amos.com` have a `sandbox` environment. Similarly, API keys can only access the environment that they were created in.

## Quick start: credit-card form (vanilla)

```ts
import {
  mountAmosCreditCardPaymentMethodForm,
  validateForm,
  confirmPaymentIntent,
} from "@amos.com/amos-js";

const form = mountAmosCreditCardPaymentMethodForm(
  document.querySelector("#card-form")!,
  {
    renderToken: "the-render-token-created-on-dashboard.amos.com",
    additionalFields: { cardholderName: true },
    appearance: {
      themeVariables: {
        "--primary": "oklch(0.5 0.2 240)",
        "--radius": "0.5rem",
      },
    },
    onResult: (result) => {
      // Unlock UI. Verify settlement on your backend via webhooks.
      if (result.status === "succeeded") {
        console.log("Confirm returned:", result);
      } else if (result.status === "failed") {
        console.error("Confirm failed:", result.errorMessage);
      }
      // status === "incomplete": field errors or validation_failed — unlock UI
      if (result.status === "incomplete") {
        console.log("Recoverable:", result.reason);
      }
    },
    onValidityChange: ({ isValid }) => {
      document.querySelector("#pay-now")!.disabled = !isValid;
    },
  },
);

document.querySelector("#pay-now")!.addEventListener("click", async () => {
  const isValid = await validateForm({ iframe: form.iframe });
  if (!isValid) {
    return;
  }

  const response = await fetch("/api/payment-intents", { method: "POST" });
  const { token } = await response.json();
  confirmPaymentIntent({ iframe: form.iframe, token });
});

// Later, if your theme changes:
form.update({
  appearance: { themeVariables: { "--primary": "oklch(0.6 0.2 30)" } },
});

// On teardown:
form.destroy();
```

## Understanding the flow for creating and confirming payment intents

### Credit Card & Bank Account

The following flow is for credit card and bank account payment method types only.

1. **Set up prerequisites**: create a `renderToken` (safe for client), and keep `apiKey` and `accountId` server-side only.
2. **Render your checkout UI** by calling `mountAmosCreditCardPaymentMethodForm(container, options)` (or `mountAmosBankAccountPaymentMethodForm(...)`) along with the required `onResult` callback. The SDK shows a field-shaped skeleton immediately (sized from `appearance`, `additionalFields`, and `billingAddressRequirement`) and auto-manages iframe height.
3. **User clicks "Pay now" button**: call `validateForm({ iframe: form.iframe })`, which returns `Promise<true>` if the embedded form is valid, and `Promise<false>` otherwise.
4. **Create payment intent on your server**: use your server-side Amos client to call `POST /payment_intents`. You may also associate this payment intent with a new or existing customer via `POST /customers`. This must be server-side because it uses your private API key.
5. **Return the payment intent token to the browser**: your backend responds with the embed token (`components["schemas"]["EmbedToken"]`) needed for confirmation.
6. **Confirm the payment intent from the client**: call `confirmPaymentIntent({ iframe: form.iframe, token })` in the browser to continue the payment flow.
7. **Handle UX**: show the user a "processing" state when the "Pay now" button is clicked, and handle `onResult`. Do not treat `onResult` as settlement proof — verify payment success on your backend via webhooks. Recoverable field errors are shown in the iframe (`status: "incomplete"`).

### Google Pay & Apple Pay

Google Pay and Apple Pay are forms of express checkout. Their buttons are alternatives to the "Pay now" button in your payment forms. Users can make a payment with either flow.

The key differences between the express and non-express payment flows are:

- The express payment method components accept an option called `onInitiatePaymentIntentRequest` which will be called when you should create the payment intent on your server.
- You do not call `validateForm` in an express flow.
- You do not call `confirmPaymentIntent` in an express flow (this is done after `onInitiatePaymentIntentRequest` returns a token).

```ts
import { mountAmosGooglePayButton } from "@amos.com/amos-js";

const button = mountAmosGooglePayButton(
  document.querySelector("#google-pay")!,
  {
    renderToken: "the-render-token-created-on-dashboard.amos.com",
    amount: "5000", // $50.00 in cents, as a string
    merchantName: "your-user-facing-merchant-name",
    onInitiatePaymentIntentRequest: async ({
      paymentIntentCreateAttributes,
      customerCreateAttributes,
    }) => {
      const response = await fetch("/api/payment-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: customerCreateAttributes,
          paymentIntent: paymentIntentCreateAttributes,
        }),
      });
      const { token } = await response.json();
      return token;
    },
    onResult: (result) => {
      if (result.status === "succeeded") {
        console.log("Google Pay confirm returned:", result);
      } else if (result.status === "failed") {
        console.error("Google Pay failed:", result.errorMessage);
      }
    },
  },
);

// Updating amount/merchant name later just works:
button.update({ amount: "7500" });
```

Apple Pay uses the same express-checkout flow and options — swap `mountAmosGooglePayButton` for `mountAmosApplePayButton`. When Apple Pay Code opens in a separate window, the SDK shows a host-page waiting overlay and tears it down when the session ends.

## Understanding the flow for creating and confirming setup intents

Setup intents are used to save payment methods for future use (e.g. recurring payments, subscriptions) without charging the customer immediately. The flow is identical to a payment intent, except:

- On the server, call `POST /setup_intents` instead of `POST /payment_intents`.
- On the client, call `confirmSetupIntent({ iframe, token })` instead of `confirmPaymentIntent({ iframe, token })`.
- The same `onResult` callback is used; succeeded setup intents arrive as `{ status: "succeeded", intent: "setup", setupIntent }`.

The same `mountAmosCreditCardPaymentMethodForm` / `mountAmosBankAccountPaymentMethodForm` controllers support both payment intents and setup intents — they are differentiated by which confirmation function you call.

## Understanding PCI DSS compliance requirements

The flows above are designed so your systems and any third-party servers you control do not handle card or bank account data in either raw or encrypted form.

Why this matters:

- The payment method UI is rendered inside Amos-hosted iframes, so sensitive input fields are not part of your DOM.
- Raw payment details are submitted from the iframe directly to Amos-controlled infrastructure.
- Your backend only creates payment intents (or setup intents) and returns a short-lived token used to continue the iframe flow.
- `confirmPaymentIntent` / `confirmSetupIntent` sends the token back to the iframe to complete confirmation; it does not pass full payment method payloads through your app server.
- In express flows (e.g. Google Pay, Apple Pay), the iframe component handles payment data exchange and only asks your server to create a payment intent token.

In short, your app orchestrates the payment flow, while sensitive payment data stays within Amos-controlled components and APIs.

## Appearance

Card and bank mount functions (and `attachPaymentMethodFormListeners`) accept an optional `appearance` option that controls the look of the iframe UI. It contains a `themeVariables` object whose keys are CSS custom-property names and whose values are strings, and an optional `labels` setting for field label placement. You can update appearance after page load via the controller's `update({ appearance })` method. Wallet buttons do not take `appearance`.

```ts
form.update({
  appearance: {
    labels: "floating",
    themeVariables: {
      "--primary": "oklch(0.5 0.2 240)",
      "--radius": "0.25rem",
    },
  },
});
```

`themeVariables` uses a **replace** model: each update that includes `themeVariables` sets the full override set. Only the variables you list are overridden; unlisted variables revert to iframe defaults. Omit `themeVariables` to leave existing overrides unchanged.

### Label placement

Set `labels` to control how field labels are rendered in card and bank account forms:

| Value | Behavior |
| ----- | -------- |
| `above` (default) | Label text above each input |
| `floating` | Label inside the control; moves up when focused or filled |
| `placeholder` | No visible label; placeholder and `aria-label` only |

Radio groups (e.g. account type) always use an above-style group label regardless of this setting.

### Available theme variables

| Variable                 | Purpose                                        | Default                     |
| ------------------------ | ---------------------------------------------- | --------------------------- |
| `--background`           | Page body and base surface color               | `oklch(1 0 0)`              |
| `--foreground`           | Default text color                             | `oklch(0.145 0 0)`          |
| `--primary`              | Button fill and input text-selection highlight | `oklch(0.205 0 0)`          |
| `--primary-foreground`   | Text on primary-colored surfaces               | `oklch(0.985 0 0)`          |
| `--secondary`            | Secondary button fill                          | `oklch(0.97 0 0)`           |
| `--secondary-foreground` | Text on secondary-colored surfaces             | `oklch(0.205 0 0)`          |
| `--muted`                      | Muted surface color                                              | `oklch(0.97 0 0)`           |
| `--muted-foreground`           | Placeholder text, helper labels, muted icons                     | `oklch(0.556 0 0)`          |
| `--accent`                     | Hover/focus highlight for interactive items                      | `oklch(0.97 0 0)`           |
| `--accent-foreground`          | Text on accent-highlighted items                                 | `oklch(0.205 0 0)`          |
| `--destructive`                | Error/invalid state borders, icons, and field error text         | `oklch(0.577 0.245 27.325)` |
| `--destructive-foreground`     | Text on destructive-colored surfaces                             | `oklch(0.45 0.24 27.325)`   |
| `--border`                     | General border color                                             | `oklch(0.922 0 0)`          |
| `--popover`                    | Dropdown / popover panel background                              | `oklch(1 0 0)`              |
| `--popover-foreground`         | Dropdown / popover panel text color                              | `oklch(0.145 0 0)`          |
| `--input`                      | Input field border color                                         | `oklch(0.922 0 0)`          |
| `--input-background`           | Input field background fill                                      | `var(--background)`         |
| `--input-height`               | Height of text inputs and form controls                          | `2.25rem`                   |
| `--input-font-size`            | Font size of text inputs and dropdown fields                     | `0.875rem`                  |
| `--input-font-weight`          | Font weight of typed input values                                | `400`                       |
| `--input-padding`              | Horizontal padding inside inputs                                 | `0.75rem`                   |
| `--input-border-width`         | Input field border width                                         | `1px`                       |
| `--input-shadow`               | Input field box shadow                                           | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| `--floating-input-height`      | Height of inputs when labels are floating                        | `3.25rem`                   |
| `--floating-label-font-size`        | Font size of floating labels when focused or filled              | `0.75rem`                   |
| `--floating-label-empty-font-size`  | Font size of floating labels when empty (unfocused)              | `var(--input-font-size)`    |
| `--floating-label-font-weight`      | Font weight of floating labels                                   | `500`                       |
| `--floating-label-color`            | Color of floating labels when empty (unfocused)                  | `var(--muted-foreground)`   |
| `--floating-label-floated-color`    | Color of floating labels when focused or filled                  | `var(--floating-label-color)` |
| `--floating-label-offset`           | Top offset of the shrunk floating label                          | `0.625rem`                  |
| `--label-font-size`            | Font size of above-style field labels                            | `0.875rem`                  |
| `--label-font-weight`          | Font weight of above-style field labels                          | `500`                       |
| `--field-gap`                  | Vertical gap between stacked form fields                         | `1rem`                      |
| `--control-gap`                | Horizontal gap between side-by-side controls                     | `0.5rem`                    |
| `--error-font-size`            | Font size of field-level error messages                          | `0.875rem`                  |
| `--radio-size`                 | Size of radio buttons on the bank account form                   | `1rem`                      |
| `--ring`                       | Focus ring and outline color                                     | `oklch(0.708 0 0)`          |
| `--ring-width`                 | Focus ring width                                                 | `3px`                       |
| `--radius`                     | Base border-radius (derived into sm/md/lg/xl)                    | `0.625rem`                  |

## API reference

### `mountAmosCreditCardPaymentMethodForm(container, options)`

Mount the secure credit-card payment method form into a container element (an `HTMLElement` or a CSS selector string).

**Required `options`:**

- `renderToken` (`string`)
- `onResult` (`(result: ConfirmationResult) => void`) — required. Called when the interactive confirmation attempt finishes (`succeeded`, `failed`, or `incomplete` with `reason`). Not settlement proof; verify via webhooks.

**Optional `options`:**

- `appearance` (`{ themeVariables?: Partial<Record<ThemeVariable, string>>; labels?: "above" | "floating" | "placeholder" }`)
- `additionalFields` (`{ cardholderName: boolean }`, defaults to `{ cardholderName: false }`)
- `billingAddressRequirement` (`"country" | "full"`, defaults to `"country"`) — how much billing address the iframe collects. `country` collects country / region and, for CA / PR / GB / US, a postal code (labeled ZIP for the United States). `full` shows a full street address form with Smarty autocomplete.


- `onValidityChange` (`(event: { isValid: boolean }) => void`) — called when form validity changes. `isValid` is true when all required fields are present and valid. Does not include PCI data. Use this to enable or disable your checkout button.
- `onHeightChange`, `onAppearanceReady` (advanced — override the default iframe styling logic). The skeleton is removed and the iframe faded in when `onAppearanceReady` fires.

**Returns** `AmosPaymentMethodFormMountController`:

- `iframe` — the underlying `<iframe>` element.
- `update(patch)` — patch any of the options listed above.
- `destroy()` — remove the iframe (and any loading skeleton) and detach listeners.

### `mountAmosBankAccountPaymentMethodForm(container, options)`

Same shape as `mountAmosCreditCardPaymentMethodForm`, minus `additionalFields`. Supports the same `billingAddressRequirement` option.

### `mountAmosGooglePayButton(container, options)`

Mount the secure Google Pay button (express checkout) into a container element.

**Required `options`:**

- `renderToken` (`string`)
- `amount` (`string`)
- `merchantName` (`string`)
- `onInitiatePaymentIntentRequest` (`({ paymentIntentCreateAttributes, customerCreateAttributes }) => Promise<components["schemas"]["EmbedToken"]["token"]>`)

- `onResult` (`(result: ConfirmationResult) => void`) — required. Called when the interactive confirmation attempt finishes (`succeeded`, `failed`, or `incomplete` with `reason`). Not settlement proof; verify via webhooks.

**Optional `options`:** `onHeightChange`, `onAppearanceReady`, plus:

- `height` (`string | number`, defaults to `"48px"`) — painted button height. Unitless numbers become `px`.
- `buttonProps` — native Google Pay button options. Defaults (override any field):

```ts
{
  buttonType: "short",
  buttonSizeMode: "fill",
  style: { width: "100%" },
}
```

Override any field. Compact button: `buttonProps={{ buttonSizeMode: "static", style: { width: "240px" } }}`.
- `iframeClassName` / `iframeStyle` — applied to the host-page `<iframe>` element. Use CSS values with units (`{ borderRadius: "8px" }`); unitless numbers are coerced to `px`.

```ts
mountAmosGooglePayButton("#google-pay", {
  // ...required options
  buttonProps: {
    buttonType: "donate",
    buttonBorderType: "no_border",
  },
  iframeStyle: { borderRadius: "8px" },
});
```

The wallet iframe is flush with its mount container (`width: 100%`, zero margin). The branded button fills that iframe at 48px tall. For advanced host layout overrides, use the returned controller's `iframe` element.

**Returns** `AmosGooglePayButtonMountController`:

- `iframe`, `update(patch)`, `destroy()`. Use `update({ amount, merchantName })` to push new values into the iframe. Use `update({ height, buttonProps })` to restyle the button.

### Migration from flat wallet props

| Before | After |
| ------ | ----- |
| `buttonstyle`, `type`, `locale` | `buttonProps.buttonstyle`, `buttonProps.type`, `buttonProps.locale` |
| Google `buttonType`, `buttonColor`, … | `buttonProps.buttonType`, `buttonProps.buttonColor`, … |
| `style` / inner button CSS | `height` + `buttonProps.style` (`buttonProps.style.height` wins if both are set) |
| `iframeStyle` / `iframeClassName` | unchanged names; inner button `style` is no longer top-level |
| `fullWidth` / `buttonSizeMode: "fill"` | default `buttonProps` (`buttonSizeMode: "fill"` + `style.width: "100%"`; Apple also sets `--apple-pay-button-width: "100%"`) |
| wallet `appearance` | removed |
| default painted height `40px` | `"48px"` |

### `mountAmosApplePayButton(container, options)`

Mount the secure Apple Pay button (express checkout). Same required options and return shape as `mountAmosGooglePayButton`.

**Optional visual options:**

- `height` (`string | number`, defaults to `"48px"`) — painted button height. Apple ignores CSS `height`; Amos maps this for you.
- `buttonProps` — native `<apple-pay-button>` attributes. Defaults (override any field):

```ts
{
  buttonstyle: "black",
  type: "plain",
  locale: "en-US",
  style: { display: "block", width: "100%", "--apple-pay-button-width": "100%" },
}
```

Override any field. `style.width` also updates `--apple-pay-button-width` unless you set that custom property yourself.
- `iframeClassName` / `iframeStyle` — host-page `<iframe>` chrome.

```ts
button.update({
  buttonProps: {
    buttonstyle: "white-outline",
    type: "buy",
    locale: "en-GB",
  },
});
```

### `validateForm({ iframe })`

Validates the embedded card/bank iframe form. Returns `Promise<boolean>` (resolves to `false` after 5 seconds if the iframe does not respond).

### `confirmPaymentIntent({ iframe, token })` / `confirmSetupIntent({ iframe, token })`

Forward an embed JWT to the iframe so it can complete the payment / setup intent confirmation. The matching `payment_intent_id` / `setup_intent_id` is extracted from the JWT and forwarded automatically.

### `resetForm({ iframe })`

Clears all field values and API errors in the embedded card/bank iframe form. Call after `onResult` when the customer wants to try again.

### `attachPaymentMethodFormListeners(iframe, options)`

Lower-level helper that wires up the host-page side of the credit-card or bank-account iframe message protocol on an existing `<iframe>` element. The iframe is expected to have been added to the DOM with the correct `src` already (see `getCreditCardFormSrc` / `getBankAccountFormSrc`). Returns `{ update, destroy }`.

This is what `@amos.com/react-amos-js` uses to integrate with React's rendering model.

### `attachGooglePayButtonListeners(iframe, options)` / `attachApplePayButtonListeners(iframe, options)`

The Google Pay / Apple Pay equivalents of `attachPaymentMethodFormListeners`.

### `getCreditCardFormSrc(renderToken, additionalFields?, billingAddressRequirement?)` / `getBankAccountFormSrc(renderToken, billingAddressRequirement?)` / `getGooglePayButtonSrc(renderToken)` / `getApplePayButtonSrc(renderToken)`

Build the iframe `src` URL for each form type.

### `formatGooglePayPaymentData({ paymentData })`

Transforms raw Google Pay payment data into an Amos-compatible `paymentMethod` payload. Use this when integrating with the raw Google Pay API (e.g. `@google-pay/button-react`) instead of `mountAmosGooglePayButton`.

### `createMessage(message)` / `decodeJwt(token)` / `getEmbedOrigin(renderToken)`

Advanced helpers exposed for integrators that need to construct or inspect the message protocol themselves.

### Exported types

`Message`, `Appearance`, `ThemeVariable`, `FormattedGooglePayPaymentData`, `PaymentMethodFormValidityChangeEvent`, plus the per-form `*Options` and `*Controller` types. For OpenAPI schema types, import `components` from `@amos.com/node`.

## Notes and potential gotchas

- **`iframe` argument**: every messaging helper (`validateForm`, `confirmPaymentIntent`, `confirmSetupIntent`, `resetForm`) accepts the `iframe` element directly. With the mount helpers, use `controller.iframe`.
- **Same components for payment vs setup intents**: `mountAmosCreditCardPaymentMethodForm` and `mountAmosBankAccountPaymentMethodForm` support both payment intents and setup intents. The flow differs only by which server call you make and which confirmation function you use. Handle both outcomes via `onResult`.
- **Amount format**: for `mountAmosGooglePayButton` and `mountAmosApplePayButton`, `amount` is a string (e.g. `"5000"` for $50.00). For `components["schemas"]["CreatePaymentIntentInput"]` on the server, `amount` is a number in cents (e.g. `5000`).
- **Browser-only**: the mount and messaging helpers require `window` and the DOM. They are not safe to call during server-side rendering — call them from client-side code only (for example, inside a `useEffect`-like hook in your framework of choice).

---

**Full product docs:** [docs.amos.com](https://docs.amos.com)
