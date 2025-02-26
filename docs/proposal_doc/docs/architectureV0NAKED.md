Understood. Let's craft a focused architecture that balances your goals with maintainability:

graph TD
    A[Chrome Extension] --> B{Job Capture}
    B --> C[Platform-Specific Parser]
    C --> D[MCP Scraping Service]
    D --> E[Proposal Generator]
    E --> F[User Profile DB]
    F --> G[Tone Settings]
    G --> E
    E --> H[Save/Send Actions]
    H --> I[Employer Channels]
1. MVP Core Implementation
a. Chrome Extension Essentials

// chrome-extension/content.ts
interface JobCaptureRequest {
  url: string;
  platform: 'upwork' | 'linkedin' | 'fiverr';
  userToken: string;
}

class ProposalHandler {
  async generateAndSend(job: JobCaptureRequest) {
    const content = await mcpClient.callTool('scrape_job', job);
    const proposal = await mcpClient.callTool('generate_proposal', {
      ...content,
      tone: userProfile.tonePreference
    });
    await saveProposal(proposal);
    if (userProfile.autoSend) await sendToPlatform(job.platform, proposal);
  }
}
b. MCP Services Structure

/mcp
  /scraping-server
    /src
      platforms/ # Platform-specific parsers
      tools/
        scrape_job.ts
  /proposal-server
    /src
      generators/ # LangChain logic
      tools/
        generate_proposal.ts
c. Tone Control Implementation

// Simple MVP version (expandable)
type ToneOption = 'formal' | 'friendly' | 'technical';

const TONE_INSTRUCTIONS: Record<ToneOption, string> = {
  formal: "Use professional business language",
  friendly: "Adopt a conversational tone",
  technical: "Focus on technical specifications"
};

function applyTone(proposal: string, tone: ToneOption): string {
  return `${TONE_INSTRUCTIONS[tone]}\n\n${proposal}`;
}
2. Key Architecture Decisions
Modular Platform Parsers
// mcp/scraping-server/src/platforms/upwork.ts
export class UpworkParser implements PlatformParser {
  async parse(content: string): ParsedJob {
    // Specialized extraction logic
    return {
      title: extractTitle(content),
      budget: extractBudget(content),
      urgency: detectUrgency(content)
    };
  }
}
Profile-Based Learning
// Future-ready interface
interface UserProfile {
  writingStyle: {
    commonPhrases: string[];
    sentenceLength: number;
    formalityLevel: 1-5;
  };
  successfullProposals: string[];
}
Auto-Send Implementation
sequenceDiagram
    Chrome->>MCP: Scrape Job
    MCP->>Generator: Create Proposal
    Generator->>DB: Save Draft
    User->>UI: Approve
    UI->>MCP: Send Proposal
    MCP->>Platform API: Submit
3. Implementation Roadmap
Phase 1 (2 Weeks)
Chrome extension job capture
MCP scraping service
Basic tone control
Manual send functionality
Phase 2 (1 Week)
User profile storage
Proposal history
Auto-save feature
Phase 3 (1 Week)
Platform auto-send
Basic style learning
A/B testing setup
Next Steps

Create MCP server scaffolding
Implement core scraping service
Build Chrome extension UI