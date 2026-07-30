/// <reference types="googlepay" />

export type {
  FormattedGooglePayPaymentData,
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
  BillingAddressRequirement,
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
