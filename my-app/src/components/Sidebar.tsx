import React from "react";
import clsx from "clsx";
import type { FunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Check,
  FileText,
  FileUser,
  Gear,
  Menu,
  Moon,
  SunMedium,
  Trash,
  X,
} from "@/lib/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth, useUser, UserButton } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { formatCvDisplayTitle } from "../lib/proposal-personalization";
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
};

type SidebarWorkspaceItem = {
  key: string;
  kind: "Resume" | "Proposal";
  title: string;
  href: string;
  onFollow?: () => void;
  onDelete?: () => void | Promise<void>;
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
  baseLabel: "Resume" | "Proposal",
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
        ? `Untitled ${baseLabel}`
        : `Untitled ${baseLabel} ${untitledCount}`,
    );
  }

  return titles;
}

function SidebarDocumentSection({
  sectionLabel,
  hasDocuments,
  createLabel,
  allLabel,
  allCount,
  items,
  onCreate,
  allHref,
}: {
  sectionLabel: string;
  hasDocuments: boolean;
  createLabel: string;
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
                            className="sb-item-action card-delete-btn"
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
            {`All ${allLabel.toLowerCase()} (${allCount}) →`}
          </Link>
        </>
      ) : (
        <button
          type="button"
          className="sb-section__action"
          onClick={onCreate}
        >
          {`+ ${createLabel}`}
        </button>
      )}
    </section>
  );
}

function SidebarWorkspaceSection({
  primaryItem,
  secondaryItem,
}: {
  primaryItem: SidebarWorkspaceItem | null;
  secondaryItem: SidebarWorkspaceItem | null;
}) {
  const [confirmingDeleteKey, setConfirmingDeleteKey] = React.useState<
    string | null
  >(null);

  if (!primaryItem && !secondaryItem) {
    return null;
  }

  return (
    <section className="sb-section sb-section--workspace" aria-label="Workspace">
      <div className="sb-section__title">Workspace</div>
      {primaryItem ? (
        <div className="sb-workspace-card-shell card-group">
          <Link
            to={primaryItem.href}
            className="sb-workspace-card sb-workspace-card--primary"
            onClick={primaryItem.onFollow}
          >
            <span className="sb-workspace-card__eyebrow">
              {`Editing ${primaryItem.kind.toLowerCase()}`}
            </span>
            <span className="sb-workspace-card__title">{primaryItem.title}</span>
          </Link>
          {primaryItem.onDelete ? (
            <div
              className="sb-item-actions"
              aria-label={`Delete ${primaryItem.title}`}
            >
              {confirmingDeleteKey === primaryItem.key ? (
                <>
                  <button
                    type="button"
                    className="sb-item-action sb-item-action--confirm"
                    title={`Confirm delete ${primaryItem.title}`}
                    aria-label={`Confirm delete ${primaryItem.title}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void Promise.resolve(primaryItem.onDelete?.())
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
                    title={`Cancel delete ${primaryItem.title}`}
                    aria-label={`Cancel delete ${primaryItem.title}`}
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
                  className="sb-item-action card-delete-btn"
                  title={`Delete ${primaryItem.title}`}
                  aria-label={`Delete ${primaryItem.title}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setConfirmingDeleteKey(primaryItem.key);
                  }}
                >
                  <Trash size={12} strokeWidth={1.8} aria-hidden="true" />
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      {secondaryItem ? (
        <div className="sb-workspace-card-shell card-group">
          <Link
            to={secondaryItem.href}
            className="sb-workspace-card sb-workspace-card--secondary"
            onClick={secondaryItem.onFollow}
          >
            <span className="sb-workspace-card__eyebrow">
              {`${secondaryItem.kind} in progress`}
            </span>
            <span className="sb-workspace-card__title">{secondaryItem.title}</span>
          </Link>
          {secondaryItem.onDelete ? (
            <div
              className="sb-item-actions"
              aria-label={`Delete ${secondaryItem.title}`}
            >
              {confirmingDeleteKey === secondaryItem.key ? (
                <>
                  <button
                    type="button"
                    className="sb-item-action sb-item-action--confirm"
                    title={`Confirm delete ${secondaryItem.title}`}
                    aria-label={`Confirm delete ${secondaryItem.title}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void Promise.resolve(secondaryItem.onDelete?.())
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
                    title={`Cancel delete ${secondaryItem.title}`}
                    aria-label={`Cancel delete ${secondaryItem.title}`}
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
                  className="sb-item-action card-delete-btn"
                  title={`Delete ${secondaryItem.title}`}
                  aria-label={`Delete ${secondaryItem.title}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setConfirmingDeleteKey(secondaryItem.key);
                  }}
                >
                  <Trash size={12} strokeWidth={1.8} aria-hidden="true" />
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
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
  input.setProposalOutputDraft(readStoredProposalOutputDraft());
  input.setProposalComposeDraft(readStoredProposalComposeDraft());
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
    window.addEventListener("focus", refreshDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      {
        window.removeEventListener("storage", refreshDraft);
        window.removeEventListener(
          PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
          refreshDraft,
        );
        window.removeEventListener("focus", refreshDraft);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const refreshComposeDraft = () => {
      refreshProposalWorkspaceDraftState({
        setProposalOutputDraft,
        setProposalComposeDraft,
      });
    };

    window.addEventListener(
      PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
      refreshComposeDraft,
    );
    return () =>
      window.removeEventListener(
        PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
        refreshComposeDraft,
      );
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

  const forcedCollapsed = viewportWidth < 768;
  const sidebarCollapsed = collapsed || forcedCollapsed;
  const isResumeRoute = matchesRoute("/cv");
  const isResumeLibraryRoute = matchesRoute("/cvs");
  const isProposalRoute = matchesRoute("/proposal");
  const isProposalLibraryRoute = matchesRoute("/proposals");

  const handleCreateProposal = React.useCallback(() => {
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

      window.requestAnimationFrame(() => {
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
          rawTitle: formatCvDisplayTitle({
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
    ? resumeTitles.get(activeResumeKey) ?? "Untitled Resume"
    : null;
  const activeResumeHref = activeResumeKey
    ? `/cv?id=${encodeURIComponent(activeResumeKey)}`
    : "/cv";
  const recentResumeItems = React.useMemo(
    () =>
      resumeDocs
        .filter((doc) => doc.key !== activeResumeKey)
        .slice(0, MAX_RECENT_ITEMS)
        .map((doc) => ({
          key: doc.key,
          title: resumeTitles.get(doc.key) ?? "Untitled Resume",
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
  const effectiveProposalOutputDraft =
    typeof window === "undefined"
      ? proposalOutputDraft
      : readStoredProposalOutputDraft();
  const effectiveProposalComposeDraft =
    typeof window === "undefined"
      ? proposalComposeDraft
      : readStoredProposalComposeDraft();
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
      "Saved proposal";
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
  const activeGeneratedProposalKey =
    hasEditableProposalDraft && effectiveProposalOutputDraft?.generatedProposalId
      ? String(effectiveProposalOutputDraft.generatedProposalId)
      : null;

  let activeProposalKey: string | null = null;
  let activeProposalRawTitle = "";
  let activeProposalHref = "/proposal";

  if (hasEditableProposalDraft) {
    activeProposalKey = "__draft__";
    activeProposalRawTitle = outputDraftTitle || composeJobTitle;
  } else if (isProposalSavedView && selectedProposalId) {
    activeProposalKey = selectedProposalId;
    activeProposalRawTitle =
      normalizeLabel(
        proposalDocs.find((proposal) => proposal.key === selectedProposalId)
          ?.rawTitle,
      ) || "";
    activeProposalHref = buildSavedProposalHref(selectedProposalId);
  }

  const proposalDocsForTitles = React.useMemo(() => {
    const docs = proposalDocs.map(({ key, rawTitle }) => ({ key, rawTitle }));
    if (activeProposalKey && !docs.some((doc) => doc.key === activeProposalKey)) {
      docs.unshift({
        key: activeProposalKey,
        rawTitle: activeProposalRawTitle,
      });
    }
    return docs;
  }, [activeProposalKey, activeProposalRawTitle, proposalDocs]);

  const proposalTitles = React.useMemo(
    () =>
      resolveDocumentTitles(
        proposalDocsForTitles,
        "Proposal",
        isGenericProposalTitle,
      ),
    [proposalDocsForTitles],
  );

  const activeProposalTitle = activeProposalKey
    ? proposalTitles.get(activeProposalKey) ?? "Untitled Proposal"
    : null;

  const recentProposalItems = React.useMemo(
    () =>
      proposalDocs
        .filter(
          (doc) =>
            doc.key !== activeProposalKey &&
            (isProposalSavedView || doc.key !== activeGeneratedProposalKey),
        )
        .slice(0, MAX_RECENT_ITEMS)
        .map((doc) => ({
          key: doc.key,
          title: proposalTitles.get(doc.key) ?? "Untitled Proposal",
          href: buildSavedProposalHref(doc.key),
          onDelete: () => handleDeleteSavedProposal(doc.proposalId),
          isActive: highlightedSavedProposalKey === doc.key,
        })),
    [
      activeProposalKey,
      activeGeneratedProposalKey,
      handleDeleteSavedProposal,
      highlightedSavedProposalKey,
      isProposalSavedView,
      proposalDocs,
      proposalTitles,
    ],
  );

  const proposalTotalCount =
    proposalCount ?? proposalDocs.length;

  const proposalWorkspaceItem = React.useMemo<SidebarWorkspaceItem | null>(
    () =>
      hasEditableProposalDraft && activeProposalTitle
        ? {
            key: "__proposal_draft__",
            kind: "Proposal",
            title: activeProposalTitle,
            href: "/proposal",
            onFollow: handleOpenProposalWorkspace,
            onDelete: () => {
              void handleDeleteProposalWorkspace();
            },
          }
        : null,
    [
      activeProposalTitle,
      handleDeleteProposalWorkspace,
      handleOpenProposalWorkspace,
      hasEditableProposalDraft,
    ],
  );
  const resumeWorkspaceItem = React.useMemo<SidebarWorkspaceItem | null>(
    () =>
      activeResumeKey && activeResumeTitle
        ? {
            key: activeResumeKey,
            kind: "Resume",
            title: activeResumeTitle,
            href: activeResumeHref,
            onFollow: () => {
              queueResumeLoad(activeResumeKey);
            },
            onDelete: () => handleDeleteResume(activeResumeKey),
          }
        : null,
    [
      activeResumeHref,
      activeResumeKey,
      activeResumeTitle,
      handleDeleteResume,
      queueResumeLoad,
    ],
  );

  const primaryWorkspaceItem = React.useMemo<SidebarWorkspaceItem | null>(() => {
    if (isResumeRoute) {
      return resumeWorkspaceItem ?? proposalWorkspaceItem;
    }
    if (isProposalRoute) {
      return proposalWorkspaceItem ?? resumeWorkspaceItem;
    }
    return proposalWorkspaceItem ?? resumeWorkspaceItem;
  }, [isProposalRoute, isResumeRoute, proposalWorkspaceItem, resumeWorkspaceItem]);

  const secondaryWorkspaceItem = React.useMemo<SidebarWorkspaceItem | null>(() => {
    if (!primaryWorkspaceItem) {
      return null;
    }

    if (primaryWorkspaceItem.kind === "Proposal") {
      return resumeWorkspaceItem &&
        resumeWorkspaceItem.key !== primaryWorkspaceItem.key
        ? resumeWorkspaceItem
        : null;
    }

    return proposalWorkspaceItem &&
      proposalWorkspaceItem.key !== primaryWorkspaceItem.key
      ? proposalWorkspaceItem
      : null;
  }, [primaryWorkspaceItem, proposalWorkspaceItem, resumeWorkspaceItem]);

  const handleCreateResume = React.useCallback(() => {
    createNewCv(undefined, { forceV1: true });
    void navigate("/cv");
  }, [createNewCv, navigate]);

  const hasResumeDocuments = resumeDocs.length > 0;
  const hasProposalDocuments =
    proposalTotalCount > 0 || Boolean(activeProposalKey);

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
              label="Proposals"
              icon={
                <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
              }
              active={isProposalRoute || isProposalLibraryRoute}
              href={activeProposalHref}
            />
          ) : (
            <SidebarRailButton
              label="Proposals"
              icon={
                <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
              }
              active={isProposalRoute || isProposalLibraryRoute}
              onClick={handleOpenProposalWorkspace}
            />
          )}
        </nav>
      ) : (
        <nav className="sb__nav sb__nav--stack" aria-label="Primary sidebar">
          <SidebarWorkspaceSection
            primaryItem={primaryWorkspaceItem}
            secondaryItem={secondaryWorkspaceItem}
          />

          <SidebarDocumentSection
            sectionLabel="Resumes"
            hasDocuments={hasResumeDocuments}
            createLabel="New Resume"
            allLabel="Resumes"
            allCount={resumeDocs.length}
            items={recentResumeItems}
            onCreate={handleCreateResume}
            allHref="/cvs"
          />

          <SidebarDocumentSection
            sectionLabel="Proposals"
            hasDocuments={hasProposalDocuments}
            createLabel="New Proposal"
            allLabel="Proposals"
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
        <UserButton afterSignOutUrl="/" appearance={clerkAppearance} />
        {!sidebarCollapsed ? (
          <div className="sb-footer__account">
            <div className="sb-footer__title">
              {user?.firstName ?? user?.username ?? "Account"}
            </div>
            <div className="sb-footer__subtitle">
              {isConvexAuthLoading
                ? "Loading"
                : isSignedIn
                  ? "Workspace"
                  : "Guest"}
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
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? (
                <SunMedium size={14} strokeWidth={1.6} aria-hidden="true" />
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
