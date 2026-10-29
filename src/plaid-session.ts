import type {
  BankVerificationConfirmError,
  PlaidConfirmCredentials,
} from "./types";

type BankPlaidSession = {
  requiresVerification: boolean;
  plaid?: PlaidConfirmCredentials;
  /** Drop linked Plaid credentials and restore Embedded Link. */
  clearLinked?: () => void;
  /** Paint a micro-deposit confirm failure on the Plaid panel. */
  showConfirmError?: (error: BankVerificationConfirmError) => void;
};

const sessions = new WeakMap<HTMLIFrameElement, BankPlaidSession>();

export function setBankPlaidSession(
  iframe: HTMLIFrameElement,
  session: BankPlaidSession,
): void {
  sessions.set(iframe, session);
}

export function getBankPlaidSession(
  iframe: HTMLIFrameElement | null | undefined,
): BankPlaidSession | undefined {
  if (!iframe) {
    return undefined;
  }
  return sessions.get(iframe);
}

export function clearBankPlaidSession(
  iframe: HTMLIFrameElement | null | undefined,
): void {
  if (!iframe) {
    return;
  }
  sessions.delete(iframe);
}

export function getBankPlaidCredentials(
  iframe: HTMLIFrameElement | null | undefined,
): PlaidConfirmCredentials | undefined {
  return getBankPlaidSession(iframe)?.plaid;
}
