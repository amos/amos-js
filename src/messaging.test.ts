import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  CONFIRM_TIMEOUT_MS,
  type ConfirmPaymentResult,
  type ConfirmSetupResult,
  confirmPayment,
  confirmSetup,
  isConfirmTimeout,
} from "./index";
import { createMessage } from "./types";

function unsignedJwt(payload: object): string {
  const encode = (value: object) => btoa(JSON.stringify(value));
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.sig`;
}

function embedIframe(): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.src = `${location.origin}/`;
  document.body.append(iframe);
  return iframe;
}

function postFromIframe(
  iframe: HTMLIFrameElement,
  result: ConfirmPaymentResult | ConfirmSetupResult,
): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: createMessage({ type: "CONFIRMATION_RESULT", result }),
      source: iframe.contentWindow,
    }),
  );
}

describe("isConfirmTimeout", () => {
  test("is true only for failed + error timeout", () => {
    expect(isConfirmTimeout({ status: "failed", error: "timeout" })).toBe(true);
    expect(isConfirmTimeout({ status: "failed" })).toBe(false);
    expect(
      isConfirmTimeout({
        status: "succeeded",
        paymentIntent: { id: "pi_1" } as never,
      }),
    ).toBe(false);
    expect(isConfirmTimeout(null)).toBe(false);
  });
});

describe("confirmPayment timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  test("missing iframe is a decline, not a timeout", async () => {
    await expect(
      confirmPayment({
        iframe: null,
        token: unsignedJwt({ payment_intent_id: "pi_1" }),
      }),
    ).resolves.toEqual({ status: "failed" });
  });

  test("resolves timeout after CONFIRM_TIMEOUT_MS when the iframe is silent", async () => {
    const iframe = embedIframe();
    const pending = confirmPayment({
      iframe,
      token: unsignedJwt({ payment_intent_id: "pi_1" }),
    });

    await vi.advanceTimersByTimeAsync(CONFIRM_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({
      status: "failed",
      error: "timeout",
    });
  });

  test("forwards an iframe timeout result", async () => {
    const iframe = embedIframe();
    const pending = confirmPayment({
      iframe,
      token: unsignedJwt({ payment_intent_id: "pi_1" }),
    });
    postFromIframe(iframe, { status: "failed", error: "timeout" });
    await expect(pending).resolves.toEqual({
      status: "failed",
      error: "timeout",
    });
  });

  test("keeps a processor decline distinct from timeout", async () => {
    const iframe = embedIframe();
    const paymentIntent = { id: "pi_declined", state: "failed" };
    const pending = confirmPayment({
      iframe,
      token: unsignedJwt({ payment_intent_id: "pi_declined" }),
    });
    postFromIframe(iframe, {
      status: "failed",
      paymentIntent: paymentIntent as never,
    });
    await expect(pending).resolves.toEqual({
      status: "failed",
      paymentIntent,
    });
    expect(
      isConfirmTimeout({
        status: "failed",
        paymentIntent: paymentIntent as never,
      }),
    ).toBe(false);
  });
});

describe("confirmSetup timeout", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("forwards an iframe timeout result", async () => {
    const iframe = embedIframe();
    const pending = confirmSetup({
      iframe,
      token: unsignedJwt({ setup_intent_id: "seti_1" }),
    });
    postFromIframe(iframe, { status: "failed", error: "timeout" });
    await expect(pending).resolves.toEqual({
      status: "failed",
      error: "timeout",
    });
  });
});
