"use client";
import React from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { api } from "../../convex/_generated/api";

/**
 * ConvexStatusBanner
 *
 * Displays a lightweight status banner if the Convex mutation `mutations:upsertProfile`
 * is not available at runtime. This helps developers and users by surfacing the
 * exact actionable command to run locally (`npx convex dev`) or to deploy (`npx convex deploy`).
 *
 * Usage: import and render near your App header (for example in src/App.tsx or Header).
 *
 * This component intentionally performs a synchronous capability check against the
 * generated `api` object (no network call). If the function is not present, the
 * server-side runtime hasn't been started or deployed.
 */
export function ConvexStatusBanner(): JSX.Element | null {
  // Defensive check for the generated api shape
  const hasUpsert =
    typeof (api as any)?.mutations !== "undefined" && typeof (api as any).mutations?.upsertProfile !== "undefined";

  if (hasUpsert) return null;

  // Render a prominent but non-blocking banner that instructs the developer/user.
  return (
    <Card className="mb-4 text-yellow-900 border-yellow-400 bg-yellow-50">
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <div className="font-medium">Server save unavailable</div>
          <div className="text-sm">
            The Convex mutation <code>mutations:upsertProfile</code> is not found at runtime.
            To enable server saves, run the local Convex dev server or deploy your functions.
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => {
              void navigator.clipboard?.writeText("npx convex dev").catch(() => {});
            }}
            variant="ghost"
            aria-label="Copy npx convex dev"
          >
            Copy: npx convex dev
          </Button>

          <Button
            onClick={() => {
              void navigator.clipboard?.writeText("npx convex deploy").catch(() => {});
            }}
            variant="secondary"
            aria-label="Copy npx convex deploy"
          >
            Copy: npx convex deploy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ConvexStatusBanner;