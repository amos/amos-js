import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { attachPlaidBankUi } from "./plaid-bank-ui";
import { createMessage } from "./types";

const { destroyLink, mountPlaidEmbeddedLink } = vi.hoisted(() => {
  const destroyLink = vi.fn();
  const mountPlaidEmbeddedLink = vi.fn(
    async ({
      onLoad,
      signal,
    }: {
      onLoad?: () => void;
      signal?: AbortSignal;
    }) => {
      if (signal?.aborted) {
        return () => {};
      }
      onLoad?.();
      return destroyLink;
    },
  );
  return { destroyLink, mountPlaidEmbeddedLink };
});

vi.mock("./messaging", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./messaging")>();
  return {
    ...actual,
    requestPlaidLinkToken: vi.fn(async () => "link-sandbox-token"),
  };
});

vi.mock("./plaid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./plaid")>();
  return {
    ...actual,
    mountPlaidEmbeddedLink,
  };
});

function unsignedJwt(payload: object): string {
  const encode = (value: object) => btoa(JSON.stringify(value));
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.sig`;
}

function mountHost(): {
  host: HTMLElement;
  iframe: HTMLIFrameElement;
  panel: () => HTMLElement | null;
} {
  const host = document.createElement("div");
  const wrap = document.createElement("div");
  const iframe = document.createElement("iframe");
  iframe.src = `${location.origin}/`;
  wrap.append(iframe);
  host.append(wrap);
  document.body.append(host);
  return {
    host,
    iframe,
    panel: () => host.querySelector<HTMLElement>("[data-amos-plaid-panel]"),
  };
}

function signalIframeReady(iframe: HTMLIFrameElement): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: createMessage({ type: "IFRAME_READY" }),
      source: iframe.contentWindow,
    }),
  );
}

describe("attachPlaidBankUi requireAchVerification", () => {
  beforeEach(() => {
    destroyLink.mockClear();
    mountPlaidEmbeddedLink.mockClear();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  test("toggling requireAchVerification hides Link without destroying it", async () => {
    const { host, iframe, panel } = mountHost();
    const ui = attachPlaidBankUi({
      host,
      iframe,
      options: {
        renderToken: unsignedJwt({}),
        requireAchVerification: true,
      },
    });

    signalIframeReady(iframe);
    await vi.waitFor(() => {
      expect(mountPlaidEmbeddedLink).toHaveBeenCalledTimes(1);
    });
    expect(panel()?.dataset["mode"]).toBe("embed");

    ui.update({ requireAchVerification: false });
    expect(destroyLink).not.toHaveBeenCalled();
    expect(panel()?.dataset["mode"]).toBe("hidden");
    expect(mountPlaidEmbeddedLink).toHaveBeenCalledTimes(1);

    ui.update({ requireAchVerification: true });
    expect(destroyLink).not.toHaveBeenCalled();
    expect(panel()?.dataset["mode"]).toBe("embed");
    expect(mountPlaidEmbeddedLink).toHaveBeenCalledTimes(1);

    ui.destroy();
    expect(destroyLink).toHaveBeenCalledTimes(1);
  });
});
