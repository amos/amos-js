import { afterEach, describe, expect, test, vi } from "vitest";
import { openPlaidPopupLink } from "./plaid";

type PlaidApi = NonNullable<Window["Plaid"]>;
type CreateConfig = Parameters<PlaidApi["create"]>[0];

/**
 * `window.Plaid` requires both entry points, so every stub carries an
 * `createEmbedded` even when the test only exercises regular Link.
 */
function setPlaid(plaid: Partial<PlaidApi>): void {
  window.Plaid = {
    createEmbedded: () => ({ destroy: () => {} }),
    ...plaid,
  } as PlaidApi;
}

afterEach(() => {
  delete window.Plaid;
});

describe("openPlaidPopupLink", () => {
  test("opens a regular Link session with the token", async () => {
    const open = vi.fn();
    const destroy = vi.fn();
    setPlaid({ create: () => ({ open, destroy }) });

    const teardown = await openPlaidPopupLink({
      token: "link-sandbox-update",
      onSuccess: () => {},
    });

    expect(open).toHaveBeenCalledTimes(1);
    expect(teardown).toBeTypeOf("function");
  });

  test("teardown destroys the session rather than just exiting it", async () => {
    const destroy = vi.fn();
    setPlaid({ create: () => ({ open: vi.fn(), destroy }) });

    const teardown = await openPlaidPopupLink({
      token: "link-sandbox-update",
      onSuccess: () => {},
    });
    teardown();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  test("a session aborted during create is destroyed without opening", async () => {
    const open = vi.fn();
    const destroy = vi.fn();
    const controller = new AbortController();
    setPlaid({
      create: () => {
        // The unmount landed while the Link script was still loading.
        controller.abort();
        return { open, destroy };
      },
    });

    const teardown = await openPlaidPopupLink({
      token: "link-sandbox-update",
      onSuccess: () => {},
      signal: controller.signal,
    });

    expect(open).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
    teardown();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  test("routes success and exit through to the callers", async () => {
    let created: CreateConfig | undefined;

    setPlaid({
      create: (config) => {
        created = config;
        return { open: vi.fn(), destroy: vi.fn() };
      },
    });

    const onSuccess = vi.fn();
    const onExit = vi.fn();
    await openPlaidPopupLink({
      token: "link-sandbox-update",
      onSuccess,
      onExit,
    });

    const config = created as CreateConfig | undefined;
    expect(config).toBeDefined();

    config?.onSuccess("public-token-1", { account_id: "account-1" });
    expect(onSuccess).toHaveBeenCalledWith("public-token-1", {
      account_id: "account-1",
    });

    config?.onExit?.({ error_code: "USER_EXIT" }, {});
    expect(onExit).toHaveBeenCalledWith({ error_code: "USER_EXIT" });
  });

  test("does nothing once aborted before create", async () => {
    const create = vi.fn();
    setPlaid({ create });
    const controller = new AbortController();
    controller.abort();

    const teardown = await openPlaidPopupLink({
      token: "link-sandbox-update",
      onSuccess: () => {},
      signal: controller.signal,
    });

    expect(create).not.toHaveBeenCalled();
    expect(teardown).toBeTypeOf("function");
  });

  test("rejects when the script loaded without regular Link", async () => {
    // `window.Plaid` truthy but no `create`: the script resolved without the
    // API this call needs, which must not look like a successful open.
    setPlaid({});

    await expect(
      openPlaidPopupLink({
        token: "link-sandbox-update",
        onSuccess: () => {},
      }),
    ).rejects.toThrow("Plaid Link failed to initialize");
  });
});
