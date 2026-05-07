import React from "react";
import clsx from "clsx";
import type { FunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Briefcase,
  FileText,
  FileUser,
  FolderTree,
  Gear,
  ImagesSquare,
  Moon,
  SquaresFour,
  Sun,
} from "@/lib/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import {
  formatCvDisplayTitle,
} from "../lib/proposal-personalization";
import {
  PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
  readStoredProposalOutputDraft,
} from "../lib/proposal-output-draft";
import {
  PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
  clearStoredProposalWorkspaceState,
  createProposalWorkspaceResetState,
  readStoredProposalComposeDraft,
} from "../lib/proposal-workspace-state";
import { useThemeMode } from "../lib/theme-mode";
import collapsedLogoUrl from "../assets/logo/two-weeks-logo.png";

const MAX_RECENT_ITEMS = 3;
const MAX_MIXED_RECENT_ITEMS = 4;

type ProposalRecord = {
  _id: Id<"proposals">;
  _creationTime: number;
  title?: string;
  status?: string;
  updatedAt?: number;
};

type SidebarDoc = {
  key: string;
  rawTitle: string;
  onOpen: () => void;
};

type SidebarListItem = {
  key: string;
  title: string;
  href: string;
  onFollow?: () => void;
  onDelete?: () => void | Promise<void>;
  isActive?: boolean;
  markerTone?: "muted";
};

type SidebarMixedRecentItem = {
  key: string;
  title: string;
  meta: string;
  href: string;
  badge: string;
  onFollow?: () => void;
  isActive?: boolean;
};

function normalizeLabel(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function toTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function isGenericResumeTitle(value: string): boolean {
  return /^(?:resume|draft resume|imported cv|untitled cv(?:\s+\d+)?|untitled resume(?:\s+\d+)?)$/i.test(
    value,
  );
}

function isGenericProposalTitle(value: string): boolean {
  return /^(?:proposal|generated proposal|untitled proposal(?:\s+\d+)?|untitled|letter|message)$/i.test(
    value,
  );
}

function resolveDocumentTitles(
  entries: Array<Pick<SidebarDoc, "key" | "rawTitle">>,
  baseLabel: "Resume" | "Cover letter",
  isGenericTitle: (value: string) => boolean,
): Map<string, string> {
  const titles = new Map<string, string>();
  let untitledCount = 0;

  for (const entry of entries) {
    const normalized = normalizeLabel(entry.rawTitle);
    if (normalized && !isGenericTitle(normalized)) {
      titles.set(entry.key, normalized);
      continue;
    }

    untitledCount += 1;
    titles.set(
      entry.key,
      untitledCount === 1
        ? `Untitled ${baseLabel.toLowerCase()}`
        : `Untitled ${baseLabel.toLowerCase()} ${untitledCount}`,
    );
  }

  return titles;
}

function formatSidebarResumeLabel(value: string): string {
  return value.replace(/\s+[—–]\s+/g, " - ");
}

function SidebarRailButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={clsx("sb-rail-button", active && "sb-rail-button--active")}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function refreshProposalWorkspaceDraftState(input: {
  setProposalOutputDraft: React.Dispatch<
    React.SetStateAction<ReturnType<typeof readStoredProposalOutputDraft>>
  >;
  setProposalComposeDraft: React.Dispatch<
    React.SetStateAction<ReturnType<typeof readStoredProposalComposeDraft>>
  >;
}): void {
  const nextOutputDraft = readStoredProposalOutputDraft();
  const nextComposeDraft = readStoredProposalComposeDraft();

  input.setProposalOutputDraft((currentDraft) => {
    const currentTitle = normalizeLabel(currentDraft?.proposalDocumentTitle);
    const nextTitle = normalizeLabel(nextOutputDraft?.proposalDocumentTitle);
    const currentContent =
      typeof currentDraft?.proposalContent === "string"
        ? currentDraft.proposalContent.trim()
        : "";
    const nextContent =
      typeof nextOutputDraft?.proposalContent === "string"
        ? nextOutputDraft.proposalContent.trim()
        : "";
    const currentGeneratedId = String(currentDraft?.generatedProposalId ?? "");
    const nextGeneratedId = String(nextOutputDraft?.generatedProposalId ?? "");

    if (
      currentTitle === nextTitle &&
      currentContent === nextContent &&
      currentGeneratedId === nextGeneratedId
    ) {
      return currentDraft;
    }

    return nextOutputDraft;
  });
  input.setProposalComposeDraft((currentDraft) => {
    const currentTitle = normalizeLabel(currentDraft?.jobTitle);
    const nextTitle = normalizeLabel(nextComposeDraft?.jobTitle);
    const currentHasDraft = currentDraft !== null;
    const nextHasDraft = nextComposeDraft !== null;

    if (currentTitle === nextTitle && currentHasDraft === nextHasDraft) {
      return currentDraft;
    }

    return nextComposeDraft;
  });
}

function buildSavedProposalHref(proposalId: string): string {
  const params = new URLSearchParams();
  params.set("view", "saved");
  params.set("id", proposalId);
  return `/proposal?${params.toString()}`;
}

function SidebarRailLink({
  label,
  icon,
  active,
  href,
  onFollow,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  href: string;
  onFollow?: () => void;
}) {
  return (
    <Link
      to={href}
      className={clsx("sb-rail-button", active && "sb-rail-button--active")}
      onClick={onFollow}
      title={label}
      aria-label={label}
    >
      {icon}
    </Link>
  );
}

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, search } = location;
  const { mode: themeMode, toggle: toggleTheme } = useThemeMode();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const { isLoaded, isSignedIn } = useAuth();
  const { cvs, currentCv, currentCvId, loadCv, createNewCv, deleteCv } =
    useCvLibrary();
  const [sidebarPinned, setSidebarPinned] = React.useState(false);
  const [brandPeriodAnimating, setBrandPeriodAnimating] = React.useState(false);
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [proposalOutputDraft, setProposalOutputDraft] = React.useState(() =>
    readStoredProposalOutputDraft(),
  );
  const [proposalComposeDraft, setProposalComposeDraft] = React.useState(() =>
    readStoredProposalComposeDraft(),
  );
  const proposalsQueryReference = React.useMemo(
    () =>
      (api as unknown as {
        proposalsPublic: {
          default: FunctionReference<
            "query",
            "public",
            Record<string, never>,
            ProposalRecord[]
          >;
        };
      }).proposalsPublic.default,
    [],
  );
  const proposalCountQueryReference = React.useMemo(
    () =>
      (api as unknown as {
        proposalsCountPublic: {
          default: FunctionReference<
            "query",
            "public",
            Record<string, never>,
            number
          >;
        };
      }).proposalsCountPublic.default,
    [],
  );
  const params = React.useMemo(() => new URLSearchParams(search), [search]);
  const proposalView =
    params.get("view") === "saved" || Boolean(params.get("id"))
      ? "saved"
      : null;
  const selectedProposalId = params.get("id");
  const selectedDraftProposalId = params.get("draftId");
  const selectedResumeId = params.get("id");

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const refreshDraft = () => {
      refreshProposalWorkspaceDraftState({
        setProposalOutputDraft,
        setProposalComposeDraft,
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshDraft();
      }
    };

    window.addEventListener("storage", refreshDraft);
    window.addEventListener(
      PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
      refreshDraft,
    );
    window.addEventListener(
      PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
      refreshDraft,
    );
    window.addEventListener("focus", refreshDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      {
        window.removeEventListener("storage", refreshDraft);
        window.removeEventListener(
          PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
          refreshDraft,
        );
        window.removeEventListener(
          PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
          refreshDraft,
        );
        window.removeEventListener("focus", refreshDraft);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      };
  }, []);

  const proposals = useQuery(
    proposalsQueryReference,
    isLoaded && isSignedIn && isConvexAuthenticated && !isConvexAuthLoading ? {} : "skip",
  );

  const proposalCount = useQuery(
    proposalCountQueryReference,
    isLoaded && isSignedIn && isConvexAuthenticated && !isConvexAuthLoading ? {} : "skip",
  );
  const deleteProposal = useMutation(api.deleteProposalPublic.default);

  const matchesRoute = React.useCallback(
    (base: string) => pathname === base || pathname.startsWith(`${base}/`),
    [pathname],
  );
  const forcedCollapsed = false;
  const hideSidebar = viewportWidth < 480;
  const sidebarCollapsed = !sidebarPinned;
  const [renderCollapsedContent, setRenderCollapsedContent] = React.useState(
    () => sidebarCollapsed,
  );
  const isResumeRoute = matchesRoute("/cv");
  const isResumeLibraryRoute = matchesRoute("/cvs");
  const isDashboardRoute = matchesRoute("/dashboard") || pathname === "/";
  const isJobsRoute = matchesRoute("/jobs");
  const isProposalRoute = matchesRoute("/proposal");
  const isProposalLibraryRoute = matchesRoute("/proposals");
  const isTemplatesRoute = matchesRoute("/style") || matchesRoute("/templates");
  const isDocumentsRoute =
    matchesRoute("/documents") || isProposalLibraryRoute || isResumeLibraryRoute;

  React.useEffect(() => {
    if (!sidebarCollapsed) {
      setRenderCollapsedContent(false);
      return undefined;
    }

    setRenderCollapsedContent(true);
    return undefined;
  }, [forcedCollapsed, sidebarCollapsed]);

  const handleOpenProposalWorkspace = React.useCallback(() => {
    refreshProposalWorkspaceDraftState({
      setProposalOutputDraft,
      setProposalComposeDraft,
    });
    void navigate("/proposal");
  }, [navigate]);

  const handleDeleteProposalWorkspace = React.useCallback(async () => {
    const generatedProposalId = proposalOutputDraft?.generatedProposalId ?? null;

    if (generatedProposalId && isConvexAuthenticated) {
      await deleteProposal({ id: generatedProposalId });
    }

    clearStoredProposalWorkspaceState();

    if (isProposalRoute) {
      void navigate("/proposal", {
        state: createProposalWorkspaceResetState(),
      });
    }
  }, [
    deleteProposal,
    isConvexAuthenticated,
    isProposalRoute,
    navigate,
    proposalOutputDraft?.generatedProposalId,
  ]);

  const handleDeleteSavedProposal = React.useCallback(
    async (proposalId: Id<"proposals">) => {
      await deleteProposal({ id: proposalId });

      if (
        proposalOutputDraft?.generatedProposalId &&
        String(proposalOutputDraft.generatedProposalId) === String(proposalId)
      ) {
        clearStoredProposalWorkspaceState();
      }

      if (
        selectedProposalId === String(proposalId) &&
        isProposalRoute &&
        proposalView === "saved"
      ) {
        void navigate("/proposal");
      }
    },
    [
      deleteProposal,
      isProposalRoute,
      navigate,
      proposalView,
      proposalOutputDraft?.generatedProposalId,
      selectedProposalId,
    ],
  );

  const handleDeleteResume = React.useCallback(
    (resumeId: string) => {
      deleteCv(resumeId);

      if (String(currentCv?.id ?? "") === resumeId && isResumeRoute) {
        void navigate("/cv");
      }
    },
    [currentCv?.id, deleteCv, isResumeRoute, navigate],
  );

  const queueResumeLoad = React.useCallback(
    (resumeId: string) => {
      const targetId = String(resumeId);
      if (typeof window === "undefined") {
        loadCv(targetId);
        return;
      }

      React.startTransition(() => {
        loadCv(targetId);
      });
    },
    [loadCv],
  );

  const resumeDocs = React.useMemo(() => {
    const docMap = new Map<string, (typeof cvs)[number]>();

    for (const cv of cvs) {
      docMap.set(String(cv.id), cv);
    }

    if (currentCv) {
      docMap.set(String(currentCv.id), currentCv);
    }

    return [...docMap.values()]
      .sort((left, right) => {
        const rightTime = toTimestamp(
          right.metadata?.updatedAt ?? right.metadata?.createdAt,
        );
        const leftTime = toTimestamp(
          left.metadata?.updatedAt ?? left.metadata?.createdAt,
        );
        return rightTime - leftTime;
      })
      .map((cv) => {
        const profileSection = Array.isArray(cv.sections)
          ? cv.sections.find((section) => section.type === "profile")
          : undefined;
        const profileItem = Array.isArray(profileSection?.structuredContent)
          ? (profileSection.structuredContent[0] as
              | Record<string, unknown>
              | undefined)
          : undefined;

        return {
          key: String(cv.id),
          rawTitle: formatSidebarResumeLabel(
            formatCvDisplayTitle({
              title: cv.title,
              profileName:
                typeof profileItem?.name === "string" ? profileItem.name : null,
              desiredPosition:
                typeof profileItem?.desiredPosition === "string"
                  ? profileItem.desiredPosition
                  : typeof profileItem?.title === "string"
                    ? profileItem.title
                    : null,
            }),
          ),
          onOpen: () => {
            queueResumeLoad(String(cv.id));
          },
        } satisfies SidebarDoc;
      });
  }, [cvs, currentCv, queueResumeLoad]);

  const resumeTitles = React.useMemo(
    () => resolveDocumentTitles(resumeDocs, "Resume", isGenericResumeTitle),
    [resumeDocs],
  );

  const activeResumeKey =
    isResumeRoute && selectedResumeId
      ? String(selectedResumeId)
      : currentCvId
        ? String(currentCvId)
        : currentCv
          ? String(currentCv.id)
          : null;
  const activeResumeTitle = activeResumeKey
    ? resumeTitles.get(activeResumeKey) ?? "Untitled resume"
    : null;
  const activeResumeHref = activeResumeKey
    ? `/cv?id=${encodeURIComponent(activeResumeKey)}`
    : "/cv";
  const recentResumeItems = React.useMemo(
    () =>
      resumeDocs
        .slice(0, MAX_RECENT_ITEMS)
        .map((doc) => ({
          key: doc.key,
          title: resumeTitles.get(doc.key) ?? "Untitled resume",
          href: `/cv?id=${encodeURIComponent(doc.key)}`,
          onFollow: doc.onOpen,
          onDelete: () => handleDeleteResume(doc.key),
          isActive: isResumeRoute && activeResumeKey === doc.key,
        })),
    [
      activeResumeKey,
      handleDeleteResume,
      isResumeRoute,
      resumeDocs,
      resumeTitles,
    ],
  );

  const isProposalSavedView =
    isProposalRoute && proposalView === "saved" && Boolean(selectedProposalId);
  const effectiveProposalOutputDraft = proposalOutputDraft;
  const effectiveProposalComposeDraft = proposalComposeDraft;
  const optimisticSavedProposal = React.useMemo<ProposalRecord | null>(
    () => null,
    [],
  );
  const sortedProposals = React.useMemo(() => {
    const mergedProposals = new Map<string, ProposalRecord>();

    for (const proposal of proposals ?? []) {
      if (proposal.status === "draft" || proposal.status === "saved") {
        mergedProposals.set(String(proposal._id), proposal);
      }
    }

    if (optimisticSavedProposal) {
      mergedProposals.set(
        String(optimisticSavedProposal._id),
        optimisticSavedProposal,
      );
    }

    return [...mergedProposals.values()].sort((left, right) => {
      const leftStatusRank = left.status === "saved" ? 0 : 1;
      const rightStatusRank = right.status === "saved" ? 0 : 1;
      if (leftStatusRank !== rightStatusRank) {
        return leftStatusRank - rightStatusRank;
      }
      const rightTime = toTimestamp(right.updatedAt ?? right._creationTime);
      const leftTime = toTimestamp(left.updatedAt ?? left._creationTime);
      return rightTime - leftTime;
    });
  }, [optimisticSavedProposal, proposals]);

  const proposalDocs = React.useMemo(
    () =>
      sortedProposals.map((proposal) => ({
        proposalId: proposal._id,
        key: String(proposal._id),
        rawTitle: normalizeLabel(proposal.title),
        status: proposal.status === "draft" ? "draft" : "saved",
      })),
    [sortedProposals],
  );
  const composeJobTitle = normalizeLabel(effectiveProposalComposeDraft?.jobTitle);
  const hasStoredProposalComposeDraft = effectiveProposalComposeDraft !== null;
  const outputDraftTitle = normalizeLabel(
    effectiveProposalOutputDraft?.proposalDocumentTitle,
  );
  const outputDraftContent = normalizeLabel(
    effectiveProposalOutputDraft?.proposalContent,
  );
  const hasStoredProposalDraft = Boolean(
    outputDraftTitle ||
      outputDraftContent ||
      effectiveProposalOutputDraft?.generatedProposalId,
  );

  const hasEditableProposalDraft =
    hasStoredProposalDraft || hasStoredProposalComposeDraft;
  const highlightedSavedProposalKey =
    isProposalSavedView && selectedProposalId ? selectedProposalId : null;

  let activeProposalKey: string | null = null;
  let activeProposalRawTitle = "";
  let activeProposalHref = "/proposal";

  if (isProposalSavedView && selectedProposalId) {
    activeProposalKey = selectedProposalId;
    activeProposalRawTitle =
      normalizeLabel(
        proposalDocs.find((proposal) => proposal.key === selectedProposalId)
          ?.rawTitle,
      ) || "";
    activeProposalHref = buildSavedProposalHref(selectedProposalId);
  } else if (isProposalRoute && selectedDraftProposalId) {
    activeProposalKey = selectedDraftProposalId;
    activeProposalRawTitle =
      normalizeLabel(
        proposalDocs.find((proposal) => proposal.key === selectedDraftProposalId)
          ?.rawTitle,
      ) || "";
    activeProposalHref = `/proposal?draftId=${encodeURIComponent(selectedDraftProposalId)}`;
  } else if (hasEditableProposalDraft) {
    activeProposalKey = "__draft__";
    activeProposalRawTitle = outputDraftTitle || composeJobTitle;
  }

  const proposalDocsForTitles = React.useMemo(() => {
    const docs = proposalDocs.map(({ key, rawTitle, status }) => ({
      key,
      rawTitle,
      status,
    }));
    if (
      hasEditableProposalDraft &&
      !docs.some((doc) => doc.key === "__draft__")
    ) {
      docs.unshift({
        key: "__draft__",
        rawTitle: outputDraftTitle || composeJobTitle,
      });
    }
    if (activeProposalKey && !docs.some((doc) => doc.key === activeProposalKey)) {
      docs.unshift({
        key: activeProposalKey,
        rawTitle: activeProposalRawTitle,
      });
    }
    return docs;
  }, [
    activeProposalKey,
    activeProposalRawTitle,
    composeJobTitle,
    hasEditableProposalDraft,
    outputDraftTitle,
    proposalDocs,
  ]);

  const proposalTitles = React.useMemo(
    () =>
      resolveDocumentTitles(
        proposalDocsForTitles,
        "Cover letter",
        isGenericProposalTitle,
      ),
    [proposalDocsForTitles],
  );

  const activeProposalTitle = activeProposalKey
    ? proposalTitles.get(activeProposalKey) ?? "Untitled cover letter"
    : null;
  const activeProposalServerStatus = activeProposalKey
    ? proposalDocs.find((proposal) => proposal.key === activeProposalKey)?.status ?? null
    : null;

  const recentProposalItems = React.useMemo(
    () =>
      proposalDocsForTitles
        .slice(0, MAX_RECENT_ITEMS)
        .map((doc): SidebarListItem => ({
          key: doc.key,
          title: proposalTitles.get(doc.key) ?? "Untitled cover letter",
          href:
            doc.key === "__draft__"
              ? "/proposal"
              : doc.status === "draft"
                ? `/proposal?draftId=${encodeURIComponent(doc.key)}`
                : buildSavedProposalHref(doc.key),
          onFollow:
            doc.key === "__draft__" ? handleOpenProposalWorkspace : undefined,
          onDelete:
            doc.key === "__draft__"
              ? () => handleDeleteProposalWorkspace()
              : () => {
                  const matchingProposal = sortedProposals.find(
                    (proposal) => String(proposal._id) === doc.key,
                  );
                  if (matchingProposal) {
                    return handleDeleteSavedProposal(matchingProposal._id);
                  }
                  return undefined;
                },
          isActive:
            doc.key === "__draft__"
              ? activeProposalKey === "__draft__"
              : doc.status === "draft"
                ? isProposalRoute && params.get("draftId") === doc.key
                : highlightedSavedProposalKey === doc.key,
          markerTone:
            doc.key === "__draft__" && activeProposalKey !== "__draft__"
              ? "muted"
              : undefined,
        })),
    [
      activeProposalKey,
      handleDeleteSavedProposal,
      handleDeleteProposalWorkspace,
      handleOpenProposalWorkspace,
      highlightedSavedProposalKey,
      isProposalRoute,
      params,
      proposalDocsForTitles,
      proposalTitles,
      sortedProposals,
    ],
  );

  const proposalTotalCount =
    proposalCount ?? proposalDocs.length;

  const handleCreateResume = React.useCallback(async () => {
    await createNewCv(undefined, { forceV1: true });
    void navigate("/cv");
  }, [createNewCv, navigate]);

  const hasResumeDocuments = resumeDocs.length > 0;
  const mixedRecentItems = React.useMemo<SidebarMixedRecentItem[]>(() => {
    const items: SidebarMixedRecentItem[] = [];

    if (activeProposalKey && activeProposalTitle) {
      items.push({
        key: `proposal:${activeProposalKey}`,
        title: activeProposalTitle,
        meta:
          activeProposalKey === "__draft__" || activeProposalServerStatus === "draft"
            ? "proposal draft"
            : "saved proposal",
        href: activeProposalHref,
        badge: "P",
        onFollow:
          activeProposalKey === "__draft__"
            ? handleOpenProposalWorkspace
            : undefined,
        isActive: isProposalRoute,
      });
    }

    if (activeResumeKey && activeResumeTitle) {
      items.push({
        key: `cv:${activeResumeKey}`,
        title: activeResumeTitle,
        meta: "CV source",
        href: activeResumeHref,
        badge: "CV",
        onFollow: () => queueResumeLoad(activeResumeKey),
        isActive: isResumeRoute,
      });
    }

    const savedProposal = recentProposalItems.find(
      (item) => item.key !== "__draft__" && !items.some((recent) => recent.href === item.href),
    );
    if (savedProposal) {
      items.push({
        key: `proposal:${savedProposal.key}`,
        title: savedProposal.title,
        meta: "document",
        href: savedProposal.href,
        badge: "D",
        onFollow: savedProposal.onFollow,
        isActive: savedProposal.isActive,
      });
    }

    const resumeItem = recentResumeItems.find(
      (item) => !items.some((recent) => recent.href === item.href),
    );
    if (resumeItem) {
      items.push({
        key: `cv:${resumeItem.key}`,
        title: resumeItem.title,
        meta: "CV",
        href: resumeItem.href,
        badge: "CV",
        onFollow: resumeItem.onFollow,
        isActive: resumeItem.isActive,
      });
    }

    items.push({
      key: "job:linear",
      title: "Senior Frontend Engineer",
      meta: "job match ready",
      href: "/jobs",
      badge: "J",
      isActive: isJobsRoute,
    });

    return items.slice(0, MAX_MIXED_RECENT_ITEMS);
  }, [
    activeProposalHref,
    activeProposalKey,
    activeProposalServerStatus,
    activeProposalTitle,
    activeResumeHref,
    activeResumeKey,
    activeResumeTitle,
    handleOpenProposalWorkspace,
    isJobsRoute,
    isProposalRoute,
    isResumeRoute,
    queueResumeLoad,
    recentProposalItems,
    recentResumeItems,
  ]);
  const pulseBrandPeriod = () => {
    setBrandPeriodAnimating(true);
  };

  React.useEffect(() => {
    if (!brandPeriodAnimating) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setBrandPeriodAnimating(false);
    }, 950);
    return () => window.clearTimeout(timeoutId);
  }, [brandPeriodAnimating]);

  if (hideSidebar) {
    return null;
  }

  return (
    <aside
      className={clsx(
        "sb",
        sidebarCollapsed && "sb--collapsed",
        forcedCollapsed && "sb--forced-collapsed",
        sidebarPinned && "sb--pinned",
      )}
      data-pinned={sidebarPinned ? "true" : "false"}
    >
      <div className="sb__top">
        <button
          type="button"
          className={clsx(
            "sb-toggle",
            !sidebarCollapsed && "sb-toggle--labeled",
            sidebarPinned ? "sb-toggle--collapse" : "sb-toggle--expand",
          )}
          onClick={() => {
            pulseBrandPeriod();
            setSidebarPinned((current) => !current);
          }}
          title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          <span className="sb-toggle__label" aria-hidden="true">
            {sidebarCollapsed ? (
              <span className="sb-toggle__collapsed-logo-shell">
                <img
                  className={clsx(
                    "sb-toggle__collapsed-logo",
                    themeMode === "dark" && "sb-toggle__collapsed-logo--dark",
                  )}
                  src={collapsedLogoUrl}
                  alt=""
                  aria-hidden="true"
                />
              </span>
            ) : (
              <>
                two weeks
                <span
                  className={clsx(
                    "sb-toggle__period",
                    brandPeriodAnimating && "sb-toggle__period--active",
                  )}
                >
                  .
                </span>
              </>
            )}
          </span>
        </button>
      </div>

      {renderCollapsedContent ? (
        <nav className="sb__nav sb__nav--rail" aria-label="Primary sidebar">
          <SidebarRailLink
            label="Dashboard"
            icon={<SquaresFour size={16} strokeWidth={1.5} aria-hidden="true" />}
            active={isDashboardRoute}
            href="/dashboard"
          />
          <SidebarRailLink
            label="Jobs"
            icon={<Briefcase size={16} strokeWidth={1.5} aria-hidden="true" />}
            active={isJobsRoute}
            href="/jobs"
          />
          <SidebarRailLink
            label="Proposal forge"
            icon={<FileText size={16} strokeWidth={1.5} aria-hidden="true" />}
            active={isProposalRoute}
            href={activeProposalHref}
          />
          {hasResumeDocuments ? (
            <SidebarRailLink
              label="CV forge"
              icon={
                <FileUser size={16} strokeWidth={1.5} aria-hidden="true" />
              }
              active={isResumeRoute || isResumeLibraryRoute}
              href={activeResumeHref}
              onFollow={() => {
                if (activeResumeKey) {
                  queueResumeLoad(activeResumeKey);
                }
              }}
            />
          ) : (
            <SidebarRailButton
              label="CV forge"
              icon={
                <FileUser size={16} strokeWidth={1.5} aria-hidden="true" />
              }
              active={isResumeRoute || isResumeLibraryRoute}
              onClick={handleCreateResume}
            />
          )}
        </nav>
      ) : (
        <nav className="sb__nav sb__nav--stack" aria-label="Primary sidebar">
          <div className="sb-section sb-section--primary-nav" aria-label="Workspace">
            <Link
              to="/dashboard"
              className={clsx(
                "sb-section__action",
                isDashboardRoute && "sb-section__action--active",
              )}
            >
              <SquaresFour size={15} strokeWidth={1.5} aria-hidden="true" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/jobs"
              className={clsx(
                "sb-section__action",
                isJobsRoute && "sb-section__action--active",
              )}
            >
              <Briefcase size={15} strokeWidth={1.5} aria-hidden="true" />
              <span>Jobs</span>
              <span className="sb-section__count">142</span>
            </Link>
            <Link
              to={activeProposalHref}
              onClick={
                activeProposalKey === "__draft__"
                  ? handleOpenProposalWorkspace
                  : undefined
              }
              className={clsx(
                "sb-section__action",
                isProposalRoute && "sb-section__action--active",
              )}
            >
              <FileText size={15} strokeWidth={1.5} aria-hidden="true" />
              <span>Proposal forge</span>
            </Link>
            <Link
              to={activeResumeHref}
              onClick={() => {
                if (activeResumeKey) {
                  queueResumeLoad(activeResumeKey);
                }
              }}
              className={clsx(
                "sb-section__action",
                (isResumeRoute || isResumeLibraryRoute) &&
                  "sb-section__action--active",
              )}
            >
              <FileUser size={15} strokeWidth={1.5} aria-hidden="true" />
              <span>CV forge</span>
            </Link>
          </div>

          <div className="sb-section" aria-label="Library">
            <div className="sb-section__title">Library</div>
            <Link
              to="/documents"
              className={clsx(
                "sb-section__action",
                isDocumentsRoute && "sb-section__action--active",
              )}
            >
              <FolderTree size={15} strokeWidth={1.5} aria-hidden="true" />
              <span>Documents</span>
              <span className="sb-section__count">
                {resumeDocs.length + proposalTotalCount}
              </span>
            </Link>
            <Link
              to="/templates"
              className={clsx(
                "sb-section__action",
                isTemplatesRoute && "sb-section__action--active",
              )}
            >
              <ImagesSquare size={15} strokeWidth={1.5} aria-hidden="true" />
              <span>Templates</span>
            </Link>
          </div>

          <section className="sb-recents" aria-label="Recent">
            <div className="sb-recents__head">
              <span>Recent</span>
            </div>
            <ul className="sb-recents__list" role="list">
              {mixedRecentItems.map((item) => (
                <li key={item.key}>
                  <Link
                    to={item.href}
                    onClick={item.onFollow}
                    className={clsx(
                      "sb-recent",
                      item.isActive && "sb-recent--active",
                    )}
                    aria-current={item.isActive ? "page" : undefined}
                  >
                    <span className="sb-recent__badge">{item.badge}</span>
                    <span className="sb-recent__body">
                      <span className="sb-recent__title">{item.title}</span>
                      <span className="sb-recent__meta">{item.meta}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

        </nav>
      )}

      <div
        className={clsx(
          "sb-footer",
          sidebarCollapsed && "sb-footer--collapsed",
        )}
      >
        <div className="sb-footer__tools">
          <Link
            to="/settings"
            className={clsx(
              "sb-section__action",
              matchesRoute("/settings") && "sb-section__action--active",
            )}
            title="Settings"
            aria-label="Settings"
          >
            <Gear size={14} strokeWidth={1.6} aria-hidden="true" />
            <span className="sb-footer__tool-label">Settings</span>
          </Link>
          {!sidebarCollapsed ? (
            <button
              type="button"
              className="sb-theme-toggle__single"
              onClick={toggleTheme}
              aria-pressed={themeMode === "dark"}
              aria-label={themeMode === "dark" ? "Light mode" : "Dark mode"}
              title={themeMode === "dark" ? "Light mode" : "Dark mode"}
            >
              {themeMode === "dark" ? (
                <Sun size={14} strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Moon size={14} strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
