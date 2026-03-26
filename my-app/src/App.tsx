import "./styles/globals.css";

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Unauthenticated } from "convex/react";
import { SignInButton } from "@clerk/clerk-react";
import { ConvexStatusBanner } from "./components/ConvexStatusBanner";
import { CvForge } from "./pages/CvForge";
import { CvsLibrary } from "./pages/CvsLibrary";
import { ProposalForge } from "./pages/ProposalForge";
import { ProposalsLibrary } from "./pages/ProposalsLibrary";
import { StyleForge } from "./pages/StyleForge";
import { Sidebar } from "./components/Sidebar";
import { CvLibraryProvider } from "./contexts/CvLibraryContext";

/**
 * Topbar — h:54px (--hdr), wordmark only.
 */
function Topbar() {
  return (
    <header
      style={{
        height: "var(--hdr)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(var(--space-3), 4vw, var(--space-7))",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-canvas)",
        boxShadow: "0 1px 0 var(--color-border), var(--shadow-sm)",
        position: "relative",
        zIndex: 5,
      }}
    >
      {/* Left — wordmark only */}
      <span
        style={{
          fontFamily: "var(--font-heading-family)",
          fontSize: "var(--tm)",
          fontWeight: "var(--font-heading-weight)",
          letterSpacing: "var(--tracking-display)",
          color: "var(--ti)",
        }}
      >
        dasti
      </span>

      {/* Right — auth only when logged out */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)" }}>
        <Unauthenticated>
          <SignInButton mode="modal">
            <button className="dasti-button dasti-button--secondary dasti-button--sm">
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
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <ConvexStatusBanner />
          <Topbar />

          {/* .pscroll — flex:1 overflow:hidden, chaque page gère son propre scroll */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Routes>
              <Route path="/cv" element={<CvForge />} />
              <Route path="/cvs" element={<CvsLibrary />} />
              <Route path="/proposal" element={<ProposalForge />} />
              <Route path="/proposals" element={<ProposalsLibrary />} />
              <Route path="/style" element={<StyleForge />} />
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
