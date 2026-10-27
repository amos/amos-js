import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  attachExternalBankAccountUi,
  confirmExternalBankAccountIntent,
  type ExternalBankAccountStateEvent,
  refreshExternalBankAccountIntent,
} from "./external-bank-account";
import type { PlaidLinkOnSuccessMetadata } from "./plaid";
import { CONFIRM_TIMEOUT_MS, createMessage, type Message } from "./types";

type PlaidCallbacks = {
  token: string;
  onSuccess: (
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata,
  ) => void;
  onExit?: (error: { error_code?: string } | null) => void;
};

const { destroyLink, mountPlaidEmbeddedLink, openPlaidPopupLink } = vi.hoisted(
  () => {
    const destroyLink = vi.fn();
    const mountPlaidEmbeddedLink = vi.fn(
      async (input: PlaidCallbacks & { onLoad?: () => void }) => {
        input.onLoad?.();
        return destroyLink;
      },
    );
    const openPlaidPopupLink = vi.fn(async (_input: PlaidCallbacks) => vi.fn());
    return { destroyLink, mountPlaidEmbeddedLink, openPlaidPopupLink };
  },
);

vi.mock("./plaid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./plaid")>();
  return { ...actual, mountPlaidEmbeddedLink, openPlaidPopupLink };
});

const INTENT_ID = "ebai_123";

const METADATA = {
  institution: { name: "Chase" },
  accounts: [{ id: "acc_1", mask: "6789" }],
} as PlaidLinkOnSuccessMetadata;

function setup() {
  const host = document.createElement("div");
  const iframe = document.createElement("iframe");
  iframe.src = `${location.origin}/`;
  host.append(iframe);
  document.body.append(host);

  const posted: Array<Message> = [];
  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    throw new Error("iframe has no window");
  }
  vi.spyOn(frameWindow, "postMessage").mockImplementation(
    (message: unknown) => {
      posted.push(message as Message);
    },
  );

  const onStateChange = vi.fn<(event: ExternalBankAccountStateEvent) => void>();
  const onValidityChange = vi.fn<(event: { isValid: boolean }) => void>();
  const ui = attachExternalBankAccountUi({
    host,
    iframe,
    options: { intentId: INTENT_ID, onStateChange, onValidityChange },
  });

  function fromIframe(message: Message): void {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: createMessage(message),
        origin: location.origin,
        source: iframe.contentWindow,
      }),
    );
  }

  return {
    host,
    iframe,
    ui,
    posted,
    onStateChange,
    onValidityChange,
    fromIframe,
    panel: () =>
      host.querySelector<HTMLElement>(
        "[data-amos-external-bank-account-panel]",
      ),
    lastValidity: () => onValidityChange.mock.lastCall?.[0].isValid,
    confirms: () =>
      posted.filter(
        (
          message,
        ): message is Extract<
          Message,
          { type: "CONFIRM_EXTERNAL_BANK_ACCOUNT_INTENT" }
        > => message.type === "CONFIRM_EXTERNAL_BANK_ACCOUNT_INTENT",
      ),
    state: (screen: ExternalBankAccountStateEvent["screen"]) =>
      fromIframe({
        type: "EXTERNAL_BANK_ACCOUNT_STATE",
        intentId: INTENT_ID,
        screen,
        institutionName: null,
        mask: null,
      }),
    linkToken: (linkToken: string, mode: "new" | "update") =>
      fromIframe({
        type: "EXTERNAL_BANK_ACCOUNT_LINK_TOKEN",
        intentId: INTENT_ID,
        linkToken,
        mode,
      }),
    holder: (isValid: boolean) =>
      fromIframe({ type: "FORM_VALIDITY_CHANGE", isValid }),
    result: (
      result: Extract<
        Message,
        { type: "EXTERNAL_BANK_ACCOUNT_INTENT_RESULT" }
      >["result"],
    ) =>
      fromIframe({
        type: "EXTERNAL_BANK_ACCOUNT_INTENT_RESULT",
        intentId: INTENT_ID,
        result,
      }),
  };
}

async function linkBank(form: ReturnType<typeof setup>): Promise<void> {
  form.state("connect");
  form.linkToken("link-new-1", "new");
  await vi.waitFor(() => {
    expect(mountPlaidEmbeddedLink).toHaveBeenCalled();
  });
  mountPlaidEmbeddedLink.mock.lastCall?.[0].onSuccess("public-1", METADATA);
}

describe("attachExternalBankAccountUi", () => {
  beforeEach(() => {
    destroyLink.mockClear();
    mountPlaidEmbeddedLink.mockClear();
    openPlaidPopupLink.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  test("sends the intent once per iframe load", () => {
    const form = setup();
    const intentRequests = () =>
      form.posted.filter((m) => m.type === "EXTERNAL_BANK_ACCOUNT_INTENT");

    form.fromIframe({ type: "IFRAME_READY" });
    form.fromIframe({ type: "IFRAME_READY" });
    expect(intentRequests()).toEqual([
      { type: "EXTERNAL_BANK_ACCOUNT_INTENT", intentId: INTENT_ID },
    ]);

    form.iframe.dispatchEvent(new Event("load"));
    form.fromIframe({ type: "IFRAME_READY" });
    expect(intentRequests()).toHaveLength(2);
  });

  test("refresh asks the iframe to read the intent again", () => {
    const form = setup();
    refreshExternalBankAccountIntent({ iframe: form.iframe });
    expect(form.posted).toEqual([
      { type: "EXTERNAL_BANK_ACCOUNT_INTENT", intentId: INTENT_ID },
    ]);
    form.ui.destroy();
    refreshExternalBankAccountIntent({ iframe: form.iframe });
    expect(form.posted).toHaveLength(1);
  });

  test("reports state and ignores other intents", () => {
    const form = setup();
    form.fromIframe({
      type: "EXTERNAL_BANK_ACCOUNT_STATE",
      intentId: "ebai_other",
      screen: "done",
      institutionName: null,
      mask: null,
    });
    expect(form.onStateChange).not.toHaveBeenCalled();

    form.fromIframe({
      type: "EXTERNAL_BANK_ACCOUNT_STATE",
      intentId: INTENT_ID,
      screen: "done",
      institutionName: "Chase",
      mask: "6789",
    });
    expect(form.onStateChange).toHaveBeenCalledWith({
      screen: "done",
      institutionName: "Chase",
      mask: "6789",
    });
    expect(form.panel()?.dataset["mode"]).toBe("hidden");
  });

  test("a first link is valid once a bank is picked and the holder is filled in", async () => {
    const form = setup();
    form.state("connect");
    form.linkToken("link-new-1", "new");
    await vi.waitFor(() => {
      expect(mountPlaidEmbeddedLink).toHaveBeenCalledTimes(1);
    });
    expect(mountPlaidEmbeddedLink.mock.lastCall?.[0].token).toBe("link-new-1");
    expect(form.panel()?.dataset["mode"]).toBe("embed");

    form.holder(true);
    expect(form.lastValidity()).toBe(false);

    mountPlaidEmbeddedLink.mock.lastCall?.[0].onSuccess("public-1", METADATA);
    expect(form.panel()?.dataset["mode"]).toBe("linked");
    expect(form.panel()?.textContent).toContain("Chase");
    expect(form.panel()?.textContent).toContain("****6789");
    expect(form.lastValidity()).toBe(true);

    form.holder(false);
    expect(form.lastValidity()).toBe(false);
  });

  test("Disconnect asks the iframe for a fresh Link token", async () => {
    const form = setup();
    await linkBank(form);
    form.posted.length = 0;

    form
      .panel()
      ?.querySelector<HTMLButtonElement>(
        "[aria-label='Disconnect bank account']",
      )
      ?.click();

    expect(form.panel()?.dataset["mode"]).toBe("embed");
    expect(form.posted).toEqual([
      { type: "EXTERNAL_BANK_ACCOUNT_INTENT", intentId: INTENT_ID },
    ]);
    form.linkToken("link-new-2", "new");
    await vi.waitFor(() => {
      expect(mountPlaidEmbeddedLink.mock.lastCall?.[0].token).toBe(
        "link-new-2",
      );
    });
  });

  test("an invalid Link token is replaced a limited number of times", async () => {
    const form = setup();
    form.state("connect");
    for (const token of ["link-a", "link-b", "link-c"]) {
      form.linkToken(token, "new");
      await vi.waitFor(() => {
        expect(mountPlaidEmbeddedLink.mock.lastCall?.[0].token).toBe(token);
      });
      mountPlaidEmbeddedLink.mock.lastCall?.[0].onExit?.({
        error_code: "INVALID_LINK_TOKEN",
      });
    }
    const intentRequests = form.posted.filter(
      (m) => m.type === "EXTERNAL_BANK_ACCOUNT_INTENT",
    );
    expect(intentRequests).toHaveLength(2);
    expect(form.panel()?.textContent).toContain("Could not connect bank.");
  });

  test("micro-deposit codes go through Link's overlay in update mode", async () => {
    const form = setup();
    form.holder(true);
    form.state("code");
    expect(form.panel()?.dataset["mode"]).toBe("update");
    const button = form
      .panel()
      ?.querySelector<HTMLButtonElement>(".amos-js-plaid-update");
    expect(button?.disabled).toBe(true);

    form.linkToken("link-update-1", "update");
    expect(button?.disabled).toBe(false);
    expect(mountPlaidEmbeddedLink).not.toHaveBeenCalled();
    expect(form.lastValidity()).toBe(false);

    button?.click();
    button?.click();
    expect(openPlaidPopupLink).toHaveBeenCalledTimes(1);
    expect(openPlaidPopupLink.mock.lastCall?.[0].token).toBe("link-update-1");

    openPlaidPopupLink.mock.lastCall?.[0].onSuccess("ignored", METADATA);
    expect(form.panel()?.dataset["mode"]).toBe("hidden");
    expect(form.lastValidity()).toBe(true);
  });

  test("a verified account only needs the holder", () => {
    const form = setup();
    form.state("finish");
    expect(form.lastValidity()).toBe(false);
    form.holder(true);
    expect(form.lastValidity()).toBe(true);
    expect(mountPlaidEmbeddedLink).not.toHaveBeenCalled();
  });

  test("destroy tears down Link and unregisters the form", async () => {
    const form = setup();
    form.state("connect");
    form.linkToken("link-new-1", "new");
    await vi.waitFor(() => {
      expect(mountPlaidEmbeddedLink).toHaveBeenCalledTimes(1);
    });
    form.ui.destroy();
    expect(destroyLink).toHaveBeenCalled();
    expect(form.panel()).toBeNull();
    await expect(
      confirmExternalBankAccountIntent({ iframe: form.iframe, token: "t" }),
    ).resolves.toMatchObject({ status: "failed", reason: "unknown" });
  });
});

describe("confirmExternalBankAccountIntent", () => {
  beforeEach(() => {
    mountPlaidEmbeddedLink.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  test("fails without a mounted form", async () => {
    await expect(
      confirmExternalBankAccountIntent({ iframe: null, token: "t" }),
    ).resolves.toEqual({
      status: "failed",
      reason: "unknown",
      retryable: false,
      error: "The external bank account form is not mounted.",
    });
  });

  test("sends the picked bank on a first link and resolves with the result", async () => {
    const form = setup();
    await linkBank(form);

    const pending = confirmExternalBankAccountIntent({
      iframe: form.iframe,
      token: "embed-token",
      metadata: { order: "1" },
    });
    const [confirm] = form.confirms();
    expect(confirm).toMatchObject({
      intentId: INTENT_ID,
      token: "embed-token",
      plaid: { public_token: "public-1", account_id: "acc_1" },
      metadata: { order: "1" },
    });
    expect(confirm?.idempotencyKey).toEqual(expect.any(String));

    form.fromIframe({
      type: "EXTERNAL_BANK_ACCOUNT_INTENT_RESULT",
      intentId: "ebai_other",
      result: { status: "succeeded" },
    });
    form.result({ status: "succeeded", mask: "6789" });
    await expect(pending).resolves.toEqual({
      status: "succeeded",
      mask: "6789",
    });
  });

  test("omits plaid when the screen has no first link", async () => {
    const form = setup();
    form.state("finish");
    const pending = confirmExternalBankAccountIntent({
      iframe: form.iframe,
      token: "embed-token",
    });
    expect(form.confirms()[0]).not.toHaveProperty("plaid");
    form.result({ status: "succeeded" });
    await pending;
  });

  test("a timeout keeps the key for the retry; any other result drops it", async () => {
    vi.useFakeTimers();
    const form = setup();
    form.state("finish");

    const first = confirmExternalBankAccountIntent({
      iframe: form.iframe,
      token: "t1",
    });
    vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS);
    await expect(first).resolves.toEqual({
      status: "failed",
      reason: "timeout",
      retryable: true,
      error: "timeout",
    });

    const second = confirmExternalBankAccountIntent({
      iframe: form.iframe,
      token: "t2",
    });
    form.result({
      status: "failed",
      reason: "unauthorized",
      retryable: true,
    });
    await second;

    const third = confirmExternalBankAccountIntent({
      iframe: form.iframe,
      token: "t3",
    });
    form.result({ status: "succeeded" });
    await third;

    const [a, b, c] = form.confirms().map((m) => m.idempotencyKey);
    expect(b).toBe(a);
    expect(c).not.toBe(b);
  });

  test.each([
    { status: "succeeded" as const },
    {
      status: "requires_verification" as const,
      verificationStatus: "pending_manual_verification" as const,
    },
  ])(
    "a $status result drops the spent bank without reopening Link",
    async (result) => {
      const form = setup();
      form.holder(true);
      await linkBank(form);
      expect(form.lastValidity()).toBe(true);
      mountPlaidEmbeddedLink.mockClear();
      form.posted.length = 0;

      const pending = confirmExternalBankAccountIntent({
        iframe: form.iframe,
        token: "embed-token",
      });
      form.result(result);
      await expect(pending).resolves.toEqual(result);

      expect(form.panel()?.dataset["mode"]).toBe("hidden");
      expect(form.lastValidity()).toBe(false);
      expect(mountPlaidEmbeddedLink).not.toHaveBeenCalled();
      expect(
        form.posted.filter((m) => m.type === "EXTERNAL_BANK_ACCOUNT_INTENT"),
      ).toEqual([]);

      const retry = confirmExternalBankAccountIntent({
        iframe: form.iframe,
        token: "embed-token-2",
      });
      expect(form.confirms()[1]).not.toHaveProperty("plaid");
      form.result({ status: "succeeded" });
      await retry;
    },
  );

  test("a rejected first link drops the spent bank and mounts the next session", async () => {
    const form = setup();
    await linkBank(form);
    mountPlaidEmbeddedLink.mockClear();

    const pending = confirmExternalBankAccountIntent({
      iframe: form.iframe,
      token: "embed-token",
    });
    // The iframe posts the next Link session before the result.
    form.state("connect");
    form.linkToken("link-new-2", "new");
    expect(form.panel()?.dataset["mode"]).toBe("linked");
    form.result({
      status: "failed",
      reason: "rejected",
      retryable: true,
      error: "Plaid verification failed",
    });
    await pending;

    expect(form.panel()?.dataset["mode"]).toBe("embed");
    await vi.waitFor(() => {
      expect(mountPlaidEmbeddedLink.mock.lastCall?.[0].token).toBe(
        "link-new-2",
      );
    });

    const retry = confirmExternalBankAccountIntent({
      iframe: form.iframe,
      token: "embed-token-2",
    });
    expect(form.confirms()[1]).not.toHaveProperty("plaid");
    form.result({
      status: "failed",
      reason: "holder_required",
      retryable: true,
    });
    await retry;
  });
});
