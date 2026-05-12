import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";
import {
  ForgeTemplatePanelProvider,
  useForgeTemplatePanel,
} from "../../contexts/ForgeTemplatePanelContext";
import { readStoredProposalOutputDraft } from "../../lib/proposal-output-draft";

const toastMocks = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: () => null,
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: { getCurrent: "proposalSettings.getCurrent" },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    cvs: [],
    currentCv: null,
    currentCvId: null,
    loadCv: vi.fn(),
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: toastMocks.showToast,
  }),
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({ onSubmit, onValuesChange }: any) => {
    const values = {
      jobTitle: "Human Resources Administrator",
      jobDescription:
        "Support day-to-day HR operations and keep internal communication precise.",
      proposalType: "cover_letter",
      voicePreset: "signature",
      toneTuning: null,
      characterLimitMode: "none",
      characterLimitValue: null,
    };

    return (
      <button
        type="button"
        onClick={() => {
          onValuesChange?.(values);
          onSubmit?.(
            values,
            "Generated proposal body.\n\nSincerely,\njo",
            undefined,
            "proposal_generated",
          );
        }}
      >
        Generate proposal
      </button>
    );
  },
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: ({
    railTitle,
    railMeta,
    contactLine,
    closing,
    mode,
    showZoomControls,
  }: {
    railTitle?: string | null;
    railMeta?: string | null;
    contactLine?: string | null;
    closing?: { signatureName?: string | null } | null;
    mode?: "preview" | "edit";
    showZoomControls?: boolean;
  }) => (
    <div data-testid="proposal-display-props">
      {railTitle ?? ""} | {railMeta ?? ""} | {contactLine ?? ""}
      <span data-testid="proposal-display-closing">
        {closing?.signatureName ?? ""}
      </span>
      <span data-testid="proposal-display-mode">{mode ?? ""}</span>
      <span data-testid="proposal-display-zoom">
        {showZoomControls ? "on" : "off"}
      </span>
    </div>
  ),
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

function TestForgePanel(): JSX.Element | null {
  const { activeRegistration, open } = useForgeTemplatePanel();
  if (!open || !activeRegistration) return null;

  return (
    <aside aria-label={activeRegistration.ariaLabel ?? activeRegistration.title}>
      {activeRegistration.kind === "custom"
        ? activeRegistration.renderContent()
        : null}
    </aside>
  );
}

function renderProposalForge(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={["/proposal"]}>
      <ForgeTemplatePanelProvider>
        <ProposalForge />
        <TestForgePanel />
      </ForgeTemplatePanelProvider>
    </MemoryRouter>,
  );
}

describe("ProposalForge preview applicant fallback", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    toastMocks.showToast.mockClear();
  });

  it("toggles the structured signature switch from the Proposal Forge Style tab", async () => {
    renderProposalForge();

    fireEvent.click(
      screen.getByRole("button", { name: "Generate proposal", hidden: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Alex Martin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Design" }));

    const signatureSwitch = await screen.findByRole("switch", {
      name: "Printed name",
    });
    expect(signatureSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.click(signatureSwitch);

    await waitFor(() => {
      expect(signatureSwitch).toHaveAttribute("aria-checked", "false");
      expect(readStoredProposalOutputDraft()?.proposalClosing).toMatchObject({
        enabled: false,
        source: "settings",
      });
    });
    expect(toastMocks.showToast).not.toHaveBeenCalledWith(
      expect.stringMatching(/signature/i),
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit proposal" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-mode")).toHaveTextContent(
        "edit",
      );
      expect(readStoredProposalOutputDraft()?.proposalOutputMode).toBe("edit");
    });
  });

  it("keeps edit mode active when the structured signature is toggled", async () => {
    renderProposalForge();

    fireEvent.click(
      screen.getByRole("button", { name: "Generate proposal", hidden: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Alex Martin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit proposal" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-mode")).toHaveTextContent(
        "edit",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(await screen.findByRole("switch", { name: "Printed name" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-mode")).toHaveTextContent(
        "edit",
      );
      expect(readStoredProposalOutputDraft()?.proposalOutputMode).toBe("edit");
    });
  });

  it("updates a settings-owned structured signature when the Heading name changes", async () => {
    renderProposalForge();

    fireEvent.click(
      screen.getByRole("button", { name: "Generate proposal", hidden: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Heading" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "A" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-closing")).toHaveTextContent("A");
    });

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Alex Martin" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("proposal-display-closing")).toHaveTextContent(
        "Alex Martin",
      );
    });
  });

  it("does not use the sample resume header when no CV is attached", () => {
    renderProposalForge();

    fireEvent.click(
      screen.getByRole("button", { name: "Generate proposal", hidden: true }),
    );

    expect(screen.getByTestId("proposal-display-props")).toHaveTextContent(
      "| |",
    );
    expect(screen.getByTestId("proposal-display-props")).not.toHaveTextContent(
      "Elena Marlowe",
    );
    expect(screen.getByTestId("proposal-display-props")).not.toHaveTextContent(
      "elena@sample.design",
    );
    expect(screen.getByTestId("proposal-display-zoom")).toHaveTextContent("on");
  });
});
