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
    expect(controller.iframe.style.visibility).not.toBe("hidden");
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
    expect(controller.iframe.style.width).toBe("calc(100% + 8px)");
    expect(controller.iframe.inert).toBe(false);
    expect(controller.iframe.style.pointerEvents).toBe("");
    expect((host.firstElementChild as HTMLElement).style.overflow).toBe("");
    expect((host.firstElementChild as HTMLElement).style.width).toBe("100%");
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
    expect(controller.iframe.style.width).toBe("calc(100% + 8px)");
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
