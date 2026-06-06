import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ProposalDraftDrawer,
  ProposalJobsDrawer,
  ProposalPasteJobDrawer,
  ProjectsLibraryDrawer,
  ProposalCvDrawer,
  ProposalLibraryDrawer,
} from "../ProposalForge";
import { CvForgeCvDrawer, CvForgeLibraryDrawer } from "../CvForge";
import type { LibraryItem } from "../../lib/application-library";
import type { CvDocument } from "../../types/cvDocument";

vi.mock("../../components/library/LibraryDocumentPreview", () => ({
  DrawerDocumentTile: ({
    item,
    badge,
    actionPill,
  }: {
    item: LibraryItem;
    badge?: string | null;
    actionPill?: React.ReactNode;
  }) => (
    <span
      className="forge-rail-document-tile"
      data-testid={`drawer-tile-${item.id}`}
    >
      <span
        className="forge-rail-document-tile__preview"
        data-testid={`drawer-preview-${item.id}`}
      >
        {badge ? (
          <span className="forge-rail-document-tile__badge">{badge}</span>
        ) : null}
        {actionPill ? (
          <span className="forge-rail-drawer__thumb-affordance">
            {actionPill}
          </span>
        ) : null}
      </span>
      <span className="forge-rail-document-tile__caption">
        <strong>{item.title}</strong>
        <span>meta</span>
      </span>
    </span>
  ),
  DrawerUnavailableThumbnail: ({ label }: { label?: string }) => (
    <span>{label ?? "Preview unavailable"}</span>
  ),
}));

const hydrateCvDocument = vi.fn(
  async () =>
    ({
      id: "cv-one",
      title: "CV one",
      sections: [],
      metadata: {},
    }) as unknown as CvDocument,
);

const proposalTypeOptions = [
  {
    id: "cover_letter" as const,
    label: "Letter",
    description: "A focused cover letter.",
    selected: true,
  },
  {
    id: "freelance_proposal" as const,
    label: "Proposal",
    description: "A client proposal.",
    selected: false,
  },
];

const toneOptions = [
  {
    id: null,
    label: "Auto",
    description: "Choose tone automatically.",
    selected: true,
  },
  {
    id: "expert",
    label: "Formal",
    description: "Formal and composed.",
    selected: false,
  },
];

function proposalItem(id: string, title: string): LibraryItem {
  return {
    id: `proposal:${id}`,
    type: "proposal",
    title,
    content: `${title} body`,
    updatedAt: 1,
    routeTarget: { kind: "route", to: `/proposal?draftId=${id}` },
    source: "convex",
  };
}

function savedProposalItem(id: string, title: string): LibraryItem {
  return {
    ...proposalItem(id, title),
    routeTarget: { kind: "route", to: `/proposal?view=saved&id=${id}` },
  };
}

function cvItem(id: string, title: string): LibraryItem {
  return {
    id: `cv:${id}`,
    type: "cv",
    title,
    updatedAt: 1,
    routeTarget: { kind: "route", to: `/cv?id=${id}` },
    source: "cv-library",
    cvDocument: {
      id,
      title,
      sections: [],
      metadata: {},
    } as unknown as CvDocument,
  };
}

describe("forge rail drawers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps loaded Proposal Draft sources compact and opens settings menus upward", async () => {
    const onOpenJobs = vi.fn();
    const onOpenPasteJob = vi.fn();
    const onClearJobContext = vi.fn();
    const onOpenCvs = vi.fn();
    const onClearCv = vi.fn();

    render(
      <>
        <h2>Draft</h2>
        <ProposalDraftDrawer
          jobTitle="Building Security Guard"
          jobMeta="AM · linkedin.com"
          jobSummary="Security role"
          jobContextKind="saved"
          sourceCvTitle="Robert Cooper"
          proposalTypeLabel="Letter"
          proposalTypeOptions={proposalTypeOptions}
          onSelectProposalType={vi.fn()}
          toneLabel="Formal"
          toneOptions={toneOptions}
          onSelectTone={vi.fn()}
          generateLabel="Generate"
          generateDisabled={false}
          generateState="idle"
          hasExistingDraft
          onGenerateDraft={vi.fn()}
          onOpenJobs={onOpenJobs}
          onOpenPasteJob={onOpenPasteJob}
          onClearJobContext={onClearJobContext}
          onOpenCvs={onOpenCvs}
          onClearCv={onClearCv}
        />
      </>,
    );

    expect(screen.getAllByText("Draft")).toHaveLength(1);
    expect(
      screen.queryByText(
        "Choose a job and CV, then generate a first proposal.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("JOB")).toBeInTheDocument();
    expect(screen.getByText("CV")).toBeInTheDocument();
    expect(screen.getByText("SETTINGS")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Choose saved job" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Replace with saved job" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Replace with pasted job" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pick a CV" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change CV" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Attached to this draft"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Generate" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Change job: Building Security Guard",
      }),
    );
    expect(onOpenJobs).toHaveBeenCalledTimes(1);
    expect(onOpenPasteJob).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove job context" }));
    expect(onClearJobContext).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Change attached CV: Robert Cooper" }),
    );
    expect(onOpenCvs).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove attached CV" }));
    expect(onClearCv).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Document type" }));
    const typeMenu = await screen.findByRole("menu", { name: "Document type" });
    await waitFor(() => expect(typeMenu).toHaveAttribute("data-side", "top"));
  });

  it("shows the real job title for pasted/generated draft sources", () => {
    render(
      <ProposalDraftDrawer
        jobTitle="Operations Associate"
        jobMeta="Studio North · example.com"
        jobSummary="Recurring launches and structured handoffs."
        jobContextKind="pasted"
        sourceCvTitle="Robert Cooper"
        proposalTypeLabel="Letter"
        proposalTypeOptions={proposalTypeOptions}
        onSelectProposalType={vi.fn()}
        toneLabel="Formal"
        toneOptions={toneOptions}
        onSelectTone={vi.fn()}
        generateLabel="Generate"
        generateDisabled={false}
        generateState="idle"
        hasExistingDraft
        onGenerateDraft={vi.fn()}
        onOpenJobs={vi.fn()}
        onOpenPasteJob={vi.fn()}
        onOpenCvs={vi.fn()}
        onClearCv={vi.fn()}
      />,
    );

    expect(screen.getByText("Operations Associate")).toBeInTheDocument();
    expect(screen.getByText("Studio North · example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change job: Operations Associate" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Robert Cooper")).toBeInTheDocument();
  });

  it("keeps empty Proposal Draft source actions explicit", () => {
    render(
      <ProposalDraftDrawer
        jobTitle=""
        jobMeta={null}
        jobSummary={null}
        jobContextKind="empty"
        sourceCvTitle={null}
        proposalTypeLabel="Letter"
        proposalTypeOptions={proposalTypeOptions}
        onSelectProposalType={vi.fn()}
        toneLabel="Auto"
        toneOptions={toneOptions}
        onSelectTone={vi.fn()}
        generateLabel="Generate"
        generateDisabled={false}
        generateState="idle"
        onGenerateDraft={vi.fn()}
        onOpenJobs={vi.fn()}
        onOpenPasteJob={vi.fn()}
        onOpenCvs={vi.fn()}
        onClearCv={vi.fn()}
      />,
    );

    expect(
      screen.queryByText(
        "Choose a job and CV, then generate a first proposal.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("JOB")).toBeInTheDocument();
    expect(screen.getByText("CV")).toBeInTheDocument();
    expect(screen.getByText("SETTINGS")).toBeInTheDocument();
    expect(screen.queryByText("No job loaded")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose saved job" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Paste job offer" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No CV attached")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pick a CV" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate" }),
    ).toBeInTheDocument();
  });

  it("localizes Proposal Draft drawer chrome in French without touching document language", () => {
    window.localStorage.setItem("twoweeks:ui-language", "fr");
    window.localStorage.setItem("twoweeks:document-language", "es");

    render(
      <ProposalDraftDrawer
        jobTitle=""
        jobMeta={null}
        jobSummary={null}
        jobContextKind="empty"
        sourceCvTitle={null}
        proposalTypeLabel=""
        proposalTypeOptions={proposalTypeOptions}
        onSelectProposalType={vi.fn()}
        toneLabel="Auto"
        toneOptions={toneOptions}
        onSelectTone={vi.fn()}
        generateLabel="Generate"
        generateDisabled={false}
        generateState="idle"
        onGenerateDraft={vi.fn()}
        onOpenJobs={vi.fn()}
        onOpenPasteJob={vi.fn()}
        onOpenCvs={vi.fn()}
        onClearCv={vi.fn()}
      />,
    );

    expect(screen.getByText("OFFRE")).toBeInTheDocument();
    expect(screen.getByText("CV")).toBeInTheDocument();
    expect(screen.getByText("PARAMÈTRES")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choisir une offre" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Coller une offre" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choisir un CV" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Type de document" }),
    ).toHaveTextContent("Lettre");
    expect(screen.getByRole("button", { name: "Ton" })).toBeInTheDocument();
    expect(screen.queryByText(/Proposition|proposition/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe(
      "es",
    );
  });

  it("shows staged job changes in the existing job field", () => {
    const onGenerateDraft = vi.fn();
    const onCancelStagedSource = vi.fn();

    function StagedDraftDrawer(): JSX.Element {
      const [staged, setStaged] = React.useState(true);

      return (
        <ProposalDraftDrawer
          jobTitle="Current Security Guard"
          jobMeta="Current Company · LinkedIn"
          jobSummary="Current letter source"
          jobContextKind="saved"
          stagedJobTitle={staged ? "Updated Operations Lead" : null}
          stagedJobMeta={staged ? "Studio Vale · Example Jobs" : null}
          stagedJobSummary={
            staged
              ? "Lead updated operations workflows and coordinate a new job context."
              : null
          }
          sourceCvTitle="Robert Cooper"
          proposalTypeLabel="Letter"
          proposalTypeOptions={proposalTypeOptions}
          onSelectProposalType={vi.fn()}
          toneLabel="Formal"
          toneOptions={toneOptions}
          onSelectTone={vi.fn()}
          generateLabel="Generate"
          generateDisabled={false}
          generateState="idle"
          hasExistingDraft
          onGenerateDraft={onGenerateDraft}
          onCancelStagedSource={() => {
            onCancelStagedSource();
            setStaged(false);
          }}
          onOpenJobs={vi.fn()}
          onOpenPasteJob={vi.fn()}
          onOpenCvs={vi.fn()}
          onClearCv={vi.fn()}
        />
      );
    }

    render(<StagedDraftDrawer />);

    expect(screen.queryByLabelText("Staged source")).not.toBeInTheDocument();
    expect(screen.getByText("Updated Operations Lead")).toBeInTheDocument();
    expect(screen.getByText("Studio Vale · Example Jobs")).toBeInTheDocument();
    expect(screen.queryByText("Current Security Guard")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Change job: Updated Operations Lead",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onGenerateDraft).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Cancel staged source change" }),
    );
    expect(onCancelStagedSource).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Staged source")).not.toBeInTheDocument();
    expect(screen.getByText("Current Security Guard")).toBeInTheDocument();
  });

  it("shows multiple staged sources in their existing source fields", () => {
    const onGenerateDraft = vi.fn();
    const onCancelStagedSource = vi.fn();

    render(
      <ProposalDraftDrawer
        jobTitle="Current Security Guard"
        jobMeta="Current Company · LinkedIn"
        jobSummary="Current letter source"
        jobContextKind="saved"
        stagedJobTitle="Updated Operations Lead"
        stagedJobMeta="Studio Vale · Example Jobs"
        stagedCvTitle="Operations CV"
        sourceCvTitle="Robert Cooper"
        proposalTypeLabel="Letter"
        proposalTypeOptions={proposalTypeOptions}
        onSelectProposalType={vi.fn()}
        toneLabel="Formal"
        toneOptions={toneOptions}
        onSelectTone={vi.fn()}
        generateLabel="Generate"
        generateDisabled={false}
        generateState="idle"
        hasExistingDraft
        onGenerateDraft={onGenerateDraft}
        onCancelStagedSource={onCancelStagedSource}
        onOpenJobs={vi.fn()}
        onOpenPasteJob={vi.fn()}
        onOpenCvs={vi.fn()}
        onClearCv={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Staged source")).not.toBeInTheDocument();
    expect(screen.getByText("Updated Operations Lead")).toBeInTheDocument();
    expect(screen.getByText("Operations CV")).toBeInTheDocument();
    expect(screen.getAllByText("Staged. Letter unchanged.")).toHaveLength(1);
    expect(
      screen.getByRole("button", {
        name: "Change job: Updated Operations Lead",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change attached CV: Operations CV" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Cancel staged source change" }),
    ).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /generate/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onGenerateDraft).toHaveBeenCalledTimes(1);
  });

  it("keeps Regenerate available for an existing draft even when job and CV are unchanged", () => {
    const onGenerateDraft = vi.fn();

    render(
      <ProposalDraftDrawer
        jobTitle="Current Security Guard"
        jobMeta="Current Company · LinkedIn"
        jobSummary="Current letter source"
        jobContextKind="saved"
        sourceCvTitle="Robert Cooper"
        proposalTypeLabel="Letter"
        proposalTypeOptions={proposalTypeOptions}
        onSelectProposalType={vi.fn()}
        toneLabel="Formal"
        toneOptions={toneOptions}
        onSelectTone={vi.fn()}
        generateLabel="Generate"
        generateDisabled={false}
        generateState="idle"
        hasExistingDraft
        onGenerateDraft={onGenerateDraft}
        onOpenJobs={vi.fn()}
        onOpenPasteJob={vi.fn()}
        onOpenCvs={vi.fn()}
        onClearCv={vi.fn()}
      />,
    );

    const regenerate = screen.getByRole("button", { name: "Regenerate" });
    expect(regenerate).not.toBeDisabled();

    fireEvent.click(regenerate);
    expect(onGenerateDraft).toHaveBeenCalledTimes(1);
  });

  it("does not show a competing generate footer while Rail Ask review is ready", () => {
    render(
      <ProposalDraftDrawer
        jobTitle="Current Security Guard"
        jobMeta="Current Company · LinkedIn"
        jobSummary="Current letter source"
        jobContextKind="saved"
        stagedJobTitle="Updated Operations Lead"
        stagedJobMeta="Studio Vale · Example Jobs"
        sourceCvTitle="Robert Cooper"
        proposalTypeLabel="Letter"
        proposalTypeOptions={proposalTypeOptions}
        onSelectProposalType={vi.fn()}
        toneLabel="Formal"
        toneOptions={toneOptions}
        onSelectTone={vi.fn()}
        generateLabel="Generate"
        generateDisabled={false}
        generateState="idle"
        hasExistingDraft
        askReviewReady
        onGenerateDraft={vi.fn()}
        onCancelStagedSource={vi.fn()}
        onOpenJobs={vi.fn()}
        onOpenPasteJob={vi.fn()}
        onOpenCvs={vi.fn()}
        onClearCv={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Staged source")).not.toBeInTheDocument();
    expect(screen.getByText("Updated Operations Lead")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /generate/i }),
    ).not.toBeInTheDocument();
  });

  it("uses a larger adaptive textarea for pasted job context", () => {
    render(
      <ProposalPasteJobDrawer
        value="About the job\nJob Summary\nLong pasted offer"
        onChange={vi.fn()}
        onCommit={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Paste job offer")).toHaveClass(
      "forge-rail-drawer__paste-job-input",
    );
    expect(
      screen.getByRole("button", { name: "Use job context" }),
    ).toBeInTheDocument();
  });

  it("wires job drawer primary and external actions", () => {
    const onSelectJob = vi.fn();
    const onOpenJob = vi.fn();
    const onOpenPasteJob = vi.fn();
    render(
      <ProposalJobsDrawer
        jobs={[
          {
            id: "job-one",
            title: "Employment lawyer",
            company: "Northstar",
            location: "Paris",
            sourceDomain: "linkedin.com",
          } as any,
        ]}
        onSelectJob={onSelectJob}
        onOpenJob={onOpenJob}
        onOpenPasteJob={onOpenPasteJob}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Paste job offer" }));
    expect(onOpenPasteJob).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getAllByRole("button", { name: /Employment lawyer/i })[0],
    );
    expect(onSelectJob).toHaveBeenCalledWith("job-one");

    const openJob = screen.getAllByRole("button", {
      name: "Open job page: Employment lawyer",
    })[0];
    expect(openJob).toHaveAttribute("data-toolbar-tooltip", "Open job page");
    fireEvent.click(openJob);
    expect(onOpenJob).toHaveBeenCalledWith("job-one");
  });

  it("wires CV attach drawer tile and external CV actions", () => {
    const onSelectCv = vi.fn();
    const onOpenCv = vi.fn();
    render(
      <ProposalCvDrawer
        items={[cvItem("cv-one", "CV one")]}
        activeCvId={null}
        hydrateCvDocument={hydrateCvDocument}
        onSelectCv={onSelectCv}
        onOpenCv={onOpenCv}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Attach CV: CV one" })[0],
    );
    expect(onSelectCv).toHaveBeenCalledWith("cv-one");
    expect(screen.getAllByText("Attach CV").length).toBeGreaterThan(0);
    expect(
      screen.getAllByTestId("drawer-preview-cv:cv-one")[0],
    ).toHaveTextContent("Attach CV");
    expect(
      screen
        .getAllByTestId("drawer-tile-cv:cv-one")[0]
        .querySelector(".forge-rail-document-tile__caption strong"),
    ).toHaveTextContent("CV one");

    const openCv = screen.getAllByRole("button", {
      name: "Open full CV: CV one",
    })[0];
    expect(openCv).toHaveAttribute("data-toolbar-tooltip", "Open full CV");
    fireEvent.click(openCv);
    expect(onOpenCv).toHaveBeenCalledWith("cv-one");
  });

  it("wires saved proposal drawer primary and external actions to the same proposal item", () => {
    const onOpenItem = vi.fn();
    const onOpenProposal = vi.fn();
    const item = savedProposalItem("proposal-one", "Proposal one");
    render(
      <ProposalLibraryDrawer
        items={[item]}
        hydrateCvDocument={hydrateCvDocument}
        onOpenItem={onOpenItem}
        onOpenProposal={onOpenProposal}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Open proposal: Proposal one" })[0],
    );
    expect(onOpenItem).toHaveBeenLastCalledWith(item);
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);

    const openProposal = screen.getAllByRole("button", {
      name: "Open full proposal: Proposal one",
    })[0];
    expect(openProposal).toHaveAttribute(
      "data-toolbar-tooltip",
      "Open proposal",
    );
    fireEvent.click(openProposal);
    expect(onOpenProposal).toHaveBeenCalledWith(item);
    expect(item.routeTarget).toEqual({
      kind: "route",
      to: "/proposal?view=saved&id=proposal-one",
    });
  });

  it("wires mixed library CV and proposal external actions", () => {
    const onOpenItem = vi.fn();
    const onOpenLibraryType = vi.fn();
    const cv = cvItem("cv-one", "CV one");
    const proposal = savedProposalItem("proposal-one", "Proposal one");
    render(
      <ProjectsLibraryDrawer
        items={[cv, proposal]}
        initialFilter="all"
        hydrateCvDocument={hydrateCvDocument}
        onOpenItem={onOpenItem}
        onOpenLibraryType={onOpenLibraryType}
        onDownloadItems={vi.fn()}
        onDeleteItems={vi.fn()}
      />,
    );

    const openCv = screen.getAllByRole("button", {
      name: "Open CV library: CV one",
    })[0];
    expect(openCv).toHaveAttribute("data-toolbar-tooltip", "Open CV library");
    fireEvent.click(openCv);
    expect(onOpenLibraryType).toHaveBeenLastCalledWith("cvs");

    const openProposal = screen.getAllByRole("button", {
      name: "Open proposals: Proposal one",
    })[0];
    expect(openProposal).toHaveAttribute(
      "data-toolbar-tooltip",
      "Open proposals",
    );
    fireEvent.click(openProposal);
    expect(onOpenLibraryType).toHaveBeenLastCalledWith("proposals");
  });

  it("localizes CV Forge drawer search chrome in French", () => {
    window.localStorage.setItem("twoweeks:ui-language", "fr");
    window.localStorage.setItem("twoweeks:document-language", "ar");
    window.localStorage.setItem(
      "twoweeks:forge-drawer:recent-cvforge-library-searches",
      JSON.stringify(["portfolio"]),
    );
    render(
      <CvForgeLibraryDrawer
        items={[cvItem("cv-one", "CV one"), proposalItem("one", "Lettre one")]}
        currentCvId="cv-one"
        hydrateCvDocument={hydrateCvDocument}
        onSelectCv={vi.fn()}
        onOpenItem={vi.fn()}
        onOpenLibraryType={vi.fn()}
      />,
    );

    const search = screen.getByPlaceholderText("Rechercher la bibliothèque");
    fireEvent.focus(search);

    expect(
      screen.getByRole("tablist", { name: "Filtre de bibliothèque" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Recherches récentes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Effacer" })).toBeInTheDocument();
    expect(screen.getByText("Vus récemment")).toBeInTheDocument();
    expect(screen.getByText("Tous les résultats")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: "Ouvrir la bibliothèque CV: CV one",
      })[0],
    ).toHaveAttribute("data-toolbar-tooltip", "Ouvrir la bibliothèque CV");
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe(
      "ar",
    );
  });

  it("localizes proposal drawer search chrome in Spanish without propuesta terminology", () => {
    window.localStorage.setItem("twoweeks:ui-language", "es");
    window.localStorage.setItem("twoweeks:document-language", "fr");
    window.localStorage.setItem(
      "twoweeks:forge-drawer:recent-proposal-searches",
      JSON.stringify(["legal"]),
    );
    render(
      <ProposalLibraryDrawer
        items={[proposalItem("one", "Carta one")]}
        hydrateCvDocument={hydrateCvDocument}
        onOpenItem={vi.fn()}
        onOpenProposal={vi.fn()}
      />,
    );

    const search = screen.getByPlaceholderText("Buscar cartas");
    fireEvent.focus(search);

    expect(screen.getByText("Búsquedas recientes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Borrar" })).toBeInTheDocument();
    expect(screen.getByText("Visto recientemente")).toBeInTheDocument();
    expect(screen.getByText("Todos los resultados")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Abrir carta: Carta one" })[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText("Abrir").length).toBeGreaterThan(0);
    expect(screen.queryByText(/propuesta/i)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe(
      "fr",
    );
  });

  it("applies library selection ring only to the preview object", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product.css"),
      "utf8",
    );

    expect(css).toContain(
      '.forge-rail-drawer__thumb-item[data-selected="true"] .forge-rail-document-tile__preview',
    );
    expect(css).not.toContain(
      '.forge-rail-drawer__thumb-item[data-selected="true"] .forge-template-card__preview',
    );
    expect(css).not.toContain(
      '.forge-rail-drawer__thumb-item[data-selected="true"] .forge-rail-drawer__thumb-button',
    );
    const selectedPreviewBlock = css.match(
      /\.forge-rail-drawer__thumb-item\[data-selected="true"\] \.forge-rail-document-tile__preview\s*\{[^}]*\}/,
    )?.[0];
    expect(selectedPreviewBlock).toBeTruthy();
    expect(selectedPreviewBlock).not.toContain("border:");
  });

  it("keeps template drawer shell spacing aligned with rail drawers", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.forge-template-panel\s*\{[\s\S]*padding: var\(--space-4\)/,
    );
    expect(css).toMatch(
      /\.forge-template-panel__grid\s*\{[\s\S]*column-gap: var\(--forge-drawer-template-grid-gutter\)/,
    );
    expect(css).toMatch(
      /\.forge-template-panel__grid\s*\{[\s\S]*row-gap: var\(--forge-drawer-grid-row-gap\)/,
    );
    expect(css).toMatch(
      /\.forge-template-panel__grid\s*\{[\s\S]*margin: calc\(var\(--forge-drawer-scroll-inset\) \* -1\)/,
    );
    expect(css).toMatch(
      /\.forge-template-panel__grid\s*\{[\s\S]*padding: var\(--forge-drawer-scroll-inset\)/,
    );
    expect(css).toMatch(
      /\.forge-rail-drawer__grid\s*\{[\s\S]*column-gap: var\(--forge-drawer-grid-gutter\)/,
    );
    expect(css).toMatch(
      /\.forge-rail-drawer__grid\s*\{[\s\S]*row-gap: var\(--forge-drawer-grid-row-gap\)/,
    );
  });

  it("keeps the Draft generate footer from painting a separate tray", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product.css"),
      "utf8",
    );

    const bodyBlock = css.match(
      /\.forge-rail-drawer__draft-body\s*\{[^}]*\}/,
    )?.[0];
    const footerBlock = css.match(
      /\.forge-rail-drawer__draft-footer\s*\{[^}]*\}/,
    )?.[0];

    expect(bodyBlock).toContain(
      "calc(var(--forge-drawer-scroll-inset) + var(--control-md) + var(--space-5))",
    );
    expect(footerBlock).toContain("background: transparent;");
    expect(footerBlock).toContain("border-block-start: 0;");
  });

  it("keeps forge page rails collapsible when a docked drawer needs the space", () => {
    const productCss = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product.css"),
      "utf8",
    );
    const cvCss = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product-cv.css"),
      "utf8",
    );
    const proposalCss = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product-proposal.css"),
      "utf8",
    );
    const proposalSource = fs.readFileSync(
      path.join(process.cwd(), "src/pages/ProposalForge.tsx"),
      "utf8",
    );
    const cvSource = fs.readFileSync(
      path.join(process.cwd(), "src/pages/CvForge.tsx"),
      "utf8",
    );

    expect(productCss).toMatch(
      /\.app-shell\[data-forge-panel-docked="true"\]\s*\{[\s\S]*var\(--app-nav-panel-width-wide\)/,
    );
    expect(proposalSource).toContain("data-forge-drawer-docked");
    expect(proposalSource).toContain("FORGE_DOCKED_PANEL_INLINE_SIZE_PX = 400");
    expect(proposalSource).toContain("proposalLayoutViewportWidth");
    expect(proposalSource).toContain(
      "proposalLayoutViewportWidth < proposalTwoPaneMinViewportWidth",
    );
    expect(proposalSource).toContain('openTemplateSurface("jobs", {');
    expect(proposalSource).toContain('openTemplateSurface("cvs", {');
    expect(proposalSource).toContain(
      'mode: isWideEnoughForDockedForgePanel ? "docked" : "overlay"',
    );
    expect(proposalSource).toContain(
      "minmax(0, 1fr) var(--proposal-workspace-rail-inline-size)",
    );
    expect(cvSource).toContain("data-forge-drawer-docked");
    expect(cvSource).toContain(
      "CV_WORKSPACE_DOCKED_PANEL_MIN_VIEWPORT_WIDTH = 1180",
    );
    expect(cvSource).toContain("const activeWorkspacePanel = templatePanelOpen");
    expect(cvSource).toContain(
      "const isWorkspacePanelDocked =\n    activeWorkspacePanel !== null && isWideEnoughForDockedPanel",
    );
    expect(cvSource).toContain("const openCvWorkspacePanel = React.useCallback");
    expect(cvSource).toContain(
      'mode: isWideEnoughForDockedPanel ? "docked" : "overlay"',
    );
    expect(proposalCss).toMatch(
      /\.dasti-proposal-skeleton-forge__stage\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--proposal-workspace-stage-inline-size\)\);[\s\S]*justify-self:\s*center;/,
    );
    expect(proposalCss).toMatch(
      /\.dasti-proposal-skeleton-forge\[data-forge-drawer-docked="true"\]\s*\{[\s\S]*grid-template-columns:[\s\S]*minmax\(0,\s*1fr\)[\s\S]*var\(--proposal-workspace-rail-inline-size\);[\s\S]*justify-content:\s*stretch;/,
    );
    expect(proposalCss).toMatch(
      /\.dasti-proposal-skeleton-forge\[data-forge-drawer-rail-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*var\(--proposal-workspace-stage-inline-size\)\);/,
    );
    expect(proposalCss).toMatch(
      /\.dasti-proposal-skeleton-forge\[data-forge-drawer-docked="true"\]\[data-forge-drawer-rail-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
    expect(cvCss).toMatch(
      /\.dasti-cv-skeleton-forge\[data-forge-drawer-docked="true"\]\s*\{[\s\S]*grid-template-columns:[\s\S]*minmax\(0,\s*1fr\)[\s\S]*var\(--cv-workspace-rail-inline-size\);[\s\S]*justify-content:\s*stretch;/,
    );
    expect(cvCss).toMatch(
      /\.dasti-cv-skeleton-forge\[data-forge-drawer-rail-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*var\(--cv-workspace-stage-inline-size\)\);/,
    );
    expect(cvCss).toMatch(
      /\.dasti-cv-skeleton-forge\[data-forge-drawer-docked="true"\]\[data-forge-drawer-rail-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
  });

  it("uses tokenized hover feedback for drawer and template tiles", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product.css"),
      "utf8",
    );

    expect(css).toContain(".forge-rail-drawer__thumb-button:hover");
    expect(css).toContain(".forge-rail-drawer__row:hover");
    expect(css).toMatch(
      /\.forge-rail-drawer__thumb-menu\s*\{[\s\S]*z-index:\s*4/,
    );
    expect(css).toMatch(
      /\.forge-rail-drawer__thumb-menu\[data-toolbar-tooltip\]\s*\{[\s\S]*position:\s*absolute/,
    );
    expect(css).toMatch(
      /\.forge-rail-drawer__row-icon\[data-toolbar-tooltip\],[\s\S]*\.forge-rail-drawer__thumb-menu\[data-toolbar-tooltip\]\s*\{[\s\S]*--dasti-toolbar-tooltip-inset-block-start:\s*auto;[\s\S]*--dasti-toolbar-tooltip-inset-block-end:\s*calc\(100% \+ var\(--space-1\)\);/,
    );
    expect(css).toMatch(
      /\.forge-rail-drawer__row-icon\s*\{[\s\S]*box-shadow:\s*var\(--shadow-popover\)/,
    );
    expect(css).toContain(".forge-rail-drawer__row-icon[data-toolbar-tooltip]");
    expect(css).toMatch(
      /\.forge-rail-drawer__row\s*\{[\s\S]*transition:[\s\S]*transform var\(--duration-fast\) var\(--ease-standard\)/,
    );
    expect(css).toContain(".forge-rail-drawer__row:focus-within");
    expect(css).toContain("transform: translateY(-1px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(
      /\.forge-rail-document-tile__badge\s*\{[\s\S]*z-index: 2/,
    );
    expect(css).toMatch(
      /\.forge-rail-drawer__thumb-affordance\s*\{[\s\S]*inset-block-end:\s*var\(--space-2\);[\s\S]*inset-inline-start:\s*50%;[\s\S]*min-height:\s*var\(--control-sm\);[\s\S]*font-size:\s*var\(--tx\);/,
    );
    expect(css).toMatch(
      /\.forge-rail-drawer__row-affordance\s*\{[\s\S]*min-height:\s*var\(--control-sm\);[\s\S]*padding:\s*0 var\(--space-3\);[\s\S]*font-size:\s*var\(--tx\);/,
    );
    expect(css).toMatch(
      /\.forge-rail-drawer__row-main \.forge-rail-drawer__row-affordance\s*\{[\s\S]*font-size:\s*var\(--tx\);[\s\S]*line-height:\s*var\(--lx\);/,
    );
    expect(css).toMatch(
      /\.forge-rail-drawer__row-affordance svg,[\s\S]*\.forge-rail-drawer__row-affordance-icon,[\s\S]*\.forge-rail-drawer__thumb-affordance svg\s*\{[\s\S]*width:\s*var\(--app-sidebar-icon-size\);[\s\S]*height:\s*var\(--app-sidebar-icon-size\);/,
    );
    expect(css).toMatch(
      /\.forge-rail-drawer__thumb-item:hover \.forge-rail-drawer__thumb-affordance,[\s\S]*\.forge-rail-drawer__thumb-item:focus-within \.forge-rail-drawer__thumb-affordance\s*\{[\s\S]*opacity:\s*1;/,
    );
  });

  it("renders the mixed library drawer with proposals active, all results visible, and selection stable", () => {
    render(
      <ProjectsLibraryDrawer
        items={[
          cvItem("cv-one", "CV one"),
          proposalItem("one", "Proposal one"),
          proposalItem("two", "Proposal two"),
          proposalItem("three", "Proposal three"),
        ]}
        initialFilter="proposals"
        hydrateCvDocument={hydrateCvDocument}
        onOpenItem={vi.fn()}
        onOpenLibraryType={vi.fn()}
        onDownloadItems={vi.fn()}
        onDeleteItems={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Proposals" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByText("Proposal one").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Proposal two").length).toBeGreaterThan(0);
    expect(screen.getByText("Proposal three")).toBeInTheDocument();
    expect(screen.getByText("All results")).toBeInTheDocument();
    expect(screen.queryByText("CV one")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all proposals" }));
    expect(screen.getByRole("tab", { name: "Proposals" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Proposal three")).toBeInTheDocument();
    expect(screen.queryByText("CV one")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("checkbox", {
        name: /Select proposal: Proposal one/i,
      })[0],
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 selected");
    expect(
      document.querySelector(".forge-rail-drawer__select-check svg"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear selection" }),
    ).toBeInTheDocument();
  });

  it("reveals all CVs from the CV attach drawer Show all action", () => {
    const onOpenCv = vi.fn();
    const { container } = render(
      <ProposalCvDrawer
        items={[
          cvItem("one", "CV one"),
          cvItem("two", "CV two"),
          cvItem("three", "CV three"),
        ]}
        activeCvId="two"
        hydrateCvDocument={hydrateCvDocument}
        onSelectCv={vi.fn()}
        onOpenCv={onOpenCv}
      />,
    );

    expect(screen.getAllByText("CV one").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CV two").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CV three").length).toBeGreaterThan(0);
    expect(screen.getByText("All results")).toBeInTheDocument();
    expect(screen.getAllByText("Attached").length).toBeGreaterThan(0);
    expect(screen.getByText("Attached")).toHaveClass(
      "forge-rail-document-tile__badge",
    );
    expect(screen.getAllByTestId("drawer-preview-cv:two")[0]).toHaveTextContent(
      "Attach CV",
    );
    expect(screen.getAllByText("CV two")).toHaveLength(1);
    expect(
      screen
        .getByRole("button", { name: "Attach CV: CV two" })
        .closest("article"),
    ).toHaveAttribute("data-state", "attached");
    expect(
      screen
        .getByRole("button", { name: "Attach CV: CV two" })
        .closest("article"),
    ).not.toHaveAttribute("data-selected");
    expect(
      Array.from(
        container.querySelectorAll(".forge-rail-drawer__section-title"),
      ).some((node) => node.textContent?.trim() === "Current"),
    ).toBe(false);
    expect(
      screen.queryByRole("button", { name: "More actions for CV two" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Open full CV: CV two" })[0],
    );
    expect(onOpenCv).toHaveBeenCalledWith("two");

    fireEvent.click(screen.getByRole("button", { name: "Show all CVs" }));
    expect(screen.getAllByText("CV three").length).toBeGreaterThan(0);
  });

  it("reveals all proposals from the proposal drawer Show all action", () => {
    const onOpenItem = vi.fn();
    const onOpenProposal = vi.fn();
    render(
      <ProposalLibraryDrawer
        items={[
          proposalItem("one", "Proposal one"),
          proposalItem("two", "Proposal two"),
          proposalItem("three", "Proposal three"),
        ]}
        hydrateCvDocument={hydrateCvDocument}
        onOpenItem={onOpenItem}
        onOpenProposal={onOpenProposal}
      />,
    );

    expect(screen.getAllByText("Proposal one").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Proposal two").length).toBeGreaterThan(0);
    expect(screen.getByText("Proposal three")).toBeInTheDocument();
    expect(screen.getByText("All results")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "More actions for Proposal one" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Open full proposal: Proposal one",
      })[0],
    );
    expect(onOpenProposal).toHaveBeenCalledWith(
      expect.objectContaining({ id: "proposal:one" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Show all proposals" }));
    expect(screen.getByText("Proposal three")).toBeInTheDocument();
  });

  it("renders the CV Forge CV rail drawer as CV-only without library tabs or bulk selection", () => {
    const onSelectCv = vi.fn();
    const onOpenCv = vi.fn();
    render(
      <CvForgeCvDrawer
        items={[
          cvItem("one", "CV one"),
          cvItem("two", "CV two"),
          proposalItem("one", "Proposal one"),
        ]}
        currentCvId="one"
        hydrateCvDocument={hydrateCvDocument}
        onSelectCv={onSelectCv}
        onOpenCv={onOpenCv}
      />,
    );

    expect(screen.queryByRole("tab", { name: "All" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "CVs" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Proposals" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByText("Current").length).toBeGreaterThan(0);
    expect(screen.queryByText("Proposal one")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Open CV: CV two" })[0],
    );
    expect(onSelectCv).toHaveBeenCalledWith("two");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Open full CV: CV two" })[0],
    );
    expect(onOpenCv).toHaveBeenCalledWith("two");
  });

  it("renders the CV Forge mixed library drawer with CVs active by default", () => {
    const onOpenItem = vi.fn();
    const onOpenLibraryType = vi.fn();
    const { container } = render(
      <CvForgeLibraryDrawer
        items={[
          cvItem("one", "CV one"),
          cvItem("two", "CV two"),
          cvItem("three", "CV three"),
          proposalItem("one", "Proposal one"),
        ]}
        currentCvId="one"
        hydrateCvDocument={hydrateCvDocument}
        onSelectCv={vi.fn()}
        onOpenItem={onOpenItem}
        onOpenLibraryType={onOpenLibraryType}
      />,
    );

    expect(screen.getByRole("tab", { name: "CVs" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByText("CV one").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CV three").length).toBeGreaterThan(0);
    expect(screen.queryByText("Proposal one")).not.toBeInTheDocument();
    expect(screen.getAllByText("Current").length).toBeGreaterThan(0);
    expect(screen.getByText("Current")).toHaveClass(
      "forge-rail-document-tile__badge",
    );
    expect(screen.getAllByText("CV one")).toHaveLength(1);
    expect(
      screen
        .getByRole("button", { name: "Open CV: CV one" })
        .closest("article"),
    ).toHaveAttribute("data-state", "current");
    expect(
      screen
        .getByRole("button", { name: "Open CV: CV one" })
        .closest("article"),
    ).not.toHaveAttribute("data-selected");
    expect(
      Array.from(
        container.querySelectorAll(".forge-rail-drawer__section-title"),
      ).some((node) => node.textContent?.trim() === "Current"),
    ).toBe(false);
    expect(
      screen.queryByRole("button", { name: "More actions for CV one" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Open CV library: CV one" }),
    );
    expect(onOpenLibraryType).toHaveBeenCalledWith("cvs");
    expect(screen.getByText("All results")).toBeInTheDocument();
  });
});
