/**
 * `AbortController` is Chrome 66+ / Safari 12.1+. The SDK's floor includes
 * Chrome 64 and Safari 12.0; those only need `.aborted` / `.abort()`.
 */
export function createAbortController(): AbortController {
  if (typeof AbortController === "function") {
    return new AbortController();
  }

  let aborted = false;
  return {
    signal: {
      get aborted() {
        return aborted;
      },
    },
    abort() {
      aborted = true;
    },
  } as AbortController;
}
