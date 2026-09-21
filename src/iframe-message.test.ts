import { afterEach, describe, expect, test } from "vitest";
import {
  iframeNameFromMessage,
  isMessageFromEmbedIframe,
} from "./iframe-message";

function embedIframe(
  src = `${location.origin}/iframe/card`,
  name = "amos-credit-card-payment-method-form",
): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.name = name;
  document.body.append(iframe);
  return iframe;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("iframeNameFromMessage", () => {
  test("reads a non-empty iframeName", () => {
    expect(
      iframeNameFromMessage({
        iframeName: "amos-credit-card-payment-method-form",
      }),
    ).toBe("amos-credit-card-payment-method-form");
  });

  test("ignores missing or empty names", () => {
    expect(iframeNameFromMessage(undefined)).toBeUndefined();
    expect(iframeNameFromMessage({ type: "IFRAME_READY" })).toBeUndefined();
    expect(iframeNameFromMessage({ iframeName: "" })).toBeUndefined();
    expect(iframeNameFromMessage({ iframeName: 1 })).toBeUndefined();
  });
});

describe("isMessageFromEmbedIframe", () => {
  test("accepts a matching contentWindow even without iframeName", () => {
    const iframe = embedIframe();
    const event = new MessageEvent("message", {
      data: { type: "IFRAME_READY" },
      origin: location.origin,
      source: iframe.contentWindow,
    });
    expect(isMessageFromEmbedIframe(event, iframe)).toBe(true);
  });

  test("rejects a sibling iframe that shares the embed origin", () => {
    const card = embedIframe(
      `${location.origin}/iframe/card`,
      "amos-credit-card-payment-method-form",
    );
    const bank = embedIframe(
      `${location.origin}/iframe/bank`,
      "amos-bank-account-payment-method-form",
    );
    const event = new MessageEvent("message", {
      data: {
        type: "IFRAME_READY",
        iframeName: "amos-bank-account-payment-method-form",
      },
      origin: location.origin,
      source: bank.contentWindow,
    });
    expect(isMessageFromEmbedIframe(event, card)).toBe(false);
    expect(isMessageFromEmbedIframe(event, bank)).toBe(true);
  });

  test("matches origin + iframeName when WindowProxy identity disagrees", () => {
    const iframe = embedIframe();
    const foreign = window;
    const event = new MessageEvent("message", {
      data: {
        type: "UPDATED_APPEARANCE",
        iframeName: "amos-credit-card-payment-method-form",
      },
      origin: location.origin,
      source: foreign,
    });
    expect(event.source === iframe.contentWindow).toBe(false);
    expect(isMessageFromEmbedIframe(event, iframe)).toBe(true);
  });

  test("does not origin-match a nameless message from a foreign source", () => {
    const iframe = embedIframe();
    const event = new MessageEvent("message", {
      data: { type: "IFRAME_READY" },
      origin: location.origin,
      source: window,
    });
    expect(isMessageFromEmbedIframe(event, iframe)).toBe(false);
  });

  test("rejects a matching contentWindow from a foreign origin", () => {
    const iframe = embedIframe();
    const event = new MessageEvent("message", {
      data: { type: "IFRAME_READY" },
      origin: "https://evil.test",
      source: iframe.contentWindow,
    });
    expect(isMessageFromEmbedIframe(event, iframe)).toBe(false);
  });

  test("rejects a foreign origin even with a matching name", () => {
    const iframe = embedIframe();
    const event = new MessageEvent("message", {
      data: {
        type: "IFRAME_READY",
        iframeName: "amos-credit-card-payment-method-form",
      },
      origin: "https://evil.test",
      source: window,
    });
    expect(isMessageFromEmbedIframe(event, iframe)).toBe(false);
  });
});
