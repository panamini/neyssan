import React from "react";
import { useConvexAuth, useQuery } from "convex/react";
import ProposalInputForm from "../components/ProposalInputForm";
import ProposalDisplay from "../components/ProposalDisplay";
import ProposalsList from "../components/ProposalsList";
import { Button } from "../components/ui/button";
import { Flex } from "@radix-ui/themes";
import type { FormValues } from "../components/ProposalInputForm.schemas";
import { api } from "../../convex/_generated/api";
import type { ProposalGenerationFallbackInfo } from "../lib/proposal-generation-ui";

type ProposalForgePrefill = {
  handoffId: string;
  jobTitle: string;
  jobDescription: string;
  sourceUrl?: string;
  platform?: string;
} | null;

type ProposalForgeView = "compose" | "saved";

/**
 * ProposalForge
 *
 * Dedicated Proposal workspace page. Keeps proposal-related components and state
 * isolated from the CV workspace.
 */
export function ProposalForge(): JSX.Element {
  const handoffId = React.useMemo(() => new URLSearchParams(window.location.search).get("handoffId"), []);
  const { isLoading: isConvexAuthLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const [proposalContent, setProposalContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [proposalType, setProposalType] = React.useState<FormValues["proposalType"] | null>(null);
  const [fallbackInfo, setFallbackInfo] =
    React.useState<ProposalGenerationFallbackInfo | null>(null);
  const [activeView, setActiveView] = React.useState<ProposalForgeView>("compose");
  const handoffRecord = useQuery(
    api.proposalHandoffs.get,
    handoffId && isConvexAuthenticated ? { handoffId } : "skip",
  );

  const prefill = React.useMemo<ProposalForgePrefill>(() => {
    if (!handoffRecord) {
      return null;
    }

    return {
      handoffId: handoffRecord.handoffId,
      jobTitle: handoffRecord.jobTitle,
      jobDescription: handoffRecord.jobDescription,
      sourceUrl: handoffRecord.sourceUrl,
      platform: handoffRecord.platform,
    };
  }, [handoffRecord]);

  const handleProposalStart = React.useCallback((values: FormValues) => {
    setLoading(true);
    setProposalType(values.proposalType);
    setProposalContent(null);
    setError(null);
    setFallbackInfo(null);
  }, []);

  const handleProposalSubmit = React.useCallback(
    (
      values: FormValues,
      proposal: string,
      nextFallbackInfo?: ProposalGenerationFallbackInfo,
    ) => {
      setProposalType(values.proposalType);
      setProposalContent(proposal);
      setError(null);
      setFallbackInfo(nextFallbackInfo ?? null);
      setLoading(false);
    },
    [],
  );

  const handleProposalError = React.useCallback(
    (message: string, values: FormValues) => {
      setLoading(false);
      setProposalType(values.proposalType);
      setProposalContent(null);
      setError(message);
      setFallbackInfo(null);
    },
    [],
  );

  const isComposeView = activeView === "compose";
  const isSavedView = activeView === "saved";
  const isLoadingHandoff =
    Boolean(handoffId) &&
    (isConvexAuthLoading || (isConvexAuthenticated && handoffRecord === undefined));

  return (
    <main>
      <Flex direction="column" gap="4" align="stretch" className="w-full">
        <h2 className="text-lg font-semibold">Proposal Forge</h2>

        <div className="p-4 border rounded bg-background">
          <p className="text-sm text-muted-foreground">
            This workspace is dedicated to writing and managing proposals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Proposal Forge views">
          <Button
            type="button"
            size="sm"
            variant={isComposeView ? "primary" : "secondary"}
            onClick={() => setActiveView("compose")}
          >
            Compose
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isSavedView ? "primary" : "secondary"}
            onClick={() => setActiveView("saved")}
          >
            Saved
          </Button>
        </div>

        <section className={isComposeView ? "block" : "hidden"} aria-hidden={!isComposeView}>
          <div className="mt-4 flex flex-col gap-3">
            <ProposalDisplay
              proposalContent={proposalContent}
              loading={loading}
              error={error}
              proposalType={proposalType}
              fallbackInfo={fallbackInfo}
            />

          {isLoadingHandoff ? (
            <div>
              <div className="p-4 border rounded bg-background">
                <p className="text-sm text-muted-foreground">
                  Loading imported job offer…
                </p>
              </div>
            </div>
          ) : (
            <div>
              <ProposalInputForm
                onStart={handleProposalStart}
                onSubmit={handleProposalSubmit}
                onError={handleProposalError}
                prefill={prefill}
              />
            </div>
          )}
          </div>
        </section>

        <section className={isSavedView ? "block" : "hidden"} aria-hidden={!isSavedView}>
          <div className="p-4 border rounded bg-background">
            <p className="text-sm text-muted-foreground">
              Browse saved proposals without leaving Proposal Forge.
            </p>
          </div>

          <div className="mt-4">
            <ProposalsList />
          </div>
        </section>
      </Flex>
    </main>
  );
}
