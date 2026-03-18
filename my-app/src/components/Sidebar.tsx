import React, { useRef, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useCvLibrary } from '../contexts/CvLibraryContext';
import { normalizeAndValidateCvDocument } from '../lib/normalize-cv';
import CvRenameDialog from './CvRenameDialog';
import DarkModeToggle from './dark-mode-toggle/DarkModeToggle';

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

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { cvs, currentCv, loadCv, createNewCv, importCv, deleteCv, renameCv } = useCvLibrary();

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

  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${title}"?`)) return;
    try { deleteCv(id); }
    catch (err) {
      console.error("[Sidebar] deleteCv failed", err);
      setError("Failed to delete CV");
    }
  };

  /* ── Styles inline (tokens dasti) ───────────────────────── */

  const sb: React.CSSProperties = {
    width: collapsed ? SB_COLLAPSED : SB_EXPANDED,
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
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 var(--s3)",
    height: "var(--hdr)",
    borderBottom: "1px solid var(--bo)",
    flexShrink: 0,
  };

  const sbSec: React.CSSProperties = collapsed
    ? { opacity: 0, maxHeight: 0, overflow: "hidden", padding: 0, pointerEvents: "none" }
    : {
        fontSize: 10,
        fontWeight: 600,
        color: "var(--tg2)",
        letterSpacing: ".12em",
        textTransform: "uppercase",
        padding: "var(--s3) var(--s2) var(--s1)",
        whiteSpace: "nowrap",
        transition: "opacity .18s var(--ez), max-height .22s var(--ez)",
        maxHeight: 32,
      };

  return (
    <>
      <div style={sb}>
        {/* ── Top bar ─────────────────────────────────────── */}
        <div style={sbTop}>
          {/* Wordmark "dasti" — Fraunces, hidden in collapsed */}
          {!collapsed && (
            <span
              style={{
                fontFamily: '"Fraunces", serif',
                fontSize: "var(--ts)",
                fontWeight: 600,
                letterSpacing: "-.01em",
                color: "var(--ti)",
                whiteSpace: "nowrap",
                transition: "opacity .18s var(--ez)",
              }}
            >
              dasti
            </span>
          )}

          {/* Collapse toggle — ‹ / › */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              width: 26,
              height: 26,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--rs)",
              border: "1px solid var(--bo)",
              color: "var(--tg2)",
              background: "var(--sfr)",
              cursor: "pointer",
              transition: "all .12s var(--ez)",
              marginLeft: collapsed ? "auto" : 0,
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.color = "var(--ti)";
              b.style.borderColor = "var(--bm)";
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.color = "var(--tg2)";
              b.style.borderColor = "var(--bo)";
            }}
          >
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
              style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .22s var(--ez)" }}
            >
              <path d="M10 3L6 8l4 5" />
            </svg>
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

          {/* Resume nav item — always visible */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--s3)",
              padding: "var(--s2)",
              borderRadius: "var(--rs)",
              border: "1px solid var(--bo)",
              cursor: "pointer",
              height: 34,
              background: "var(--sfr)",
              boxShadow: "var(--sha)",
              transition: "all .12s var(--ez)",
              overflow: "hidden",
            }}
          >
            <div style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ac)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="1" width="10" height="14" rx="2" />
                <path d="M6 5h4M6 8h4M6 11h2" />
              </svg>
            </div>
            {!collapsed && (
              <span style={{ fontSize: "var(--ts)", fontWeight: 600, color: "var(--ti)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                Resume
              </span>
            )}
          </div>

          {/* CV document sub-items — sb-doc style */}
          {cvs.map((cv) => {
            const isActive = currentCv?.id === cv.id;
            const updatedAt = new Date(
              cv.metadata?.updatedAt ?? cv.metadata?.createdAt ?? Date.now()
            ).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

            return collapsed ? null : (
              <SbDoc
                key={cv.id}
                title={cv.title}
                date={updatedAt}
                isActive={isActive}
                onClick={() => handleLoadCv(cv.id)}
                onRename={(e) => { e.stopPropagation(); handleRenameOpen(cv.id, cv.title); }}
                onDelete={(e) => handleDelete(e, cv.id, cv.title)}
              />
            );
          })}

          {/* New CV link */}
          {!collapsed && (
            <button
              onClick={handleCreate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s3)",
                padding: "var(--s2)",
                borderRadius: "var(--rs)",
                cursor: "pointer",
                height: 30,
                color: "var(--tg2)",
                fontSize: "var(--tx)",
                transition: "all .12s var(--ez)",
                background: "transparent",
                border: "none",
                width: "100%",
                textAlign: "left",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.color = "var(--am)";
                b.style.background = "var(--sf2)";
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.color = "var(--tg2)";
                b.style.background = "transparent";
              }}
            >
              <Plus size={16} style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>New resume</span>
            </button>
          )}

          {/* Error display */}
          {error && !collapsed && (
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
            gap: collapsed ? 0 : "var(--s3)",
            overflow: "hidden",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 30,
              height: 30,
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
            P
          </div>

          {/* Name — hidden in collapsed */}
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontSize: "var(--ts)", fontWeight: 600, color: "var(--ti)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Profile
              </div>
            </div>
          )}

          {/* Theme toggle — hidden in collapsed */}
          {!collapsed && <DarkModeToggle />}
        </div>
      </div>

      {/* ── Rename dialog — logique intacte ─────────────── */}
      <CvRenameDialog
        open={renameTarget !== null}
        currentTitle={renameTarget?.title ?? ""}
        onClose={() => setRenameTarget(null)}
        onSave={handleRenameSave}
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
  isActive: boolean;
  onClick: () => void;
  onRename: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SbDoc({ title, date, isActive, onClick, onRename, onDelete }: SbDocProps) {
  const [hovered, setHovered] = useState(false);
  const [delHovered, setDelHovered] = useState(false);
  const [renHovered, setRenHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: `var(--s2) var(--s2) var(--s2) ${isActive ? "30px" : "32px"}`,
        borderRadius: "var(--rs)",
        cursor: "pointer",
        transition: "all .12s var(--ez)",
        position: "relative",
        background: isActive ? "var(--sfr)" : hovered ? "var(--sf2)" : "transparent",
        borderLeft: isActive ? "2px solid var(--ac)" : "none",
      }}
    >
      <div
        style={{
          fontSize: "var(--ts)",
          fontWeight: 500,
          color: "var(--ti)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 160,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 10, color: "var(--tg2)", marginTop: 2, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
        {date}
      </div>

      {/* Rename button — appears on hover */}
      <button
        onClick={onRename}
        onMouseEnter={() => setRenHovered(true)}
        onMouseLeave={() => setRenHovered(false)}
        title="Rename"
        style={{
          position: "absolute",
          right: 24,
          top: "50%",
          transform: "translateY(-50%)",
          width: 20,
          height: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 3,
          border: "none",
          background: renHovered ? "var(--sf2)" : "transparent",
          color: renHovered ? "var(--ti)" : "var(--tg2)",
          cursor: "pointer",
          padding: 0,
          opacity: hovered ? 1 : 0,
          transition: "opacity .1s var(--ez), color .1s var(--ez), background .1s var(--ez)",
          fontFamily: "inherit",
        }}
      >
        <Pencil size={10} />
      </button>

      {/* Delete button — appears on hover, danger on its own hover */}
      <button
        onClick={onDelete}
        onMouseEnter={() => setDelHovered(true)}
        onMouseLeave={() => setDelHovered(false)}
        title="Delete"
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          width: 20,
          height: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 3,
          border: "none",
          background: delHovered ? "var(--erb)" : "transparent",
          color: delHovered ? "var(--ert)" : "var(--tg2)",
          cursor: "pointer",
          padding: 0,
          opacity: hovered ? 1 : 0,
          transition: "opacity .1s var(--ez), color .1s var(--ez), background .1s var(--ez)",
          fontFamily: "inherit",
        }}
      >
        {/* ✕ icon 10×10 */}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 2l8 8M10 2L2 10" />
        </svg>
      </button>
    </div>
  );
}

export default Sidebar;
