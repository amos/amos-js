import type { PlaidCredentials } from "./plaid";

type BankPlaidSession = {
  requiresVerification: boolean;
  plaid?: PlaidCredentials;
  /** Drop linked Plaid credentials and restore the Connect button. */
  clearLinked?: () => void;
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
): PlaidCredentials | undefined {
  return getBankPlaidSession(iframe)?.plaid;
}
