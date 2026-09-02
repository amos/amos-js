import { describe, expect, test } from "vitest";
import {
  appearanceWithDefaults,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONTS,
  defaultFontFamilyFor,
  SYSTEM_FONT_FAMILY,
} from "./appearance-defaults";

describe("defaultFontFamilyFor", () => {
  test("omitted and non-empty fonts use Inter", () => {
    expect(defaultFontFamilyFor(undefined)).toBe(DEFAULT_FONT_FAMILY);
    expect(defaultFontFamilyFor(DEFAULT_FONTS)).toBe(DEFAULT_FONT_FAMILY);
  });

  test("fonts: [] uses the system stack", () => {
    expect(defaultFontFamilyFor([])).toBe(SYSTEM_FONT_FAMILY);
  });
});

describe("appearanceWithDefaults", () => {
  test("initial omitted fonts and font-family become Inter", () => {
    const next = appearanceWithDefaults(undefined, { initial: true });
    expect(next.fonts).toEqual(DEFAULT_FONTS);
    expect(next.themeVariables?.["--font-family"]).toBe(DEFAULT_FONT_FAMILY);
  });

  test("initial fonts: [] keeps the clear and uses the system stack", () => {
    const next = appearanceWithDefaults({ fonts: [] }, { initial: true });
    expect(next.fonts).toEqual([]);
    expect(next.themeVariables?.["--font-family"]).toBe(SYSTEM_FONT_FAMILY);
  });

  test("initial fonts: [] keeps an explicit --font-family", () => {
    const next = appearanceWithDefaults(
      {
        fonts: [],
        themeVariables: { "--font-family": "Georgia, ui-serif, serif" },
      },
      { initial: true },
    );
    expect(next.fonts).toEqual([]);
    expect(next.themeVariables?.["--font-family"]).toBe(
      "Georgia, ui-serif, serif",
    );
  });

  test("later omitted fonts are left omitted", () => {
    const next = appearanceWithDefaults(
      { labels: "floating" },
      { initial: false },
    );
    expect(next.fonts).toBeUndefined();
    expect(next.themeVariables).toBeUndefined();
  });

  test("later themeVariables replace without --font-family fills Inter", () => {
    const next = appearanceWithDefaults(
      { themeVariables: { "--primary": "red" } },
      { initial: false },
    );
    expect(next.themeVariables).toEqual({
      "--font-family": DEFAULT_FONT_FAMILY,
      "--primary": "red",
    });
  });

  test("later fonts: [] with themeVariables uses the system stack", () => {
    const next = appearanceWithDefaults(
      { fonts: [], themeVariables: { "--primary": "red" } },
      { initial: false },
    );
    expect(next.fonts).toEqual([]);
    expect(next.themeVariables).toEqual({
      "--font-family": SYSTEM_FONT_FAMILY,
      "--primary": "red",
    });
  });

  test("merchant fonts win on first paint", () => {
    const fonts = [{ cssSrc: "https://fonts.example.com/serif.css" }];
    const next = appearanceWithDefaults({ fonts }, { initial: true });
    expect(next.fonts).toEqual(fonts);
  });
});
