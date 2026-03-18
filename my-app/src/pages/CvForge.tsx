import React from "react";
import { CvLibraryProvider } from "../contexts/CvLibraryContext";
import { Sidebar } from "../components/Sidebar";
import { ProfileReviewCard } from "../components/ProfileReviewCard";
import { Flex } from "@radix-ui/themes";
import { CvToolbar } from "../components/header/CvToolbar";

/**
 * CvForge
 *
 * Dedicated CV workspace page. It mounts CvLibraryProvider so all CV-related
 * contexts and components are scoped to this page only.
 *
 * This page intentionally keeps a minimal layout so the CV workspace can
 * be iterated on independently from the proposal flow.
 */
export function CvForge(): JSX.Element {
  return (
    <CvLibraryProvider>
      <div className="flex flex-row">
        <Sidebar />
        <main className="flex-1 px-4 py-6">
          <Flex direction="column" gap="4" align="stretch" className="w-full">
            <h2 className="text-lg font-semibold">CV Forge</h2>
            <div className="p-4 border rounded bg-background">
              <p className="text-sm text-muted-foreground">
                This workspace contains the CV library and editor. Use the sidebar to create or select a CV, then upload or edit it here.
              </p>
            </div>

            {/* Workspace Toolbar */}
            <CvToolbar className="mt-1" />

            {/* Main editor / review canvas */}
            <div className="mt-4">
              <ProfileReviewCard />
            </div>
          </Flex>
        </main>
      </div>
    </CvLibraryProvider>
  );
}
