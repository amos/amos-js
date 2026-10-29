import { createAbortController } from "./abort-controller";
import { embedIframeSearchParams } from "./embed-src";
import { isMessageFromEmbedIframe } from "./iframe-message";
import { getEmbedOrigin } from "./jwt";
import { getIframeTargetOrigin } from "./messaging";
import {
  linkedBankLabelFromMetadata,
  mountPlaidEmbeddedLink,
  openPlaidPopupLink,
  type PlaidCredentials,
  plaidAccountIdFromMetadata,
} from "./plaid";
import {
  applyTheme,
  createBuildingIcon,
  ensurePlaidBankUiStyles,
} from "./plaid-bank-ui";
import { randomRequestId } from "./random-id";
import {
  type Appearance,
  CONFIRM_TIMEOUT_MS,
  createMessage,
  type ExternalBankAccountConfirmResult,
  type ExternalBankAccountLinkMode,
  type ExternalBankAccountScreen,
  type Message,
} from "./types";

/** Stops a stale-token exit / re-request cycle from looping forever. */
const MAX_INVALID_TOKEN_REFRESHES = 2;

/** Same fallback as the bank form: reveal if Plaid never calls onLoad. */
const PLAID_SKELETON_FALLBACK_MS = 1500;

const TIMEOUT_RESULT: ExternalBankAccountConfirmResult = {
  status: "failed",
  reason: "timeout",
  retryable: true,
  error: "timeout",
};

/** What the form shows, reported through `onStateChange`. */
export type ExternalBankAccountStateEvent = {
  screen: ExternalBankAccountScreen;
  institutionName: string | null;
  mask: string | null;
  error?: string;
};

export type ExternalBankAccountUiOptions = {
  intentId: string;
  appearance?: Appearance;
  /**
   * Mint an embed token for the intent with your server's
   * `POST /external_bank_account_intents/:id/embed_token`. Called before each
   * call the iframe makes, because the token expires within seconds.
   */
  getEmbedToken: (intentId: string) => Promise<string>;
  onStateChange?: (event: ExternalBankAccountStateEvent) => void;
  onValidityChange?: (event: { isValid: boolean }) => void;
};

type ExternalBankAccountSession = {
  intentId: string;
  screen: () => ExternalBankAccountScreen | undefined;
  plaid: () => PlaidCredentials | undefined;
  /** Kept only after a timeout, so the retry replays the same request. */
  retryKey?: string;
  onResult: (result: ExternalBankAccountConfirmResult) => void;
  refresh: () => void;
};

const sessions = new WeakMap<HTMLIFrameElement, ExternalBankAccountSession>();

export function getExternalBankAccountFormSrc(renderToken: string): string {
  const params = embedIframeSearchParams({ token: renderToken });
  return `${getEmbedOrigin(renderToken)}/iframe/external-bank-account?${params.toString()}`;
}

/**
 * Host-page half of the external bank account form. The iframe owns the
 * intent and the account holder; this side runs Plaid Link, which cannot
 * run inside the sandboxed iframe, and combines both into one validity.
 */
export function attachExternalBankAccountUi({
  host,
  iframe,
  options,
}: {
  host: HTMLElement;
  iframe: HTMLIFrameElement;
  options: ExternalBankAccountUiOptions;
}): {
  update: (
    patch: Partial<Omit<ExternalBankAccountUiOptions, "intentId">>,
  ) => void;
  refresh: () => void;
  destroy: () => void;
} {
  ensurePlaidBankUiStyles();

  const current = { ...options };
  const appliedThemeKeys: Array<string> = [];
  const abort = createAbortController();
  let intentRequested = false;
  let holderValid = false;
  let screen: ExternalBankAccountScreen | undefined;
  let link:
    | { token: string; mode: ExternalBankAccountLinkMode; used: boolean }
    | undefined;
  let linked:
    | { credentials: PlaidCredentials; bankName: string; last4: string }
    | undefined;
  let updateDone = false;
  let invalidTokenRefreshes = 0;
  let mountGeneration = 0;
  let mounting = false;
  let destroyLink: (() => void) | undefined;
  let destroyPopup: (() => void) | undefined;
  let popupOpen = false;
  let fallbackRevealTimer: ReturnType<typeof setTimeout> | undefined;
  let lastEmittedValid: boolean | undefined;

  const panel = document.createElement("div");
  panel.className = "amos-js-plaid-panel";
  panel.setAttribute("data-amos-external-bank-account-panel", "true");
  panel.dataset["mode"] = "hidden";
  panel.setAttribute("aria-hidden", "true");
  applyTheme(panel, current.appearance, appliedThemeKeys);

  const embedEl = document.createElement("div");
  embedEl.className = "amos-js-plaid-embed";
  embedEl.setAttribute("data-testid", "amos-plaid-embed");
  embedEl.setAttribute("aria-busy", "true");
  const targetEl = document.createElement("div");
  targetEl.className = "amos-js-plaid-embed-target";
  const skeletonEl = document.createElement("div");
  skeletonEl.className = "amos-js-plaid-skeleton";
  skeletonEl.setAttribute("aria-hidden", "true");
  const skeletonFill = document.createElement("div");
  skeletonFill.className = "amos-js-plaid-skeleton-fill";
  skeletonEl.append(skeletonFill);
  embedEl.append(targetEl, skeletonEl);

  const linkedEl = document.createElement("div");
  linkedEl.className = "amos-js-plaid-linked";
  const linkedMark = document.createElement("div");
  linkedMark.className = "amos-js-plaid-linked-mark";
  linkedMark.setAttribute("aria-hidden", "true");
  linkedMark.append(createBuildingIcon());
  const linkedCopy = document.createElement("div");
  linkedCopy.className = "amos-js-plaid-linked-copy";
  const linkedName = document.createElement("span");
  linkedName.className = "amos-js-plaid-linked-name";
  const linkedMeta = document.createElement("span");
  linkedMeta.className = "amos-js-plaid-linked-meta";
  linkedCopy.append(linkedName, linkedMeta);
  const disconnect = document.createElement("button");
  disconnect.type = "button";
  disconnect.className = "amos-js-plaid-disconnect";
  disconnect.textContent = "Disconnect";
  disconnect.setAttribute("aria-label", "Disconnect bank account");
  linkedEl.append(linkedMark, linkedCopy, disconnect);

  const updateButton = document.createElement("button");
  updateButton.type = "button";
  updateButton.className = "amos-js-plaid-disconnect amos-js-plaid-update";
  updateButton.textContent = "Enter verification code";

  const errorEl = document.createElement("p");
  errorEl.className = "amos-js-plaid-error";
  errorEl.setAttribute("role", "alert");

  panel.append(embedEl, linkedEl, updateButton, errorEl);
  host.append(panel);

  function setError(message: string | undefined): void {
    errorEl.textContent = message ?? "";
  }

  function setEmbedReady(ready: boolean): void {
    if (ready) {
      embedEl.setAttribute("data-ready", "");
      embedEl.removeAttribute("aria-busy");
    } else {
      embedEl.removeAttribute("data-ready");
      embedEl.setAttribute("aria-busy", "true");
    }
  }

  function clearFallbackReveal(): void {
    if (fallbackRevealTimer !== undefined) {
      clearTimeout(fallbackRevealTimer);
      fallbackRevealTimer = undefined;
    }
  }

  function teardownEmbedded(): void {
    mountGeneration += 1;
    mounting = false;
    clearFallbackReveal();
    destroyLink?.();
    destroyLink = undefined;
    targetEl.replaceChildren();
    setEmbedReady(false);
  }

  function teardownPopup(): void {
    destroyPopup?.();
    destroyPopup = undefined;
  }

  function post(message: Message): void {
    iframe.contentWindow?.postMessage(
      createMessage(message),
      getIframeTargetOrigin(iframe),
    );
  }

  /** The iframe re-reads the intent and posts a fresh state and token. */
  function requestIntent(): void {
    link = undefined;
    post({ type: "EXTERNAL_BANK_ACCOUNT_INTENT", intentId: current.intentId });
  }

  /** Answer an `EXTERNAL_BANK_ACCOUNT_TOKEN_REQUEST`, even when minting fails. */
  async function provideToken(
    requestId: string,
    intentId: string,
  ): Promise<void> {
    const reply = {
      type: "EXTERNAL_BANK_ACCOUNT_TOKEN",
      intentId,
      requestId,
    } as const;
    try {
      const token = await current.getEmbedToken(intentId);
      post(
        token
          ? { ...reply, token }
          : { ...reply, error: "Could not mint an embed token." },
      );
    } catch (error) {
      post({
        ...reply,
        error:
          error instanceof Error
            ? error.message
            : "Could not mint an embed token.",
      });
    }
  }

  function onInvalidLinkToken(): void {
    if (invalidTokenRefreshes >= MAX_INVALID_TOKEN_REFRESHES) {
      setError("Could not connect bank.");
      setEmbedReady(true);
      return;
    }
    invalidTokenRefreshes += 1;
    requestIntent();
  }

  function linkStepDone(): boolean {
    switch (screen) {
      case "finish":
        return true;
      case "connect":
        return Boolean(linked);
      case "code":
        return updateDone;
      default:
        return false;
    }
  }

  function publishValidity(): void {
    const isValid = holderValid && linkStepDone();
    if (lastEmittedValid === isValid) {
      return;
    }
    lastEmittedValid = isValid;
    current.onValidityChange?.({ isValid });
  }

  async function mountEmbedded(token: string): Promise<void> {
    teardownEmbedded();
    const generation = mountGeneration;
    mounting = true;
    setError(undefined);
    const stale = () => abort.signal.aborted || generation !== mountGeneration;
    try {
      const destroy = await mountPlaidEmbeddedLink({
        token,
        target: targetEl,
        signal: abort.signal,
        onLoad: () => {
          if (stale()) {
            return;
          }
          clearFallbackReveal();
          setEmbedReady(true);
        },
        onSuccess: (publicToken, metadata) => {
          if (stale()) {
            return;
          }
          const accountId = plaidAccountIdFromMetadata(metadata);
          if (!accountId) {
            setError("Select a bank account to continue.");
            return;
          }
          const label = linkedBankLabelFromMetadata(metadata);
          linked = {
            credentials: { public_token: publicToken, account_id: accountId },
            bankName: label.bankName,
            last4: label.last4,
          };
          if (link) {
            link.used = true;
          }
          invalidTokenRefreshes = 0;
          teardownEmbedded();
          render();
        },
        onExit: (error) => {
          if (stale() || error?.error_code !== "INVALID_LINK_TOKEN") {
            return;
          }
          teardownEmbedded();
          onInvalidLinkToken();
        },
      });
      if (stale()) {
        destroy();
        return;
      }
      destroyLink = destroy;
      mounting = false;
      fallbackRevealTimer = setTimeout(() => {
        fallbackRevealTimer = undefined;
        setEmbedReady(true);
      }, PLAID_SKELETON_FALLBACK_MS);
    } catch (error) {
      if (stale()) {
        return;
      }
      teardownEmbedded();
      setError(
        error instanceof Error ? error.message : "Could not connect bank.",
      );
      setEmbedReady(true);
    }
  }

  function openUpdateLink(): void {
    if (link?.mode !== "update" || link.used || popupOpen) {
      return;
    }
    const token = link.token;
    let closed = false;
    const close = () => {
      closed = true;
      popupOpen = false;
      teardownPopup();
    };
    popupOpen = true;
    setError(undefined);
    openPlaidPopupLink({
      token,
      signal: abort.signal,
      // Update mode only confirms the Item; its public_token is not used.
      onSuccess: () => {
        close();
        if (link?.token === token) {
          link.used = true;
        }
        updateDone = true;
        invalidTokenRefreshes = 0;
        render();
      },
      onExit: (error) => {
        close();
        if (error?.error_code === "INVALID_LINK_TOKEN") {
          onInvalidLinkToken();
        }
      },
    })
      .then((destroy) => {
        if (closed || abort.signal.aborted) {
          destroy();
          return;
        }
        destroyPopup = destroy;
      })
      .catch((error: unknown) => {
        popupOpen = false;
        if (abort.signal.aborted) {
          return;
        }
        setError(
          error instanceof Error ? error.message : "Could not open your bank.",
        );
      });
  }

  function render(): void {
    if (screen === "connect" && linked) {
      panel.dataset["mode"] = "linked";
      panel.removeAttribute("aria-hidden");
      linkedName.textContent = linked.bankName;
      linkedMeta.textContent = linked.last4
        ? `****${linked.last4}`
        : "Connected";
    } else if (screen === "connect") {
      panel.dataset["mode"] = "embed";
      panel.removeAttribute("aria-hidden");
      if (link?.mode === "new" && !link.used) {
        if (!destroyLink && !mounting) {
          void mountEmbedded(link.token);
        }
      } else if (link?.used) {
        requestIntent();
      }
    } else if (screen === "code" && !updateDone) {
      panel.dataset["mode"] = "update";
      panel.removeAttribute("aria-hidden");
      updateButton.disabled = link?.mode !== "update" || link.used;
    } else {
      panel.dataset["mode"] = "hidden";
      panel.setAttribute("aria-hidden", "true");
    }
    publishValidity();
  }

  function onState(next: ExternalBankAccountStateEvent): void {
    if (next.screen !== "connect") {
      linked = undefined;
      teardownEmbedded();
    }
    if (next.screen !== "code") {
      updateDone = false;
    }
    screen = next.screen;
    setError(undefined);
    render();
    current.onStateChange?.(next);
  }

  function handleMessage(event: MessageEvent<Message>): void {
    if (!isMessageFromEmbedIframe(event, iframe)) {
      return;
    }
    const data = event.data;
    switch (data.type) {
      case "IFRAME_READY":
        if (!intentRequested) {
          intentRequested = true;
          requestIntent();
        }
        return;
      case "FORM_VALIDITY_CHANGE":
        holderValid = data.isValid;
        publishValidity();
        return;
      case "EXTERNAL_BANK_ACCOUNT_TOKEN_REQUEST":
        if (data.intentId === current.intentId) {
          void provideToken(data.requestId, data.intentId);
        }
        return;
      case "EXTERNAL_BANK_ACCOUNT_STATE":
        if (data.intentId === current.intentId) {
          onState({
            screen: data.screen,
            institutionName: data.institutionName,
            mask: data.mask,
            ...(data.error ? { error: data.error } : {}),
          });
        }
        return;
      case "EXTERNAL_BANK_ACCOUNT_LINK_TOKEN":
        if (data.intentId === current.intentId) {
          link = { token: data.linkToken, mode: data.mode, used: false };
          if (data.mode === "new") {
            teardownEmbedded();
          }
          render();
        }
        return;
      default:
        return;
    }
  }

  function onResult(result: ExternalBankAccountConfirmResult): void {
    if (result.status === "failed") {
      // A rejected first link removes the Plaid Item, so its public_token is
      // spent; the iframe has already posted the next Link token.
      if (result.reason === "rejected") {
        linked = undefined;
        render();
      }
      return;
    }
    // The public_token was exchanged. The iframe posts any next Link session
    // before the result, so only the token that linked this bank is spent.
    linked = undefined;
    if (link?.used) {
      link = undefined;
    }
    if (screen === "connect" && !link) {
      // Wait for the iframe's next state instead of reopening Link.
      teardownEmbedded();
      panel.dataset["mode"] = "hidden";
      panel.setAttribute("aria-hidden", "true");
      publishValidity();
      return;
    }
    render();
  }

  // A reloaded iframe forgets the intent; ask again on its next handshake.
  function handleLoad(): void {
    intentRequested = false;
  }

  window.addEventListener("message", handleMessage);
  iframe.addEventListener("load", handleLoad);
  disconnect.addEventListener("click", () => {
    linked = undefined;
    render();
  });
  updateButton.addEventListener("click", openUpdateLink);

  sessions.set(iframe, {
    intentId: current.intentId,
    screen: () => screen,
    plaid: () => (screen === "connect" ? linked?.credentials : undefined),
    onResult,
    refresh: requestIntent,
  });

  return {
    update(patch) {
      if (patch.getEmbedToken) {
        current.getEmbedToken = patch.getEmbedToken;
      }
      if ("onStateChange" in patch) {
        current.onStateChange = patch.onStateChange;
      }
      if ("onValidityChange" in patch) {
        current.onValidityChange = patch.onValidityChange;
      }
      if ("appearance" in patch) {
        current.appearance = patch.appearance;
        applyTheme(panel, current.appearance, appliedThemeKeys);
      }
    },
    refresh() {
      requestIntent();
    },
    destroy() {
      abort.abort();
      window.removeEventListener("message", handleMessage);
      iframe.removeEventListener("load", handleLoad);
      teardownEmbedded();
      teardownPopup();
      sessions.delete(iframe);
      panel.remove();
    },
  };
}

/**
 * Read the intent again and show its current screen, e.g. while it is
 * `verifying`. No-op if the form is not mounted.
 */
export function refreshExternalBankAccountIntent({
  iframe,
}: {
  iframe: HTMLIFrameElement | null | undefined;
}): void {
  if (iframe) {
    sessions.get(iframe)?.refresh();
  }
}

/**
 * Link the bank account behind an external bank account intent: the
 * first link, finishing manual verification, or resuming a verified
 * account. `token` is the intent's embed token, minted by your server
 * with `POST /external_bank_account_intents/:id/embed_token` right
 * before calling this.
 *
 * Resolves with the intent's outcome and does not throw. A
 * `retryable` failure can be submitted again; after a `timeout` the
 * next call replays the same request, so it never links twice.
 * Wait for `succeeded` to come back before paying out.
 */
export function confirmExternalBankAccountIntent({
  iframe,
  token,
  metadata,
  idempotencyKey,
}: {
  iframe: HTMLIFrameElement | null | undefined;
  token: string;
  metadata?: Record<string, string>;
  /** Overrides the key the SDK manages. Reuse it only to retry. */
  idempotencyKey?: string;
}): Promise<ExternalBankAccountConfirmResult> {
  const session = iframe ? sessions.get(iframe) : undefined;
  const target = iframe?.contentWindow;
  if (!iframe || !session || !target) {
    return Promise.resolve({
      status: "failed",
      reason: "unknown",
      retryable: false,
      error: "The external bank account form is not mounted.",
    });
  }

  const form = { iframe, session };
  const key = idempotencyKey ?? session.retryKey ?? randomRequestId();
  const plaid = session.plaid();

  return new Promise<ExternalBankAccountConfirmResult>((resolve) => {
    const timer = setTimeout(() => finish(TIMEOUT_RESULT), CONFIRM_TIMEOUT_MS);

    function finish(result: ExternalBankAccountConfirmResult): void {
      clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
      form.session.retryKey =
        result.status === "failed" && result.reason === "timeout"
          ? key
          : undefined;
      form.session.onResult(result);
      resolve(result);
    }

    function handleMessage(event: MessageEvent<Message>): void {
      if (
        isMessageFromEmbedIframe(event, form.iframe) &&
        event.data.type === "EXTERNAL_BANK_ACCOUNT_INTENT_RESULT" &&
        event.data.intentId === form.session.intentId
      ) {
        finish(event.data.result);
      }
    }

    window.addEventListener("message", handleMessage);
    target.postMessage(
      createMessage({
        type: "CONFIRM_EXTERNAL_BANK_ACCOUNT_INTENT",
        intentId: session.intentId,
        token,
        idempotencyKey: key,
        ...(plaid ? { plaid } : {}),
        ...(metadata ? { metadata } : {}),
      }),
      getIframeTargetOrigin(iframe),
    );
  });
}
