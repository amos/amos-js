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
  PaymentMethodFormSkeleton,
  PaymentMethodFormSkeletonKind,
  PaymentMethodFormSkeletonOptions,
  WalletButtonSkeleton,
  WalletButtonSkeletonOptions,
} from "./form-skeleton";
export {
  createPaymentMethodFormSkeleton,
  createWalletButtonSkeleton,
  ensureSkeletonStyles,
  resolveWalletButtonSkeletonBorderRadius,
  SKELETON_STYLES,
} from "./form-skeleton";
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
  confirmPayment,
  confirmSetup,
  resetForm,
  sendConfirmationResult,
  sendParentReadyMessage,
  setFormValues,
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
  AmosBankAccountPaymentMethodFormMountController,
  AmosBankAccountPaymentMethodFormOptions,
  AmosCreditCardPaymentMethodFormOptions,
  AmosGooglePayButtonMountController,
  AmosGooglePayButtonOptions,
  AmosPaymentMethodFormMountController,
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
  OpenPlaidLinkInput,
  PlaidCredentials,
  PlaidLinkOnSuccessMetadata,
} from "./plaid";
export {
  linkedBankLabelFromMetadata,
  loadPlaidScript,
  openPlaidLink,
  plaidAccountIdFromMetadata,
  requiresAchVerification,
} from "./plaid";
export type {
  Appearance,
  AppearanceLabels,
  ApplePayButtonElementProps,
  CardBrand,
  ConfirmResult,
  GooglePayButtonElementProps,
  Message,
  PaymentMethodFormCardBrandChangeEvent,
  PaymentMethodFormValidityChangeEvent,
  PaymentMethodFormValues,
  ThemeVariable,
} from "./types";
export { createMessage } from "./types";
