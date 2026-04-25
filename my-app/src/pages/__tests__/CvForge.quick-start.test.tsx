import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import { CvForge } from "../CvForge";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";

const {
  importFileMock,
  setDefaultResumeMock,
  setJobResumeMock,
  useCvLibraryMock,
} = vi.hoisted(() => ({
  importFileMock: vi.fn(),
  setDefaultResumeMock: vi.fn(async () => undefined),
  setJobResumeMock: vi.fn(async () => undefined),
  useCvLibraryMock: vi.fn(),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    jobsPublic: {
      getById: "jobsPublic.getById",
      setResumeForJob: "jobsPublic.setResumeForJob",
      setDefaultResume: "jobsPublic.setDefaultResume",
    },
    proposalSettings: {
      getPresets: "proposalSettings.getPresets",
    },
  },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
  })),
  useMutation: vi.fn((reference: string) => {
    if (reference === "jobsPublic.setResumeForJob") {
      return setJobResumeMock;
    }
    if (reference === "jobsPublic.setDefaultResume") {
      return setDefaultResumeMock;
    }
    return vi.fn(async () => undefined);
  }),
  useQuery: vi.fn((reference: string, args?: unknown) => {
    if (args === "skip") {
      return undefined;
    }

    if (args && typeof args === "object" && "jobId" in (args as Record<string, unknown>)) {
      return {
        id: "job_123",
        title: "Senior Product Designer",
        company: "Acme",
      };
    }

    return {
      preset1: null,
      preset2: null,
      preset3: null,
      activeSlot: null,
    };
  }),
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

vi.mock("../../components/useStructuredMistralImport", () => ({
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT: ".pdf",
  useStructuredMistralImport: () => ({
    importFile: importFileMock,
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => useCvLibraryMock(),
}));

function buildCvLibraryState(overrides: Record<string, unknown> = {}) {
  return {
    currentCv: null,
    currentCvId: null,
    createNewCv: vi.fn(async () => undefined),
    importCv: vi.fn(),
    cvs: [],
    isLibraryHydrated: true,
    lastLibraryFetchFailed: false,
    loadCv: vi.fn(() => true),
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

function buildProfileCv(
  id: string,
  profileName: string,
  desiredPosition: string,
) {
  const now = "2026-04-17T12:00:00.000Z";
  return {
    id,
    title: "Untitled CV",
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    sections: [
      {
        id: `profile-${id}`,
        type: "profile",
        title: "Profile",
        blocks: [],
        structuredContent: [
          {
            id: `profile-item-${id}`,
            name: profileName,
            desiredPosition,
          },
        ],
      },
    ],
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

describe("CvForge entry picker", () => {
  beforeEach(() => {
    window.localStorage.clear();
    importFileMock.mockReset();
    setDefaultResumeMock.mockReset();
    setJobResumeMock.mockReset();
    useCvLibraryMock.mockReset();
  });

  it("shows the picker for first-entry users with no saved CVs", () => {
    useCvLibraryMock.mockReturnValue(buildCvLibraryState());

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByText("Choose your CV")).toBeInTheDocument();
    expect(screen.getByText("No saved CVs yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import new" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start from scratch" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv::null");
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

    expect(screen.getByText("Choose your CV")).toBeInTheDocument();
    expect(screen.queryByText("Mock profile editor none")).not.toBeInTheDocument();
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

    expect(screen.getByText("Choose your CV")).toBeInTheDocument();
    expect(screen.queryByText("Mock profile editor none")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");
  });

  it("does not mutate existing location state when showing the picker", () => {
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        cvs: [buildBlankCv("cv_existing")],
      }),
    );

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/cv",
            state: { source: "test" },
          },
        ]}
      >
        <CvForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByText("Choose your CV")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      JSON.stringify({ source: "test" }),
    );
  });

  it("shows an arrow-only action button for each saved CV", () => {
    const soloCv = buildProfileCv("cv_only", "Ada Lovelace", "Product Designer");
    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv: soloCv,
        currentCvId: "cv_only",
        cvs: [soloCv],
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByText("Choose your CV")).toBeInTheDocument();
    expect(screen.queryByText("Mock profile editor none")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this CV" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Product Designer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use selected CV" })).not.toBeInTheDocument();
  });

  it("keeps only the compact job chip above the picker and returns to the job after choosing a CV", async () => {
    const user = userEvent.setup();
    const loadCv = vi.fn(() => true);
    const primaryCv = buildProfileCv("cv_primary", "Ada Lovelace", "Product Designer");
    const secondaryCv = buildProfileCv("cv_secondary", "Grace Hopper", "Engineering Manager");

    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv: primaryCv,
        currentCvId: "cv_primary",
        loadCv,
        cvs: [primaryCv, secondaryCv],
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv?jobId=job_123"]}>
        <CvForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("For: Senior Product Designer @ Acme"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear job context" })).toBeInTheDocument();
    expect(screen.queryByText(/CV:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to job" })).not.toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: "Use this CV" })[1],
    );

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_123",
        resumeId: "cv_secondary",
        resumeName: "Engineering Manager — Grace Hopper",
      });
    });
    expect(setDefaultResumeMock).not.toHaveBeenCalled();
    expect(loadCv).toHaveBeenCalledWith("cv_secondary");
    expect(screen.getByTestId("location")).toHaveTextContent("/jobs/job_123");
  });

  it("opens the selected cv directly from the card action button", async () => {
    const user = userEvent.setup();
    const loadCv = vi.fn(() => true);
    const primaryCv = buildProfileCv("cv_primary", "Ada Lovelace", "Product Designer");
    const secondaryCv = buildProfileCv("cv_secondary", "Grace Hopper", "Engineering Manager");

    useCvLibraryMock.mockReturnValue(
      buildCvLibraryState({
        currentCv: primaryCv,
        currentCvId: "cv_primary",
        loadCv,
        cvs: [primaryCv, secondaryCv],
      }),
    );

    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <CvForge />
        <LocationProbe />
      </MemoryRouter>,
    );

    await user.click(
      screen.getAllByRole("button", { name: "Use this CV" })[1],
    );

    expect(setDefaultResumeMock).not.toHaveBeenCalled();
    expect(setJobResumeMock).not.toHaveBeenCalled();
    expect(loadCv).toHaveBeenCalledWith("cv_secondary");
    expect(screen.getByTestId("location")).toHaveTextContent("/cv?id=cv_secondary");
    expect(screen.queryByText("Choose your CV")).not.toBeInTheDocument();
  });
});
