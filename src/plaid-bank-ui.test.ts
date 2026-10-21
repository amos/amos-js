import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  registerPlaidBankVerification,
  requestPlaidLinkToken,
} from "./messaging";
import type { PlaidLinkOnSuccessMetadata } from "./plaid";
import { attachPlaidBankUi } from "./plaid-bank-ui";
import { createMessage } from "./types";

type MountHandlers = {
  onLoad?: () => void;
  onSuccess?: (
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata,
  ) => void;
  signal?: AbortSignal;
};

const { destroyLink, mountPlaidEmbeddedLink, lastMount } = vi.hoisted(() => {
  const destroyLink = vi.fn();
  const lastMount: { current?: MountHandlers } = {};
  const mountPlaidEmbeddedLink = vi.fn(async (config: MountHandlers) => {
    lastMount.current = config;
    if (config.signal?.aborted) {
      return () => {};
    }
    config.onLoad?.();
    return destroyLink;
  });
  return { destroyLink, mountPlaidEmbeddedLink, lastMount };
});

vi.mock("./messaging", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./messaging")>();
  return {
    ...actual,
    requestPlaidLinkToken: vi.fn(async () => "link-sandbox-token"),
    registerPlaidBankVerification: vi.fn(async () => ({
      id: "ver_123",
      status: "pending_manual_verification",
    })),
    refreshPlaidBankVerification: vi.fn(async () => ({
      id: "ver_123",
      status: "pending_manual_verification",
      institutionName: "Synovus",
      mask: "1234",
    })),
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
      origin: location.origin,
      source: iframe.contentWindow,
    }),
  );
}

describe("attachPlaidBankUi requireAchVerification", () => {
  beforeEach(() => {
    destroyLink.mockClear();
    mountPlaidEmbeddedLink.mockClear();
    lastMount.current = undefined;
    vi.mocked(registerPlaidBankVerification).mockClear();
    vi.mocked(requestPlaidLinkToken).mockClear();
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

  test("pending micro-deposit success is not a valid bank", async () => {
    const { host, iframe, panel } = mountHost();
    const onValidityChange = vi.fn();
    const ui = attachPlaidBankUi({
      host,
      iframe,
      options: {
        renderToken: unsignedJwt({}),
        requireAchVerification: true,
        onValidityChange,
      },
    });

    signalIframeReady(iframe);
    await vi.waitFor(() => {
      expect(lastMount.current?.onSuccess).toBeTypeOf("function");
    });

    lastMount.current?.onSuccess?.("public-sandbox", {
      institution: { name: "Synovus" },
      account_id: "acc_123",
      accounts: [
        {
          id: "acc_123",
          mask: "1234",
          verification_status: "pending_manual_verification",
        },
      ],
    });

    await vi.waitFor(() => {
      expect(registerPlaidBankVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          publicToken: "public-sandbox",
          accountId: "acc_123",
          verificationStatus: "pending_manual_verification",
        }),
      );
    });
    expect(panel()?.dataset["mode"]).toBe("pending");
    expect(onValidityChange).toHaveBeenCalledWith({
      isValid: false,
      bankVerification: {
        id: "ver_123",
        status: "pending_manual_verification",
      },
    });
    expect(onValidityChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ isValid: true }),
    );

    ui.destroy();
  });

  test("verification_failed shows an error and stays invalid", async () => {
    const { host, iframe, panel } = mountHost();
    const onValidityChange = vi.fn();
    const ui = attachPlaidBankUi({
      host,
      iframe,
      options: {
        renderToken: unsignedJwt({}),
        requireAchVerification: true,
        onValidityChange,
      },
    });

    signalIframeReady(iframe);
    await vi.waitFor(() => {
      expect(lastMount.current?.onSuccess).toBeTypeOf("function");
    });

    lastMount.current?.onSuccess?.("public-sandbox", {
      account_id: "acc_123",
      accounts: [{ id: "acc_123", verification_status: "verification_failed" }],
    });

    await vi.waitFor(() => {
      expect(
        panel()?.querySelector(".amos-js-plaid-error")?.textContent,
      ).toMatch(/failed/i);
    });
    expect(registerPlaidBankVerification).not.toHaveBeenCalled();
    expect(onValidityChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ isValid: true }),
    );

    ui.destroy();
  });

  test("plaidVerificationId requests an update-mode token for manual verification", async () => {
    const { host, iframe } = mountHost();
    const ui = attachPlaidBankUi({
      host,
      iframe,
      options: {
        renderToken: unsignedJwt({}),
        requireAchVerification: true,
        plaidVerificationId: "ver_saved",
      },
    });

    signalIframeReady(iframe);
    await vi.waitFor(() => {
      expect(requestPlaidLinkToken).toHaveBeenCalledWith(
        expect.objectContaining({ plaidBankVerificationId: "ver_saved" }),
      );
    });

    ui.destroy();
  });
});
