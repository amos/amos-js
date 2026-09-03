import { createAbortController } from "./abort-controller";
import { ensureSkeletonStyles } from "./form-skeleton";
import { requestPlaidLinkToken } from "./messaging";
import type { PaymentMethodFormListenerOptions } from "./payment-method-form";
import {
  linkedBankLabelFromMetadata,
  mountPlaidEmbeddedLink,
  type PlaidCredentials,
  plaidAccountIdFromMetadata,
  shouldShowPlaidLink,
} from "./plaid";
import { clearBankPlaidSession, setBankPlaidSession } from "./plaid-session";
import type { Appearance, Message, ThemeVariable } from "./types";

const STYLE_ID = "amos-js-plaid-bank-ui-styles";

/** Stops a stale-token exit / remount cycle from looping forever. */
const MAX_INVALID_TOKEN_REMOUNTS = 2;

/** Same fallback as card/bank forms: reveal if Plaid never calls onLoad. */
const PLAID_SKELETON_FALLBACK_MS = 1500;

const PLAID_BANK_UI_STYLES = `
.amos-js-plaid-panel {
  box-sizing: border-box;
  color: var(--foreground, oklch(0.145 0 0));
  display: none;
  flex-direction: column;
  font-family: inherit;
  gap: var(--control-gap, 0.5rem);
  width: 100%;
}
.amos-js-plaid-panel[data-mode="embed"],
.amos-js-plaid-panel[data-mode="linked"] {
  display: flex;
}
.amos-js-plaid-embed {
  box-sizing: border-box;
  height: 350px;
  min-height: 350px;
  min-width: 300px;
  position: relative;
  width: 100%;
}
.amos-js-plaid-embed-target {
  box-sizing: border-box;
  height: 100%;
  min-height: 350px;
  min-width: 300px;
  width: 100%;
}
.amos-js-plaid-embed:not([data-ready]) .amos-js-plaid-embed-target {
  opacity: 0;
  pointer-events: none;
}
.amos-js-plaid-skeleton {
  inset: 0;
  pointer-events: none;
  position: absolute;
  z-index: 1;
}
.amos-js-plaid-embed[data-ready] .amos-js-plaid-skeleton {
  display: none;
}
.amos-js-plaid-skeleton-fill {
  animation: amos-js-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  background: var(--input, var(--accent));
  border-radius: calc(var(--radius, 0.625rem) * 0.8);
  box-sizing: border-box;
  height: 100%;
  width: 100%;
}
@media (prefers-reduced-motion: reduce) {
  .amos-js-plaid-skeleton-fill {
    animation: none;
  }
}
.amos-js-plaid-panel[data-mode="linked"] .amos-js-plaid-embed {
  display: none;
}
.amos-js-plaid-linked {
  display: none;
  flex-direction: column;
  gap: 0.25rem;
}
.amos-js-plaid-panel[data-mode="linked"] .amos-js-plaid-linked {
  display: flex;
}
.amos-js-plaid-linked-name {
  font-size: var(--input-font-size, 0.875rem);
  font-weight: 500;
}
.amos-js-plaid-linked-meta {
  color: var(--muted-foreground, oklch(0.556 0 0));
  font-size: 0.75rem;
}
.amos-js-plaid-disconnect {
  align-self: flex-start;
  background: none;
  border: none;
  border-radius: calc(var(--radius, 0.625rem) * 0.8);
  color: var(--muted-foreground, oklch(0.556 0 0));
  cursor: pointer;
  font: inherit;
  font-size: var(--input-font-size, 0.875rem);
  margin-top: 0.25rem;
  outline: none;
  padding: 0;
}
.amos-js-plaid-disconnect:hover {
  color: var(--accent-foreground, oklch(0.205 0 0));
}
.amos-js-plaid-disconnect:focus-visible {
  box-shadow:
    0 0 0 var(--ring-width, 3px)
      color-mix(in oklab, var(--ring, oklch(0.708 0 0)) 50%, transparent);
}
.amos-js-plaid-error {
  color: var(--destructive, oklch(0.577 0.245 27.325));
  display: none;
  font-size: var(--error-font-size, 0.875rem);
  margin: 0;
}
.amos-js-plaid-error:not(:empty) {
  display: block;
}
/* Keep the bank iframe's browsing context alive so it can mint link
 * tokens and confirm. display:none can skip or freeze iframe JS. */
.amos-js-plaid-form-hidden {
  height: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
  position: absolute !important;
  visibility: hidden !important;
  width: 0 !important;
}
`;

function ensurePlaidBankUiStyles(): void {
  ensureSkeletonStyles();
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = PLAID_BANK_UI_STYLES;
  document.head.append(style);
}

function applyTheme(
  panel: HTMLElement,
  appearance: Appearance | undefined,
  appliedKeys: Array<string>,
): void {
  for (const property of appliedKeys) {
    panel.style.removeProperty(property);
  }
  appliedKeys.length = 0;
  const themeVariables = appearance?.themeVariables;
  if (!themeVariables) {
    return;
  }
  for (const [property, value] of Object.entries(themeVariables) as Array<
    [ThemeVariable, string | undefined]
  >) {
    if (typeof value === "string" && value.trim() !== "") {
      panel.style.setProperty(property, value.trim());
      appliedKeys.push(property);
    }
  }
}

export type PlaidBankUiOptions = {
  renderToken: string;
  requireAchVerification?: boolean;
  intent?: "payment" | "setup";
  appearance?: PaymentMethodFormListenerOptions["appearance"];
  onValidityChange?: PaymentMethodFormListenerOptions["onValidityChange"];
};

/**
 * Parent-page Plaid Embedded Institution Search. Unset theme variables
 * inherit from the host document, then fall back to {@link ThemeVariable}
 * defaults; `appearance.themeVariables` overrides with the same replace
 * model as the iframe.
 */
export function attachPlaidBankUi({
  host,
  iframe,
  options,
}: {
  host: HTMLElement;
  iframe: HTMLIFrameElement;
  options: PlaidBankUiOptions;
}): {
  update: (patch: Partial<PlaidBankUiOptions>) => void;
  destroy: () => void;
} {
  ensurePlaidBankUiStyles();

  const current: PlaidBankUiOptions = {
    ...options,
    requireAchVerification: options.requireAchVerification ?? false,
    intent: options.intent ?? "payment",
  };
  const appliedThemeKeys: Array<string> = [];
  let cachedLinkToken: string | undefined;
  let mounting = false;
  let remountRequested = false;
  let invalidTokenRemounts = 0;
  let iframeReady = false;
  let lastEmittedValid: boolean | undefined;
  let destroyLink: (() => void) | undefined;
  let fallbackRevealTimer: ReturnType<typeof setTimeout> | undefined;
  const abort = createAbortController();
  let linked:
    | { credentials: PlaidCredentials; bankName: string; last4: string }
    | undefined;

  const panel = document.createElement("div");
  panel.className = "amos-js-plaid-panel";
  panel.setAttribute("data-amos-plaid-panel", "true");
  panel.dataset["mode"] = "hidden";
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
  skeletonEl.setAttribute("data-testid", "amos-plaid-skeleton");
  const skeletonFill = document.createElement("div");
  skeletonFill.className = "amos-js-plaid-skeleton-fill";
  skeletonEl.append(skeletonFill);

  embedEl.append(targetEl, skeletonEl);

  const linkedEl = document.createElement("div");
  linkedEl.className = "amos-js-plaid-linked";

  const linkedName = document.createElement("span");
  linkedName.className = "amos-js-plaid-linked-name";

  const linkedMeta = document.createElement("span");
  linkedMeta.className = "amos-js-plaid-linked-meta";

  const disconnect = document.createElement("button");
  disconnect.type = "button";
  disconnect.className = "amos-js-plaid-disconnect";
  disconnect.textContent = "Disconnect";
  disconnect.setAttribute("aria-label", "Disconnect bank account");

  const errorEl = document.createElement("p");
  errorEl.className = "amos-js-plaid-error";
  errorEl.setAttribute("role", "alert");

  linkedEl.append(linkedName, linkedMeta, disconnect);
  panel.append(embedEl, linkedEl, errorEl);
  host.append(panel);
  const formWrapper = iframe.parentElement;

  function setError(message: string | undefined): void {
    errorEl.textContent = message ?? "";
  }

  function requiresPlaid(): boolean {
    return shouldShowPlaidLink({
      renderToken: current.renderToken,
      intent: current.intent,
      requireAchVerification: current.requireAchVerification,
    });
  }

  function publishPlaidValidity(): void {
    const isValid = Boolean(linked);
    if (lastEmittedValid === isValid) {
      return;
    }
    lastEmittedValid = isValid;
    current.onValidityChange?.({ isValid });
  }

  function setEmbedReady(ready: boolean): void {
    if (ready) {
      embedEl.setAttribute("data-ready", "");
      embedEl.removeAttribute("aria-busy");
      return;
    }
    embedEl.removeAttribute("data-ready");
    embedEl.setAttribute("aria-busy", "true");
  }

  function clearFallbackReveal(): void {
    if (fallbackRevealTimer === undefined) {
      return;
    }
    clearTimeout(fallbackRevealTimer);
    fallbackRevealTimer = undefined;
  }

  function startFallbackReveal(): void {
    if (
      embedEl.hasAttribute("data-ready") ||
      fallbackRevealTimer !== undefined
    ) {
      return;
    }
    fallbackRevealTimer = setTimeout(() => {
      fallbackRevealTimer = undefined;
      setEmbedReady(true);
    }, PLAID_SKELETON_FALLBACK_MS);
  }

  function teardownEmbedded(): void {
    clearFallbackReveal();
    destroyLink?.();
    destroyLink = undefined;
    targetEl.replaceChildren();
    setEmbedReady(false);
  }

  function unlink(): void {
    linked = undefined;
    cachedLinkToken = undefined;
    invalidTokenRemounts = 0;
    teardownEmbedded();
    setError(undefined);
    syncSession();
  }

  function hideBankForm(hidden: boolean): void {
    if (!formWrapper) {
      return;
    }
    formWrapper.classList.toggle("amos-js-plaid-form-hidden", hidden);
    if (hidden) {
      formWrapper.setAttribute("aria-hidden", "true");
    } else {
      formWrapper.removeAttribute("aria-hidden");
    }
  }

  async function ensureEmbedded(): Promise<void> {
    // CREATE_PLAID_LINK_TOKEN is dropped if we post before the iframe's
    // listener is up, and mounting used to block the IFRAME_READY retry.
    if (
      abort.signal.aborted ||
      !iframeReady ||
      !requiresPlaid() ||
      linked ||
      destroyLink
    ) {
      return;
    }
    if (mounting) {
      // Token fetch and Link script load are slow enough for a remount
      // request to land mid-attempt; replay it once this one settles.
      remountRequested = true;
      return;
    }
    mounting = true;
    remountRequested = false;
    // Plaid can call onExit before createEmbedded's promise resolves, so
    // the handler we are about to receive may already be dead.
    let invalidated = false;
    setError(undefined);
    try {
      if (!cachedLinkToken) {
        cachedLinkToken = await requestPlaidLinkToken({ iframe });
      }
      if (abort.signal.aborted || !requiresPlaid() || linked) {
        return;
      }
      const token = cachedLinkToken;
      teardownEmbedded();
      const destroy = await mountPlaidEmbeddedLink({
        token,
        target: targetEl,
        signal: abort.signal,
        onLoad: () => {
          if (abort.signal.aborted) {
            return;
          }
          clearFallbackReveal();
          setEmbedReady(true);
        },
        onSuccess: (publicToken, metadata) => {
          if (abort.signal.aborted) {
            return;
          }
          const accountId = plaidAccountIdFromMetadata(metadata);
          if (!accountId) {
            setError("Select a bank account to continue.");
            return;
          }
          const label = linkedBankLabelFromMetadata(metadata);
          linked = {
            credentials: {
              public_token: publicToken,
              account_id: accountId,
            },
            bankName: label.bankName,
            last4: label.last4,
          };
          cachedLinkToken = undefined;
          // Bank linked: this session recovered. Do not reset on
          // createEmbedded — INVALID_LINK_TOKEN arrives after that
          // and would restart the remount budget forever.
          invalidTokenRemounts = 0;
          teardownEmbedded();
          syncSession();
        },
        onExit: (error) => {
          if (abort.signal.aborted) {
            return;
          }
          if (error?.error_code !== "INVALID_LINK_TOKEN") {
            return;
          }
          invalidated = true;
          cachedLinkToken = undefined;
          teardownEmbedded();
          if (!requiresPlaid() || linked) {
            return;
          }
          if (invalidTokenRemounts >= MAX_INVALID_TOKEN_REMOUNTS) {
            setError("Could not connect bank.");
            setEmbedReady(true);
            return;
          }
          invalidTokenRemounts += 1;
          void ensureEmbedded();
        },
      });
      destroyLink = destroy;
      startFallbackReveal();
      // The session can change while the Link script loads: drop the
      // handler rather than leave it live behind a hidden panel.
      if (abort.signal.aborted || invalidated || linked || !requiresPlaid()) {
        teardownEmbedded();
      }
    } catch (error) {
      cachedLinkToken = undefined;
      teardownEmbedded();
      if (abort.signal.aborted) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Could not connect bank.";
      if (message === "Bank form is not ready.") {
        return;
      }
      setError(message);
      setEmbedReady(true);
    } finally {
      mounting = false;
      if (remountRequested) {
        remountRequested = false;
        void ensureEmbedded();
      }
    }
  }

  function syncSession(): void {
    const requiresVerification = requiresPlaid();
    setBankPlaidSession(iframe, {
      requiresVerification,
      plaid: requiresVerification ? linked?.credentials : undefined,
      clearLinked: unlink,
    });

    if (!requiresVerification) {
      panel.dataset["mode"] = "hidden";
      hideBankForm(false);
      lastEmittedValid = undefined;
      teardownEmbedded();
      return;
    }

    panel.dataset["mode"] = linked ? "linked" : "embed";
    hideBankForm(true);
    if (linked) {
      linkedName.textContent = linked.bankName;
      linkedMeta.textContent = linked.last4
        ? `****${linked.last4}`
        : "Connected";
    } else {
      void ensureEmbedded();
    }
    publishPlaidValidity();
  }

  function handleIframeMessage(event: MessageEvent<Message>): void {
    if (event.source !== iframe.contentWindow) {
      return;
    }
    if (event.data.type === "IFRAME_READY") {
      iframeReady = true;
    } else if (event.data.type !== "FORM_VALIDITY_CHANGE") {
      return;
    }
    if (requiresPlaid() && !linked && !destroyLink) {
      void ensureEmbedded();
    }
  }

  window.addEventListener("message", handleIframeMessage);
  syncSession();

  disconnect.addEventListener("click", () => {
    unlink();
  });

  return {
    update(patch) {
      if ("requireAchVerification" in patch) {
        current.requireAchVerification = patch.requireAchVerification ?? false;
      }
      if ("intent" in patch) {
        current.intent = patch.intent ?? "payment";
      }
      if ("renderToken" in patch && patch.renderToken) {
        current.renderToken = patch.renderToken;
      }
      if ("onValidityChange" in patch) {
        current.onValidityChange = patch.onValidityChange;
      }
      if ("appearance" in patch) {
        current.appearance = patch.appearance;
        applyTheme(panel, current.appearance, appliedThemeKeys);
      }
      if (linked && !requiresPlaid()) {
        unlink();
        return;
      }
      syncSession();
    },
    destroy() {
      abort.abort();
      clearFallbackReveal();
      window.removeEventListener("message", handleIframeMessage);
      teardownEmbedded();
      clearBankPlaidSession(iframe);
      panel.remove();
    },
  };
}
