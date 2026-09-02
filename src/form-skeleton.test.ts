import { describe, expect, test } from "vitest";
import { SYSTEM_FONT_FAMILY } from "./appearance-defaults";
import { skeletonRulesToCss } from "./form-skeleton";

describe("skeletonRulesToCss", () => {
  test("emits resting Input and Label declarations", () => {
    const css = skeletonRulesToCss(".scope", {
      ".Input": { fontSize: "1rem", padding: "8px" },
      ".Label": { fontWeight: "600" },
    });
    expect(css).toContain(".scope .amos-js-form-skeleton-input");
    expect(css).toContain("font-size: 1rem;");
    expect(css).toContain("padding: 8px;");
    expect(css).toContain(".scope .amos-js-form-skeleton-label");
    expect(css).toContain("font-weight: 600;");
  });

  test("appends a system font-family fallback", () => {
    const css = skeletonRulesToCss(".scope", {
      ".Input": { fontFamily: "Source Serif 4, ui-serif, serif" },
    });
    expect(css).toContain(
      `font-family: Source Serif 4, ui-serif, serif, ${SYSTEM_FONT_FAMILY};`,
    );
  });

  test("ignores hover and invalid selectors", () => {
    const css = skeletonRulesToCss(".scope", {
      ".Input:hover": { fontSize: "2rem" },
      ".Input--invalid": { boxShadow: "none" },
    });
    expect(css).toBeUndefined();
  });

  test("drops values that would break out of a style tag", () => {
    const css = skeletonRulesToCss(".scope", {
      ".Input": {
        fontSize: "</style><img src=x>",
        color: "red",
      },
    });
    expect(css).toContain("color: red;");
    expect(css).not.toContain("</style>");
  });

  test("drops CSS-escape and url() values", () => {
    expect(
      skeletonRulesToCss(".scope", {
        ".Input": { fontSize: "16px\\3b color: red" },
      }),
    ).toBeUndefined();
    expect(
      skeletonRulesToCss(".scope", {
        ".Input": { backgroundColor: "url(https://evil.example)" },
      }),
    ).toBeUndefined();
  });

  test("allows var(--token) for allowlisted theme variables", () => {
    const css = skeletonRulesToCss(".scope", {
      ".Input": { color: "var(--primary)" },
    });
    expect(css).toContain("color: var(--primary);");
  });
});
