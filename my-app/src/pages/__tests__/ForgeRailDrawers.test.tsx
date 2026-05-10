import React from "react";
import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ProposalJobsDrawer,
  ProjectsLibraryDrawer,
  ProposalCvDrawer,
  ProposalLibraryDrawer,
} from "../ProposalForge";
import { CvForgeLibraryDrawer } from "../CvForge";
import type { LibraryItem } from "../../lib/application-library";
import type { CvDocument } from "../../types/cvDocument";

vi.mock("../../components/library/LibraryDocumentPreview", () => ({
  DrawerDocumentTile: ({
    item,
    badge,
  }: {
    item: LibraryItem;
    badge?: string | null;
  }) => (
    <span data-testid={`drawer-preview-${item.id}`}>
      {item.title}
      {badge ? <span className="forge-rail-document-tile__badge">{badge}</span> : null}
    </span>
  ),
  DrawerUnavailableThumbnail: ({ label }: { label?: string }) => (
    <span>{label ?? "Preview unavailable"}</span>
  ),
}));

const hydrateCvDocument = vi.fn(async () => ({
  id: "cv-one",
  title: "CV one",
  sections: [],
  metadata: {},
}) as unknown as CvDocument);

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
  it("wires job drawer primary and external actions", () => {
    const onSelectJob = vi.fn();
    const onOpenJob = vi.fn();
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
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Employment lawyer/i })[0]);
    expect(onSelectJob).toHaveBeenCalledWith("job-one");

    const openJob = screen.getAllByRole("button", { name: "Open job details for Employment lawyer" })[0];
    expect(openJob).toHaveAttribute("data-toolbar-tooltip", "Open job page");
    fireEvent.click(openJob);
    expect(onOpenJob).toHaveBeenCalledWith("job-one");
  });

  it("wires CV attach drawer tile and external CV actions", () => {
    const onSelectCv = vi.fn();
    const onOpenCvLibrary = vi.fn();
    render(
      <ProposalCvDrawer
        items={[cvItem("cv-one", "CV one")]}
        activeCvId={null}
        hydrateCvDocument={hydrateCvDocument}
        onSelectCv={onSelectCv}
        onOpenCvLibrary={onOpenCvLibrary}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Attach CV: CV one" })[0]);
    expect(onSelectCv).toHaveBeenCalledWith("cv-one");

    const openCv = screen.getAllByRole("button", { name: "Open CV library for CV one" })[0];
    expect(openCv).toHaveAttribute("data-toolbar-tooltip", "Open CV library");
    fireEvent.click(openCv);
    expect(onOpenCvLibrary).toHaveBeenCalled();
  });

  it("wires saved proposal drawer primary and external actions to the same proposal item", () => {
    const onOpenItem = vi.fn();
    const onOpenProposalLibrary = vi.fn();
    const item = savedProposalItem("proposal-one", "Proposal one");
    render(
      <ProposalLibraryDrawer
        items={[item]}
        hydrateCvDocument={hydrateCvDocument}
        onOpenItem={onOpenItem}
        onOpenProposalLibrary={onOpenProposalLibrary}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Open proposal Proposal one" })[0]);
    expect(onOpenItem).toHaveBeenLastCalledWith(item);

    const openProposal = screen.getAllByRole("button", { name: "Open proposals library for Proposal one" })[0];
    expect(openProposal).toHaveAttribute("data-toolbar-tooltip", "Open proposals");
    fireEvent.click(openProposal);
    expect(onOpenProposalLibrary).toHaveBeenCalled();
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

    const openCv = screen.getAllByRole("button", { name: "Open CV library for CV one" })[0];
    expect(openCv).toHaveAttribute("data-toolbar-tooltip", "Open CV library");
    fireEvent.click(openCv);
    expect(onOpenLibraryType).toHaveBeenLastCalledWith("cvs");

    const openProposal = screen.getAllByRole("button", { name: "Open proposals library for Proposal one" })[0];
    expect(openProposal).toHaveAttribute("data-toolbar-tooltip", "Open proposals");
    fireEvent.click(openProposal);
    expect(onOpenLibraryType).toHaveBeenLastCalledWith("proposals");
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

    expect(css).toMatch(/\.forge-template-panel\s*\{[\s\S]*padding: var\(--space-4\)/);
    expect(css).toMatch(/\.forge-template-panel__grid\s*\{[\s\S]*column-gap: var\(--space-3\)/);
    expect(css).toMatch(/\.forge-template-panel__grid\s*\{[\s\S]*row-gap: var\(--space-5\)/);
    expect(css).toMatch(/\.forge-template-panel__grid\s*\{[\s\S]*margin: calc\(var\(--space-1\) \* -1\)/);
    expect(css).toMatch(/\.forge-template-panel__grid\s*\{[\s\S]*padding: var\(--space-1\)/);
    expect(css).toMatch(/\.forge-rail-drawer__grid\s*\{[\s\S]*column-gap: var\(--space-3\)/);
    expect(css).toMatch(/\.forge-rail-drawer__grid\s*\{[\s\S]*row-gap: var\(--space-5\)/);
  });

  it("keeps forge page rails collapsible when a pinned drawer needs the space", () => {
    const productCss = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product.css"),
      "utf8",
    );
    const cvCss = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product-cv.css"),
      "utf8",
    );

    expect(productCss).toMatch(
      /\.app-shell\[data-forge-panel-docked="true"\]\s*\{[\s\S]*var\(--app-nav-panel-width-wide\)/,
    );
    expect(cvCss).toMatch(
      /\.dasti-cv-skeleton-forge\[data-forge-drawer-rail-collapsed="true"\]\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*var\(--cv-workspace-stage-inline-size\)\);/,
    );
  });

  it("uses tokenized hover feedback for drawer and template tiles", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/styles/product.css"),
      "utf8",
    );

    expect(css).toContain(".forge-rail-drawer__thumb-button:hover");
    expect(css).toContain(".forge-rail-drawer__row:hover");
    expect(css).toMatch(/\.forge-rail-drawer__thumb-menu\s*\{[\s\S]*z-index:\s*4/);
    expect(css).toMatch(/\.forge-rail-drawer__thumb-menu\[data-toolbar-tooltip\]\s*\{[\s\S]*position:\s*absolute/);
    expect(css).toMatch(/\.forge-rail-drawer__row-icon\[data-toolbar-tooltip\],[\s\S]*\.forge-rail-drawer__thumb-menu\[data-toolbar-tooltip\]\s*\{[\s\S]*--dasti-toolbar-tooltip-inset-block-start:\s*auto;[\s\S]*--dasti-toolbar-tooltip-inset-block-end:\s*calc\(100% \+ var\(--space-1\)\);/);
    expect(css).toMatch(/\.forge-rail-drawer__row-icon\s*\{[\s\S]*box-shadow:\s*var\(--shadow-popover\)/);
    expect(css).toContain(".forge-rail-drawer__row-icon[data-toolbar-tooltip]");
    expect(css).toMatch(/\.forge-rail-drawer__row\s*\{[\s\S]*transition:[\s\S]*transform var\(--duration-fast\) var\(--ease-standard\)/);
    expect(css).toContain(".forge-rail-drawer__row:focus-within");
    expect(css).toContain("transform: translateY(-1px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(/\.forge-rail-document-tile__badge\s*\{[\s\S]*z-index: 2/);
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

    fireEvent.click(screen.getAllByRole("checkbox", { name: /Select proposal Proposal one/i })[0]);
    expect(screen.getByRole("status")).toHaveTextContent("1 selected");
    expect(document.querySelector(".forge-rail-drawer__select-check svg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear selection" })).toBeInTheDocument();
  });

  it("reveals all CVs from the CV attach drawer Show all action", () => {
    const onOpenCvLibrary = vi.fn();
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
        onOpenCvLibrary={onOpenCvLibrary}
      />,
    );

    expect(screen.getAllByText("CV one").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CV two").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CV three").length).toBeGreaterThan(0);
    expect(screen.getByText("All results")).toBeInTheDocument();
    expect(screen.getAllByText("Attached").length).toBeGreaterThan(0);
    expect(screen.getByText("Attached")).toHaveClass("forge-rail-document-tile__badge");
    expect(screen.getAllByText("CV two")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Attach CV: CV two" }).closest("article"),
    ).toHaveAttribute("data-state", "attached");
    expect(
      screen.getByRole("button", { name: "Attach CV: CV two" }).closest("article"),
    ).not.toHaveAttribute("data-selected");
    expect(
      Array.from(container.querySelectorAll(".forge-rail-drawer__section-title")).some(
        (node) => node.textContent?.trim() === "Current",
      ),
    ).toBe(false);
    expect(screen.queryByRole("button", { name: "More actions for CV two" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open CV library for CV two" }));
    expect(onOpenCvLibrary).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Show all CVs" }));
    expect(screen.getAllByText("CV three").length).toBeGreaterThan(0);
  });

  it("reveals all proposals from the proposal drawer Show all action", () => {
    const onOpenItem = vi.fn();
    const onOpenProposalLibrary = vi.fn();
    render(
      <ProposalLibraryDrawer
        items={[
          proposalItem("one", "Proposal one"),
          proposalItem("two", "Proposal two"),
          proposalItem("three", "Proposal three"),
        ]}
        hydrateCvDocument={hydrateCvDocument}
        onOpenItem={onOpenItem}
        onOpenProposalLibrary={onOpenProposalLibrary}
      />,
    );

    expect(screen.getAllByText("Proposal one").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Proposal two").length).toBeGreaterThan(0);
    expect(screen.getByText("Proposal three")).toBeInTheDocument();
    expect(screen.getByText("All results")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions for Proposal one" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Open proposals library for Proposal one" })[0]);
    expect(onOpenProposalLibrary).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Show all proposals" }));
    expect(screen.getByText("Proposal three")).toBeInTheDocument();
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
    expect(screen.getByText("Current")).toHaveClass("forge-rail-document-tile__badge");
    expect(screen.getAllByText("CV one")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Open CV: CV one" }).closest("article"),
    ).toHaveAttribute("data-state", "current");
    expect(
      screen.getByRole("button", { name: "Open CV: CV one" }).closest("article"),
    ).not.toHaveAttribute("data-selected");
    expect(
      Array.from(container.querySelectorAll(".forge-rail-drawer__section-title")).some(
        (node) => node.textContent?.trim() === "Current",
      ),
    ).toBe(false);
    expect(screen.queryByRole("button", { name: "More actions for CV one" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open CV library for CV one" }));
    expect(onOpenLibraryType).toHaveBeenCalledWith("cvs");
    expect(screen.getByText("All results")).toBeInTheDocument();
  });
});
