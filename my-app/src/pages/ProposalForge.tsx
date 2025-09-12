import React from "react";
import ProposalInputForm from "../components/ProposalInputForm";
import ProposalDisplay from "../components/ProposalDisplay";
import ProposalsList from "../components/ProposalsList";
import { Flex } from "@radix-ui/themes";

/**
 * ProposalForge
 *
 * Dedicated Proposal workspace page. Keeps proposal-related components and state
 * isolated from the CV workspace.
 */
export function ProposalForge(): JSX.Element {
  const [proposalContent, setProposalContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleProposalSubmit = (_values: any, proposal: string) => {
    setLoading(true);
    setError(null);
    try {
      setProposalContent(proposal);
    } catch (e: any) {
      setError(e.message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <Flex direction="column" gap="4" align="stretch" className="w-full">
        <h2 className="text-lg font-semibold">Proposal Forge</h2>

        <div className="p-4 border rounded bg-background">
          <p className="text-sm text-muted-foreground">
            This workspace is dedicated to writing and managing proposals.
          </p>
        </div>

        <div className="mt-4">
          <ProposalDisplay proposalContent={proposalContent} loading={loading} error={error} />
        </div>

        <div className="py-4">
          <ProposalInputForm onSubmit={handleProposalSubmit} />
        </div>

        <div className="mt-6">
          <ProposalsList />
        </div>
      </Flex>
    </main>
  );
}