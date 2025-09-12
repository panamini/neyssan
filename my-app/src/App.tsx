import "./styles/globals.css";
"use client";

import React from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { Button } from "./components/ui/button";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";
import { ConvexStatusBanner } from "./components/ConvexStatusBanner";
import DarkModeToggle from "./components/dark-mode-toggle/DarkModeToggle";

/**
 * Pages (lazy-loaded components)
 * - CvForge: CV workspace (loads CV contexts + components)
 * - ProposalForge: Proposal workspace (loads proposal components)
 *
 * Keep these pages self-contained so each workspace only loads what it needs.
 */
import { CvForge } from "./pages/CvForge";
import { ProposalForge } from "./pages/ProposalForge";

/**
 * Minimal top navigation linking the two workspaces.
 * Defaults to /cv.
 */
export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <header className="w-full border-b bg-background/90 backdrop-blur-sm">
          <div className="flex items-center justify-between max-w-6xl px-4 py-3 mx-auto">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold">Forge</h1>
              <nav className="flex items-center gap-2">
                <Link to="/cv" aria-current="page">
                  <Button variant="ghost" size="sm">CV Forge</Button>
                </Link>
                <Link to="/proposal">
                  <Button variant="ghost" size="sm">Proposal Forge</Button>
                </Link>
              </nav>
            </div>
 
            <div className="flex items-center gap-2">
              <DarkModeToggle />
              <Authenticated>
                <UserButton />
              </Authenticated>
              <Unauthenticated>
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button variant="ghost" size="sm">Sign up</Button>
                </SignUpButton>
              </Unauthenticated>
            </div>
          </div>
          <ConvexStatusBanner />
        </header>

        <main className="max-w-6xl px-4 py-6 mx-auto">
          <Routes>
            <Route path="/cv" element={<CvForge />} />
            <Route path="/proposal" element={<ProposalForge />} />
            <Route path="/" element={<Navigate to="/cv" replace />} />
            <Route path="*" element={<Navigate to="/cv" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
