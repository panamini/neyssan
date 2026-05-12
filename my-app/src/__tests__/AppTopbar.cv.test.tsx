import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppTopbar } from "../components/AppTopbar";
import {
  CvForgeTopbarProvider,
  useRegisterCvForgeTopbar,
} from "../contexts/CvForgeTopbarContext";
import type { AtsAuditResult } from "../lib/ats-audit/types";

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => ({ isAuthenticated: false, isLoading: false })),
  useQuery: vi.fn(() => undefined),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(() => ({ isLoaded: true, isSignedIn: false })),
  useUser: vi.fn(() => ({ user: null })),
  UserButton: () => null,
}));

vi.mock("../contexts/CvLibraryContext", () => ({
  CvLibraryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCvLibrary: () => ({
    currentCv: { id: "cv_1", title: "Jessica Claire" },
    currentCvId: "cv_1",
    cvs: [{ id: "cv_1", title: "Jessica Claire" }],
  }),
}));

const emptyIssues = {
  parsing: [],
  layout: [],
  typography: [],
  sections: [],
  keywords: [],
  content: [],
};

const excellentAudit: AtsAuditResult = {
  score: 100,
  verdict: "excellent",
  blockers: [],
  categoryScores: {
    parsing: 100,
    layout: 100,
    typography: 100,
    sections: 100,
    keywords: 100,
    content: 100,
  },
  issues: emptyIssues,
  priorityFixes: [],
};

function makeAudit(
  overrides: Partial<AtsAuditResult> = {},
): AtsAuditResult {
  return {
    ...excellentAudit,
    ...overrides,
  };
}

function RegisterCvTopbar(): null {
  const registration = React.useMemo(
    () => ({
      mode: "preview" as const,
      hasCurrentCv: true,
      documentTitle: "Jessica Claire",
      titlePlaceholder: "Untitled CV",
      onTitleCommit: vi.fn(),
      hasTrustedExport: true,
      atsAudit: excellentAudit,
      importIssueCount: 0,
      importReviewBannerVisible: false,
      exporting: false,
      pageCount: 1,
      onOpenAtsAudit: vi.fn(),
      onOpenImportReview: vi.fn(),
      onExportPdf: vi.fn(),
      onExportDocx: vi.fn(),
    }),
    [],
  );
  useRegisterCvForgeTopbar(registration);
  return null;
}

describe("AppTopbar CV controls", () => {
  it("renders CV status and share controls in the global topbar", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_1"]}>
        <CvForgeTopbarProvider>
          <RegisterCvTopbar />
          <AppTopbar
            commandPaletteOpen={false}
            onOpenCommandPalette={vi.fn()}
          />
        </CvForgeTopbarProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Working on:")).not.toBeInTheDocument();
    expect(container.querySelector(".app-topbar__doc-identity")).toHaveAttribute(
      "title",
      "Jessica Claire",
    );
    expect(container.querySelector(".app-topbar__doc-identity")).toHaveClass(
      "app-topbar__doc-identity",
    );
    expect(
      container.querySelector(".document-title-editor__text"),
    ).toHaveTextContent("Jessica Claire");
    expect(
      container.querySelector(".app-topbar__doc-title-suffix"),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".app-topbar__actions")).toBeTruthy();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByText("ATS-ready")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ATS audit looks good" })).toHaveClass(
      "app-topbar__doc-health",
    );
    expect(screen.getByRole("button", { name: "ATS audit looks good" })).toHaveTextContent("ATS");
    expect(screen.getByLabelText("Saved")).toBeInTheDocument();
    expect(screen.queryByText("1 page")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toHaveTextContent(
      "Share",
    );
    expect(screen.getByRole("button", { name: "Share" })).toHaveAttribute(
      "data-share-tooltip-mode",
      "compact",
    );

    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(
      await screen.findByRole("menuitem", { name: "Safe-send checklist" }),
    ).toBeInTheDocument();
  });

  it("commits CV title edits from the document identity editor", async () => {
    const user = userEvent.setup();
    const onTitleCommit = vi.fn();

    function RegisterEditableTitle(): null {
      const registration = React.useMemo(
        () => ({
          mode: "edit" as const,
          hasCurrentCv: true,
          documentTitle: "Jessica Claire",
          titlePlaceholder: "Untitled CV",
          onTitleCommit,
          hasTrustedExport: true,
          atsAudit: excellentAudit,
          importIssueCount: 0,
          importReviewBannerVisible: false,
          exporting: false,
          pageCount: 1,
          onOpenAtsAudit: vi.fn(),
          onOpenImportReview: vi.fn(),
          onExportPdf: vi.fn(),
          onExportDocx: vi.fn(),
        }),
        [],
      );
      useRegisterCvForgeTopbar(registration);
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_1"]}>
        <CvForgeTopbarProvider>
          <RegisterEditableTitle />
          <AppTopbar
            commandPaletteOpen={false}
            onOpenCommandPalette={vi.fn()}
          />
        </CvForgeTopbarProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Edit CV title" }));
    const input = screen.getByLabelText("CV title");
    await user.clear(input);
    await user.type(input, "Security Guard Resume{Enter}");

    expect(onTitleCommit).toHaveBeenCalledWith("Security Guard Resume");
  });

  it("does not show ATS or export review language for untrusted export metadata", () => {
    function RegisterUntrustedExport(): null {
      const registration = React.useMemo(
        () => ({
          mode: "edit" as const,
          hasCurrentCv: true,
          hasTrustedExport: false,
          atsAudit: makeAudit({ verdict: "good", score: 82 }),
          importIssueCount: 0,
          importReviewBannerVisible: false,
          exporting: false,
          pageCount: 2,
          onOpenAtsAudit: vi.fn(),
          onOpenImportReview: vi.fn(),
          onExportPdf: vi.fn(),
          onExportDocx: vi.fn(),
        }),
        [],
      );
      useRegisterCvForgeTopbar(registration);
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_1"]}>
        <CvForgeTopbarProvider>
          <RegisterUntrustedExport />
          <AppTopbar
            commandPaletteOpen={false}
            onOpenCommandPalette={vi.fn()}
          />
        </CvForgeTopbarProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByText("ATS-ready")).not.toBeInTheDocument();
    expect(screen.queryByText("ATS review")).not.toBeInTheDocument();
    expect(screen.queryByText("Export ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Export review")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ATS audit looks good" })).toHaveClass(
      "app-topbar__doc-health",
    );
    expect(screen.getByRole("button", { name: "ATS audit looks good" })).toHaveTextContent("ATS");
    expect(screen.getByText("2 pages")).toBeInTheDocument();
  });

  it("shows an ATS issues badge when the audit needs review", async () => {
    const user = userEvent.setup();
    const onOpenAtsAudit = vi.fn();

    function RegisterNeedsReview(): null {
      const registration = React.useMemo(
        () => ({
          mode: "edit" as const,
          hasCurrentCv: true,
          hasTrustedExport: true,
          atsAudit: makeAudit({ verdict: "needs_review", score: 68 }),
          importIssueCount: 0,
          importReviewBannerVisible: false,
          exporting: false,
          pageCount: 2,
          onOpenAtsAudit,
          onOpenImportReview: vi.fn(),
          onExportPdf: vi.fn(),
          onExportDocx: vi.fn(),
        }),
        [],
      );
      useRegisterCvForgeTopbar(registration);
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_1"]}>
        <CvForgeTopbarProvider>
          <RegisterNeedsReview />
          <AppTopbar
            commandPaletteOpen={false}
            onOpenCommandPalette={vi.fn()}
          />
        </CvForgeTopbarProvider>
      </MemoryRouter>,
    );

    const atsIssues = screen.getByRole("button", { name: "ATS issues found" });
    expect(atsIssues).toHaveTextContent("ATS");
    await user.click(atsIssues);
    expect(onOpenAtsAudit).toHaveBeenCalledTimes(1);
  });

  it("shows an ATS blocked badge when the audit is blocked", async () => {
    const user = userEvent.setup();
    const onOpenAtsAudit = vi.fn();

    function RegisterBlocked(): null {
      const registration = React.useMemo(
        () => ({
          mode: "edit" as const,
          hasCurrentCv: true,
          hasTrustedExport: true,
          atsAudit: makeAudit({ verdict: "blocked", score: 72 }),
          importIssueCount: 1,
          importReviewBannerVisible: false,
          exporting: false,
          pageCount: 2,
          onOpenAtsAudit,
          onOpenImportReview: vi.fn(),
          onExportPdf: vi.fn(),
          onExportDocx: vi.fn(),
        }),
        [],
      );
      useRegisterCvForgeTopbar(registration);
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_1"]}>
        <CvForgeTopbarProvider>
          <RegisterBlocked />
          <AppTopbar
            commandPaletteOpen={false}
            onOpenCommandPalette={vi.fn()}
          />
        </CvForgeTopbarProvider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Review needed" }),
    ).not.toBeInTheDocument();
    const atsBlocked = screen.getByRole("button", { name: "ATS blocked" });
    expect(atsBlocked).toHaveTextContent("ATS");
    await user.click(atsBlocked);
    expect(onOpenAtsAudit).toHaveBeenCalledTimes(1);
  });

  it("does not show ATS review when there is no current CV", () => {
    function RegisterNoCv(): null {
      const registration = React.useMemo(
        () => ({
          mode: "edit" as const,
          hasCurrentCv: false,
          hasTrustedExport: false,
          atsAudit: null,
          importIssueCount: 0,
          importReviewBannerVisible: false,
          exporting: false,
          pageCount: null,
          onOpenAtsAudit: vi.fn(),
          onOpenImportReview: vi.fn(),
          onExportPdf: vi.fn(),
          onExportDocx: vi.fn(),
        }),
        [],
      );
      useRegisterCvForgeTopbar(registration);
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForgeTopbarProvider>
          <RegisterNoCv />
          <AppTopbar
            commandPaletteOpen={false}
            onOpenCommandPalette={vi.fn()}
          />
        </CvForgeTopbarProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("No CV")).toBeInTheDocument();
    expect(screen.queryByText("ATS review")).not.toBeInTheDocument();
    expect(screen.queryByText("ATS")).not.toBeInTheDocument();
  });

  it("exposes Exporting PDF on the document state dot", () => {
    function RegisterExporting(): null {
      const registration = React.useMemo(
        () => ({
          mode: "preview" as const,
          hasCurrentCv: true,
          hasTrustedExport: true,
          atsAudit: excellentAudit,
          importIssueCount: 0,
          importReviewBannerVisible: false,
          exporting: true,
          pageCount: null,
          onOpenAtsAudit: vi.fn(),
          onOpenImportReview: vi.fn(),
          onExportPdf: vi.fn(),
          onExportDocx: vi.fn(),
        }),
        [],
      );
      useRegisterCvForgeTopbar(registration);
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_1"]}>
        <CvForgeTopbarProvider>
          <RegisterExporting />
          <AppTopbar
            commandPaletteOpen={false}
            onOpenCommandPalette={vi.fn()}
          />
        </CvForgeTopbarProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Exporting PDF")).toBeInTheDocument();
  });

  it("uses the workspace banner for import review until that banner is dismissed", async () => {
    const user = userEvent.setup();
    const onOpenImportReview = vi.fn();

    function RegisterImportReview({
      bannerVisible,
    }: {
      bannerVisible: boolean;
    }): null {
      const registration = React.useMemo(
        () => ({
          mode: "edit" as const,
          hasCurrentCv: true,
          hasTrustedExport: true,
          atsAudit: null,
          importIssueCount: 2,
          importReviewBannerVisible: bannerVisible,
          exporting: false,
          pageCount: 2,
          onOpenAtsAudit: vi.fn(),
          onOpenImportReview,
          onExportPdf: vi.fn(),
          onExportDocx: vi.fn(),
        }),
        [bannerVisible],
      );
      useRegisterCvForgeTopbar(registration);
      return null;
    }

    const { rerender } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_1"]}>
        <CvForgeTopbarProvider>
          <RegisterImportReview bannerVisible />
          <AppTopbar
            commandPaletteOpen={false}
            onOpenCommandPalette={vi.fn()}
          />
        </CvForgeTopbarProvider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Review needed" }),
    ).not.toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/cv?id=cv_1"]}>
        <CvForgeTopbarProvider>
          <RegisterImportReview bannerVisible={false} />
          <AppTopbar
            commandPaletteOpen={false}
            onOpenCommandPalette={vi.fn()}
          />
        </CvForgeTopbarProvider>
      </MemoryRouter>,
    );

    const reviewNeeded = screen.getByRole("button", { name: "Review needed" });
    expect(reviewNeeded).toHaveTextContent("Review needed");
    await user.click(reviewNeeded);
    expect(onOpenImportReview).toHaveBeenCalledTimes(1);
  });
});
