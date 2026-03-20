import React from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, X, Check } from "lucide-react";
import { useCvLibrary } from "../contexts/CvLibraryContext";

export function CvsLibrary(): JSX.Element {
  const navigate = useNavigate();
  const { cvs, loadCv, createNewCv, deleteCv } = useCvLibrary();
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  const sorted = React.useMemo(
    () =>
      [...cvs].sort((a, b) => {
        const aTime = new Date(a.metadata?.updatedAt ?? a.metadata?.createdAt ?? 0).getTime();
        const bTime = new Date(b.metadata?.updatedAt ?? b.metadata?.createdAt ?? 0).getTime();
        return bTime - aTime;
      }),
    [cvs],
  );

  function handleOpen(id: string) {
    loadCv(id);
    void navigate("/cv");
  }

  function handleDelete(id: string) {
    deleteCv(id);
    setConfirmingId(null);
  }

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehaviorY: "contain",
        background: "var(--bg)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "var(--s7)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s5)",
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontSize: "var(--tx)",
                fontWeight: 600,
                color: "var(--am)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                marginBottom: "var(--s2)",
              }}
            >
              Resume
            </div>
            <h1
              style={{
                fontFamily: '"Fraunces", serif',
                fontSize: "var(--tx2)",
                fontWeight: 600,
                letterSpacing: "-.01em",
                color: "var(--ti)",
                margin: 0,
              }}
            >
              All resumes
            </h1>
          </div>
          <button
            onClick={() => { createNewCv(); void navigate("/cv"); }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--s2)",
              height: "var(--hm)",
              padding: "0 var(--s4)",
              borderRadius: "var(--rs)",
              border: "1px solid var(--bm)",
              background: "var(--sfr)",
              color: "var(--ti)",
              fontSize: "var(--ts)",
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "var(--sha)",
              transition: "all .12s var(--ez)",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sf2)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sfr)"; }}
          >
            <Plus size={14} />
            New resume
          </button>
        </div>

        {/* Empty */}
        {sorted.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--s4)",
              padding: "var(--s9) 0",
              color: "var(--tg2)",
            }}
          >
            <FileText size={32} strokeWidth={1.2} />
            <div style={{ fontSize: "var(--ts)", fontWeight: 500 }}>No resumes yet</div>
            <button
              onClick={() => { createNewCv(); void navigate("/cv"); }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--s2)",
                height: "var(--hm)",
                padding: "0 var(--s4)",
                borderRadius: "var(--rs)",
                border: "1px solid var(--ac)",
                background: "var(--ac)",
                color: "#fff",
                fontSize: "var(--ts)",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all .12s var(--ez)",
                fontFamily: "inherit",
              }}
            >
              <Plus size={14} />
              Create your first resume
            </button>
          </div>
        )}

        {/* Grid */}
        {sorted.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--s4)",
            }}
          >
            {sorted.map((cv) => {
              const updatedAt = new Date(
                cv.metadata?.updatedAt ?? cv.metadata?.createdAt ?? Date.now(),
              ).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

              const core = (cv.core as any);
              const profileName: string = core?.profile?.name ?? "";
              const position: string = core?.profile?.position ?? core?.profile?.desiredPosition ?? "";
              const location: string = [core?.profile?.city, core?.profile?.country].filter(Boolean).join(", ");
              const summary: string = core?.profile?.summary ?? core?.profile?.objective ?? core?.profile?.bio ?? "";
              const summarySnippet = summary ? summary.slice(0, 180) : "";
              const hasProfile = !!(profileName || position);
              const isConfirming = confirmingId === cv.id;

              return (
                <div
                  key={cv.id}
                  className="card-group"
                  style={{ position: "relative" }}
                  onMouseLeave={() => { if (isConfirming) setConfirmingId(null); }}
                >
                  {/* Main card button */}
                  <button
                    onClick={() => handleOpen(cv.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "var(--s3)",
                      padding: "var(--s4)",
                      borderRadius: "var(--rm)",
                      border: "1px solid var(--bo)",
                      background: "var(--sfr)",
                      boxShadow: "var(--sha)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background .12s var(--ez), border-color .12s var(--ez)",
                      fontFamily: "inherit",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = "var(--sf2)";
                      el.style.borderColor = "var(--bm)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = "var(--sfr)";
                      el.style.borderColor = "var(--bo)";
                    }}
                  >
                    {/* Top row: status badge + date */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingRight: 20 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                          padding: "2px 7px",
                          borderRadius: 99,
                          ...(hasProfile
                            ? { background: "var(--ap)", color: "var(--am)", border: "1px solid color-mix(in srgb, var(--ac) 30%, transparent)" }
                            : { background: "var(--sf2)", color: "var(--tg2)", border: "1px solid var(--bo)" }
                          ),
                        }}
                      >
                        {hasProfile ? "Resume" : "Draft"}
                      </span>
                      <span style={{ fontSize: "var(--tx)", color: "var(--tg2)" }}>{updatedAt}</span>
                    </div>

                    {/* Title — Fraunces serif, same as proposal cards */}
                    <div
                      style={{
                        fontFamily: '"Fraunces", serif',
                        fontSize: "var(--ts)",
                        fontWeight: 600,
                        lineHeight: 1.35,
                        letterSpacing: "-.01em",
                        color: "var(--ti)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {cv.title}
                    </div>

                    {/* Name · Position · Location */}
                    {(profileName || position || location) && (
                      <div
                        style={{
                          fontSize: "var(--tx)",
                          color: "var(--tm2)",
                          lineHeight: 1.5,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          width: "100%",
                        }}
                      >
                        {[profileName, position, location].filter(Boolean).join(" · ")}
                      </div>
                    )}

                    {/* Summary snippet — rich preview like proposals */}
                    {summarySnippet && (
                      <div
                        style={{
                          fontSize: "var(--tx)",
                          color: "var(--tg2)",
                          lineHeight: 1.55,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {summarySnippet}
                      </div>
                    )}

                    {/* Empty placeholder for cards with no profile data */}
                    {!hasProfile && !summarySnippet && (
                      <div
                        style={{
                          fontSize: "var(--tx)",
                          color: "var(--tg2)",
                          fontStyle: "italic",
                          lineHeight: 1.5,
                        }}
                      >
                        No profile data yet
                      </div>
                    )}
                  </button>

                  {/* Delete — confirm overlay or X trigger */}
                  {isConfirming ? (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        background: "var(--sfr)",
                        border: "1px solid var(--bo)",
                        borderRadius: "var(--rs)",
                        padding: "2px 6px 2px 8px",
                        boxShadow: "var(--shb)",
                        zIndex: 2,
                      }}
                    >
                      <span style={{ fontSize: "var(--tx)", color: "var(--tg2)", whiteSpace: "nowrap" }}>Delete?</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(cv.id); }}
                        title="Confirm delete"
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 22, height: 22, border: "1px solid var(--bm)", borderRadius: "var(--rx)",
                          background: "transparent", cursor: "pointer", color: "var(--tg2)", fontFamily: "inherit",
                          transition: "all .1s var(--ez)",
                        }}
                        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--erb)"; b.style.color = "var(--ert)"; b.style.borderColor = "var(--ert)"; }}
                        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "var(--tg2)"; b.style.borderColor = "var(--bm)"; }}
                      >
                        <Check size={11} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmingId(null); }}
                        title="Cancel"
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 22, height: 22, border: "1px solid transparent", borderRadius: "var(--rx)",
                          background: "transparent", cursor: "pointer", color: "var(--tg2)", fontFamily: "inherit",
                          transition: "all .1s var(--ez)",
                        }}
                        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--sf2)"; b.style.color = "var(--ti)"; }}
                        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "var(--tg2)"; }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmingId(cv.id); }}
                      className="card-delete-btn"
                      title="Delete"
                      aria-label="Delete"
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        zIndex: 1,
                        width: 24,
                        height: 24,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "var(--rs)",
                        border: "1px solid transparent",
                        background: "transparent",
                        color: "var(--tg2)",
                        cursor: "pointer",
                        padding: 0,
                        fontFamily: "inherit",
                        transition: "background .1s var(--ez), color .1s var(--ez)",
                      }}
                      onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--erb)"; b.style.color = "var(--ert)"; }}
                      onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "var(--tg2)"; }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
