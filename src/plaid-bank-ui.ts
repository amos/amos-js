import { createAbortController } from "./abort-controller";
import { ensureSkeletonStyles } from "./form-skeleton";
import { isMessageFromEmbedIframe } from "./iframe-message";
import {
  refreshPlaidBankVerification,
  registerPlaidBankVerification,
  requestPlaidLinkToken,
} from "./messaging";
import type { PaymentMethodFormListenerOptions } from "./payment-method-form";
import {
  isPendingBankVerificationStatus,
  linkedBankLabelFromMetadata,
  mountPlaidEmbeddedLink,
  plaidAccountIdFromMetadata,
  plaidLinkOutcome,
  plaidVerificationStatusFromMetadata,
  shouldShowPlaidLink,
} from "./plaid";
import { clearBankPlaidSession, setBankPlaidSession } from "./plaid-session";
import type {
  Appearance,
  BankVerificationConfirmError,
  BankVerificationStatus,
  Message,
  PaymentMethodFormValidityChangeEvent,
  PlaidConfirmCredentials,
  ThemeVariable,
} from "./types";

const STYLE_ID = "amos-js-plaid-bank-ui-styles";

/** Stops a stale-token exit / remount cycle from looping forever. */
const MAX_INVALID_TOKEN_REMOUNTS = 2;

/** Same fallback as card/bank forms: reveal if Plaid never calls onLoad. */
const PLAID_SKELETON_FALLBACK_MS = 1500;

const PLAID_BANK_UI_STYLES = `
.amos-js-plaid-panel {
  box-sizing: border-box;
  color: var(--foreground, oklch(0.145 0 0));
  display: flex;
  flex-direction: column;
  font-family: inherit;
  gap: var(--control-gap, 0.5rem);
  width: 100%;
}
/* Keep Embedded Link's iframe alive across requireAchVerification
 * toggles. display:none can skip or freeze iframe JS — same reason the
 * bank form uses this hide, not display:none. */
.amos-js-plaid-panel[data-mode="hidden"] {
  height: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
  position: absolute !important;
  visibility: hidden !important;
  width: 0 !important;
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
.amos-js-plaid-panel[data-mode="linked"] .amos-js-plaid-embed,
.amos-js-plaid-panel[data-mode="pending"] .amos-js-plaid-embed {
  display: none;
}
.amos-js-plaid-linked {
  align-items: center;
  background: var(--background, oklch(1 0 0));
  border: 1px solid var(--border, oklch(0.922 0 0));
  border-radius: var(--radius, 0.625rem);
  box-sizing: border-box;
  display: none;
  gap: 0.75rem;
  padding: 0.75rem;
}
.amos-js-plaid-panel[data-mode="linked"] .amos-js-plaid-linked,
.amos-js-plaid-panel[data-mode="pending"] .amos-js-plaid-linked {
  display: flex;
}
.amos-js-plaid-pending,
.amos-js-plaid-action {
  display: none;
}
.amos-js-plaid-panel[data-mode="pending"] .amos-js-plaid-pending,
.amos-js-plaid-panel[data-mode="pending"] .amos-js-plaid-action {
  display: block;
}
.amos-js-plaid-pending {
  color: var(--muted-foreground, oklch(0.556 0 0));
  font-size: 0.75rem;
  margin: 0;
}
.amos-js-plaid-panel[data-mode="update"] .amos-js-plaid-embed {
  display: none;
}
.amos-js-plaid-update {
  align-self: flex-start;
  display: none;
}
.amos-js-plaid-panel[data-mode="update"] .amos-js-plaid-update {
  display: inline-flex;
  align-items: center;
}
.amos-js-plaid-linked-mark {
  align-items: center;
  background: var(--muted, var(--accent, oklch(0.97 0 0)));
  border-radius: calc(var(--radius, 0.625rem) * 0.8);
  color: var(--foreground, oklch(0.145 0 0));
  display: flex;
  flex: none;
  height: 2.25rem;
  justify-content: center;
  width: 2.25rem;
}
.amos-js-plaid-linked-mark svg {
  display: block;
}
.amos-js-plaid-linked-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.amos-js-plaid-linked-name {
  color: var(--foreground, oklch(0.145 0 0));
  font-size: 0.875rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.amos-js-plaid-linked-meta {
  color: var(--muted-foreground, oklch(0.556 0 0));
  font-size: 0.75rem;
}
.amos-js-plaid-disconnect {
  background: var(--background, oklch(1 0 0));
  border: 1px solid var(--border, oklch(0.922 0 0));
  border-radius: calc(var(--radius, 0.625rem) * 0.8);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  color: var(--foreground, oklch(0.145 0 0));
  cursor: pointer;
  flex: none;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  height: 2rem;
  outline: none;
  padding: 0 0.75rem;
}
.amos-js-plaid-disconnect:hover {
  background: var(--accent, oklch(0.97 0 0));
  color: var(--accent-foreground, oklch(0.205 0 0));
}
:is(.dark, .dark *) .amos-js-plaid-disconnect {
  border-color: var(--input, var(--border, oklch(0.922 0 0)));
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

/** Same Lucide building mark as the hosted-checkout Bank method. */
export function createBuildingIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", "16");
  rect.setAttribute("height", "20");
  rect.setAttribute("x", "4");
  rect.setAttribute("y", "2");
  rect.setAttribute("rx", "2");
  rect.setAttribute("ry", "2");
  svg.append(rect);

  for (const d of [
    "M9 22v-4h6v4",
    "M8 6h.01",
    "M16 6h.01",
    "M12 6h.01",
    "M12 10h.01",
    "M12 14h.01",
    "M16 10h.01",
    "M16 14h.01",
    "M8 10h.01",
    "M8 14h.01",
  ]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }

  return svg;
}

export function ensurePlaidBankUiStyles(): void {
  ensureSkeletonStyles();
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = PLAID_BANK_UI_STYLES;
  document.head.append(style);
}

export function applyTheme(
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

type LinkedBank = {
  credentials: PlaidConfirmCredentials;
  bankName: string;
  last4: string;
  verificationId?: string;
  verificationStatus?: BankVerificationStatus;
};

type PendingBank = {
  id: string;
  status:
    | "pending_manual_verification"
    | "pending_automatic_verification"
    | "unsent";
  bankName: string;
  last4: string;
};

const CONFIRM_ERROR_COPY: Record<BankVerificationConfirmError, string> = {
  bank_verification_pending:
    "Bank account verification is pending. Come back after the deposit arrives.",
  bank_verification_failed:
    "Bank account verification failed. Connect the bank again.",
  bank_verification_expired:
    "Bank account verification expired. Connect the bank again.",
};

export type PlaidBankUiOptions = {
  renderToken: string;
  requireAchVerification?: boolean;
  intent?: "payment" | "setup";
  /**
   * Stored micro-deposit verification to resume. The host keeps this id
   * from `onValidityChange` and passes it back on a later visit.
   */
  plaidVerificationId?: string;
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
  /** Bumped to drop a mount that is still fetching its token or script. */
  let mountGeneration = 0;
  let remountRequested = false;
  let invalidTokenRemounts = 0;
  let iframeReady = false;
  let lastEmittedValidity: string | undefined;
  let destroyLink: (() => void) | undefined;
  let fallbackRevealTimer: ReturnType<typeof setTimeout> | undefined;
  const abort = createAbortController();
  let linked: LinkedBank | undefined;
  let pending: PendingBank | undefined;
  let codeEntry = false;
  let preserveErrorOnNextMount = false;
  let resumeHandledFor: string | undefined;
  let dismissedVerificationId: string | undefined;

  const panel = document.createElement("div");
  panel.className = "amos-js-plaid-panel";
  panel.setAttribute("data-amos-plaid-panel", "true");
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
  skeletonEl.setAttribute("data-testid", "amos-plaid-skeleton");
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

  const errorEl = document.createElement("p");
  errorEl.className = "amos-js-plaid-error";
  errorEl.setAttribute("role", "alert");

  const pendingNote = document.createElement("p");
  pendingNote.className = "amos-js-plaid-pending";

  const action = document.createElement("button");
  action.type = "button";
  action.className = "amos-js-plaid-disconnect amos-js-plaid-action";

  linkedEl.append(linkedMark, linkedCopy, disconnect);
  panel.append(embedEl, linkedEl, pendingNote, action, errorEl);
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

  function validityEvent(): PaymentMethodFormValidityChangeEvent {
    if (linked?.verificationId && linked.verificationStatus) {
      return {
        isValid: true,
        bankVerification: {
          id: linked.verificationId,
          status: linked.verificationStatus,
        },
      };
    }
    if (linked) {
      return { isValid: true };
    }
    if (pending) {
      return {
        isValid: false,
        bankVerification: { id: pending.id, status: pending.status },
      };
    }
    return { isValid: false };
  }

  function publishPlaidValidity(): void {
    const event = validityEvent();
    const serialized = JSON.stringify(event);
    if (lastEmittedValidity === serialized) {
      return;
    }
    lastEmittedValidity = serialized;
    current.onValidityChange?.(event);
  }

  function verificationFailureCopy(status: string | undefined): string {
    if (status === "verification_expired") {
      return CONFIRM_ERROR_COPY.bank_verification_expired;
    }
    return CONFIRM_ERROR_COPY.bank_verification_failed;
  }

  function pendingCopy(status: PendingBank["status"]): string {
    if (status === "pending_automatic_verification") {
      return "A small deposit is on the way. We'll verify it automatically. Check back in one business day. Starting over sends a new deposit.";
    }
    return "A $0.01 deposit is on the way. Come back in one business day and enter the 3-letter code. Starting over sends a new deposit.";
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
    dismissedVerificationId =
      pending?.id ?? linked?.verificationId ?? current.plaidVerificationId;
    linked = undefined;
    pending = undefined;
    codeEntry = false;
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
      (pending && !codeEntry) ||
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
    const generation = mountGeneration;
    const superseded = () => generation !== mountGeneration;
    // Plaid can call onExit before createEmbedded's promise resolves, so
    // the handler we are about to receive may already be dead.
    let invalidated = false;
    if (preserveErrorOnNextMount) {
      preserveErrorOnNextMount = false;
    } else {
      setError(undefined);
    }
    try {
      if (!cachedLinkToken) {
        const minted = await requestPlaidLinkToken({
          iframe,
          plaidBankVerificationId: codeEntry ? pending?.id : undefined,
        });
        if (superseded()) {
          return;
        }
        cachedLinkToken = minted;
      }
      if (abort.signal.aborted || superseded() || !requiresPlaid() || linked) {
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
          const status = plaidVerificationStatusFromMetadata(metadata);
          const outcome = plaidLinkOutcome(status);
          cachedLinkToken = undefined;
          invalidTokenRemounts = 0;
          if (outcome === "failed") {
            linked = undefined;
            pending = undefined;
            codeEntry = false;
            teardownEmbedded();
            preserveErrorOnNextMount = true;
            setError(verificationFailureCopy(status));
            syncSession();
            return;
          }
          if (
            outcome === "pending" &&
            status &&
            isPendingBankVerificationStatus(status)
          ) {
            void registerPending({
              publicToken,
              accountId,
              status,
              bankName: label.bankName,
              last4: label.last4,
            });
            return;
          }
          const verificationId = codeEntry ? pending?.id : undefined;
          pending = undefined;
          codeEntry = false;
          setError(undefined);
          linked = verificationId
            ? {
                credentials: { verification_id: verificationId },
                bankName: label.bankName,
                last4: label.last4,
                verificationId,
                verificationStatus: "manually_verified",
              }
            : {
                credentials: {
                  public_token: publicToken,
                  account_id: accountId,
                },
                bankName: label.bankName,
                last4: label.last4,
              };
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
      if (superseded()) {
        destroy();
        return;
      }
      destroyLink = destroy;
      startFallbackReveal();
      // Abort / invalid token / a completed link still drop the handler.
      // requireAchVerification going false does not — hide via syncSession
      // so toggling the host flag does not reload Institution Search.
      if (abort.signal.aborted || invalidated || linked) {
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

  async function registerPending({
    publicToken,
    accountId,
    status,
    bankName,
    last4,
  }: {
    publicToken: string;
    accountId: string;
    status: PendingBank["status"];
    bankName: string;
    last4: string;
  }): Promise<void> {
    try {
      const registered = await registerPlaidBankVerification({
        iframe,
        publicToken,
        accountId,
        verificationStatus: status,
        institutionName: bankName,
        mask: last4,
      });
      if (abort.signal.aborted) {
        return;
      }
      pending = { id: registered.id, status, bankName, last4 };
      linked = undefined;
      codeEntry = false;
      preserveErrorOnNextMount = false;
      setError(undefined);
      teardownEmbedded();
      syncSession();
    } catch (error) {
      if (abort.signal.aborted) {
        return;
      }
      teardownEmbedded();
      preserveErrorOnNextMount = true;
      setError(
        error instanceof Error
          ? error.message
          : "Could not save bank verification.",
      );
      syncSession();
    }
  }

  function applyRefreshed(
    id: string,
    refreshed: { status?: string; institutionName?: string; mask?: string },
    openCodeEntry: boolean,
  ): void {
    const status = refreshed.status;
    const outcome = plaidLinkOutcome(status);
    const bankName =
      refreshed.institutionName || pending?.bankName || "Bank account";
    const last4 = refreshed.mask || pending?.last4 || "";
    if (outcome === "failed") {
      // Otherwise the stored id keeps the panel waiting to resume, and a
      // new Link session never mounts.
      dismissedVerificationId = id;
      pending = undefined;
      linked = undefined;
      codeEntry = false;
      preserveErrorOnNextMount = true;
      setError(verificationFailureCopy(status));
      syncSession();
      return;
    }
    preserveErrorOnNextMount = false;
    setError(undefined);
    if (
      outcome === "pending" &&
      status &&
      isPendingBankVerificationStatus(status)
    ) {
      pending = { id, status, bankName, last4 };
      linked = undefined;
      codeEntry = openCodeEntry && status === "pending_manual_verification";
      syncSession();
      return;
    }
    pending = undefined;
    codeEntry = false;
    linked = {
      credentials: { verification_id: id },
      bankName,
      last4,
      verificationId: id,
      verificationStatus:
        status === "manually_verified" ||
        status === "automatically_verified" ||
        status === "database_matched"
          ? status
          : "automatically_verified",
    };
    syncSession();
  }

  async function resumeVerification(id: string): Promise<void> {
    try {
      const refreshed = await refreshPlaidBankVerification({
        iframe,
        plaidBankVerificationId: id,
      });
      if (abort.signal.aborted) {
        return;
      }
      applyRefreshed(id, refreshed, true);
    } catch (error) {
      if (abort.signal.aborted) {
        return;
      }
      dismissedVerificationId = id;
      preserveErrorOnNextMount = true;
      setError(
        error instanceof Error
          ? error.message
          : "Could not resume bank verification.",
      );
      syncSession();
    }
  }

  function maybeResume(): void {
    const id = current.plaidVerificationId;
    if (
      !iframeReady ||
      !requiresPlaid() ||
      !id ||
      id === dismissedVerificationId ||
      resumeHandledFor === id ||
      linked ||
      pending
    ) {
      return;
    }
    resumeHandledFor = id;
    void resumeVerification(id);
  }

  function syncSession(): void {
    const requiresVerification = requiresPlaid();
    setBankPlaidSession(iframe, {
      requiresVerification,
      plaid: requiresVerification ? linked?.credentials : undefined,
      clearLinked: unlink,
      showConfirmError: (error) => {
        setError(CONFIRM_ERROR_COPY[error]);
      },
    });

    if (!requiresVerification) {
      panel.dataset["mode"] = "hidden";
      panel.setAttribute("aria-hidden", "true");
      hideBankForm(false);
      const wasValid = lastEmittedValidity?.includes('"isValid":true') === true;
      lastEmittedValidity = undefined;
      if (wasValid) {
        current.onValidityChange?.({ isValid: false });
      }
      return;
    }

    panel.removeAttribute("aria-hidden");
    hideBankForm(true);

    const waitingToResume =
      Boolean(current.plaidVerificationId) &&
      current.plaidVerificationId !== dismissedVerificationId &&
      !linked &&
      !pending;

    if (linked) {
      panel.dataset["mode"] = "linked";
      disconnect.textContent = "Disconnect";
      linkedName.textContent = linked.bankName;
      linkedMeta.textContent = linked.last4
        ? `****${linked.last4}`
        : "Connected";
    } else if (pending && !codeEntry) {
      panel.dataset["mode"] = "pending";
      disconnect.textContent = "Use a different bank";
      linkedName.textContent = pending.bankName;
      linkedMeta.textContent = pending.last4
        ? `****${pending.last4}`
        : "Pending";
      pendingNote.textContent = pendingCopy(pending.status);
      action.textContent =
        pending.status === "pending_automatic_verification"
          ? "Check verification"
          : "Enter deposit code";
    } else if (waitingToResume) {
      panel.dataset["mode"] = "embed";
      maybeResume();
    } else {
      panel.dataset["mode"] = "embed";
      disconnect.textContent = "Disconnect";
      void ensureEmbedded();
    }
    publishPlaidValidity();
  }

  function handleIframeMessage(event: MessageEvent<Message>): void {
    if (!isMessageFromEmbedIframe(event, iframe)) {
      return;
    }
    if (event.data.type === "IFRAME_READY") {
      iframeReady = true;
      maybeResume();
    } else if (event.data.type !== "FORM_VALIDITY_CHANGE") {
      return;
    }
    const resumeInFlight =
      Boolean(current.plaidVerificationId) &&
      current.plaidVerificationId !== dismissedVerificationId &&
      !linked &&
      !pending;
    if (
      requiresPlaid() &&
      !linked &&
      !pending &&
      !destroyLink &&
      !resumeInFlight
    ) {
      void ensureEmbedded();
    }
  }

  window.addEventListener("message", handleIframeMessage);
  syncSession();

  disconnect.addEventListener("click", () => {
    unlink();
  });

  action.addEventListener("click", () => {
    if (!pending) {
      return;
    }
    if (pending.status === "pending_automatic_verification") {
      void refreshPlaidBankVerification({
        iframe,
        plaidBankVerificationId: pending.id,
      })
        .then((refreshed) => {
          if (!pending) {
            return;
          }
          applyRefreshed(pending.id, refreshed, false);
        })
        .catch((error: unknown) => {
          setError(
            error instanceof Error
              ? error.message
              : "Could not check verification.",
          );
        });
      return;
    }
    codeEntry = true;
    cachedLinkToken = undefined;
    teardownEmbedded();
    syncSession();
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
      if ("plaidVerificationId" in patch) {
        const nextId = patch.plaidVerificationId;
        if (nextId !== current.plaidVerificationId) {
          current.plaidVerificationId = nextId;
          resumeHandledFor = undefined;
          if (nextId && nextId !== dismissedVerificationId) {
            dismissedVerificationId = undefined;
            if (!linked && !pending) {
              // The resume may need update-mode Link for code entry, which
              // cannot mount over a new session's Institution Search.
              mountGeneration += 1;
              remountRequested = false;
              cachedLinkToken = undefined;
              teardownEmbedded();
            }
          }
        }
      }
      if ("appearance" in patch) {
        current.appearance = patch.appearance;
        applyTheme(panel, current.appearance, appliedThemeKeys);
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
