import React from "react";
import clsx from "clsx";
import type { FunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Check,
  ClipboardText,
  FileText,
  FileUser,
  Gear,
  Menu,
  Moon,
  Sun,
  Trash,
  User,
  X,
} from "@/lib/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth, useUser, UserButton } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import {
  clearActiveLocalCvId,
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
  startFreshProposalWorkspace,
} from "../lib/proposal-workspace-state";
import { createQuickStartLocationState } from "../lib/quick-start-routing";

const MAX_RECENT_ITEMS = 3;

function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = React.useState(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark") return true;
      if (stored === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = React.useCallback(() => {
    setIsDark((current) => {
      const next = !current;

      try {
        localStorage.setItem("theme", next ? "dark" : "light");
        document.documentElement.classList.toggle("dark", next);
      } catch {
        /* noop */
      }

      return next;
    });
  }, []);

  return [isDark, toggle];
}

const clerkAppearance = {
  elements: {
    avatarBox: {
      width: "26px",
      height: "26px",
      borderRadius: "var(--radius-control)",
    },
    userButtonAvatarBox: {
      width: "26px",
      height: "26px",
      borderRadius: "var(--radius-control)",
    },
    userButtonTrigger: {
      boxShadow: "none",
      outline: "none",
    },
  },
  variables: {
    colorPrimary: "hsl(155,22%,30%)",
    borderRadius: "var(--radius-control)",
  },
} as const;

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

function SidebarDocumentSection({
  sectionLabel,
  hasDocuments,
  createLabel,
  secondaryActionLabel,
  secondaryActionHref,
  allLabel,
  allCount,
  items,
  onCreate,
  allHref,
}: {
  sectionLabel: string;
  hasDocuments: boolean;
  createLabel: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  allLabel: string;
  allCount: number;
  items: SidebarListItem[];
  onCreate: () => void;
  allHref: string;
}) {
  const [confirmingDeleteKey, setConfirmingDeleteKey] = React.useState<
    string | null
  >(null);

  return (
    <section className="sb-section" aria-label={sectionLabel}>
      <div className="sb-section__title">{sectionLabel}</div>

      {hasDocuments ? (
        <>
          <button
            type="button"
            className="sb-section__action"
            onClick={onCreate}
          >
            {`+ ${createLabel}`}
          </button>
          {secondaryActionLabel && secondaryActionHref ? (
            <Link to={secondaryActionHref} className="sb-section__all-link">
              {secondaryActionLabel}
            </Link>
          ) : null}

          {items.length > 0 ? (
            <ul className="sb-section__list" role="list">
              {items.map((item) => (
                <li key={item.key}>
                  <div className="sb-section__document-row card-group">
                    <Link
                      to={item.href}
                      className={clsx(
                        "sb-section__document",
                        item.isActive && "sb-section__document--active",
                        item.markerTone === "muted" &&
                          "sb-section__document--muted-marker",
                      )}
                      onClick={item.onFollow}
                      aria-current={item.isActive ? "page" : undefined}
                    >
                      {item.title}
                    </Link>
                    {item.onDelete ? (
                      <div
                        className="sb-item-actions"
                        aria-label={`Delete ${item.title}`}
                      >
                        {confirmingDeleteKey === item.key ? (
                          <>
                            <button
                              type="button"
                              className="sb-item-action sb-item-action--confirm"
                              title={`Confirm delete ${item.title}`}
                              aria-label={`Confirm delete ${item.title}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void Promise.resolve(item.onDelete?.())
                                  .catch(() => undefined)
                                  .finally(() => {
                                    setConfirmingDeleteKey(null);
                                  });
                              }}
                            >
                              <Check size={12} strokeWidth={2.4} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="sb-item-action"
                              title={`Cancel delete ${item.title}`}
                              aria-label={`Cancel delete ${item.title}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setConfirmingDeleteKey(null);
                              }}
                            >
                              <X size={12} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="sb-item-action sb-item-action--delete"
                            title={`Delete ${item.title}`}
                            aria-label={`Delete ${item.title}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setConfirmingDeleteKey(item.key);
                            }}
                          >
                            <Trash size={12} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <Link
            to={allHref}
            className="sb-section__all-link"
          >
            {`All ${allLabel.toLowerCase()} (${allCount})`}
          </Link>
        </>
      ) : (
        <>
          <button
            type="button"
            className="sb-section__action"
            onClick={onCreate}
          >
            {`+ ${createLabel}`}
          </button>
          {secondaryActionLabel && secondaryActionHref ? (
            <Link to={secondaryActionHref} className="sb-section__all-link">
              {secondaryActionLabel}
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
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
  const [isDarkMode, toggleDarkMode] = useDarkMode();
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const { cvs, currentCv, currentCvId, loadCv, createNewCv, deleteCv } =
    useCvLibrary();
  const clerkUserButtonRef = React.useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);
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
    isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip",
  );

  const proposalCount = useQuery(
    proposalCountQueryReference,
    isLoaded && isSignedIn && isConvexAuthenticated ? {} : "skip",
  );
  const deleteProposal = useMutation(api.deleteProposalPublic.default);

  const matchesRoute = React.useCallback(
    (base: string) => pathname === base || pathname.startsWith(`${base}/`),
    [pathname],
  );
  const handleAccountClick = React.useCallback(() => {
    const clerkTrigger =
      clerkUserButtonRef.current?.querySelector<HTMLButtonElement>("button");

    if (clerkTrigger) {
      clerkTrigger.click();
      return;
    }

    if (!isSignedIn) {
      void navigate("/sign-in");
    }
  }, [isSignedIn, navigate]);

  const forcedCollapsed = viewportWidth < 768;
  const hideSidebar = viewportWidth < 480;
  const sidebarCollapsed = collapsed || forcedCollapsed;
  const isResumeRoute = matchesRoute("/cv");
  const isResumeLibraryRoute = matchesRoute("/cvs");
  const isJobsRoute = matchesRoute("/jobs");
  const isProposalRoute = matchesRoute("/proposal");
  const isProposalLibraryRoute = matchesRoute("/proposals");

  const handleCreateProposal = React.useCallback(() => {
    clearActiveLocalCvId();
    startFreshProposalWorkspace();
    void navigate("/proposal", {
      state: createProposalWorkspaceResetState(),
    });
  }, [navigate]);

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
  const optimisticSavedProposal = React.useMemo<ProposalRecord | null>(() => {
    if (!selectedProposalId || proposalView !== "saved") {
      return null;
    }

    if (
      !effectiveProposalOutputDraft?.generatedProposalId ||
      String(effectiveProposalOutputDraft.generatedProposalId) !==
        String(selectedProposalId)
    ) {
      return null;
    }

    const normalizedTitle =
      normalizeLabel(effectiveProposalOutputDraft.proposalDocumentTitle) ||
      normalizeLabel(effectiveProposalComposeDraft?.jobTitle) ||
      "Saved cover letter";
    const optimisticTimestamp = Date.now();

    return {
      _id: selectedProposalId as Id<"proposals">,
      _creationTime: optimisticTimestamp,
      title: normalizedTitle,
      updatedAt: optimisticTimestamp,
      status: "saved",
    };
  }, [
    effectiveProposalComposeDraft?.jobTitle,
    effectiveProposalOutputDraft?.generatedProposalId,
    effectiveProposalOutputDraft?.proposalDocumentTitle,
    proposalView,
    selectedProposalId,
  ]);
  const sortedProposals = React.useMemo(() => {
    const mergedProposals = new Map<string, ProposalRecord>();

    for (const proposal of proposals ?? []) {
      if (proposal.status === "saved") {
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
  } else if (hasEditableProposalDraft) {
    activeProposalKey = "__draft__";
    activeProposalRawTitle = outputDraftTitle || composeJobTitle;
  }

  const proposalDocsForTitles = React.useMemo(() => {
    const docs = proposalDocs.map(({ key, rawTitle }) => ({ key, rawTitle }));
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

  const recentProposalItems = React.useMemo(
    () =>
      proposalDocsForTitles
        .slice(0, MAX_RECENT_ITEMS)
        .map((doc) => ({
          key: doc.key,
          title: proposalTitles.get(doc.key) ?? "Untitled cover letter",
          href:
            doc.key === "__draft__" ? "/proposal" : buildSavedProposalHref(doc.key),
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
  const hasProposalDocuments =
    proposalTotalCount > 0 || Boolean(activeProposalKey);
  const handleOpenQuickStart = React.useCallback(() => {
    void navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      {
        state: createQuickStartLocationState(location.state),
      },
    );
  }, [location.pathname, location.search, location.state, navigate]);

  if (hideSidebar) {
    return null;
  }

  return (
    <aside
      className={clsx(
        "sb",
        collapsed && "sb--collapsed",
        forcedCollapsed && "sb--forced-collapsed",
      )}
    >
      <div className="sb__top">
        <button
          type="button"
          className={clsx(
            "sb-toggle",
            sidebarCollapsed ? "sb-toggle--expand" : "sb-toggle--collapse",
          )}
          onClick={() => {
            if (!forcedCollapsed) {
              setCollapsed((current) => !current);
            }
          }}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {sidebarCollapsed ? (
        <nav className="sb__nav sb__nav--rail" aria-label="Primary sidebar">
          <SidebarRailButton
            label="Start"
            icon={<Check size={16} strokeWidth={1.5} aria-hidden="true" />}
            active={false}
            onClick={handleOpenQuickStart}
          />
          {hasResumeDocuments ? (
            <SidebarRailLink
              label="Resumes"
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
              label="Resumes"
              icon={
                <FileUser size={16} strokeWidth={1.5} aria-hidden="true" />
              }
              active={isResumeRoute || isResumeLibraryRoute}
              onClick={handleCreateResume}
            />
          )}
          {hasProposalDocuments ? (
            <SidebarRailLink
              label="Cover letters"
              icon={
                <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
              }
              active={isProposalRoute || isProposalLibraryRoute}
              href={activeProposalHref}
            />
          ) : (
            <SidebarRailButton
              label="Cover letters"
              icon={
                <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
              }
              active={isProposalRoute || isProposalLibraryRoute}
              onClick={handleOpenProposalWorkspace}
            />
          )}
          <SidebarRailLink
            label="Jobs"
            icon={
              <ClipboardText size={16} strokeWidth={1.5} aria-hidden="true" />
            }
            active={isJobsRoute}
            href="/jobs"
          />
        </nav>
      ) : (
        <nav className="sb__nav sb__nav--stack" aria-label="Primary sidebar">
          <div
            className="sb-section"
            aria-label="Start"
            style={{ paddingBottom: "var(--space-2)" }}
          >
            <button
              type="button"
              onClick={handleOpenQuickStart}
              className="sb-section__action"
              style={{
                width: "100%",
                border: "none",
                background: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Start
            </button>
          </div>

          <section className="sb-section" aria-label="Jobs">
            <Link
              to="/jobs"
              className={clsx(
                "sb-section__action",
                isJobsRoute && "sb-section__action--active",
              )}
            >
              Jobs
            </Link>
          </section>

          <SidebarDocumentSection
            sectionLabel="Resumes"
            hasDocuments={hasResumeDocuments}
            createLabel="New resume"
            allLabel="Resumes"
            allCount={resumeDocs.length}
            items={recentResumeItems}
            onCreate={handleCreateResume}
            allHref="/cvs"
          />

          <SidebarDocumentSection
            sectionLabel="Cover letters"
            hasDocuments={hasProposalDocuments}
            createLabel="New cover letter"
            allLabel="Cover letters"
            allCount={proposalTotalCount}
            items={recentProposalItems}
            onCreate={handleCreateProposal}
            allHref="/proposals"
          />
        </nav>
      )}

      <div
        className={clsx(
          "sb-footer",
          sidebarCollapsed && "sb-footer--collapsed",
        )}
      >
        <div className="sb-footer__avatar">
          <button
            type="button"
            className="sb-footer__account-button"
            onClick={handleAccountClick}
            aria-label={isSignedIn ? "Open account menu" : "Sign In"}
            title={isSignedIn ? "Account" : "Sign In"}
          >
            <User size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
          {isSignedIn ? (
            <div
              ref={clerkUserButtonRef}
              className="sb-footer__clerk-user-button"
              aria-hidden="true"
            >
              <UserButton afterSignOutUrl="/" appearance={clerkAppearance} />
            </div>
          ) : null}
        </div>
        {!sidebarCollapsed ? (
          <div className="sb-footer__account">
            <div className="sb-footer__title">
              {isSignedIn
                ? user?.firstName ?? user?.username ?? "You"
                : "Sign In"}
            </div>
            <div className="sb-footer__subtitle">
              {isSignedIn && isConvexAuthLoading
                ? "Loading"
                : isSignedIn
                  ? "Signed in"
                  : "Save draft"}
            </div>
          </div>
        ) : null}
        <div className="sb-footer__tools">
          <Link
            to="/settings"
            className={clsx(
              "sb-footer__tool-btn",
              matchesRoute("/settings") && "sb-footer__tool-btn--active",
            )}
            title="Settings"
            aria-label="Settings"
          >
            <Gear size={14} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <div className="sb-theme-toggle">
            <button
              type="button"
              className="sb-theme-toggle__single"
              onClick={toggleDarkMode}
              aria-pressed={isDarkMode}
              aria-label={
                isDarkMode ? "Light mode" : "Dark mode"
              }
              title={isDarkMode ? "Light mode" : "Dark mode"}
            >
              {isDarkMode ? (
                <Sun size={14} strokeWidth={1.6} aria-hidden="true" />
              ) : (
                <Moon size={14} strokeWidth={1.6} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
