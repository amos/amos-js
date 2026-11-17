import { afterEach, describe, expect, test, vi } from "vitest";
import { attachOnboardingUi, refreshOnboarding } from "./onboarding";
import {
  createMessage,
  type Message,
  type OnboardingCreateApplicationInput,
  type OnboardingCreateApplicationResult,
  type OnboardingOrganization,
} from "./types";

const APPLICATION_ID = "lea_123";

const BUSINESS: OnboardingCreateApplicationInput = {
  legal_name: "Riverside Community Food Bank",
  entity_type: "tax_exempt_organization",
  ownership_type: "private",
};

const ORGANIZATION: OnboardingOrganization = {
  doingBusinessAs: "Riverside Food Bank",
  organizationType: "nonprofit",
  businessCategory: "charity",
};

function setup({
  applicationId = APPLICATION_ID as string | null,
  getEmbedToken = async (_id: string) => "embed.jwt",
  createApplication,
}: {
  applicationId?: string | null;
  getEmbedToken?: (applicationId: string) => Promise<string>;
  createApplication?: (
    application: OnboardingCreateApplicationInput,
    organization?: OnboardingOrganization,
  ) => Promise<OnboardingCreateApplicationResult>;
} = {}) {
  const iframe = document.createElement("iframe");
  iframe.src = `${location.origin}/`;
  document.body.append(iframe);

  const posted: Array<Message> = [];
  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    throw new Error("iframe has no window");
  }
  vi.spyOn(frameWindow, "postMessage").mockImplementation(
    (message: unknown) => {
      posted.push(message as Message);
    },
  );

  const onStateChange = vi.fn();
  const onSubmitted = vi.fn();
  const onApplicationCreated = vi.fn();
  const ui = attachOnboardingUi({
    iframe,
    options: {
      applicationId,
      getEmbedToken,
      createApplication,
      onStateChange,
      onSubmitted,
      onApplicationCreated,
    },
  });

  function fromIframe(message: Message, source = iframe.contentWindow): void {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: createMessage(message),
        origin: location.origin,
        source,
      }),
    );
  }

  return {
    iframe,
    ui,
    posted,
    fromIframe,
    onStateChange,
    onSubmitted,
    onApplicationCreated,
    ofType: <T extends Message["type"]>(type: T) =>
      posted.filter(
        (message): message is Extract<Message, { type: T }> =>
          message.type === type,
      ),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let cleanup: Array<() => void> = [];

afterEach(() => {
  for (const run of cleanup) run();
  cleanup = [];
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function mounted(options: Parameters<typeof setup>[0] = {}) {
  const form = setup(options);
  cleanup.push(form.ui.destroy);
  return form;
}

describe("attachOnboardingUi", () => {
  test("sends the application once the iframe is ready, and again on refresh", () => {
    const form = mounted();

    form.fromIframe({ type: "IFRAME_READY" });
    form.fromIframe({ type: "IFRAME_READY" });
    expect(form.ofType("ONBOARDING_APPLICATION")).toEqual([
      { type: "ONBOARDING_APPLICATION", applicationId: APPLICATION_ID },
    ]);

    refreshOnboarding({ iframe: form.iframe });
    expect(form.ofType("ONBOARDING_APPLICATION")).toHaveLength(2);
  });

  test("sends the application again after the iframe reloads", () => {
    const form = mounted();
    form.fromIframe({ type: "IFRAME_READY" });
    form.iframe.dispatchEvent(new Event("load"));
    form.fromIframe({ type: "IFRAME_READY" });
    expect(form.ofType("ONBOARDING_APPLICATION")).toHaveLength(2);
  });

  test("answers a token request with a freshly minted token", async () => {
    const getEmbedToken = vi.fn(async (_id: string) => "fresh.jwt");
    const form = mounted({ getEmbedToken });

    form.fromIframe({
      type: "ONBOARDING_TOKEN_REQUEST",
      applicationId: APPLICATION_ID,
      requestId: "r1",
    });
    await flush();

    expect(getEmbedToken).toHaveBeenCalledWith(APPLICATION_ID);
    expect(form.ofType("ONBOARDING_TOKEN")).toEqual([
      {
        type: "ONBOARDING_TOKEN",
        applicationId: APPLICATION_ID,
        requestId: "r1",
        token: "fresh.jwt",
      },
    ]);
  });

  test("reports a minting failure instead of leaving the iframe waiting", async () => {
    const form = mounted({
      getEmbedToken: async () => {
        throw new Error("Session expired");
      },
    });

    form.fromIframe({
      type: "ONBOARDING_TOKEN_REQUEST",
      applicationId: APPLICATION_ID,
      requestId: "r1",
    });
    await flush();

    expect(form.ofType("ONBOARDING_TOKEN")[0]?.error).toBe("Session expired");
  });

  test("never mints a token for another application", async () => {
    const getEmbedToken = vi.fn(async (_id: string) => "fresh.jwt");
    const form = mounted({ getEmbedToken });

    form.fromIframe({
      type: "ONBOARDING_TOKEN_REQUEST",
      applicationId: "lea_other",
      requestId: "r1",
    });
    await flush();

    expect(getEmbedToken).not.toHaveBeenCalled();
  });

  test("creates the application, then mints tokens for it", async () => {
    const createApplication = vi.fn(
      async (
        _application: OnboardingCreateApplicationInput,
        _organization?: OnboardingOrganization,
      ) => ({ applicationId: "lea_new" }),
    );
    const getEmbedToken = vi.fn(async (_id: string) => "fresh.jwt");
    const form = mounted({
      applicationId: null,
      createApplication,
      getEmbedToken,
    });

    form.fromIframe({ type: "IFRAME_READY" });
    expect(form.ofType("ONBOARDING_APPLICATION")[0]?.applicationId).toBeNull();

    form.fromIframe({
      type: "ONBOARDING_CREATE_REQUEST",
      requestId: "c1",
      application: BUSINESS,
      organization: ORGANIZATION,
    });
    await flush();

    expect(createApplication).toHaveBeenCalledWith(BUSINESS, ORGANIZATION);
    expect(form.onApplicationCreated).toHaveBeenCalledWith({
      applicationId: "lea_new",
    });
    expect(form.ofType("ONBOARDING_CREATED")).toEqual([
      { type: "ONBOARDING_CREATED", requestId: "c1", applicationId: "lea_new" },
    ]);

    form.fromIframe({
      type: "ONBOARDING_TOKEN_REQUEST",
      applicationId: "lea_new",
      requestId: "r1",
    });
    await flush();
    expect(getEmbedToken).toHaveBeenCalledWith("lea_new");
  });

  test("creates once when asked twice", async () => {
    const createApplication = vi.fn(async () => ({
      applicationId: "lea_new",
    }));
    const form = mounted({ applicationId: null, createApplication });

    form.fromIframe({
      type: "ONBOARDING_CREATE_REQUEST",
      requestId: "c1",
      application: BUSINESS,
    });
    form.fromIframe({
      type: "ONBOARDING_CREATE_REQUEST",
      requestId: "c2",
      application: BUSINESS,
    });
    await flush();

    expect(createApplication).toHaveBeenCalledTimes(1);
    expect(
      form.ofType("ONBOARDING_CREATED").map((reply) => reply.applicationId),
    ).toEqual(["lea_new", "lea_new"]);
  });

  test("passes the API's field errors back to the form", async () => {
    const form = mounted({
      applicationId: null,
      createApplication: async () => ({
        errors: { tax_id: ["has already been taken"] },
      }),
    });

    form.fromIframe({
      type: "ONBOARDING_CREATE_REQUEST",
      requestId: "c1",
      application: BUSINESS,
    });
    await flush();

    expect(form.ofType("ONBOARDING_CREATED")[0]).toEqual({
      type: "ONBOARDING_CREATED",
      requestId: "c1",
      errors: { tax_id: ["has already been taken"] },
    });
    expect(form.onApplicationCreated).not.toHaveBeenCalled();
  });

  test("says so when the page can't create applications", async () => {
    const form = mounted({ applicationId: null });

    form.fromIframe({
      type: "ONBOARDING_CREATE_REQUEST",
      requestId: "c1",
      application: BUSINESS,
    });
    await flush();

    expect(form.ofType("ONBOARDING_CREATED")[0]?.error).toMatch(
      /can't start an application/,
    );
  });

  test("forwards state and submission without the message envelope", () => {
    const form = mounted();

    form.fromIframe({
      type: "ONBOARDING_STATE",
      applicationId: APPLICATION_ID,
      applicationState: "needs_information",
      step: "status",
      openRequirements: [
        { requirementType: "irs_cp_575", message: "Upload a clearer letter" },
      ],
    });
    form.fromIframe({
      type: "ONBOARDING_SUBMITTED",
      applicationId: APPLICATION_ID,
      applicationState: "submitted",
    });

    expect(form.onStateChange).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      applicationState: "needs_information",
      step: "status",
      openRequirements: [
        { requirementType: "irs_cp_575", message: "Upload a clearer letter" },
      ],
    });
    expect(form.onSubmitted).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      applicationState: "submitted",
    });
  });

  test("opens Plaid Link for the form and answers what Link said", async () => {
    type LinkConfig = {
      token: string;
      onSuccess: (publicToken: string, metadata: object) => void;
      onExit: (error: null) => void;
    };
    const sessions: Array<LinkConfig> = [];
    const open = vi.fn();
    const destroy = vi.fn();
    window.Plaid = {
      createEmbedded: () => ({ destroy }),
      create: (config) => {
        sessions.push(config as LinkConfig);
        return { open, destroy };
      },
    };
    const form = mounted();

    form.fromIframe({
      type: "ONBOARDING_PLAID_OPEN",
      requestId: "p1",
      linkToken: "link-sandbox-1",
    });
    // At once, before Link has loaded: the form is waiting to hear that
    // this SDK can open Link at all.
    expect(form.ofType("ONBOARDING_PLAID_RESULT")).toEqual([
      expect.objectContaining({ requestId: "p1", status: "opened" }),
    ]);
    await flush();
    expect(sessions[0]?.token).toBe("link-sandbox-1");
    expect(open).toHaveBeenCalledOnce();

    // A bank link: the public token and the account picked.
    sessions[0]?.onSuccess("public-1", {
      institution: { name: "Chase" },
      accounts: [{ id: "acc_1", mask: "6789" }],
    });
    expect(form.ofType("ONBOARDING_PLAID_RESULT")[1]).toMatchObject({
      requestId: "p1",
      status: "success",
      publicToken: "public-1",
      accountId: "acc_1",
      institutionName: "Chase",
      mask: "6789",
    });

    // An identity verification: no public token, only the session.
    form.fromIframe({
      type: "ONBOARDING_PLAID_OPEN",
      requestId: "p2",
      linkToken: "link-sandbox-2",
    });
    await flush();
    // The first session is gone before the second opens.
    expect(destroy).toHaveBeenCalledOnce();
    sessions[1]?.onSuccess("", { link_session_id: "idv_1" });
    expect(form.ofType("ONBOARDING_PLAID_RESULT").at(-1)).toMatchObject({
      requestId: "p2",
      status: "success",
      publicToken: "",
      linkSessionId: "idv_1",
    });

    form.fromIframe({
      type: "ONBOARDING_PLAID_OPEN",
      requestId: "p3",
      linkToken: "link-sandbox-3",
    });
    await flush();
    sessions[2]?.onExit(null);
    expect(form.ofType("ONBOARDING_PLAID_RESULT").at(-1)).toMatchObject({
      requestId: "p3",
      status: "exit",
    });
    delete window.Plaid;
  });

  test("ignores messages from other windows", () => {
    const form = mounted();
    form.fromIframe(
      {
        type: "ONBOARDING_SUBMITTED",
        applicationId: APPLICATION_ID,
        applicationState: "submitted",
      },
      window,
    );
    expect(form.onSubmitted).not.toHaveBeenCalled();
  });
});
