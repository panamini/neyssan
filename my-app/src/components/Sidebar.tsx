import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, FileText, Plus, Pencil, Settings, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { api } from '../../convex/_generated/api';
import { useCvLibrary } from '../contexts/CvLibraryContext';
import { normalizeAndValidateCvDocument } from '../lib/normalize-cv';
import CvRenameDialog from './CvRenameDialog';
import DarkModeToggle from './dark-mode-toggle/DarkModeToggle';
import { useToast } from './ui/toast';

/**
 * Sidebar — dasti v1
 *
 * Layout : 248px expanded / 52px collapsed (CSS transition .22s).
 * Sections : RESUME (CV library) — WRITE et SETTINGS sont des chantiers séparés.
 * Logique métier : loadCv, createNewCv, renameCv, deleteCv, importCv — intacte.
 *
 * §12 dasti-spec-v1 : sidebar structure, collapse, sb-doc items, footer.
 */

const SB_EXPANDED = 248;
const SB_COLLAPSED = 52;

/** IDs currently waiting for a second-click delete confirmation */
type ConfirmingMap = Record<string, true>;

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [proposalRenameTarget, setProposalRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCv, setConfirmingCv] = useState<ConfirmingMap>({});
  const [confirmingProposal, setConfirmingProposal] = useState<ConfirmingMap>({});
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { cvs, currentCv, loadCv, createNewCv, importCv, deleteCv, renameCv } = useCvLibrary();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { showToast } = useToast();
  const params = new URLSearchParams(search);
  const proposalView = params.get("view");
  const selectedProposalId = params.get("id");
  const isProposal = pathname.startsWith('/proposal');
  const isStyle = pathname.startsWith('/style');
  const isResume = pathname.startsWith('/cv');
  const forcedCollapsed = viewportWidth < 1220;
  const sidebarCollapsed = collapsed || forcedCollapsed;
  const compactDensity = viewportWidth < 1360;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ── Proposals query (même source que ProposalsList) ────────── */
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const userInitials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() || user.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "?"
    : "?";
  const proposals = useQuery(
    api.proposalsPublic.default as any,
    isLoaded && isSignedIn ? {} : "skip",
  ) as Array<{ _id: string; _creationTime: number; title?: string; metadata?: { proposalType?: string } }> | undefined;
  const deleteProposal = useMutation((api as any).deleteProposalPublic?.default);
  const updateProposal = useMutation((api as any).updateProposalPublic?.default);

  /* ── Handlers (logique métier intacte) ───────────────────── */

  const handleLoadCv = (id: string) => {
    try { loadCv(id); }
    catch (e) { console.error("[Sidebar] loadCv failed", e); }
  };

  const handleCreate = () => {
    try { createNewCv(undefined, { forceV1: true }); }
    catch (err) { console.error("[Sidebar] createNewCv failed", err); }
  };

  const handleRenameOpen = (id: string, title: string) => {
    setError(null);
    setRenameTarget({ id, title });
  };

  const handleRenameSave = (nextTitle: string) => {
    if (!renameTarget) return;
    try {
      renameCv(renameTarget.id, nextTitle);
      setRenameTarget(null);
    } catch (err) {
      console.error("[Sidebar] renameCv failed", err);
      setError("Failed to rename CV");
    }
  };

  const handleDeleteRequest = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmingCv((prev) => ({ ...prev, [id]: true }));
  };

  const handleDeleteConfirm = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmingCv((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try { deleteCv(id); }
    catch (err) {
      console.error("[Sidebar] deleteCv failed", err);
      setError("Failed to delete CV");
    }
  };

  const handleDeleteCancel = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmingCv((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleDeleteProposalRequest = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmingProposal((prev) => ({ ...prev, [id]: true }));
  };

  const handleDeleteProposalConfirm = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmingProposal((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      await deleteProposal({ id });
      if (selectedProposalId === id) {
        void navigate('/proposal?view=saved');
      }
      showToast("Proposal deleted", { variant: "success" });
    } catch (err) {
      console.error("[Sidebar] deleteProposal failed", err);
      showToast("Failed to delete proposal", { variant: "error" });
    }
  };

  const handleDeleteProposalCancel = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmingProposal((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleRenameProposal = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setProposalRenameTarget({ id, title });
  };

  const handleProposalRenameSave = async (nextTitle: string) => {
    if (!proposalRenameTarget) return;
    try {
      await updateProposal({ id: proposalRenameTarget.id, title: nextTitle });
      setProposalRenameTarget(null);
      showToast("Proposal renamed", { variant: "success" });
    } catch (err) {
      console.error("[Sidebar] renameProposal failed", err);
      showToast("Failed to rename proposal", { variant: "error" });
    }
  };

  const footerHint = (() => {
    if (isProposal) {
      const activeProposal = proposals?.find((proposal) => proposal._id === selectedProposalId);
      return activeProposal?.title ?? "Proposal library";
    }
    return currentCv?.title ?? "No resume selected";
  })();

  /* ── Styles inline (tokens dasti) ───────────────────────── */

  const sb: React.CSSProperties = {
    width: sidebarCollapsed ? SB_COLLAPSED : compactDensity ? 232 : SB_EXPANDED,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRight: "1px solid var(--bo)",
    background: "var(--sf1)",
    transition: "width .22s var(--ez)",
    overflow: "hidden",
    position: "relative",
    zIndex: 10,
  };

  const sbTop: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    padding: "0 var(--s3)",
    height: "var(--hdr)",
    borderBottom: "1px solid var(--bo)",
    flexShrink: 0,
  };

  const sbSec: React.CSSProperties = sidebarCollapsed
    ? { opacity: 0, maxHeight: 0, overflow: "hidden", padding: 0, pointerEvents: "none" }
    : {
        fontSize: "var(--tx)",
        fontWeight: 600,
        color: "var(--tg2)",
        letterSpacing: ".12em",
        textTransform: "uppercase",
        padding: compactDensity ? "var(--s3) var(--s2) var(--s2)" : "var(--s4) var(--s2) var(--s3)",
        whiteSpace: "nowrap",
        transition: "opacity .18s var(--ez), max-height .22s var(--ez)",
        maxHeight: 40,
      };

  return (
    <>
      <div style={sb}>
        {/* ── Top bar ─────────────────────────────────────── */}
        <div style={sbTop}>
          {/* Wordmark — always visible, collapses to just "d" */}
          <span
            style={{
              fontFamily: '"Fraunces", serif',
              fontSize: sidebarCollapsed ? "var(--tm)" : "var(--ts)",
              fontWeight: 600,
              letterSpacing: "-.02em",
              color: "var(--ti)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              transition: "font-size .18s var(--ez)",
              userSelect: "none",
            }}
          >
            {sidebarCollapsed ? "d" : "dasti"}
          </span>

          <div style={{ flex: 1 }} />

          {/* Collapse toggle — ‹ / › */}
          <button
            onClick={() => {
              if (!forcedCollapsed) setCollapsed((c) => !c);
            }}
            title={forcedCollapsed ? "Sidebar auto-collapses on narrow widths" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="sb-toggle"
            disabled={forcedCollapsed}
          >
            <ChevronLeft
              size={16}
              strokeWidth={1.5}
              style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "none", transition: "transform .22s var(--ez)" }}
            />
          </button>
        </div>

        {/* ── Nav ─────────────────────────────────────────── */}
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "var(--s2)",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {/* Section label RESUME */}
          <span style={sbSec as React.CSSProperties}>Resume</span>

          {/* Resume nav item */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { void navigate('/cv'); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void navigate('/cv'); }}
            className={`sb-nav-item sb-tooltip-wrap${isResume ? " sb-nav-item--active" : ""}`}
            style={{
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: "var(--s3)",
              padding: sidebarCollapsed ? 0 : "var(--s2) var(--s3)",
              cursor: "pointer",
              height: 34,
              width: sidebarCollapsed ? 36 : "100%",
              alignSelf: sidebarCollapsed ? "center" : "stretch",
            }}
          >
            <div style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: isResume ? "var(--ac)" : "var(--tm2)" }}>
              <FileText size={16} strokeWidth={1.5} />
            </div>
            {!sidebarCollapsed && (
              <span style={{ fontSize: "var(--ts)", fontWeight: isResume ? 600 : 500, color: isResume ? "var(--ti)" : "var(--tm2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                Studio
              </span>
            )}
            {sidebarCollapsed && <span className="sb-tooltip">Studio</span>}
          </div>

          {/* CV document sub-items — sb-doc style */}
          {cvs.map((cv) => {
            const isActive = currentCv?.id === cv.id;
            const updatedAt = new Date(
              cv.metadata?.updatedAt ?? cv.metadata?.createdAt ?? Date.now()
            ).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit" });

            return sidebarCollapsed ? null : (
              <SbDoc
                key={cv.id}
                title={cv.title}
                date={updatedAt}
                isActive={isActive}
                dense={compactDensity}
                isConfirming={Boolean(confirmingCv[cv.id])}
                onClick={() => { handleLoadCv(cv.id); void navigate('/cv'); }}
                onRename={(e) => { e.stopPropagation(); handleRenameOpen(cv.id, cv.title); }}
                onDeleteRequest={(e) => handleDeleteRequest(e, cv.id)}
                onDeleteConfirm={(e) => handleDeleteConfirm(e, cv.id)}
                onDeleteCancel={(e) => handleDeleteCancel(e, cv.id)}
              />
            );
          })}

          {/* New CV link */}
          {!sidebarCollapsed && (
            <button onClick={handleCreate} className="sb-new-btn">
              <Plus size={16} style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>New resume</span>
            </button>
          )}

          {/* Section label WRITE */}
          <span style={sbSec as React.CSSProperties}>Write</span>

          {/* Compose nav item */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { void navigate('/proposal'); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void navigate('/proposal'); }}
            className={`sb-nav-item sb-tooltip-wrap${isProposal ? " sb-nav-item--active" : ""}`}
            style={{
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: "var(--s3)",
              padding: sidebarCollapsed ? 0 : "var(--s2) var(--s3)",
              cursor: "pointer",
              height: 34,
              width: sidebarCollapsed ? 36 : "100%",
              alignSelf: sidebarCollapsed ? "center" : "stretch",
            }}
          >
            <div style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: isProposal ? "var(--ac)" : "var(--tm2)" }}>
              <Pencil size={16} strokeWidth={1.5} />
            </div>
            {!sidebarCollapsed && (
              <span style={{ fontSize: "var(--ts)", fontWeight: isProposal ? 600 : 500, color: isProposal ? "var(--ti)" : "var(--tm2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                Compose
              </span>
            )}
            {sidebarCollapsed && <span className="sb-tooltip">Compose</span>}
          </div>

          {/* Proposal sub-items under Compose */}
          {!sidebarCollapsed && isSignedIn && proposals && proposals.map((p) => {
            const date = new Date(p._creationTime).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit" });
            const typeLabel = p.metadata?.proposalType === "cover_letter" ? "Letter"
              : p.metadata?.proposalType === "freelance_proposal" ? "Proposal"
              : p.metadata?.proposalType === "application_message" ? "Message"
              : "Letter";
            const isActive = isProposal && proposalView === "saved" && selectedProposalId === p._id;
            return (
              <SbDoc
                key={p._id}
                title={p.title ?? "Untitled"}
                date={date}
                docType={typeLabel}
                isActive={isActive}
                dense={compactDensity}
                isConfirming={Boolean(confirmingProposal[p._id])}
                onClick={() => { void navigate(`/proposal?view=saved&id=${encodeURIComponent(p._id)}`); }}
                onRename={(e) => {
                  void handleRenameProposal(e, p._id, p.title ?? "Untitled");
                }}
                onDeleteRequest={(e) => handleDeleteProposalRequest(e, p._id)}
                onDeleteConfirm={(e) => { void handleDeleteProposalConfirm(e, p._id); }}
                onDeleteCancel={(e) => handleDeleteProposalCancel(e, p._id)}
              />
            );
          })}

          {/* + New letter */}
          {!sidebarCollapsed && (
            <button onClick={() => { void navigate('/proposal'); }} className="sb-new-btn">
              <Plus size={16} style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>New letter</span>
            </button>
          )}

          {/* Section label SETTINGS */}
          <span style={sbSec as React.CSSProperties}>Settings</span>

          {/* Style nav item */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { void navigate('/style'); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void navigate('/style'); }}
            className={`sb-nav-item sb-tooltip-wrap${isStyle ? " sb-nav-item--active" : ""}`}
            style={{
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: "var(--s3)",
              padding: sidebarCollapsed ? 0 : "var(--s2) var(--s3)",
              cursor: "pointer",
              height: 34,
              width: sidebarCollapsed ? 36 : "100%",
              alignSelf: sidebarCollapsed ? "center" : "stretch",
            }}
          >
            <div style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: isStyle ? "var(--ac)" : "var(--tg2)" }}>
              <Settings size={16} strokeWidth={1.5} />
            </div>
            {!sidebarCollapsed && (
              <span style={{ fontSize: "var(--ts)", fontWeight: isStyle ? 600 : 500, color: isStyle ? "var(--ti)" : "var(--tm2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                Style
              </span>
            )}
            {sidebarCollapsed && <span className="sb-tooltip">Style</span>}
          </div>

          {/* Error display */}
          {error && !sidebarCollapsed && (
            <div style={{ padding: "var(--s2) var(--s2)", fontSize: "var(--tx)", color: "var(--ert)" }}>
              {error}
            </div>
          )}
        </nav>

        {/* ── Footer — avatar + theme toggle ──────────────── */}
        <div
          style={{
            flexShrink: 0,
            padding: "var(--s3)",
            borderTop: "1px solid var(--bo)",
            display: "flex",
            alignItems: "center",
            gap: sidebarCollapsed ? 0 : "var(--s3)",
            overflow: "hidden",
            justifyContent: sidebarCollapsed ? "center" : "flex-start",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: "var(--hs)",
              height: "var(--hs)",
              borderRadius: "var(--rp)",
              background: "var(--as)",
              border: "1px solid color-mix(in srgb, var(--ac) 22%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "var(--tx)",
              fontWeight: 600,
              color: "var(--am)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {isSignedIn ? userInitials : "?"}
          </div>

          {/* Name + hint — hidden in collapsed (C06) */}
          {!sidebarCollapsed && (
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontSize: "var(--ts)", fontWeight: 600, color: "var(--ti)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Profile
              </div>
              <div style={{ fontSize: "var(--tx)", color: "var(--tg2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {footerHint}
              </div>
            </div>
          )}

          {/* Theme toggle — hidden in collapsed */}
          {!sidebarCollapsed && <DarkModeToggle />}
        </div>
      </div>

      {/* ── Rename dialog — logique intacte ─────────────── */}
      <CvRenameDialog
        open={renameTarget !== null}
        currentTitle={renameTarget?.title ?? ""}
        onClose={() => setRenameTarget(null)}
        onSave={handleRenameSave}
      />
      <CvRenameDialog
        open={proposalRenameTarget !== null}
        currentTitle={proposalRenameTarget?.title ?? ""}
        title="Rename proposal"
        placeholder="Proposal title"
        onClose={() => setProposalRenameTarget(null)}
        onSave={(nextTitle) => {
          void handleProposalRenameSave(nextTitle);
        }}
      />

      {/* Hidden file input for JSON import (legacy) */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,text/json"
        className="hidden"
        onChange={(e) => {
          void (async () => {
            setError(null);
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const parsed: unknown = JSON.parse(text);
              const norm = normalizeAndValidateCvDocument(parsed, file.name);
              if (!norm.success) { setError(norm.errors.join("; ")); return; }
              await importCv(norm.document);
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : "Failed to import file");
            } finally {
              if (fileRef.current) fileRef.current.value = "";
            }
          })();
        }}
      />
    </>
  );
};

/* ─────────────────────────────────────────────────────────────
   SbDoc — sous-document sidebar (CV item)
   §11 dasti-spec-v1 : .sb-doc style
   ───────────────────────────────────────────────────────────── */

interface SbDocProps {
  title: string;
  date: string;
  docType?: string;
  isActive: boolean;
  dense?: boolean;
  isConfirming?: boolean;
  onClick: () => void;
  onRename: (e: React.MouseEvent) => void;
  onDeleteRequest: (e: React.MouseEvent) => void;
  onDeleteConfirm: (e: React.MouseEvent) => void;
  onDeleteCancel: (e: React.MouseEvent) => void;
  hideActions?: boolean;
  hideRenameAction?: boolean;
}

function SbDoc({
  title, date, docType, isActive, dense = false, isConfirming = false,
  onClick, onRename, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
  hideActions, hideRenameAction,
}: SbDocProps) {
  const [hovered, setHovered] = useState(false);

  if (isConfirming) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "var(--s2) var(--s2) var(--s2) var(--s4)",
          borderRadius: "var(--rs)",
          border: "1px solid var(--er)",
          background: "var(--erb)",
          gap: "var(--s2)",
        }}
      >
        <span className="sb-doc-confirm__label">Delete "{title.length > 18 ? title.slice(0, 18) + "…" : title}"?</span>
        <button className="sb-doc-confirm__yes" onClick={onDeleteConfirm}>Delete</button>
        <button className="sb-doc-confirm__no" onClick={onDeleteCancel}>Cancel</button>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: dense ? "7px var(--s2) 7px var(--s5)" : "var(--s2) var(--s2) var(--s2) var(--s5)",
        borderRadius: "var(--rs)",
        cursor: "pointer",
        transition: "background .12s var(--ez), box-shadow .12s var(--ez)",
        position: "relative",
        background: isActive ? "var(--sfr)" : hovered ? "var(--sf2)" : "transparent",
        boxShadow: isActive ? "var(--sha)" : "none",
      }}
    >
      <div
        style={{
          fontSize: "var(--ts)",
          fontWeight: isActive ? 600 : 500,
          color: "var(--ti)",
          lineHeight: 1.24,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingRight: hovered && !hideActions ? 48 : 0,
          transition: "padding-right .1s var(--ez)",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 10, color: "var(--tg2)", marginTop: 1, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", lineHeight: 1.28 }}>
        {date}
        {docType && <span>·</span>}
        {docType && <span style={{ color: "var(--tm2)", fontWeight: 500 }}>{docType}</span>}
      </div>

      {/* Rename + Delete — appear on hover */}
      {!hideActions && (
        <>
          {!hideRenameAction && (
            <button
              onClick={onRename}
              title="Rename"
              className="dasti-icon-button dasti-icon-button--compact"
              style={{
                position: "absolute",
                right: 24,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: hovered ? 1 : 0,
                transition: "opacity .1s var(--ez)",
              }}
            >
              <Pencil size={12} />
            </button>
          )}
          <button
            onClick={onDeleteRequest}
            title="Delete"
            className="dasti-icon-button dasti-icon-button--compact dasti-icon-button--danger"
            style={{
              position: "absolute",
              right: "var(--s1)",
              top: "50%",
              transform: "translateY(-50%)",
              opacity: hovered ? 1 : 0,
              transition: "opacity .1s var(--ez)",
            }}
          >
            <X size={12} strokeWidth={1.75} />
          </button>
        </>
      )}
    </div>
  );
}

export default Sidebar;
