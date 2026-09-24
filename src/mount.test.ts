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

const EMBED_ORIGIN = "https://js-sandbox.amos.com";

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
      origin: EMBED_ORIGIN,
      source: iframe.contentWindow,
    }),
  );
}

describe("mountAmosCreditCardPaymentMethodForm skeleton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test("keeps the iframe at opacity 0 and its default height under the skeleton", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountAmosCreditCardPaymentMethodForm(host, {
      renderToken: RENDER_TOKEN,
    });

    expect(controller.iframe.style.opacity).toBe("0");
    expect(controller.iframe.style.height).toBe("212px");
    expect(controller.iframe.style.visibility).not.toBe("hidden");
    expect(controller.iframe.style.pointerEvents).toBe("none");
    expect(host.querySelector(".amos-js-form-skeleton")).not.toBeNull();
    expect(host.querySelector("[aria-busy='true']")).not.toBeNull();

    controller.destroy();
  });

  test("reveals 1.5s after mount if appearance never acks", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountAmosCreditCardPaymentMethodForm(host, {
      renderToken: RENDER_TOKEN,
    });

    await vi.advanceTimersByTimeAsync(SKELETON_REVEAL_TIMEOUT_MS - 1);
    expect(host.querySelector(".amos-js-form-skeleton")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(host.querySelector(".amos-js-form-skeleton")).toBeNull();
    expect(controller.iframe.style.opacity).toBe("1");
    expect(controller.iframe.style.pointerEvents).toBe("");
    expect(host.querySelector("[aria-busy='true']")).toBeNull();

    controller.destroy();
  });

  test("reveals immediately when appearance acks and cancels the timer", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountAmosCreditCardPaymentMethodForm(host, {
      renderToken: RENDER_TOKEN,
    });

    postFromIframe(controller.iframe, { type: "UPDATED_APPEARANCE" });

    expect(host.querySelector(".amos-js-form-skeleton")).toBeNull();
    expect(controller.iframe.style.opacity).toBe("1");
    expect(controller.iframe.style.pointerEvents).toBe("");

    await vi.advanceTimersByTimeAsync(SKELETON_REVEAL_TIMEOUT_MS);
    expect(controller.iframe.style.opacity).toBe("1");
    expect(host.querySelector(".amos-js-form-skeleton")).toBeNull();

    controller.destroy();
  });
});
