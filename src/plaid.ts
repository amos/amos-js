import type { components } from "@amos.com/node";

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

type PlaidLinkHandler = {
  open: () => void;
  exit: (options?: { force?: boolean }) => void;
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
      create: (config: PlaidCreateConfig) => PlaidLinkHandler;
    };
  }
}

/**
 * Whether the bank form should show Plaid Link instead of routing/account
 * fields.
 *
 * - No `achThreshold`: always manual ACH (backward compatible).
 * - `amount` omitted: Plaid (setup / unknown future charge).
 * - Otherwise: Plaid when `amount >= achThreshold`.
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
  if (amount == null) {
    return true;
  }
  return amount >= achThreshold;
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

  plaidScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${PLAID_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Plaid Link")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = PLAID_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => {
        plaidScriptPromise = undefined;
        reject(new Error("Failed to load Plaid Link"));
      },
      { once: true },
    );
    document.head.append(script);
  });

  return plaidScriptPromise;
}

export type OpenPlaidLinkInput = {
  token: string;
  onSuccess: (
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata,
  ) => void;
  onExit?: (error: { error_code?: string } | null) => void;
};

/**
 * Load Plaid Link (if needed) and open it with the given `link_token`.
 * Returns a destroy function for the Link handler.
 */
export async function openPlaidLink({
  token,
  onSuccess,
  onExit,
}: OpenPlaidLinkInput): Promise<() => void> {
  await loadPlaidScript();
  if (!window.Plaid) {
    throw new Error("Plaid Link failed to initialize");
  }

  const handler = window.Plaid.create({
    token,
    onSuccess,
    onExit: (error) => {
      onExit?.(error);
    },
  });
  handler.open();

  return () => {
    handler.destroy();
  };
}
