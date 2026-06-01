/// <reference types="googlepay" />

import type { components } from "@amos.com/node";

export type {
  GooglePayButtonController,
  GooglePayButtonListenerOptions,
} from "./google-pay";
export {
  attachGooglePayButtonListeners,
  formatGooglePayPaymentData,
  getGooglePayButtonInitialHeight,
  getGooglePayButtonSrc,
} from "./google-pay";

export { decodeJwt, getEmbedOrigin } from "./jwt";

export {
  confirmPaymentIntent,
  confirmSetupIntent,
  sendConfirmationFailed,
  sendParentReadyMessage,
  updateAmount,
  updateAppearance,
  updateMerchantName,
  validateForm,
} from "./messaging";
export type {
  AmosBankAccountPaymentMethodFormOptions,
  AmosCreditCardPaymentMethodFormOptions,
  AmosGooglePayButtonMountController,
  AmosGooglePayButtonOptions,
  AmosPaymentMethodFormMountController,
} from "./mount";
export {
  mountAmosBankAccountPaymentMethodForm,
  mountAmosCreditCardPaymentMethodForm,
  mountAmosGooglePayButton,
} from "./mount";
export type {
  CreditCardAdditionalFields,
  PaymentMethodFormController,
  PaymentMethodFormListenerOptions,
} from "./payment-method-form";
export {
  attachPaymentMethodFormListeners,
  getBankAccountFormInitialHeight,
  getBankAccountFormSrc,
  getCreditCardFormInitialHeight,
  getCreditCardFormSrc,
} from "./payment-method-form";
export type {
  Appearance,
  AppearanceLabels,
  Message,
  ThemeVariable,
} from "./types";
export { createMessage } from "./types";

/**
 * Convenience alias for `components["schemas"]["CreateCustomerInput"]`.
 */
export type CreateCustomerInput = components["schemas"]["CreateCustomerInput"];
/**
 * Convenience alias for
 * `components["schemas"]["CreatePaymentIntentInput"]`.
 */
export type CreatePaymentIntentInput =
  components["schemas"]["CreatePaymentIntentInput"];
/**
 * Convenience alias for
 * `components["schemas"]["CreateSetupIntentInput"]`.
 */
export type CreateSetupIntentInput =
  components["schemas"]["CreateSetupIntentInput"];
/**
 * Convenience alias for `components["schemas"]["PaymentIntent"]`.
 */
export type PaymentIntent = components["schemas"]["PaymentIntent"];
/**
 * Convenience alias for `components["schemas"]["SetupIntent"]`.
 */
export type SetupIntent = components["schemas"]["SetupIntent"];
/**
 * API envelope `{ token?, ttl? }` for a minted embed JWT.
 *
 * `POST /payment_intents` and `POST /setup_intents` resolve to this
 * shape. {@link confirmPaymentIntent}, {@link confirmSetupIntent}, and
 * the Google Pay `onInitiatePaymentIntentRequest` return type use
 * `Pick<EmbedToken, "token">` (the JWT string returned by your server).
 */
export type EmbedToken = components["schemas"]["EmbedToken"];
/**
 * Decoded JWT payload for an embed token (`account_id`,
 * `payment_intent_id`, `setup_intent_id`, etc.).
 */
export type EmbedTokenJwt = components["schemas"]["EmbedTokenJwt"];
/**
 * Decoded JWT payload for the dashboard render token (`env`, `origins`,
 * `allowed_payment_method_types`, `render_template_id`, etc.).
 */
export type RenderTokenJwt = components["schemas"]["RenderTokenJwt"];
