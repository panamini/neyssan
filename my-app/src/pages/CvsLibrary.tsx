import React from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { useCvLibrary } from "../contexts/CvLibraryContext";

export function CvsLibrary(): JSX.Element {
  const navigate = useNavigate();
  const { cvs, loadCv, createNewCv } = useCvLibrary();

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

              // Derive a quick preview line from the CV
              const profileName = (cv.core as any)?.profile?.name ?? "";
              const position = (cv.core as any)?.profile?.position ?? (cv.core as any)?.profile?.desiredPosition ?? "";

              return (
                <button
                  key={cv.id}
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
                  {/* Icon + date row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <FileText size={14} strokeWidth={1.5} color="var(--am)" />
                    <span style={{ fontSize: "var(--tx)", color: "var(--tg2)" }}>{updatedAt}</span>
                  </div>

                  {/* Title */}
                  <div
                    style={{
                      fontSize: "var(--ts)",
                      fontWeight: 600,
                      color: "var(--ti)",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {cv.title}
                  </div>

                  {/* Profile name + position */}
                  {(profileName || position) && (
                    <div
                      style={{
                        fontSize: "var(--tx)",
                        color: "var(--tm2)",
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {[profileName, position].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
