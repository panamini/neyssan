import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import { CvForge } from "../CvForge";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";
import { createQuickStartLocationState } from "../../lib/quick-start-routing";

const { useCvLibraryMock } = vi.hoisted(() => ({
  useCvLibraryMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => ({
    preset1: null,
    preset2: null,
    preset3: null,
    activeSlot: null,
  })),
}));

vi.mock("../../components/ProfileReviewCard", () => ({
  ProfileReviewCard: ({ cvId }: { cvId?: string }) => (
    <div>Mock profile editor {cvId ?? "none"}</div>
  ),
}));

vi.mock("../../features/verbati/VerbatiCvPreviewPanel", () => ({
  VerbatiCvPreviewPanel: () => <div>Mock preview panel</div>,
}));

vi.mock("../../features/verbati/useBoundVerbatiCvStyle", () => ({
  useBoundVerbatiCvStyle: () => ({
    stylePreset: DEFAULT_VERBATI_STYLE,
    setStylePreset: vi.fn(),
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => useCvLibraryMock(),
}));

function buildCvLibraryState(overrides: Record<string, unknown> = {}) {
  return {
    currentCv: null,
    importCv: vi.fn(),
    cvs: [],
    isLibraryHydrated: true,
    lastLibraryFetchFailed: false,
    ...overrides,
  };
}

function buildBlankCv(id = "cv_blank") {
  const now = "2026-04-17T12:00:00.000Z";
  return {
    id,
    title: "Untitled CV",
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    sections: [],
  };
}

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="location">
      {`${location.pathname}${location.search}::${JSON.stringify(location.state ?? null)}`}
    </div>
  );
}

describe("CvForge Quick Start gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCvLibraryMock.mockReset();
  });

  it("pushes empty first-session users into the shell-level quick-start state", async () => {
    useCvLibraryMock.mockReturnValue(buildCvLibraryState());

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/cv::");
      expect(screen.getByTestId("location")).toHaveTextContent(
        JSON.stringify(createQuickStartLocationState(null)),
      );
    });
  });

  it("does not auto-launch before library hydration completes", () => {
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({ isLibraryHydrated: false }),
    );

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mock profile editor none")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");
  });

  it("does not auto-launch when the remote library fetch failed", () => {
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({ lastLibraryFetchFailed: true }),
    );

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mock profile editor none")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");
  });

  it("does not auto-launch for returning users with existing CVs", () => {
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        cvs: [buildBlankCv("cv_existing")],
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mock profile editor none")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");
  });

  it("does not auto-launch after a blank CV has already been created", () => {
    const blankCv = buildBlankCv();
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv: blankCv,
        cvs: [blankCv],
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mock profile editor none")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");
  });

  it("does not auto-launch again when quick start state is already present", () => {
    const blankCv = buildBlankCv();
    window.localStorage.setItem("twoweeks:quick-start-completed", "1");
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv: blankCv,
        cvs: [blankCv],
        isLibraryHydrated: false,
        lastLibraryFetchFailed: true,
      }),
    );

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/cv",
            state: createQuickStartLocationState(null),
          },
        ]}
      >
        <CvForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mock profile editor none")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      JSON.stringify(createQuickStartLocationState(null)),
    );
  });
});
