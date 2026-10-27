import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  mountAmosCreditCardPaymentMethodForm,
  mountAmosExternalBankAccountForm,
  mountAmosGooglePayButton,
  PAYMENT_IFRAME_SANDBOX,
  SKELETON_REVEAL_TIMEOUT_MS,
  WALLET_IFRAME_SANDBOX,
} from "./mount";

const RENDER_TOKEN = [
  btoa(JSON.stringify({ alg: "none" })),
  btoa(JSON.stringify({ env: "sandbox" })),
  "sig",
].join(".");

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

function postFromIframe(
  iframe: HTMLIFrameElement,
  data: { type: string },
): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data,
      origin: new URL(iframe.src).origin,
      source: iframe.contentWindow,
    }),
  );
}

describe("mountAmosCreditCardPaymentMethodForm skeleton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test("keeps the iframe at opacity 1 and its default height under the skeleton", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountAmosCreditCardPaymentMethodForm(host, {
      renderToken: RENDER_TOKEN,
    });

    const wrapper = host.querySelector("[aria-busy='true']") as HTMLElement;
    const skeleton = host.querySelector(
      ".amos-js-form-skeleton",
    ) as HTMLElement;
    expect(controller.iframe.style.opacity).toBe("1");
    expect(controller.iframe.style.height).toBe("212px");
    expect(controller.iframe.height).toBe("212");
    expect(controller.iframe.width).toMatch(/^\d+$/);
    expect(Number(controller.iframe.width)).toBeGreaterThan(0);
    expect(controller.iframe.style.width).toBe(`${controller.iframe.width}px`);
    expect(controller.iframe.style.visibility).not.toBe("hidden");
    expect(controller.iframe.getAttribute("role")).toBeNull();
    expect(controller.iframe.title).toBe(
      "Secure credit card payment method form powered by Amos",
    );
    expect(controller.iframe.getAttribute("sandbox")).toBe(
      PAYMENT_IFRAME_SANDBOX,
    );
    expect(controller.iframe.allow).toBe("");
    expect(controller.iframe.inert).toBe(true);
    expect(controller.iframe.style.pointerEvents).toBe("none");
    expect(wrapper).not.toBeNull();
    expect(wrapper.style.overflow).toBe("hidden");
    expect(wrapper.style.width).toBe("100%");
    expect(wrapper.style.margin).toBe("");
    expect(skeleton).not.toBeNull();
    expect(skeleton.style.width).toBe("");
    expect(skeleton.style.margin).toBe("");

    controller.destroy();
  });

  test("stays covered until the handshake starts, then reveals 1.5s later if appearance never acks", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountAmosCreditCardPaymentMethodForm(host, {
      renderToken: RENDER_TOKEN,
    });

    await vi.advanceTimersByTimeAsync(SKELETON_REVEAL_TIMEOUT_MS);
    expect(host.querySelector(".amos-js-form-skeleton")).not.toBeNull();

    postFromIframe(controller.iframe, { type: "IFRAME_READY" });
    await vi.advanceTimersByTimeAsync(SKELETON_REVEAL_TIMEOUT_MS - 1);
    expect(host.querySelector(".amos-js-form-skeleton")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(host.querySelector(".amos-js-form-skeleton")).toBeNull();
    expect(controller.iframe.style.opacity).toBe("1");
    expect(controller.iframe.style.width).toMatch(/^\d+px$/);
    expect(controller.iframe.width).toBe(
      controller.iframe.style.width.replace("px", ""),
    );
    expect(controller.iframe.inert).toBe(false);
    expect(controller.iframe.style.pointerEvents).toBe("");
    expect((host.firstElementChild as HTMLElement).style.overflow).toBe("");
    expect((host.firstElementChild as HTMLElement).style.width).toBe("100%");
    expect(host.querySelector("[aria-busy='true']")).toBeNull();

    controller.destroy();
  });

  test("reveals when the handshake completes and cancels the timer", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountAmosCreditCardPaymentMethodForm(host, {
      renderToken: RENDER_TOKEN,
    });

    postFromIframe(controller.iframe, { type: "IFRAME_READY" });
    await vi.advanceTimersByTimeAsync(100);
    expect(host.querySelector(".amos-js-form-skeleton")).not.toBeNull();

    postFromIframe(controller.iframe, { type: "UPDATED_APPEARANCE" });

    expect(host.querySelector(".amos-js-form-skeleton")).toBeNull();
    expect(controller.iframe.style.opacity).toBe("1");
    expect(controller.iframe.style.width).toMatch(/^\d+px$/);
    expect(controller.iframe.width).toBe(
      controller.iframe.style.width.replace("px", ""),
    );
    expect(controller.iframe.inert).toBe(false);
    expect(controller.iframe.style.pointerEvents).toBe("");
    expect((host.firstElementChild as HTMLElement).style.overflow).toBe("");
    expect((host.firstElementChild as HTMLElement).style.width).toBe("100%");

    await vi.advanceTimersByTimeAsync(SKELETON_REVEAL_TIMEOUT_MS);
    expect(controller.iframe.style.opacity).toBe("1");
    expect(host.querySelector(".amos-js-form-skeleton")).toBeNull();

    controller.destroy();
  });
});

describe("mountAmosGooglePayButton skeleton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test("reveals 1.5s after the handshake starts, or sooner when appearance acks", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const waiting = mountAmosGooglePayButton(host, {
      renderToken: RENDER_TOKEN,
      amount: "10.00",
      merchantName: "Amos",
      onConfirm: () => Promise.resolve({ status: "failed" }),
    });

    await vi.advanceTimersByTimeAsync(SKELETON_REVEAL_TIMEOUT_MS);
    expect(host.querySelector(".amos-js-wallet-skeleton")).not.toBeNull();

    postFromIframe(waiting.iframe, { type: "IFRAME_READY" });
    await vi.advanceTimersByTimeAsync(SKELETON_REVEAL_TIMEOUT_MS);
    expect(host.querySelector(".amos-js-wallet-skeleton")).toBeNull();
    waiting.destroy();

    host.replaceChildren();
    const early = mountAmosGooglePayButton(host, {
      renderToken: RENDER_TOKEN,
      amount: "10.00",
      merchantName: "Amos",
      onConfirm: () => Promise.resolve({ status: "failed" }),
    });
    postFromIframe(early.iframe, { type: "IFRAME_READY" });
    postFromIframe(early.iframe, { type: "UPDATED_APPEARANCE" });
    expect(host.querySelector(".amos-js-wallet-skeleton")).toBeNull();
    await vi.advanceTimersByTimeAsync(SKELETON_REVEAL_TIMEOUT_MS);
    expect(early.iframe.inert).toBe(false);
    early.destroy();
  });
});

describe("mountAmosExternalBankAccountForm", () => {
  test("mounts the intent iframe under a skeleton with the Plaid panel beside it", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountAmosExternalBankAccountForm(host, {
      renderToken: RENDER_TOKEN,
      intentId: "ebai_123",
    });

    const src = new URL(controller.iframe.src);
    expect(`${src.origin}${src.pathname}`).toBe(
      "https://js-sandbox.amos.com/iframe/external-bank-account",
    );
    expect(src.searchParams.get("token")).toBe(RENDER_TOKEN);
    expect(controller.iframe.getAttribute("sandbox")).toBe(
      PAYMENT_IFRAME_SANDBOX,
    );
    expect(host.querySelector(".amos-js-form-skeleton")).not.toBeNull();
    expect(
      host.querySelector("[data-amos-external-bank-account-panel]"),
    ).not.toBeNull();

    controller.destroy();
    expect(host.childElementCount).toBe(0);
  });
});

describe("mountAmosGooglePayButton sandbox", () => {
  test("allows the payment sheet popup to leave the sandbox", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountAmosGooglePayButton(host, {
      renderToken: RENDER_TOKEN,
      amount: "10.00",
      merchantName: "Amos",
      onConfirm: () => Promise.resolve({ status: "failed" }),
    });

    expect(controller.iframe.getAttribute("sandbox")).toBe(
      WALLET_IFRAME_SANDBOX,
    );
    expect(controller.iframe.allow).toBe("payment");

    controller.destroy();
  });
});
