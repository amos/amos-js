import { DEFAULT_FONT_FAMILY } from "./appearance-defaults";
import type {
  BillingAddressRequirement,
  CreditCardAdditionalFields,
} from "./payment-method-form";
import type {
  Appearance,
  AppearanceLabels,
  AppearanceRuleDeclarations,
  AppearanceRuleSelector,
  ThemeVariable,
} from "./types";

const STYLE_ID = "amos-js-form-skeleton-styles";

let skeletonSeq = 0;

const SKELETON_THEME_DEFAULTS: Record<string, string> = {
  "--accent": "oklch(0.97 0 0)",
  "--radius": "0.625rem",
  "--input-height": "2.25rem",
  "--floating-input-height": "3.25rem",
  "--field-gap": "1rem",
  "--control-gap": "0.5rem",
  "--label-font-size": "0.875rem",
  "--font-family": DEFAULT_FONT_FAMILY,
};

const PROPERTY_TO_KEBAB: Record<string, string> = {
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  fontStyle: "font-style",
  lineHeight: "line-height",
  letterSpacing: "letter-spacing",
  textTransform: "text-transform",
  color: "color",
  backgroundColor: "background-color",
  border: "border",
  borderColor: "border-color",
  borderWidth: "border-width",
  borderStyle: "border-style",
  borderRadius: "border-radius",
  boxShadow: "box-shadow",
  outline: "outline",
  padding: "padding",
  margin: "margin",
  opacity: "opacity",
};

const MAX_RULE_VALUE_LENGTH = 256;

const ALLOWED_SKELETON_VAR_NAMES = new Set([
  "--background",
  "--foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--popover",
  "--popover-foreground",
  "--input",
  "--input-background",
  "--input-height",
  "--input-font-size",
  "--input-font-weight",
  "--input-padding",
  "--input-border-width",
  "--input-shadow",
  "--floating-input-height",
  "--floating-label-font-size",
  "--floating-label-empty-font-size",
  "--floating-label-font-weight",
  "--floating-label-color",
  "--floating-label-floated-color",
  "--floating-label-offset",
  "--floating-value-padding-top",
  "--floating-value-padding-bottom",
  "--label-font-size",
  "--label-font-weight",
  "--field-gap",
  "--control-gap",
  "--error-font-size",
  "--radio-size",
  "--ring",
  "--ring-width",
  "--radius",
  "--font-family",
]);

/**
 * Resting rules that change skeleton box size. Hover / invalid /
 * placeholder / dropdown / radio have no host-page equivalent.
 */
const SKELETON_RULE_CLASSES: Partial<Record<AppearanceRuleSelector, string>> = {
  ".Input": "amos-js-form-skeleton-input",
  ".Label": "amos-js-form-skeleton-label",
};

function isSafeSkeletonCssValue(raw: string): boolean {
  if (raw.length > MAX_RULE_VALUE_LENGTH) {
    return false;
  }
  if (/[{};]|\/\*|\*\//.test(raw)) {
    return false;
  }

  const names: Array<string> = [];
  const withoutVars = raw.replace(
    /var\(\s*(--[a-zA-Z][a-zA-Z0-9-]*)\s*\)/gi,
    (_, name: string) => {
      names.push(name);
      return "x";
    },
  );
  for (const name of names) {
    if (!ALLOWED_SKELETON_VAR_NAMES.has(name)) {
      return false;
    }
  }

  const collapsed = withoutVars.replace(/\s+/g, "").toLowerCase();
  if (collapsed.includes("var(")) {
    return false;
  }
  if (/(url|expression|env|attr|element|paint|image-set)\(/.test(collapsed)) {
    return false;
  }
  if (collapsed.includes("@")) {
    return false;
  }
  if (/javascript:|data:|blob:/.test(collapsed)) {
    return false;
  }
  return true;
}

function sanitizeDeclarations(
  declarations: AppearanceRuleDeclarations,
): Array<string> {
  const css: Array<string> = [];
  for (const [property, value] of Object.entries(declarations)) {
    const kebab = PROPERTY_TO_KEBAB[property];
    if (!kebab || typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0 || !isSafeSkeletonCssValue(trimmed)) {
      continue;
    }
    css.push(`${kebab}: ${trimmed};`);
  }
  return css;
}

/**
 * Scoped CSS so `.Input` / `.Label` box metrics (line-height, padding,
 * margin, font-size) land on the host skeleton, not the iframe.
 */
export function skeletonRulesToCss(
  scope: string,
  rules: Appearance["rules"] | undefined,
): string | undefined {
  if (rules == null) {
    return undefined;
  }

  const blocks: Array<string> = [];
  for (const [selector, className] of Object.entries(
    SKELETON_RULE_CLASSES,
  ) as Array<[AppearanceRuleSelector, string]>) {
    const declarations = rules[selector];
    if (declarations == null || typeof declarations !== "object") {
      continue;
    }
    const body = sanitizeDeclarations(declarations);
    if (body.length === 0) {
      continue;
    }
    blocks.push(`${scope} .${className} {\n  ${body.join("\n  ")}\n}`);
  }

  return blocks.length > 0 ? blocks.join("\n") : undefined;
}

export const SKELETON_STYLES = `
.amos-js-form-skeleton {
  box-sizing: border-box;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--field-gap);
  margin: 0 -4px;
  padding-block: 0.25rem;
  pointer-events: none;
  width: calc(100% + 8px);
}
.amos-js-form-skeleton-field {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-width: 0;
  width: 100%;
}
.amos-js-form-skeleton-label {
  flex-shrink: 0;
  font-size: var(--label-font-size);
  font-weight: var(--label-font-weight, 500);
  line-height: 1.75rem;
}
.amos-js-form-skeleton-input {
  animation: amos-js-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  background: var(--input-background, var(--accent));
  border-radius: calc(var(--radius) * 0.8);
  box-sizing: border-box;
  height: auto;
  min-height: var(--input-height);
  width: 100%;
}
.amos-js-form-skeleton-input-floating {
  min-height: var(--floating-input-height);
}
.amos-js-form-skeleton-row {
  align-items: flex-start;
  display: flex;
  gap: var(--control-gap);
  width: 100%;
}
.amos-js-form-skeleton-row-stack {
  display: flex;
  flex-direction: column;
  gap: var(--field-gap);
  width: 100%;
}
@container (min-width: 24rem) {
  .amos-js-form-skeleton-row-stack {
    align-items: flex-start;
    flex-direction: row;
    gap: var(--control-gap);
  }
}
.amos-js-wallet-skeleton {
  flex: none;
  width: 100%;
}
@keyframes amos-js-skeleton-pulse {
  50% { opacity: 0.5; }
}
@media (prefers-reduced-motion: reduce) {
  .amos-js-form-skeleton-input {
    animation: none;
  }
}
`;

export function ensureSkeletonStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = SKELETON_STYLES;
  document.head.appendChild(style);
}

function applyTheme(
  element: HTMLElement,
  appearance: Appearance | undefined,
): void {
  for (const [property, value] of Object.entries(SKELETON_THEME_DEFAULTS)) {
    element.style.setProperty(property, value);
  }
  const themeVariables = appearance?.themeVariables;
  if (!themeVariables) {
    return;
  }
  for (const [property, value] of Object.entries(themeVariables) as Array<
    [ThemeVariable, string | undefined]
  >) {
    if (typeof value === "string" && value.trim() !== "") {
      element.style.setProperty(property, value.trim());
    }
  }
}

function div(className: string, children?: Array<HTMLElement>): HTMLDivElement {
  const node = document.createElement("div");
  node.className = className;
  if (children) {
    for (const child of children) {
      node.appendChild(child);
    }
  }
  return node;
}

function field(labels: AppearanceLabels, grow?: number): HTMLDivElement {
  const wrap = div("amos-js-form-skeleton-field");
  if (grow !== undefined) {
    wrap.style.flexGrow = String(grow);
  }
  if (labels === "above") {
    wrap.appendChild(div("amos-js-form-skeleton-label"));
  }
  const input = div("amos-js-form-skeleton-input");
  if (labels === "floating") {
    input.classList.add("amos-js-form-skeleton-input-floating");
  }
  wrap.appendChild(input);
  return wrap;
}

function row(children: Array<HTMLElement>, wrapAtSm: boolean): HTMLDivElement {
  return div(
    wrapAtSm ? "amos-js-form-skeleton-row-stack" : "amos-js-form-skeleton-row",
    children,
  );
}

function billingFields({
  labels,
  requirement,
  wrapCountryZip,
}: {
  labels: AppearanceLabels;
  requirement: BillingAddressRequirement;
  wrapCountryZip: boolean;
}): Array<HTMLElement> {
  if (requirement === "full") {
    return [
      field(labels),
      field(labels),
      row([field(labels, 1.4), field(labels, 0.7), field(labels, 0.8)], false),
      field(labels),
    ];
  }
  return [row([field(labels), field(labels)], wrapCountryZip)];
}

export type PaymentMethodFormSkeletonKind = "card" | "bank";

export type PaymentMethodFormSkeletonOptions = {
  kind: PaymentMethodFormSkeletonKind;
  appearance?: Appearance;
  additionalFields?: CreditCardAdditionalFields;
  billingAddressRequirement?: BillingAddressRequirement;
};

function buildChildren(
  options: PaymentMethodFormSkeletonOptions,
): Array<HTMLElement> {
  const labels = options.appearance?.labels ?? "above";
  const billingAddressRequirement =
    options.billingAddressRequirement ?? "country";

  if (options.kind === "card") {
    const children: Array<HTMLElement> = [
      field(labels),
      row([field(labels), field(labels)], false),
    ];
    if (options.additionalFields?.cardholderName) {
      children.push(field(labels));
    }
    children.push(
      ...billingFields({
        labels,
        requirement: billingAddressRequirement,
        wrapCountryZip: false,
      }),
    );
    return children;
  }

  return [
    field(labels),
    row([field(labels), field(labels)], true),
    field(labels),
    row([field("above"), field("above")], true),
    ...billingFields({
      labels,
      requirement: billingAddressRequirement,
      wrapCountryZip: true,
    }),
  ];
}

export type PaymentMethodFormSkeleton = {
  element: HTMLElement;
  update: (options: PaymentMethodFormSkeletonOptions) => void;
};

/**
 * Host-page placeholder that mirrors card/bank field layout using the
 * same appearance variables the iframe will apply. Shown immediately
 * while the iframe document loads, then removed when appearance is
 * ready.
 */
export function createPaymentMethodFormSkeleton(
  options: PaymentMethodFormSkeletonOptions,
): PaymentMethodFormSkeleton {
  ensureSkeletonStyles();
  const element = div("amos-js-form-skeleton");
  const skeletonId = String(++skeletonSeq);
  element.setAttribute("aria-hidden", "true");
  element.setAttribute("data-amos-skeleton", skeletonId);
  const scope = `.amos-js-form-skeleton[data-amos-skeleton="${skeletonId}"]`;

  function render(next: PaymentMethodFormSkeletonOptions): void {
    applyTheme(element, next.appearance);
    const children = buildChildren(next);
    const css = skeletonRulesToCss(scope, next.appearance?.rules);
    if (!css) {
      element.replaceChildren(...children);
      return;
    }
    const style = document.createElement("style");
    style.textContent = css;
    element.replaceChildren(style, ...children);
  }

  render(options);

  return {
    element,
    update: render,
  };
}

export type WalletButtonSkeletonOptions = {
  /** Painted height of the wallet button slot (CSS length). */
  height: string;
  /** Corner radius matching the iframe / native button. */
  borderRadius?: string;
};

export type WalletButtonSkeleton = {
  element: HTMLElement;
  update: (options: WalletButtonSkeletonOptions) => void;
};

/**
 * Host-page placeholder for Google Pay / Apple Pay: a pulsing bar at
 * the button's height. Shown immediately while the iframe loads, then
 * removed when appearance is ready.
 */
export function createWalletButtonSkeleton(
  options: WalletButtonSkeletonOptions,
): WalletButtonSkeleton {
  ensureSkeletonStyles();
  const element = div("amos-js-form-skeleton-input amos-js-wallet-skeleton");
  element.setAttribute("aria-hidden", "true");

  function render(next: WalletButtonSkeletonOptions): void {
    applyTheme(element, undefined);
    element.style.height = next.height;
    element.style.borderRadius = next.borderRadius ?? "4px";
  }

  render(options);

  return {
    element,
    update: render,
  };
}

function cssLength(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}px`;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return undefined;
}

/**
 * Corner radius for a wallet-button skeleton. Prefers host iframe
 * chrome, then native Google / Apple button radius, then 4px.
 */
export function resolveWalletButtonSkeletonBorderRadius({
  iframeStyle,
  buttonProps,
}: {
  iframeStyle?: { borderRadius?: string | number };
  buttonProps?: {
    buttonRadius?: number;
    style?: Record<string, string | number | undefined>;
  };
}): string {
  return (
    cssLength(iframeStyle?.borderRadius) ??
    cssLength(buttonProps?.buttonRadius) ??
    cssLength(buttonProps?.style?.["borderRadius"]) ??
    cssLength(buttonProps?.style?.["--apple-pay-button-border-radius"]) ??
    "4px"
  );
}
