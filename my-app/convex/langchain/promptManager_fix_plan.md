# Langchain Migration Plan

## 1. Unify PromptManager Implementations

-   Remove the duplicate `PromptManager` implementation in `src/langchain/prompts/manager.ts`.
-   Consolidate template management logic into `src/langchain/prompts/index.ts`.

## 2. Implement Template Loading

-   Create a `templates.ts` file in `src/langchain/prompts/` to define prompt templates, default variables, and validators.
-   Register the templates in the `ProposalService` using the `PromptManager`.

## 3. Update Chains to Use PromptManager

-   Modify the `BaseProposalChain` constructor to accept a `PromptManager` instance and a template name.
-   Update `TechnicalProposalChain` and `CreativeProposalChain` to pass the `PromptManager` and template names to the base class.
-   Use the `PromptManager` to retrieve templates in the `generate` method of `BaseProposalChain`.

## 4. Add Schema Validation

-   Use the Zod schemas in `src/langchain/types.ts` to validate the generated output in the `parseResponse` method of `BaseProposalChain`.

## 5. Test Changes

-   Run the tests to ensure that the changes haven't broken existing functionality.

## 6. Implement Versioning (Optional)

-   If versioning is required, implement it in the `PromptManager`.

Please switch back to ACT MODE so I can execute this plan.
