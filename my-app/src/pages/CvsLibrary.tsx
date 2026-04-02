import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Check } from "@/lib/icons";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import {
  buildActiveCvSnapshotFromCvDocument,
  formatCvDisplaySubtitle,
} from "../lib/proposal-personalization";
import { formatUiDate } from "../lib/ui-date";
import type {
  CvDocument,
  IExperienceItem,
  IProfileItem,
} from "../types/cvDocument";

const CV_LIBRARY_PAGE_SIZE = 12;

function readFirstJobTitles(
  cv: CvDocument,
  limit = 2,
): Array<{ position: string; company: string }> {
  const experienceSection = Array.isArray(cv.sections)
    ? cv.sections.find((s) => s.type === "experience")
    : undefined;
  if (!Array.isArray(experienceSection?.structuredContent)) return [];
  return (experienceSection.structuredContent as IExperienceItem[])
    .slice(0, limit)
    .map((item) => ({
      position: String(item.position ?? "").trim(),
      company: String(item.company ?? "").trim(),
    }))
    .filter((item) => item.position || item.company);
}

function readProfileContact(cv: CvDocument): {
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  location?: string;
} {
  const profileSection = Array.isArray(cv.sections)
    ? cv.sections.find((section) => section.type === "profile")
    : undefined;
  const profileItem = Array.isArray(profileSection?.structuredContent)
    ? (profileSection?.structuredContent[0] as IProfileItem | undefined)
    : undefined;
  return {
    ...(String(profileItem?.email ?? "").trim()
      ? { email: String(profileItem?.email ?? "").trim() }
      : {}),
    ...(String(profileItem?.phone ?? "").trim()
      ? { phone: String(profileItem?.phone ?? "").trim() }
      : {}),
    ...(String(profileItem?.linkedin ?? "").trim()
      ? { linkedin: String(profileItem?.linkedin ?? "").trim() }
      : {}),
    ...(String(profileItem?.website ?? "").trim()
      ? { website: String(profileItem?.website ?? "").trim() }
      : {}),
    ...(String(profileItem?.location ?? "").trim()
      ? { location: String(profileItem?.location ?? "").trim() }
      : {}),
  };
}

export function CvsLibrary(): JSX.Element {
  const navigate = useNavigate();
  const { cvs, loadCv, createNewCv, deleteCv } = useCvLibrary();
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [visibleCvCount, setVisibleCvCount] =
    React.useState(CV_LIBRARY_PAGE_SIZE);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);

  const sorted = React.useMemo(
    () =>
      [...cvs].sort((a, b) => {
        const aTime = new Date(
          a.metadata?.updatedAt ?? a.metadata?.createdAt ?? 0,
        ).getTime();
        const bTime = new Date(
          b.metadata?.updatedAt ?? b.metadata?.createdAt ?? 0,
        ).getTime();
        return bTime - aTime;
      }),
    [cvs],
  );
  const visibleCvs = React.useMemo(
    () => sorted.slice(0, visibleCvCount),
    [sorted, visibleCvCount],
  );
  const hasMoreCvs = sorted.length > visibleCvCount;

  React.useEffect(() => {
    setVisibleCvCount(CV_LIBRARY_PAGE_SIZE);
  }, [sorted.length]);

  React.useEffect(() => {
    if (!hasMoreCvs) return;
    const target = loadMoreSentinelRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setVisibleCvCount((current) =>
          Math.min(current + CV_LIBRARY_PAGE_SIZE, sorted.length),
        );
      },
      {
        rootMargin: "320px 0px",
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreCvs, sorted.length]);

  function handleOpen(id: string) {
    loadCv(id);
    void navigate("/cv");
  }

  function handleDelete(id: string) {
    deleteCv(id);
    setConfirmingId(null);
  }

  return (
    <div className="dasti-page-scroll">
      <div
        className="dasti-page-shell"
        style={
          {
            "--page-shell-max-width": "1100px",
            "--page-shell-gap": "var(--layout-page-stack)",
          } as React.CSSProperties
        }
      >
        <div className="dasti-page-header">
          <div className="dasti-stack">
            <div className="dasti-stack__eyebrow">Resume</div>
            <h1 className="dasti-stack__title">All resumes</h1>
          </div>
          <div className="dasti-page-actions">
            <button
              onClick={() => {
                createNewCv();
                void navigate("/cv");
              }}
              className="dasti-icon-button dasti-library-create-button"
              aria-label="Create new resume"
              title="Create new resume"
            >
              <Plus size={20} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        {sorted.length === 0 && (
          <div className="dasti-empty-state">
            <div className="dasti-empty-state__title">No resumes yet</div>
            <p className="dasti-empty-state__subtitle">
              Create or import a resume to start editing and personalizing it.
            </p>
            <button
              onClick={() => {
                createNewCv();
                void navigate("/cv");
              }}
              className="dasti-button dasti-button--primary dasti-button--pill"
            >
              <Plus size={14} />
              Create your first resume
            </button>
          </div>
        )}

        {sorted.length > 0 && (
          <div className="dasti-grid-auto">
            {visibleCvs.map((cv) => {
              const updatedAt =
                formatUiDate(
                  cv.metadata?.updatedAt ??
                    cv.metadata?.createdAt ??
                    Date.now(),
                ) ?? "";
              const snapshot = buildActiveCvSnapshotFromCvDocument(cv);
              const personalization = snapshot.personalizationContext;
              const profileName = String(personalization?.name ?? "").trim();
              const position = String(
                personalization?.desiredPosition ?? "",
              ).trim();
              const contact = readProfileContact(cv);
              const summarySnippet = String(
                personalization?.summary ?? "",
              ).trim();
              const cardTitle = snapshot.title;
              const identityLine = formatCvDisplaySubtitle({
                title: String(cv.title ?? ""),
                profileName,
                desiredPosition: position,
                email: contact.email,
                linkedin: contact.linkedin,
                website: contact.website,
                phone: contact.phone,
                location: contact.location,
              });
              const isConfirming = confirmingId === cv.id;
              const jobTitles = readFirstJobTitles(cv);

              return (
                <div
                  key={cv.id}
                  className="card-group"
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  onMouseLeave={() => {
                    if (isConfirming) setConfirmingId(null);
                  }}
                >
                  {/* Main card button */}
                  <button
                    onClick={() => handleOpen(cv.id)}
                    className="dasti-doc-card dasti-doc-card--library dasti-doc-card--cv-library"
                    style={{ flex: 1, paddingRight: "var(--s6)" }}
                  >
                    <div className="dasti-doc-card__stack">
                      <div className="dasti-doc-card__header">
                        <div className="dasti-doc-card__title-frame">
                          <h2 className="dasti-doc-card__title">{cardTitle}</h2>
                        </div>
                      </div>

                      <div className="dasti-doc-card__meta">
                        {identityLine || "Draft resume"}
                      </div>

                      <div className="dasti-doc-card__body-band">
                        {summarySnippet ? (
                          <p className="dasti-doc-card__snippet dasti-doc-card__snippet--library">
                            {summarySnippet}
                          </p>
                        ) : jobTitles.length > 0 ? (
                          <div className="dasti-doc-card__job-preview">
                            {jobTitles.map((job, i) => (
                              <div key={i} className="dasti-doc-card__job-line">
                                <span className="dasti-doc-card__job-position">
                                  {job.position}
                                </span>
                                {job.company ? (
                                  <span className="dasti-doc-card__job-company">
                                    {" · "}
                                    {job.company}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="dasti-doc-card__footer dasti-doc-card__footer--stamp-only">
                        <div className="dasti-doc-card__stamp">{updatedAt}</div>
                      </div>
                    </div>
                  </button>

                  {/* Delete — confirm overlay or X trigger */}
                  {isConfirming ? (
                    <div
                      className="dasti-icon-confirm-tray"
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        zIndex: 2,
                      }}
                    >
                      <span className="dasti-icon-confirm-tray__label">
                        Delete?
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(cv.id);
                        }}
                        title="Confirm delete"
                        className="dasti-icon-button dasti-icon-button--compact dasti-icon-button--confirm"
                      >
                        <Check size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingId(null);
                        }}
                        title="Cancel"
                        className="dasti-icon-button dasti-icon-button--compact"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingId(cv.id);
                      }}
                      className="dasti-card-delete-button"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
            {hasMoreCvs ? (
              <div
                ref={loadMoreSentinelRef}
                aria-hidden="true"
                style={{ height: 1, gridColumn: "1 / -1" }}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
