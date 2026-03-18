import "./styles/globals.css";
"use client";

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";
import { ConvexStatusBanner } from "./components/ConvexStatusBanner";
import DarkModeToggle from "./components/dark-mode-toggle/DarkModeToggle";
import { CvForge } from "./pages/CvForge";
import { ProposalForge } from "./pages/ProposalForge";

/**
 * Breadcrumb label derived from current route.
 * Source : squelette dasti-v16 § topbar
 */
function useBreadcrumb(): string {
  const { pathname } = useLocation();
  if (pathname.startsWith("/proposal")) return "Write";
  return "Resume";
}

/**
 * Topbar — h:54px (--hdr), breadcrumb "dasti › Page", Export PDF.
 * Frosted glass non activé (note §A spec — chantier séparé).
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
        <span
          style={{
            fontSize: "var(--ts)",
            color: "var(--tg2)",
            display: "flex",
            alignItems: "center",
            gap: "var(--s2)",
          }}
        >
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
          {/* Download icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 13h12M8 2v8M5 6l3 3 3-3" />
          </svg>
          Export PDF
        </button>

        <DarkModeToggle />

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
                border: "1px solid transparent",
                background: "transparent",
                color: "var(--tm2)",
                fontSize: "var(--ts)",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all .12s var(--ez)",
                fontFamily: "inherit",
              }}
            >
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "var(--hs)",
                padding: "0 var(--s3)",
                borderRadius: "var(--rs)",
                border: "1px solid transparent",
                background: "transparent",
                color: "var(--tm2)",
                fontSize: "var(--ts)",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all .12s var(--ez)",
                fontFamily: "inherit",
              }}
            >
              Sign up
            </button>
          </SignUpButton>
        </Unauthenticated>
      </div>
    </header>
  );
}

/**
 * AppShell — layout racine height:100vh overflow:hidden.
 * Séparé de App pour pouvoir utiliser useLocation (nécessite BrowserRouter parent).
 * §layout dasti-spec-v1 §17[A]
 */
function AppShell(): JSX.Element {
  return (
    <div
      className="pal-sauge"
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        color: "var(--ti)",
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
      }}
    >
      <ConvexStatusBanner />
      <Topbar />

      {/* Content area — flex:1 overflow:hidden pour que les pages gèrent leur propre scroll */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Routes>
          <Route path="/cv" element={<CvForge />} />
          <Route path="/proposal" element={<ProposalForge />} />
          <Route path="/" element={<Navigate to="/cv" replace />} />
          <Route path="*" element={<Navigate to="/cv" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
