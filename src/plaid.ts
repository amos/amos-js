import type { components } from "@amos.com/node";
import { decodeJwt } from "./jwt";

const PLAID_SCRIPT_SRC =
  "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

export type PlaidCredentials = components["schemas"]["PlaidCredentialsInput"];

export type PlaidLinkAccount = {
  id?: string;
  mask?: string;
  name?: string;
  subtype?: string | null;
  type?: string;
};

export type PlaidLinkOnSuccessMetadata = {
  institution?: { name?: string } | null;
  accounts?: Array<PlaidLinkAccount>;
  account?: PlaidLinkAccount;
  account_id?: string;
};

type PlaidEmbeddedHandler = {
  destroy: () => void;
};

type PlaidCreateConfig = {
  token: string;
  onSuccess: (
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata,
  ) => void;
  onExit?: (
    error: { error_code?: string; error_message?: string } | null,
    metadata: unknown,
  ) => void;
};

declare global {
  interface Window {
    Plaid?: {
      createEmbedded: (
        config: PlaidCreateConfig,
        target: HTMLElement,
      ) => PlaidEmbeddedHandler;
    };
  }
}

/**
 * Whether this render token collects Plaid / ACH verification.
 *
 * Omitted `verification` means enabled. `false` disables it so surfaces
 * like a virtual terminal can take routing and account numbers.
 */
export function isBankVerificationEnabled(renderToken: string): boolean {
  try {
    const payload: components["schemas"]["RenderTokenJwt"] =
      decodeJwt(renderToken).payload;
    const bankMethod = payload.allowed_payment_methods?.find(
      (allowed) => allowed.type === "bank_account",
    );
    const options =
      bankMethod?.type === "bank_account" ? bankMethod.options : undefined;
    return options?.verification !== false;
  } catch {
    return false;
  }
}

/**
 * Whether the bank form should show Plaid Embedded Link instead of
 * routing/account fields.
 *
 * - Render token `verification: false`: never Plaid.
 * - `intent: "setup"`: always Plaid (when verification is enabled).
 * - Otherwise: host `requireAchVerification`.
 */
export function shouldShowPlaidLink({
  renderToken,
  intent = "payment",
  requireAchVerification = false,
}: {
  renderToken: string;
  intent?: "payment" | "setup";
  requireAchVerification?: boolean;
}): boolean {
  if (!isBankVerificationEnabled(renderToken)) {
    return false;
  }
  if (intent === "setup") {
    return true;
  }
  return requireAchVerification;
}

/**
 * Whether the charge meets a merchant ACH verification threshold.
 *
 * - No `achThreshold`: always manual ACH (backward compatible).
 * - Otherwise: Plaid when `amount >= achThreshold`.
 * - Omitted `amount` is treated as `0` (typically under the threshold).
 *
 * `amount` and `achThreshold` are integer minor units (cents). Hosts can
 * use this to compute {@link shouldShowPlaidLink}'s
 * `requireAchVerification`.
 */
export function requiresAchVerification({
  amount,
  achThreshold,
}: {
  amount?: number;
  achThreshold?: number;
}): boolean {
  if (achThreshold == null) {
    return false;
  }
  return (amount ?? 0) >= achThreshold;
}

/**
 * Convert a major-currency decimal string (e.g. `"50.00"`) to integer
 * cents. Empty / invalid values are omitted.
 */
export function majorAmountToMinorUnits(amount?: string): number | undefined {
  if (amount == null) {
    return undefined;
  }
  const trimmed = amount.trim();
  if (trimmed === "") {
    return undefined;
  }
  const major = Number(trimmed.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(major)) {
    return undefined;
  }
  return Math.round(major * 100);
}

export function plaidAccountIdFromMetadata(
  metadata: PlaidLinkOnSuccessMetadata,
): string | undefined {
  return (
    metadata.account_id ?? metadata.account?.id ?? metadata.accounts?.[0]?.id
  );
}

export function linkedBankLabelFromMetadata(
  metadata: PlaidLinkOnSuccessMetadata,
): { bankName: string; last4: string } {
  const account = metadata.account ?? metadata.accounts?.[0];
  const bankName = metadata.institution?.name ?? "Bank account";
  const last4 = account?.mask ?? "";
  return { bankName, last4 };
}

let plaidScriptPromise: Promise<void> | undefined;

function removePlaidScriptTags(): void {
  for (const node of document.querySelectorAll(
    `script[src="${PLAID_SCRIPT_SRC}"]`,
  )) {
    node.remove();
  }
}

export function loadPlaidScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Plaid Link requires a browser"));
  }
  if (window.Plaid) {
    return Promise.resolve();
  }
  if (plaidScriptPromise) {
    return plaidScriptPromise;
  }

  // A previous failed attempt leaves a <script> whose load/error already
  // fired. Waiting on that tag hangs; drop it and inject a new one.
  removePlaidScriptTags();

  plaidScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PLAID_SCRIPT_SRC;
    script.async = true;

    const fail = (message: string) => {
      script.remove();
      plaidScriptPromise = undefined;
      reject(new Error(message));
    };

    script.addEventListener(
      "load",
      () => {
        if (window.Plaid) {
          resolve();
          return;
        }
        fail("Plaid Link failed to initialize");
      },
      { once: true },
    );
    script.addEventListener("error", () => fail("Failed to load Plaid Link"), {
      once: true,
    });
    document.head.append(script);
  });

  return plaidScriptPromise;
}

export type MountPlaidEmbeddedLinkInput = {
  token: string;
  target: HTMLElement;
  onSuccess: (
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata,
  ) => void;
  onExit?: (error: { error_code?: string } | null) => void;
  /**
   * When aborted (e.g. the bank form was unmounted), skip mounting
   * Embedded Link and destroy the handler if it was already created.
   */
  signal?: AbortSignal;
};

/**
 * Load Plaid Link (if needed) and mount Embedded Institution Search
 * into `target`. Returns a destroy function for the Link handler.
 */
export async function mountPlaidEmbeddedLink({
  token,
  target,
  onSuccess,
  onExit,
  signal,
}: MountPlaidEmbeddedLinkInput): Promise<() => void> {
  await loadPlaidScript();
  if (signal?.aborted) {
    return () => {};
  }
  if (!window.Plaid?.createEmbedded) {
    throw new Error("Plaid Embedded Link failed to initialize");
  }

  const handler = window.Plaid.createEmbedded(
    {
      token,
      onSuccess,
      onExit: (error) => {
        onExit?.(error);
      },
    },
    target,
  );
  if (signal?.aborted) {
    handler.destroy();
    return () => {};
  }

  return () => {
    handler.destroy();
  };
}
