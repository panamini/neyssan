 Revised Langchain Integration Plan

This plan focuses on ensuring that each module works correctly and integrates seamlessly with the others, leading to a functional MVP.

## I. Core Setup & Verification

1.  **LangChain Setup:**
    *   Remove the duplicate `PromptManager` implementation in `src/langchain/prompts/manager.ts`.
    *   Consolidate template management logic into `src/langchain/prompts/index.ts`.
    *   Create a `templates.ts` file in `src/langchain/prompts/` to define basic prompt templates, default variables, and validators for initial testing.
    *   Modify the `BaseProposalChain` constructor to accept a `PromptManager` instance and a template name.
    *   Update `TechnicalProposalChain` and `CreativeProposalChain` to pass the `PromptManager` and template names to the base class.
    *   Use the Zod schemas in `src/langchain/types.ts` to validate the generated output in the `parseResponse` method of `BaseProposalChain`.
    *   **Verification:** Write unit tests to verify the functionality of the `PromptManager` and the chains in isolation.

2.  **MCP Server Setup:**
    *   Verify that the `/mcp/scraping-server` and `/mcp/proposal-server` directories exist and are correctly configured (as per the MCP server creation documentation).
    *   Ensure the `proposal-server` configuration includes the `OPENAI_API_KEY` environment variable.
    *   Build the MCP servers (`npm run build` in each directory).
    *   **Verification:** Manually test the `scrape_job` tool in the `scraping-server` to ensure it can scrape job descriptions correctly.

3.  **Convex Setup:**
    *   Verify that the Convex deployment specified in `CONVEX_DEPLOYMENT` exists and is correctly configured.
    *   Review and update `convex/schema.ts` to ensure it aligns with the application's data model (proposals, users, etc.).
    *   Deploy Convex functions and update the schema (`npx convex deploy`).
    *   **Verification:** Use the Convex dashboard to verify that the schema is correctly deployed and that you can access the Convex database.

4.  **Frontend Setup:**
    *   Verify that Shadcn UI, Radix UI, and TailwindCSS are correctly configured.
    *   Create `ProposalInputForm.tsx` with minimal input fields (Job Title, Job Description, Proposal Type).
    *   Create `ProposalDisplay.tsx` to display the generated proposal.
    *   Connect the UI to the Convex mutation (`generateProposalMutation`).
    *   **Verification:** Manually test that the UI components are correctly rendered and that you can submit data to the Convex function.

## II. Integration & Data Flow

1.  **Convex Function Integration:**
    *   Modify `convex/functions/generateProposalMutation.ts` to:
        *   Call the `ProposalService` to generate the proposal content.
        *   Store the generated proposal in the Convex database.
        *   Handle errors and return appropriate responses to the UI.
    *   **Verification:** Use the Convex dashboard to verify that the function is correctly invoked and that data is being stored in the database.

2.  **MCP Server Integration:**
    *   Modify the `generate_proposal` tool in the `proposal-server` to:
        *   Receive the job description and other parameters from the UI.
        *   Call the `ProposalService` to generate the proposal content.
        *   Return the generated proposal to the UI.
    *   **Verification:** Manually test the `generate_proposal` tool to ensure it can generate proposals correctly.

3.  **End-to-End Testing:**
    *   Manually test the complete flow:
        1.  Enter input in `ProposalInputForm.tsx`.
        2.  Submit the form.
        3.  Verify that the proposal is generated and displayed in `ProposalDisplay.tsx`.
        4.  Check Convex function logs for any errors.
        5.  Verify that data is correctly stored in the Convex database.

## III. Error Handling & Monitoring

1.  Implement try-catch blocks in `generateProposalMutation` and other relevant functions to handle errors.
2.  Log errors to Convex logs using `console.error`.
3.  Display user-friendly error messages in the UI.
4.  Set up basic monitoring in Convex to track function executions and error rates.

Please switch back to ACT MODE so I can execute this plan.