const OVERLAY_ATTRIBUTE = "data-amos-apple-pay-waiting";

/**
 * Create (or return existing) full-viewport waiting UI on the host page while
 * Apple Pay Code runs in a separate window. Cancel invokes `onCancel`.
 */
export function showApplePayWaitingOverlay({
  onCancel,
}: {
  onCancel: () => void;
}): HTMLElement {
  const existing = document.querySelector<HTMLElement>(
    `[${OVERLAY_ATTRIBUTE}]`,
  );
  if (existing) {
    return existing;
  }

  const root = document.createElement("div");
  root.setAttribute(OVERLAY_ATTRIBUTE, "true");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "amos-apple-pay-waiting-title");
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483646",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    boxSizing: "border-box",
    background: "rgba(0, 0, 0, 0.55)",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  } satisfies Partial<CSSStyleDeclaration>);

  const card = document.createElement("div");
  Object.assign(card.style, {
    width: "100%",
    maxWidth: "360px",
    borderRadius: "12px",
    background: "#fff",
    padding: "28px 24px 20px",
    boxSizing: "border-box",
    textAlign: "center",
    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.25)",
  } satisfies Partial<CSSStyleDeclaration>);

  const mark = document.createElement("div");
  mark.setAttribute("aria-hidden", "true");
  Object.assign(mark.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    marginBottom: "16px",
    fontSize: "28px",
    fontWeight: "600",
    letterSpacing: "-0.02em",
    color: "#000",
    lineHeight: "1",
  } satisfies Partial<CSSStyleDeclaration>);
  mark.innerHTML = `<svg width="22" height="26" viewBox="0 0 14 17" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13.072 5.846c-.1.08-1.873 1.09-1.873 3.34 0 2.61 2.29 3.53 2.36 3.55-.04.1-.368 1.27-.766 2.52-.35 1.09-.72 2.18-1.28 2.18-.55 0-.73-.36-1.43-.36-.71 0-.93.37-1.48.37-.55 0-.93-.99-1.35-2.01-.5-1.2-.88-2.43-.88-3.85 0-2.26 1.47-3.46 2.91-3.46.57 0 1.11.38 1.49.38.37 0 .98-.45 1.7-.45.28 0 1.27.03 1.97 1.01ZM9.52 3.37c.3-.36.52-.86.52-1.36 0-.07 0-.14-.01-.2-.5.02-1.1.33-1.46.75-.28.32-.55.84-.55 1.35 0 .07.01.15.02.17.04.01.1.02.16.02.45 0 1.02-.3 1.32-.73Z"/></svg><span>Pay</span>`;

  const title = document.createElement("p");
  title.id = "amos-apple-pay-waiting-title";
  Object.assign(title.style, {
    margin: "0 0 20px",
    fontSize: "15px",
    lineHeight: "1.45",
    color: "#1a1a1a",
  } satisfies Partial<CSSStyleDeclaration>);
  title.textContent =
    "Complete your payment in the open Apple Pay window, or close Apple Pay to continue paying another way.";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel payment";
  Object.assign(cancel.style, {
    display: "block",
    width: "100%",
    border: "none",
    borderRadius: "8px",
    padding: "12px 16px",
    background: "#2c2c2e",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
  } satisfies Partial<CSSStyleDeclaration>);
  cancel.addEventListener("click", onCancel);

  card.append(mark, title, cancel);
  root.append(card);
  document.body.append(root);
  return root;
}

/** Remove the host-page Apple Pay waiting overlay if present. */
export function hideApplePayWaitingOverlay(): void {
  document.querySelector(`[${OVERLAY_ATTRIBUTE}]`)?.remove();
}
