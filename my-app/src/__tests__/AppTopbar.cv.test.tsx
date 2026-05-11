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
      exporting: false,
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

    expect(screen.getByText("Working on:")).toBeInTheDocument();
    expect(screen.getByText("Jessica Claire profile source")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Saved").closest(".ds-status")).toBeTruthy();
    expect(screen.getByText("ATS-ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(
      await screen.findByRole("menuitem", { name: "Safe-send checklist" }),
    ).toBeInTheDocument();
  });
});
