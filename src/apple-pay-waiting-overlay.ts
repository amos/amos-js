const OVERLAY_ATTRIBUTE = "data-amos-apple-pay-waiting";
const CANCEL_ATTRIBUTE = "data-amos-apple-pay-waiting-cancel";
const TITLE_ID = "amos-apple-pay-waiting-title";

const WAITING_COPY =
  "Complete your payment in the open Apple Pay window, or close Apple Pay to continue paying another way.";
const COMPLETING_COPY = "Completing your payment…";

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
  root.setAttribute("aria-labelledby", TITLE_ID);
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
  mark.innerHTML = `<svg width="22" height="26" viewBox="0 0 814 1000" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg><span>Pay</span>`;

  const title = document.createElement("p");
  title.id = TITLE_ID;
  Object.assign(title.style, {
    margin: "0 0 20px",
    fontSize: "15px",
    lineHeight: "1.45",
    color: "#1a1a1a",
  } satisfies Partial<CSSStyleDeclaration>);
  title.textContent = WAITING_COPY;

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.setAttribute(CANCEL_ATTRIBUTE, "true");
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

/**
 * Sheet already authorized; hide Cancel so the donor cannot double-pay.
 * No-op if the overlay is not on the page.
 */
export function setApplePayWaitingOverlayCompleting(): void {
  const root = document.querySelector<HTMLElement>(`[${OVERLAY_ATTRIBUTE}]`);
  if (!root) {
    return;
  }
  const title = root.querySelector(`#${TITLE_ID}`);
  if (title) {
    title.textContent = COMPLETING_COPY;
  }
  root.querySelector(`[${CANCEL_ATTRIBUTE}]`)?.remove();
}

/** Remove the host-page Apple Pay waiting overlay if present. */
export function hideApplePayWaitingOverlay(): void {
  document.querySelector(`[${OVERLAY_ATTRIBUTE}]`)?.remove();
}
