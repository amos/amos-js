/// <reference types="googlepay" />

export type {
  ApplePayButtonController,
  ApplePayButtonListenerOptions,
} from "./apple-pay";
export {
  attachApplePayButtonListeners,
  getApplePayButtonInitialHeight,
  getApplePayButtonSrc,
} from "./apple-pay";

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
  resetForm,
  sendConfirmationResult,
  sendParentReadyMessage,
  updateAmount,
  updateAppearance,
  updateApplePayButton,
  updateGooglePayButton,
  updateMerchantName,
  validateForm,
} from "./messaging";
export type {
  AmosApplePayButtonMountController,
  AmosApplePayButtonOptions,
  AmosBankAccountPaymentMethodFormOptions,
  AmosCreditCardPaymentMethodFormOptions,
  AmosGooglePayButtonMountController,
  AmosGooglePayButtonOptions,
  AmosPaymentMethodFormMountController,
  WalletIframeStyle,
} from "./mount";
export {
  mountAmosApplePayButton,
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
  ApplePayButtonElementProps,
  ConfirmationIncompleteReason,
  ConfirmationResult,
  GooglePayButtonElementProps,
  Message,
  PaymentMethodFormValidityChangeEvent,
  ThemeVariable,
} from "./types";
export { createMessage } from "./types";
