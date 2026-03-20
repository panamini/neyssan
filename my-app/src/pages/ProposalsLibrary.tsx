import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FileText, Plus } from "lucide-react";

function typeLabel(type?: string): string {
  if (type === "cover_letter") return "Letter";
  if (type === "freelance_proposal") return "Proposal";
  if (type === "application_message") return "Message";
  return "Letter";
}

function typeColor(type?: string): React.CSSProperties {
  if (type === "freelance_proposal") return { background: "var(--ap)", color: "var(--am)", border: "1px solid var(--ac)" };
  if (type === "application_message") return { background: "var(--sf2)", color: "var(--tm2)", border: "1px solid var(--bo)" };
  return { background: "var(--sf2)", color: "var(--tm2)", border: "1px solid var(--bo)" };
}

export function ProposalsLibrary(): JSX.Element {
  const navigate = useNavigate();
  const proposals = useQuery(api.proposalsPublic.default as any, {});

  const sorted = React.useMemo(() => {
    if (!proposals) return [];
    return [...proposals].sort((a: any, b: any) => b._creationTime - a._creationTime);
  }, [proposals]);

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
          padding: "var(--s7) var(--s7)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s6)",
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
              Write
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
              All letters & proposals
            </h1>
          </div>
          <button
            onClick={() => void navigate("/proposal")}
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
            New letter
          </button>
        </div>

        {/* Loading */}
        {proposals === undefined && (
          <div style={{ color: "var(--tg2)", fontSize: "var(--ts)", padding: "var(--s5) 0" }}>
            Loading…
          </div>
        )}

        {/* Empty */}
        {proposals !== undefined && sorted.length === 0 && (
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
            <div style={{ fontSize: "var(--ts)", fontWeight: 500 }}>No letters or proposals yet</div>
            <button
              onClick={() => void navigate("/proposal")}
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
              Write your first letter
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
            {sorted.map((p: any) => {
              const date = new Date(p._creationTime).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              });
              const label = typeLabel(p.metadata?.proposalType);
              const badge = typeColor(p.metadata?.proposalType);
              return (
                <button
                  key={p._id}
                  onClick={() => void navigate(`/proposal?view=saved&id=${encodeURIComponent(p._id)}`)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "var(--s3)",
                    padding: "var(--s4) var(--s4)",
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
                  {/* Badge + date */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        padding: "2px 7px",
                        borderRadius: 99,
                        ...badge,
                      }}
                    >
                      {label}
                    </span>
                    <span style={{ fontSize: "var(--tx)", color: "var(--tg2)" }}>{date}</span>
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
                    {p.title ?? "Untitled"}
                  </div>

                  {/* Snippet */}
                  {p.content && (
                    <div
                      style={{
                        fontSize: "var(--tx)",
                        color: "var(--tm2)",
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {p.content.slice(0, 160)}
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
