import type { Appearance, FontSource } from "./types";

/**
 * Default iframe font stack. Pair with {@link DEFAULT_FONTS} so Inter
 * is actually loaded. Merchants override with `--font-family`.
 */
export const DEFAULT_FONT_FAMILY =
  "Inter, ui-sans-serif, system-ui, sans-serif";

/**
 * System stack used when the merchant passes `fonts: []` and omits
 * `--font-family`, so Inter is not named without a webfont.
 */
export const SYSTEM_FONT_FAMILY = "ui-sans-serif, system-ui, sans-serif";

/**
 * Same Google Fonts Inter stylesheet the embed used to load globally.
 * `display=swap`; the iframe does not wait for `document.fonts.ready`.
 */
export const DEFAULT_FONT_CSS_SRC =
  "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap";

/**
 * Default `appearance.fonts` sent on the first `UPDATE_APPEARANCE` when
 * the merchant omitted `fonts`. Pass `fonts: []` to skip the webfont.
 */
export const DEFAULT_FONTS: Array<FontSource> = [
  { cssSrc: DEFAULT_FONT_CSS_SRC },
];

function fontsCleared(fonts: Appearance["fonts"]): boolean {
  return fonts !== undefined && fonts.length === 0;
}

/**
 * `--font-family` used when the merchant omitted that key. `fonts: []`
 * names the system stack so Inter is not used without a webfont.
 */
export function defaultFontFamilyFor(fonts: Appearance["fonts"]): string {
  return fontsCleared(fonts) ? SYSTEM_FONT_FAMILY : DEFAULT_FONT_FAMILY;
}

/**
 * Fill omitted Inter defaults so js.amos.com can drop its own Google
 * Fonts `<link>` once every client is on this SDK.
 *
 * Pass `{ initial: true }` only on the IFRAME_READY handshake. A later
 * call with `initial: true` re-applies omitted Inter defaults; pass the
 * merchant's last `appearance` (including `fonts: []`) so a clear sticks.
 *
 * On the first handshake (`initial: true`), omitted `fonts` becomes
 * {@link DEFAULT_FONTS} and omitted `--font-family` becomes
 * {@link DEFAULT_FONT_FAMILY}. Merchant values win. `fonts: []` is kept
 * (explicit clear) and omitted `--font-family` becomes
 * {@link SYSTEM_FONT_FAMILY} instead of Inter.
 *
 * On later updates (`initial: false`), omitted `fonts` is left omitted
 * so the iframe replace-merge keeps the previous set. If this payload
 * includes `themeVariables` without `--font-family`, Inter is filled in
 * so a variables replace does not drop the default stack — unless this
 * payload also has `fonts: []`, in which case the system stack is used.
 */
export function appearanceWithDefaults(
  appearance: Appearance | undefined,
  { initial }: { initial: boolean },
): Appearance {
  const next: Appearance = { ...appearance };

  if (initial && next.fonts === undefined) {
    next.fonts = [...DEFAULT_FONTS];
  }

  const fontFamilyOmitted =
    next.themeVariables?.["--font-family"] === undefined;
  const shouldDefaultFontFamily =
    (initial && fontFamilyOmitted) ||
    (next.themeVariables !== undefined && fontFamilyOmitted);

  if (shouldDefaultFontFamily) {
    next.themeVariables = {
      "--font-family": defaultFontFamilyFor(next.fonts),
      ...next.themeVariables,
    };
  }

  return next;
}
