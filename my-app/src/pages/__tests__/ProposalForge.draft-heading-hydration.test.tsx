import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";
import {
  PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
  readStoredProposalOutputDraft,
} from "../../lib/proposal-output-draft";

const mockUpdateProposal = vi.fn().mockResolvedValue(undefined);
const mockCreateProposal = vi.fn().mockResolvedValue("created_proposal");
const proposalDisplayProps: any[] = [];

const DRAFT_PROPOSALS = [
  {
    _id: "draft_a",
    _creationTime: 1710000000000,
    title: "Draft A Subject",
    content: "Draft A body.",
    status: "draft",
    sections: [{ type: "text", content: "Draft A body." }],
    metadata: {
      proposalType: "cover_letter",
      templateId: "proposal-workshop",
      verbatiStyle: {
        layout: "workshop",
        typography: "geist-baskervville",
        palette: "pierre",
      },
      styleLinkMode: "proposal_local",
      styleChoice: "balanced",
      templateBundleId: "swiss_serif",
      applicantName: "Applicant A",
      applicantRole: "Role A",
      contactLine: "a@example.com",
      letterDate: "Paris, 1 May 2026",
      recipientDetails: "Recipient A",
      headerShowSender: true,
      headerShowDate: true,
      headerShowSubject: true,
      headerShowRecipient: true,
      headerShowRecipientDetails: true,
    },
  },
  {
    _id: "draft_b",
    _creationTime: 1710000001000,
    title: "Draft B Subject",
    content: "Draft B body.",
    status: "draft",
    sections: [{ type: "text", content: "Draft B body." }],
    metadata: {
      proposalType: "cover_letter",
      templateId: "proposal-workshop",
      verbatiStyle: {
        layout: "workshop",
        typography: "engaging",
        palette: "bordeaux",
      },
      styleLinkMode: "proposal_local",
      styleChoice: "warm",
      templateBundleId: "magazine_editorial",
      applicantName: "Applicant B",
      applicantRole: "Role B",
      contactLine: "b@example.com",
      letterDate: "Paris, 2 May 2026",
      recipientDetails: "Recipient B",
      headerShowSender: true,
      headerShowDate: true,
      headerShowSubject: true,
      headerShowRecipient: true,
      headerShowRecipientDetails: true,
    },
  },
] as any;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: (query: string) =>
    query === "proposalsPublic.default" ? DRAFT_PROPOSALS : null,
  useMutation: (reference: string) => {
    if (reference === "updateProposalPublic.default") return mockUpdateProposal;
    if (reference === "createProposalPublic.default") return mockCreateProposal;
    return vi.fn().mockResolvedValue(undefined);
  },
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: { generateProposal: "functions.generateProposal" },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: { getCurrent: "proposalSettings.getCurrent" },
    proposalsPublic: { default: "proposalsPublic.default" },
    createProposalPublic: { default: "createProposalPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({ cvs: [], currentCv: null, currentCvId: null, loadCv: vi.fn() }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: () => <div data-testid="proposal-input-form" />,
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: (props: any) => {
    proposalDisplayProps.push(props);
    return <div data-testid="proposal-display">{props.proposalContent}</div>;
  },
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

describe("ProposalForge draft heading hydration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    proposalDisplayProps.length = 0;
    mockUpdateProposal.mockClear();
    mockCreateProposal.mockClear();
  });

  it("hydrates heading fields from the opened draft row before writing output draft storage", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal?draftId=draft_b"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(readStoredProposalOutputDraft()?.generatedProposalId).toBe("draft_b");
    });

    const stored = readStoredProposalOutputDraft();
    expect(stored).toMatchObject({
      proposalApplicantName: "Applicant B",
      proposalApplicantRole: "Role B",
      proposalContactLine: "b@example.com",
      proposalLetterDate: "Paris, 2 May 2026",
      proposalRecipientDetails: "Recipient B",
    });

    await waitFor(() => {
      expect(proposalDisplayProps.at(-1)).toMatchObject({
        railTitle: "Applicant B",
        railMeta: "Role B",
        contactLine: "b@example.com",
        letterDate: "Paris, 2 May 2026",
        recipientDetails: "Recipient B",
      });
    });
  });

  it("hydrates the opened draft style instead of a stale local workspace style", async () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Draft B body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: "proposal-workshop",
        proposalVerbatiStyle: {
          layout: "workshop",
          typography: "engaging",
          palette: "bordeaux",
        },
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "warm",
        proposalApplicantName: "Applicant B",
        proposalApplicantRole: "Role B",
        proposalContactLine: "b@example.com",
        proposalLetterDate: "Paris, 2 May 2026",
        proposalRecipientDetails: "Recipient B",
        proposalDocumentTitle: "Draft B Subject",
        proposalDocumentMeta: "Draft",
        generatedProposalId: "draft_b",
        proposalOutputMode: "preview",
        paletteOverride: "bordeaux",
        customAccentHex: null,
        templateBundleId: "magazine_editorial",
        typographyOverride: "engaging",
        layoutOverride: null,
        proposalDocumentTitleManual: false,
        characterLimitMode: null,
        characterLimitValue: null,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/proposal?draftId=draft_a"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(readStoredProposalOutputDraft()?.generatedProposalId).toBe("draft_a");
    });

    await waitFor(() => {
      expect(proposalDisplayProps.at(-1)?.stylePreset).toMatchObject({
        layout: "workshop",
        typography: "geist-baskervville",
        palette: "pierre",
      });
    });

    expect(readStoredProposalOutputDraft()).toMatchObject({
      proposalStyleChoice: "balanced",
      templateBundleId: "swiss_serif",
      paletteOverride: "pierre",
    });
  });
});
