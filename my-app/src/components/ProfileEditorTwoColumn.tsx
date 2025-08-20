"use client";

import React from "react";
import { api } from "../../convex/_generated/api";
import { useConvex } from "convex/react";
import ProfileForm from "./ProfileForm";
import ProfileView from "./ProfileView";

/**
 * ProfileEditorTwoColumn
 *
 * A safe, presentation-only two-column wrapper that reuses existing
 * ProfileForm (left: ingestion / edits) and ProfileView (right: preview).
 *
 * This component intentionally avoids reimplementing save/validation logic.
 * It fetches the latest profile for the preview and exposes a manual Refresh
 * control so editors can verify changes immediately.
 *
 * Usage (local preview):
 * - Import and render <ProfileEditorTwoColumn /> (for example in App.tsx while testing)
 *
 * NOTE: This file is created locally for previewing. Do NOT merge until tested.
 */

export default function ProfileEditorTwoColumn() {
  const convex = useConvex();
  const [profile, setProfile] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [lastFetched, setLastFetched] = React.useState<number | null>(null);

    async function fetchProfile() {
    try {
      setLoading(true);
      const p = await convex.query(api.users.getUser as any);
      setProfile(p ?? null);
      setLastFetched(Date.now());
    } catch (err) {
      console.error("Failed to fetch profile for preview", err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void fetchProfile();
    // optional: subscribe to focus to refresh preview
    function onFocus() {
      void fetchProfile();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-6xl p-4 mx-auto">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left column: existing form + editors */}
        <div>
          <ProfileForm />
        </div>

        {/* Right column: live preview (ProfileView) */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Live preview</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  void fetchProfile();
                }}
                className="px-2 py-1 text-sm bg-gray-200 rounded"
                title="Refresh preview"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="p-4 bg-white border rounded">
            {loading ? (
              <div className="text-sm text-gray-500">Loading preview…</div>
            ) : profile ? (
              <ProfileView profile={profile} />
            ) : (
              <div className="text-sm text-gray-500">No profile available</div>
            )}
          </div>

          {lastFetched && (
            <div className="text-xs text-gray-400">
              Preview last fetched: {new Date(lastFetched).toLocaleString()}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
