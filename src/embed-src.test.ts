import { afterEach, describe, expect, test } from "vitest";
import { embedIframeSearchParams } from "./embed-src";

const originalSearch = location.search;

afterEach(() => {
  history.replaceState(null, "", `${location.pathname}${originalSearch}`);
});

describe("embedIframeSearchParams", () => {
  test("omits amosDebug when the host page did not ask for it", () => {
    history.replaceState(null, "", `${location.pathname}`);
    const params = embedIframeSearchParams({ token: "tok" });

    expect(params.get("amosDebug")).toBeNull();
    expect(params.get("token")).toBe("tok");
    expect(params.get("billingAddressRequirement")).toBe("country");
    expect(params.get("intent")).toBe("payment");
  });

  test("forwards amosDebug=1 from the host page", () => {
    history.replaceState(null, "", `${location.pathname}?amosDebug=1`);
    const params = embedIframeSearchParams({ token: "tok" });

    expect(params.get("amosDebug")).toBe("1");
  });

  test("ignores any other amosDebug value", () => {
    history.replaceState(null, "", `${location.pathname}?amosDebug=true`);
    const params = embedIframeSearchParams({ token: "tok" });

    expect(params.get("amosDebug")).toBeNull();
  });
});
