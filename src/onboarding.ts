import { embedIframeSearchParams } from "./embed-src";
import { isMessageFromEmbedIframe } from "./iframe-message";
import { getEmbedOrigin } from "./jwt";
import { getIframeTargetOrigin } from "./messaging";
import {
  type Appearance,
  createMessage,
  type Message,
  type OnboardingCreateApplicationInput,
  type OnboardingCreateApplicationResult,
  type OnboardingStateEvent,
  type OnboardingSubmittedEvent,
} from "./types";

export type OnboardingUiOptions = {
  /**
   * The legal entity application to show. Omit it (or pass `null`) to start
   * a new one: the form collects the first step, then calls
   * `createApplication`.
   */
  applicationId?: string | null;
  appearance?: Appearance;
  /**
   * Mint an embed token for the application with your server's
   * `POST /legal_entity_applications/:id/embed_token`. Called before each
   * call the iframe makes, because the token expires within seconds.
   */
  getEmbedToken: (applicationId: string) => Promise<string>;
  /**
   * Create the application with your server's
   * `POST /legal_entity_applications`, using the fields the applicant
   * entered on the first step. Required when there is no `applicationId`.
   * Resolve with the API's 422 `errors` to show them on the form.
   */
  createApplication?: (
    application: OnboardingCreateApplicationInput,
  ) => Promise<OnboardingCreateApplicationResult>;
  /** Called once `createApplication` returns an id. Save it to resume later. */
  onApplicationCreated?: (event: { applicationId: string }) => void;
  /**
   * Called after every read and save with the application's state, the
   * screen shown, and the requirements still open. No field values.
   */
  onStateChange?: (event: OnboardingStateEvent) => void;
  /** Called when the applicant submits or resubmits. Verify with the webhook. */
  onSubmitted?: (event: OnboardingSubmittedEvent) => void;
};

type OnboardingSession = { refresh: () => void };

const sessions = new WeakMap<HTMLIFrameElement, OnboardingSession>();

export function getOnboardingFormSrc(renderToken: string): string {
  const params = embedIframeSearchParams({ token: renderToken });
  return `${getEmbedOrigin(renderToken)}/iframe/onboarding?${params.toString()}`;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Host-page half of the onboarding form. The iframe owns every field and
 * calls `/embed/legal_entity_applications/…` itself. This side answers its
 * requests for embed tokens and, before an application exists, asks the
 * platform to create one.
 */
export function attachOnboardingUi({
  iframe,
  options,
}: {
  iframe: HTMLIFrameElement;
  options: OnboardingUiOptions;
}): {
  update: (patch: Partial<Omit<OnboardingUiOptions, "applicationId">>) => void;
  refresh: () => void;
  destroy: () => void;
} {
  const current = { ...options };
  let applicationId = options.applicationId ?? null;
  let applicationSent = false;
  let creating: Promise<OnboardingCreateApplicationResult> | undefined;

  function post(message: Message): void {
    if (!iframe.contentWindow) {
      return;
    }
    iframe.contentWindow.postMessage(
      createMessage(message),
      getIframeTargetOrigin(iframe),
    );
  }

  function sendApplication(): void {
    applicationSent = true;
    post({ type: "ONBOARDING_APPLICATION", applicationId });
  }

  /** Answer an `ONBOARDING_TOKEN_REQUEST`, even when minting fails. */
  async function provideToken(
    requestId: string,
    forApplicationId: string,
  ): Promise<void> {
    const reply = {
      type: "ONBOARDING_TOKEN",
      applicationId: forApplicationId,
      requestId,
    } as const;
    try {
      const token = await current.getEmbedToken(forApplicationId);
      post(
        token
          ? { ...reply, token }
          : { ...reply, error: "Could not mint an embed token." },
      );
    } catch (error) {
      post({
        ...reply,
        error: errorText(error, "Could not mint an embed token."),
      });
    }
  }

  async function create(
    requestId: string,
    application: OnboardingCreateApplicationInput,
  ): Promise<void> {
    const reply = { type: "ONBOARDING_CREATED", requestId } as const;
    // A second request for the same form (a double click, a retry after a
    // lost reply) gets the application the first one made.
    if (applicationId) {
      post({ ...reply, applicationId });
      return;
    }
    if (!current.createApplication) {
      post({
        ...reply,
        error: "This page can't start an application. Ask the platform to.",
      });
      return;
    }
    try {
      creating ??= current.createApplication(application);
      const result = await creating;
      if ("applicationId" in result && result.applicationId) {
        applicationId = result.applicationId;
        current.onApplicationCreated?.({ applicationId });
        post({ ...reply, applicationId });
      } else if ("errors" in result) {
        post({ ...reply, errors: result.errors });
      } else {
        post({ ...reply, error: "Could not start the application." });
      }
    } catch (error) {
      post({
        ...reply,
        error: errorText(error, "Could not start the application."),
      });
    } finally {
      creating = undefined;
    }
  }

  function handleMessage(event: MessageEvent<Message>): void {
    if (!isMessageFromEmbedIframe(event, iframe)) {
      return;
    }
    const data = event.data;
    switch (data.type) {
      case "IFRAME_READY":
        if (!applicationSent) {
          sendApplication();
        }
        return;
      case "ONBOARDING_TOKEN_REQUEST":
        if (data.applicationId === applicationId) {
          void provideToken(data.requestId, data.applicationId);
        }
        return;
      case "ONBOARDING_CREATE_REQUEST":
        void create(data.requestId, data.application);
        return;
      case "ONBOARDING_STATE":
        current.onStateChange?.({
          applicationId: data.applicationId,
          applicationState: data.applicationState,
          step: data.step,
          openRequirements: data.openRequirements,
        });
        return;
      case "ONBOARDING_SUBMITTED":
        current.onSubmitted?.({
          applicationId: data.applicationId,
          applicationState: data.applicationState,
        });
        return;
      case "ONBOARDING_SCROLL_INTO_VIEW":
        if (iframe.getBoundingClientRect().top < 0) {
          iframe.scrollIntoView({ block: "start", behavior: "smooth" });
        }
        return;
      default:
        return;
    }
  }

  // A reloaded iframe forgets the application; send it on the next handshake.
  function handleLoad(): void {
    applicationSent = false;
  }

  window.addEventListener("message", handleMessage);
  iframe.addEventListener("load", handleLoad);
  sessions.set(iframe, { refresh: sendApplication });

  return {
    update(patch) {
      Object.assign(current, patch);
    },
    refresh() {
      sendApplication();
    },
    destroy() {
      window.removeEventListener("message", handleMessage);
      iframe.removeEventListener("load", handleLoad);
      sessions.delete(iframe);
    },
  };
}

/**
 * Read the application again and show where it stands, e.g. after your
 * server gets a `legal_entity_application.*` webhook. No-op if the form is
 * not mounted.
 */
export function refreshOnboarding({
  iframe,
}: {
  iframe: HTMLIFrameElement | null | undefined;
}): void {
  if (iframe) {
    sessions.get(iframe)?.refresh();
  }
}
