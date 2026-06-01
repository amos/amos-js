# Amos JavaScript SDK

`@amos.com/amos-js` is a framework-agnostic JavaScript SDK for embedding Amos payment methods (credit card, bank account, Google Pay) into your web app via secure iframes, and for communicating with those iframes from the host page.

It is the foundation for `@amos.com/react-amos-js`, but is fully usable on its own from vanilla JavaScript / TypeScript / any other framework.

## Installation

```bash
npm install @amos.com/amos-js
```

## What it gives you

- **Types** for the `postMessage` protocol used between your page and the Amos iframe (`Message`, `Appearance`, `ThemeVariable`), plus convenience aliases for the OpenAPI schema types you'll encounter (`PaymentIntent`, `SetupIntent`, `EmbedToken`, `CreatePaymentIntentInput`, ...).
- **Iframe-targeted helpers** to validate the form, confirm a payment intent, confirm a setup intent, update appearance, etc.
- **Mount functions** (`mountAmosCreditCardPaymentMethodForm`, `mountAmosBankAccountPaymentMethodForm`, `mountAmosGooglePayButton`) that create the iframe, wire up its message protocol, manage its height/opacity, and return a small controller for updating options and tearing it down.
- **Lower-level building blocks** (`getCreditCardFormSrc`, `attachPaymentMethodFormListeners`, `attachGooglePayButtonListeners`, ...) for integrators (such as `@amos.com/react-amos-js`) that want to render the iframe element themselves.

> **Note:** A server-side SDK (for example `@amos.com/node`) must be used alongside `@amos.com/amos-js` for end-to-end payment processing. `@amos.com/amos-js` is the client-side half.

## Requirements

```
1. Render token (created on dashboard.amos.com, safe to expose to clients)
2. Amos API key (created on dashboard.amos.com, do not expose this to clients)
3. Amos account ID (provided once your application has been approved)
```

The render token configures the iframe's allowed origin(s), allowed payment methods, and the range of valid payment amounts. If the render token does not allow an origin, the iframe will not render. Similarly, components corresponding to different payment method types will not render if not allowed by the render token.

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
    onPaymentIntentConfirmationSucceeded: (paymentIntent) => {
      console.log("Payment succeeded:", paymentIntent.id);
    },
    onConfirmationFailed: (errorMessage) => {
      console.error("Payment failed:", errorMessage);
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
2. **Render your checkout UI** by calling `mountAmosCreditCardPaymentMethodForm(container, options)` (or `mountAmosBankAccountPaymentMethodForm(...)`) along with the required option (`onConfirmationFailed`) and optional callbacks (`onPaymentIntentConfirmationSucceeded`, `onSetupIntentConfirmationSucceeded`). The iframe height is auto-managed by the SDK.
3. **User clicks "Pay now" button**: call `validateForm({ iframe: form.iframe })`, which returns `Promise<true>` if the embedded form is valid, and `Promise<false>` otherwise.
4. **Create payment intent on your server**: use your server-side Amos client to call `POST /payment_intents`. You may also associate this payment intent with a new or existing customer via `POST /customers`. This must be server-side because it uses your private API key.
5. **Return the payment intent token to the browser**: your backend responds with the `EmbedToken` needed for confirmation.
6. **Confirm the payment intent from the client**: call `confirmPaymentIntent({ iframe: form.iframe, token })` in the browser to continue the payment flow.
7. **Handle UX**: show the user a "processing" state when the "Pay now" button is clicked, and show a success or error message via `onPaymentIntentConfirmationSucceeded` and `onConfirmationFailed`.

### Google Pay

Google Pay (and soon, Apple Pay) is a form of express checkout. The Google Pay button is an alternative to the "Pay now" button in your payment forms. Users can make a payment with either flow.

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
    onPaymentIntentConfirmationSucceeded: (paymentIntent) => {
      console.log("Google Pay succeeded:", paymentIntent.id);
    },
    onConfirmationFailed: (errorMessage) => {
      console.error("Google Pay failed:", errorMessage);
    },
  },
);

// Updating amount/merchant name later just works:
button.update({ amount: "7500" });
```

## Understanding the flow for creating and confirming setup intents

Setup intents are used to save payment methods for future use (e.g. recurring payments, subscriptions) without charging the customer immediately. The flow is identical to a payment intent, except:

- On the server, call `POST /setup_intents` instead of `POST /payment_intents`.
- On the client, call `confirmSetupIntent({ iframe, token })` instead of `confirmPaymentIntent({ iframe, token })`.
- Use `onSetupIntentConfirmationSucceeded` instead of `onPaymentIntentConfirmationSucceeded`.

The same `mountAmosCreditCardPaymentMethodForm` / `mountAmosBankAccountPaymentMethodForm` controllers support both payment intents and setup intents — they are differentiated by which confirmation function you call.

## Understanding PCI DSS compliance requirements

The flows above are designed so your systems and any third-party servers you control do not handle card or bank account data in either raw or encrypted form.

Why this matters:

- The payment method UI is rendered inside Amos-hosted iframes, so sensitive input fields are not part of your DOM.
- Raw payment details are submitted from the iframe directly to Amos-controlled infrastructure.
- Your backend only creates payment intents (or setup intents) and returns a short-lived token used to continue the iframe flow.
- `confirmPaymentIntent` / `confirmSetupIntent` sends the token back to the iframe to complete confirmation; it does not pass full payment method payloads through your app server.
- In express flows (e.g. Google Pay), the iframe component handles payment data exchange and only asks your server to create a payment intent token.

In short, your app orchestrates the payment flow, while sensitive payment data stays within Amos-controlled components and APIs.

## Appearance

Every mount function (and the `attach*Listeners` helpers) accepts an optional `appearance` option that controls the look of the iframe UI. It contains a `themeVariables` object whose keys are CSS custom-property names and whose values are strings, and an optional `labels` setting for field label placement. You can update appearance after page load via the controller's `update({ appearance })` method.

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

Only the variables you provide are sent; omitted variables keep their defaults.

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
| `--muted-foreground`     | Placeholder text, helper labels, muted icons   | `oklch(0.556 0 0)`          |
| `--accent`               | Hover/focus highlight for interactive items    | `oklch(0.97 0 0)`           |
| `--accent-foreground`    | Text on accent-highlighted items               | `oklch(0.205 0 0)`          |
| `--destructive`          | Error/invalid state borders and icons          | `oklch(0.577 0.245 27.325)` |
| `--border`               | General border color                           | `oklch(0.922 0 0)`          |
| `--input`                | Input field border color                       | `oklch(0.922 0 0)`          |
| `--input-background`     | Input field background fill                    | `var(--background)`         |
| `--input-height`         | Height of text inputs and form controls        | `2.25rem`                   |
| `--ring`                 | Focus ring and outline color                   | `oklch(0.708 0 0)`          |
| `--radius`               | Base border-radius (derived into sm/md/lg/xl)  | `0.625rem`                  |

## API reference

### `mountAmosCreditCardPaymentMethodForm(container, options)`

Mount the secure credit-card payment method form into a container element (an `HTMLElement` or a CSS selector string).

**Required `options`:**

- `renderToken` (`string`)
- `onConfirmationFailed` (`(errorMessage: string) => void`)

**Optional `options`:**

- `appearance` (`{ themeVariables?: Partial<Record<ThemeVariable, string>>; labels?: "above" | "floating" | "placeholder" }`)
- `additionalFields` (`{ cardholderName: boolean }`, defaults to `{ cardholderName: false }`)
- `onPaymentIntentConfirmationSucceeded` (`(paymentIntent: PaymentIntent) => void`)
- `onSetupIntentConfirmationSucceeded` (`(setupIntent: SetupIntent) => void`)
- `onHeightChange`, `onAppearanceReady` (advanced — override the default iframe styling logic)

**Returns** `AmosPaymentMethodFormMountController`:

- `iframe` — the underlying `<iframe>` element.
- `update(patch)` — patch any of the options listed above.
- `destroy()` — remove the iframe and detach listeners.

### `mountAmosBankAccountPaymentMethodForm(container, options)`

Same shape as `mountAmosCreditCardPaymentMethodForm`, minus `additionalFields`.

### `mountAmosGooglePayButton(container, options)`

Mount the secure Google Pay button (express checkout) into a container element.

**Required `options`:**

- `renderToken` (`string`)
- `amount` (`string`)
- `merchantName` (`string`)
- `onInitiatePaymentIntentRequest` (`({ paymentIntentCreateAttributes, customerCreateAttributes }) => Promise<EmbedToken["token"]>`)
- `onPaymentIntentConfirmationSucceeded` (`(paymentIntent: PaymentIntent) => void`)
- `onConfirmationFailed` (`(errorMessage: string) => void`)

**Optional `options`:** `appearance`, `onHeightChange`, `onAppearanceReady`.

**Returns** `AmosGooglePayButtonMountController`:

- `iframe`, `update(patch)`, `destroy()`. Use `update({ amount, merchantName })` to push new values into the iframe.

### `validateForm({ iframe })`

Validates the embedded card/bank iframe form. Returns `Promise<boolean>` (resolves to `false` after 5 seconds if the iframe does not respond).

### `confirmPaymentIntent({ iframe, token })` / `confirmSetupIntent({ iframe, token })`

Forward an embed JWT to the iframe so it can complete the payment / setup intent confirmation. The matching `payment_intent_id` / `setup_intent_id` is extracted from the JWT and forwarded automatically.

### `attachPaymentMethodFormListeners(iframe, options)`

Lower-level helper that wires up the host-page side of the credit-card or bank-account iframe message protocol on an existing `<iframe>` element. The iframe is expected to have been added to the DOM with the correct `src` already (see `getCreditCardFormSrc` / `getBankAccountFormSrc`). Returns `{ update, destroy }`.

This is what `@amos.com/react-amos-js` uses to integrate with React's rendering model.

### `attachGooglePayButtonListeners(iframe, options)`

The Google Pay equivalent of `attachPaymentMethodFormListeners`.

### `getCreditCardFormSrc(renderToken, additionalFields?)` / `getBankAccountFormSrc(renderToken)` / `getGooglePayButtonSrc(renderToken)`

Build the iframe `src` URL for each form type.

### `formatGooglePayPaymentData({ paymentData })`

Transforms raw Google Pay payment data into an Amos-compatible `paymentMethod` payload. Use this when integrating with the raw Google Pay API (e.g. `@google-pay/button-react`) instead of `mountAmosGooglePayButton`.

### `createMessage(message)` / `decodeJwt(token)` / `getEmbedOrigin(renderToken)`

Advanced helpers exposed for integrators that need to construct or inspect the message protocol themselves.

### Exported types

`Message`, `Appearance`, `ThemeVariable`, `CreateCustomerInput`, `CreatePaymentIntentInput`, `CreateSetupIntentInput`, `PaymentIntent`, `SetupIntent`, `EmbedToken`, `EmbedTokenJwt`, `RenderTokenJwt`, plus the per-form `*Options` and `*Controller` types.

## Notes and potential gotchas

- **`iframe` argument**: every messaging helper (`validateForm`, `confirmPaymentIntent`, `confirmSetupIntent`) accepts the `iframe` element directly. With the mount helpers, use `controller.iframe`.
- **Same components for payment vs setup intents**: `mountAmosCreditCardPaymentMethodForm` and `mountAmosBankAccountPaymentMethodForm` support both payment intents and setup intents. The flow differs only by which server call you make and which confirmation function you use. You may optionally provide `onPaymentIntentConfirmationSucceeded` and/or `onSetupIntentConfirmationSucceeded`; the appropriate one is invoked based on the flow.
- **Amount format**: for `mountAmosGooglePayButton`, `amount` is a string (e.g. `"5000"` for $50.00). For `CreatePaymentIntentInput` on the server, `amount` is a number in cents (e.g. `5000`).
- **Browser-only**: the mount and messaging helpers require `window` and the DOM. They are not safe to call during server-side rendering — call them from client-side code only (for example, inside a `useEffect`-like hook in your framework of choice).

---

**Full product docs:** [docs.amos.com](https://docs.amos.com)
