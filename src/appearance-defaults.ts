import type { Appearance, FontSource } from "./types";

/**
 * Default iframe font stack. Pair with {@link DEFAULT_FONTS} so Inter
 * is actually loaded. Merchants override with `--font-family`.
 */
export const DEFAULT_FONT_FAMILY =
  "Inter, ui-sans-serif, system-ui, sans-serif";

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

/**
 * Fill omitted Inter defaults so js.amos.com can drop its own Google
 * Fonts `<link>` once every client is on this SDK.
 *
 * On the first handshake (`initial: true`), omitted `fonts` becomes
 * {@link DEFAULT_FONTS} and omitted `--font-family` becomes
 * {@link DEFAULT_FONT_FAMILY}. Merchant values win. `fonts: []` is kept
 * (explicit clear).
 *
 * On later updates (`initial: false`), omitted `fonts` is left omitted
 * so the iframe replace-merge keeps the previous set. If this payload
 * includes `themeVariables` without `--font-family`, Inter is filled in
 * so a variables replace does not drop the default stack.
 */
export function appearanceWithDefaults(
  appearance: Appearance | undefined,
  { initial }: { initial: boolean },
): Appearance {
  const next: Appearance = { ...appearance };

  if (initial && next.fonts === undefined) {
    next.fonts = [...DEFAULT_FONTS];
  }

  const shouldDefaultFontFamily =
    (initial && next.themeVariables?.["--font-family"] === undefined) ||
    (next.themeVariables !== undefined &&
      next.themeVariables["--font-family"] === undefined);

  if (shouldDefaultFontFamily) {
    next.themeVariables = {
      "--font-family": DEFAULT_FONT_FAMILY,
      ...next.themeVariables,
    };
  }

  return next;
}
