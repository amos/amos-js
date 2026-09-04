/// <reference types="googlepay" />

import { describe, expect, it } from "vitest";
import { formatGooglePayPaymentData } from "./google-pay";

function paymentData({
  email,
  billing,
  shipping,
  token = "wallet-token",
}: {
  email?: string;
  billing?: google.payments.api.Address;
  shipping?: google.payments.api.Address;
  token?: string;
}): google.payments.api.PaymentData {
  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    email,
    shippingAddress: shipping,
    paymentMethodData: {
      type: "CARD",
      description: "Visa 1234",
      info: {
        cardNetwork: "VISA",
        cardDetails: "1234",
        billingAddress: billing,
      },
      tokenizationData: {
        type: "PAYMENT_GATEWAY",
        token,
      },
    },
  };
}

describe("formatGooglePayPaymentData", () => {
  it("maps billingAddress onto billing_address_attributes", () => {
    const formatted = formatGooglePayPaymentData({
      paymentData: paymentData({
        email: "buyer@example.com",
        billing: {
          name: "Jane Doe",
          address1: "123 Main St",
          address2: "Apt 4",
          locality: "Austin",
          administrativeArea: "TX",
          postalCode: "78701",
          countryCode: "US",
          phoneNumber: "+15125550123",
        },
        shipping: {
          name: "Ship To",
          address1: "999 Other St",
          locality: "Dallas",
          administrativeArea: "TX",
          postalCode: "75201",
          countryCode: "US",
        },
      }),
    });

    expect(formatted.paymentMethod.billing_address_attributes).toEqual({
      name: "Jane Doe",
      address_line1: "123 Main St",
      address_line2: "Apt 4",
      city: "Austin",
      state: "TX",
      postal_code: "78701",
      country: "US",
      email: "buyer@example.com",
      phone: "+15125550123",
    });
    expect(formatted.paymentMethod.card_profile_attributes.wallet_payload).toBe(
      "wallet-token",
    );
  });

  it("prefers shipping phone over billing phone", () => {
    const formatted = formatGooglePayPaymentData({
      paymentData: paymentData({
        billing: {
          name: "Jane Doe",
          address1: "123 Main St",
          locality: "Austin",
          administrativeArea: "TX",
          postalCode: "78701",
          countryCode: "US",
          phoneNumber: "+15125550000",
        },
        shipping: {
          name: "Ship To",
          address1: "999 Other St",
          locality: "Dallas",
          administrativeArea: "TX",
          postalCode: "75201",
          countryCode: "US",
          phoneNumber: "+15125550123",
        },
      }),
    });

    expect(formatted.paymentMethod.billing_address_attributes?.phone).toBe(
      "+15125550123",
    );
  });
});
