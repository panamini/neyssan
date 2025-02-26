import { useState } from 'react';
import { Theme } from '@radix-ui/themes';
import * as z from 'zod';

import ProposalInputForm from './components/ProposalInputForm';
import ProposalDisplay from './components/ProposalDisplay';
import { formSchema } from './components/ProposalInputForm.schemas'; // Import formSchema from schemas file

interface ProposalState {
  content: string | null;
  isLoading: boolean;
  error: string | null;
}

export function ProposalGenerator() {
  const [state, setState] = useState<ProposalState>({
    content: null,
    isLoading: false,
    error: null,
  });

  const handleProposalSubmit = (_values: z.infer<typeof formSchema>, proposalContent: string) => {
    setState({
      content: proposalContent,
      isLoading: false,
      error: null,
    });
  };

  const resetState = () => setState({
    content: null,
    isLoading: false,
    error: null,
  });

  return (
    <Theme>
      <div className="container p-4 mx-auto space-y-0">
        <h2 className="mb-4 text-2xl font-bold">AI Proposal Generator</h2>
        <div className="space-y-0">
          <ProposalDisplay
            proposalContent={state.content}
            loading={state.isLoading}
            error={state.error}
          />
          <ProposalInputForm onSubmit={handleProposalSubmit} />
        </div>
        {(state.content || state.error) && (
          <button
            onClick={resetState}
            className="px-4 py-2 mt-4 bg-gray-200 rounded hover:bg-gray-300"
          >
            Start New Proposal
          </button>
        )}
      </div>
    </Theme>
  );
}

export default ProposalGenerator;
