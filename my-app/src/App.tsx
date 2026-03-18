import "./styles/globals.css";
"use client";

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton, UserButton } from "@clerk/clerk-react";
import { ConvexStatusBanner } from "./components/ConvexStatusBanner";
import DarkModeToggle from "./components/dark-mode-toggle/DarkModeToggle";
import { CvForge } from "./pages/CvForge";
import { ProposalForge } from "./pages/ProposalForge";
import { Sidebar } from "./components/Sidebar";
import { CvLibraryProvider } from "./contexts/CvLibraryContext";

/**
 * Breadcrumb label derived from current route.
 */
function useBreadcrumb(): string {
  const { pathname } = useLocation();
  if (pathname.startsWith("/proposal")) return "Write";
  return "Resume";
}

/**
 * Topbar — h:54px (--hdr), breadcrumb "dasti › Page".
 * §17[A] frosted glass non activé — chantier séparé.
 */
function Topbar() {
  const breadcrumb = useBreadcrumb();
  return (
    <header
      style={{
        height: "var(--hdr)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--s7)",
        borderBottom: "1px solid var(--bo)",
        background: "var(--bg)",
        boxShadow: "0 1px 0 var(--bo), 0 2px 16px hsla(30,20%,8%,.06)",
        position: "relative",
        zIndex: 5,
      }}
    >
      {/* Left — wordmark + breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s4)" }}>
        <span
          style={{
            fontFamily: '"Fraunces", serif',
            fontSize: "var(--ts)",
            fontWeight: 600,
            letterSpacing: "-.01em",
            color: "var(--ti)",
          }}
        >
          dasti
        </span>
        <span style={{ fontSize: "var(--ts)", color: "var(--tg2)", display: "flex", alignItems: "center", gap: "var(--s2)" }}>
          <span>›</span>
          <span style={{ color: "var(--ti)", fontWeight: 500 }}>{breadcrumb}</span>
        </span>
      </div>

      {/* Right — Export PDF + auth + dark mode */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)" }}>
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s2)",
            height: "var(--hs)",
            padding: "0 var(--s3)",
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
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--sf2)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--sfr)")}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 13h12M8 2v8M5 6l3 3 3-3" />
          </svg>
          Export PDF
        </button>

        <Authenticated>
          <UserButton />
        </Authenticated>
        <Unauthenticated>
          <SignInButton mode="modal">
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "var(--hs)",
                padding: "0 var(--s3)",
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
              }}
            >
              Sign in
            </button>
          </SignInButton>
        </Unauthenticated>
      </div>
    </header>
  );
}

/**
 * AppShell — structure exacte du squelette dasti-v16 :
 *   <div class="app">           flex-row h:100vh overflow:hidden
 *     <aside class="sb">        sidebar h:100vh
 *     <div class="page-area">   flex:1 flex-col overflow:hidden
 *       <header class="top">    topbar 54px
 *       <div class="pscroll">   flex:1 overflow:hidden → pages gèrent leur scroll
 *
 * CvLibraryProvider ici pour que Sidebar ait accès au contexte CV
 * depuis n'importe quelle route.
 */
function AppShell(): JSX.Element {
  return (
    <CvLibraryProvider>
      {/* .app — flex row, h:100vh overflow:hidden */}
      <div
        className="pal-sauge"
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100vh",
          overflow: "hidden",
          background: "var(--bg)",
          color: "var(--ti)",
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
        }}
      >
        {/* Sidebar — h:100vh depuis le parent flex */}
        <Sidebar />

        {/* .page-area — flex:1, flex-col */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <ConvexStatusBanner />
          <Topbar />

          {/* .pscroll — flex:1 overflow:hidden, chaque page gère son propre scroll */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Routes>
              <Route path="/cv" element={<CvForge />} />
              <Route path="/proposal" element={<ProposalForge />} />
              <Route path="/" element={<Navigate to="/cv" replace />} />
              <Route path="*" element={<Navigate to="/cv" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </CvLibraryProvider>
  );
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
