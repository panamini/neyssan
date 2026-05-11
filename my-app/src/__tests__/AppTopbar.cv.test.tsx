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

function RegisterCvTopbar(): null {
  const registration = React.useMemo(
    () => ({
      mode: "preview" as const,
      hasCurrentCv: true,
      hasTrustedExport: true,
      importIssueCount: 0,
      importReviewBannerVisible: false,
      exporting: false,
      pageCount: 1,
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

    render(
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
    expect(screen.getByText("Jessica Claire profile source")).toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByText("ATS-ready")).not.toBeInTheDocument();
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

  it("does not show ATS or export review language for untrusted export metadata", () => {
    function RegisterUntrustedExport(): null {
      const registration = React.useMemo(
        () => ({
          mode: "edit" as const,
          hasCurrentCv: true,
          hasTrustedExport: false,
          importIssueCount: 0,
          importReviewBannerVisible: false,
          exporting: false,
          pageCount: 2,
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
    expect(screen.getByText("2 pages")).toBeInTheDocument();
  });

  it("does not show ATS review when there is no current CV", () => {
    function RegisterNoCv(): null {
      const registration = React.useMemo(
        () => ({
          mode: "edit" as const,
          hasCurrentCv: false,
          hasTrustedExport: false,
          importIssueCount: 0,
          importReviewBannerVisible: false,
          exporting: false,
          pageCount: null,
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
  });

  it("exposes Exporting PDF on the document state dot", () => {
    function RegisterExporting(): null {
      const registration = React.useMemo(
        () => ({
          mode: "preview" as const,
          hasCurrentCv: true,
          hasTrustedExport: true,
          importIssueCount: 0,
          importReviewBannerVisible: false,
          exporting: true,
          pageCount: null,
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
          importIssueCount: 2,
          importReviewBannerVisible: bannerVisible,
          exporting: false,
          pageCount: 2,
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
