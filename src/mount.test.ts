import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  mountAmosCreditCardPaymentMethodForm,
  SKELETON_REVEAL_TIMEOUT_MS,
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

describe("mountAmosCreditCardPaymentMethodForm skeleton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test("keeps the iframe opaque under the skeleton so WebKit can run JS", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountAmosCreditCardPaymentMethodForm(host, {
      renderToken: RENDER_TOKEN,
    });

    expect(controller.iframe.style.opacity).toBe("1");
    expect(controller.iframe.style.pointerEvents).toBe("none");
    expect(host.querySelector(".amos-js-form-skeleton")).not.toBeNull();
    expect(host.querySelector("[aria-busy='true']")).not.toBeNull();

    controller.destroy();
  });

  test("keeps the skeleton until IFRAME_READY, then reveals if appearance never acks", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountAmosCreditCardPaymentMethodForm(host, {
      renderToken: RENDER_TOKEN,
    });

    await vi.advanceTimersByTimeAsync(SKELETON_REVEAL_TIMEOUT_MS);
    expect(host.querySelector(".amos-js-form-skeleton")).not.toBeNull();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "IFRAME_READY" },
        origin: "https://js-sandbox.amos.com",
        source: controller.iframe.contentWindow,
      }),
    );

    await vi.advanceTimersByTimeAsync(SKELETON_REVEAL_TIMEOUT_MS - 1);
    expect(host.querySelector(".amos-js-form-skeleton")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(host.querySelector(".amos-js-form-skeleton")).toBeNull();
    expect(controller.iframe.style.pointerEvents).toBe("");
    expect(host.querySelector("[aria-busy='true']")).toBeNull();

    controller.destroy();
  });
});
