import { requestPlaidLinkToken, validateForm } from "./messaging";
import type { PaymentMethodFormListenerOptions } from "./payment-method-form";
import {
  linkedBankLabelFromMetadata,
  openPlaidLink,
  type PlaidCredentials,
  plaidAccountIdFromMetadata,
  requiresAchVerification,
} from "./plaid";
import { clearBankPlaidSession, setBankPlaidSession } from "./plaid-session";
import type { Appearance, Message, ThemeVariable } from "./types";

const STYLE_ID = "amos-js-plaid-bank-ui-styles";

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
.amos-js-plaid-panel[data-mode="connect"],
.amos-js-plaid-panel[data-mode="linked"] {
  display: flex;
}
.amos-js-plaid-connect {
  align-items: center;
  background: var(--background, oklch(1 0 0));
  border: var(--input-border-width, 1px) solid var(--border, oklch(0.922 0 0));
  border-radius: calc(var(--radius, 0.625rem) * 0.8);
  box-shadow: var(--input-shadow, 0 1px 2px 0 rgb(0 0 0 / 0.05));
  box-sizing: border-box;
  color: var(--foreground, oklch(0.145 0 0));
  cursor: pointer;
  display: inline-flex;
  flex-shrink: 0;
  font: inherit;
  font-size: var(--input-font-size, 0.875rem);
  font-weight: 500;
  height: var(--input-height, 2.25rem);
  justify-content: center;
  line-height: 1.25;
  outline: none;
  padding: 0 var(--input-padding, 0.75rem);
  transition: color 150ms, background-color 150ms, border-color 150ms, box-shadow 150ms;
  width: 100%;
}
.amos-js-plaid-panel[data-mode="linked"] .amos-js-plaid-connect {
  display: none;
}
.amos-js-plaid-connect:hover:not(:disabled) {
  background: var(--accent, oklch(0.97 0 0));
  color: var(--accent-foreground, oklch(0.205 0 0));
}
.amos-js-plaid-connect:focus-visible {
  border-color: var(--ring, oklch(0.708 0 0));
  box-shadow:
    var(--input-shadow, 0 1px 2px 0 rgb(0 0 0 / 0.05)),
    0 0 0 var(--ring-width, 3px)
      color-mix(in oklab, var(--ring, oklch(0.708 0 0)) 50%, transparent);
}
.amos-js-plaid-connect:disabled {
  cursor: default;
  opacity: 0.5;
  pointer-events: none;
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
@media (prefers-reduced-motion: reduce) {
  .amos-js-plaid-connect {
    transition: none;
  }
}
`;

function ensurePlaidBankUiStyles(): void {
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
  amount?: number;
  appearance?: PaymentMethodFormListenerOptions["appearance"];
  onValidityChange?: PaymentMethodFormListenerOptions["onValidityChange"];
};

/**
 * Parent-page Connect bank UI. Outline/ghost controls match `@amos/ui`
 * (including `:focus-visible` `--ring`). Unset theme variables inherit
 * from the host document, then fall back to {@link ThemeVariable}
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

  const current: PlaidBankUiOptions = { ...options };
  const appliedThemeKeys: Array<string> = [];
  let thresholdKnown = false;
  let achThreshold: number | undefined;
  let requireVerification = false;
  let cachedLinkToken: string | undefined;
  let opening = false;
  let plaidMode = false;
  let lastEmittedValid: boolean | undefined;
  let destroyLink: (() => void) | undefined;
  let linked:
    | { credentials: PlaidCredentials; bankName: string; last4: string }
    | undefined;

  const panel = document.createElement("div");
  panel.className = "amos-js-plaid-panel";
  panel.setAttribute("data-amos-plaid-panel", "true");
  panel.dataset["mode"] = "hidden";
  applyTheme(panel, current.appearance, appliedThemeKeys);

  const connectButton = document.createElement("button");
  connectButton.type = "button";
  connectButton.className = "amos-js-plaid-connect";
  connectButton.textContent = "Connect bank account";
  connectButton.setAttribute("data-testid", "amos-plaid-connect");

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
  panel.append(connectButton, linkedEl, errorEl);
  host.append(panel);
  const formWrapper = iframe.parentElement;

  function setError(message: string | undefined): void {
    errorEl.textContent = message ?? "";
  }

  function requiresConnect(): boolean {
    if (!thresholdKnown) {
      return false;
    }
    if (requireVerification) {
      return true;
    }
    return requiresAchVerification({
      amount: current.amount,
      achThreshold,
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

  function syncSession(): void {
    const requiresVerification = requiresConnect();
    const leaving = plaidMode && !requiresVerification;
    plaidMode = requiresVerification;
    setBankPlaidSession(iframe, {
      requiresVerification,
      plaid: requiresVerification ? linked?.credentials : undefined,
      clearLinked: unlink,
    });

    if (!requiresVerification) {
      panel.dataset["mode"] = "hidden";
      if (formWrapper) {
        formWrapper.style.display = "";
      }
      lastEmittedValid = undefined;
      if (leaving) {
        void validateForm({ iframe }).then((isValid) => {
          if (!requiresConnect()) {
            current.onValidityChange?.({ isValid });
          }
        });
      }
      return;
    }

    panel.dataset["mode"] = linked ? "linked" : "connect";
    if (formWrapper) {
      formWrapper.style.display = "none";
    }
    if (linked) {
      linkedName.textContent = linked.bankName;
      linkedMeta.textContent = linked.last4
        ? `****${linked.last4}`
        : "Connected";
    }
    publishPlaidValidity();
  }

  function unlink(): void {
    linked = undefined;
    cachedLinkToken = undefined;
    destroyLink?.();
    destroyLink = undefined;
    setError(undefined);
    syncSession();
  }

  function handleIframeMessage(event: MessageEvent<Message>): void {
    if (event.source !== iframe.contentWindow) {
      return;
    }
    if (event.data.type !== "ACH_THRESHOLD") {
      return;
    }
    thresholdKnown = true;
    achThreshold = event.data.achThreshold ?? undefined;
    requireVerification = event.data.requireVerification === true;
    if (linked && !requiresConnect()) {
      unlink();
      return;
    }
    syncSession();
  }

  window.addEventListener("message", handleIframeMessage);
  syncSession();

  disconnect.addEventListener("click", () => {
    unlink();
  });

  connectButton.addEventListener("click", () => {
    void (async () => {
      if (opening) {
        return;
      }
      opening = true;
      connectButton.disabled = true;
      setError(undefined);
      try {
        if (!cachedLinkToken) {
          cachedLinkToken = await requestPlaidLinkToken({ iframe });
        }
        const token = cachedLinkToken;
        destroyLink?.();
        destroyLink = await openPlaidLink({
          token,
          onSuccess: (publicToken, metadata) => {
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
            syncSession();
          },
          onExit: (error) => {
            if (error?.error_code === "INVALID_LINK_TOKEN") {
              cachedLinkToken = undefined;
            }
          },
        });
      } catch (error) {
        cachedLinkToken = undefined;
        setError(
          error instanceof Error ? error.message : "Could not connect bank.",
        );
      } finally {
        opening = false;
        connectButton.disabled = false;
      }
    })();
  });

  return {
    update(patch) {
      if ("amount" in patch) {
        current.amount = patch.amount;
      }
      if ("onValidityChange" in patch) {
        current.onValidityChange = patch.onValidityChange;
      }
      if ("appearance" in patch) {
        current.appearance = patch.appearance;
        applyTheme(panel, current.appearance, appliedThemeKeys);
      }
      if (linked && !requiresConnect()) {
        unlink();
        return;
      }
      syncSession();
    },
    destroy() {
      window.removeEventListener("message", handleIframeMessage);
      destroyLink?.();
      clearBankPlaidSession(iframe);
      panel.remove();
    },
  };
}
