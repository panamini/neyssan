# Integrating Mistral Models and Agents into Proposal Generation

This document outlines the changes required to integrate Mistral models into our Convex backend for proposal generation. With this integration, you will be able to choose between using the existing ChatGPT-based approach as well as new Mistral options:
- Standard Mistral models (`mistral-large-latest` and `mistral-small-latest`) for chat completions.
- A dedicated Mistral Agent via the Agents API (`mistral-agent`).

---

## Prerequisites

1. **Install the Mistral Integration Package:**

   ```bash
   npm install @langchain/mistralai
   ```

2. **Set Environment Variables:**

   - `MISTRAL_API_KEY`: Your Mistral API key.
   - (Optional) `LANGSMITH_API_KEY`: For automated tracing of model calls.

3. **For Agent Integration:**

   - Create an agent on the Mistral platform.
   - Note your agent ID. For testing, you can use the official agent ID (or your own) such as:  
     `ag:36f49d06:20250206:untitled-agent:e85f118c`.

---

## Backend Changes Overview

We will update the Convex action `generateProposal` (in `convex/functions/generateProposalMutation.ts`) to support a new parameter, `modelType`, while keeping the existing ChatGPT logic intact.

The new parameters are:
- **`modelType`**: A union of the following string values:
  - `"chatgpt"` (use existing GPT-based approach)
  - `"mistral-large-latest"`
  - `"mistral-small-latest"`
  - `"mistral-agent"`
- **`agentId`** (optional): Used when `modelType` is `"mistral-agent"`.

**Current Status & Next Steps:**

Before proceeding with further implementation, it's important to address the TypeScript errors encountered previously. These errors, specifically related to import paths and type definitions, have been resolved. The `HumanMessage` import is now correctly pointing to `@langchain/core/messages`, and type definitions for `ProposalServiceConfig` and `generateProposal` arguments have been updated.

With these corrections in place, the next steps to complete the Mistral integration are:

1. **Verify Environment Variables**: Ensure that the `MISTRAL_API_KEY` environment variable is correctly set in the Convex environment.
2. **Implement Model Selection Logic in `generateProposalMutation.ts`**: Update the `generateProposal` action in `convex/functions/generateProposalMutation.ts` to include the logic for handling different `modelType` values as detailed in the "Detailed Changes" section below. This involves:
    - Branching the code execution based on the `modelType` argument.
    - Importing and instantiating the appropriate Mistral model classes (`ChatMistralAI`, `Mistral`).
    - Constructing prompts and invoking the models/agents as described.
3. **Frontend Changes**: Modify the frontend `ProposalInputForm` component to include a dropdown menu for selecting the `modelType`. If `"mistral-agent"` is chosen, optionally display an input field for the `agentId`.
4. **Testing**: Thoroughly test the integration by generating proposals with each of the `modelType` options to ensure they function correctly and that the generated proposals are satisfactory.

---

## Detailed Changes

### 1. Update Action Arguments

In the action's `args` object, add:
- `modelType`: The union type mentioned above.
- `agentId`: Optional string parameter for agent mode.

### 2. Update the Handler Logic

Modify the mutation handler to branch based on `args.modelType`:

- **For `"chatgpt"`**:
  - Retain the existing logic (using ProposalService and GPT4Adapter, etc.).

- **For `"mistral-large-latest"` or `"mistral-small-latest"`**:
  - Import `ChatMistralAI` from `@langchain/mistralai`.
  - Instantiate the model with:
    ```ts
    const model = new ChatMistralAI({
      apiKey: process.env.MISTRAL_API_KEY,
      modelName: args.modelType,
    });
    ```
  - Construct a prompt incorporating the job title, description, tone, and creativity:
    ```
    Generate a {proposalType} proposal for the job "{jobTitle}" with description: {jobDescription}. Tone: {formalityLevel}. Creativity: {creativity}.
    ```
  - Call the model’s `invoke()` passing a new `HumanMessage` (imported from `@langchain/schema`) to generate the proposal content:
    ```ts
    const response = await model.invoke(new HumanMessage(prompt));
    proposalContent = response.content;
    ```

- **For `"mistral-agent"`**:
  - Import the `Mistral` client from `@langchain/mistralai`.
  - Create a client instance:
    ```ts
    const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
    ```
  - Use the Agents API, supplying the agent ID (from `args.agentId` or defaulting to a known agent ID) and the prompt:
    ```ts
    const agentResponse = await client.agents.complete({
      agent_id: args.agentId || "ag:36f49d06:20250206:untitled-agent:e85f118c",
      messages: [{ role: "user", content: prompt }],
    });
    proposalContent = agentResponse.choices[0].message.content;
    ```

### 3. Storing the Proposal

After generating `proposalContent` using the chosen model, continue with the existing logic to store the proposal in the database.

---

## Sample Code Snippet

Below is an abbreviated snippet that demonstrates the core concept:

```ts
// In convex/functions/generateProposalMutation.ts
import { action } from "../_generated/server";
import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { internal, api } from "../_generated/api";
import { HumanMessage } from "@langchain/schema";

// Define the union type for model selection
const modelChoice = v.union(
  v.literal("chatgpt"),
  v.literal("mistral-large-latest"),
  v.literal("mistral-small-latest"),
  v.literal("mistral-agent")
);

export const generateProposal = action({
  args: {
    jobTitle: v.string(),
    jobDescription: v.string(),
    proposalType: v.union(v.literal("technical"), v.literal("creative")),
    formalityLevel: v.string(),
    creativity: v.string(),
    modelType: modelChoice, // new parameter
    agentId: v.optional(v.string()), // optional for agent mode
  },
  handler: async (
    ctx: ActionCtx,
    args: {
      jobTitle: string;
      jobDescription: string;
      proposalType: "technical" | "creative";
      formalityLevel: string;
      creativity: string;
      modelType: "chatgpt" | "mistral-large-latest" | "mistral-small-latest" | "mistral-agent";
      agentId?: string;
    }
  ): Promise<{ proposalId: Id<"proposals">; proposalContent: string }> => {
    // (Authentication and user profile logic omitted for brevity)

    let proposalContent: string;
    const prompt = `Generate a ${args.proposalType} proposal for the job "${args.jobTitle}" with description: ${args.jobDescription}. Tone: ${args.formalityLevel}. Creativity: ${args.creativity}.`;

    if (args.modelType === "chatgpt") {
      // Existing logic using GPT-based models
    } else if (args.modelType === "mistral-large-latest" || args.modelType === "mistral-small-latest") {
      const { ChatMistralAI } = await import("@langchain/mistralai");
      const model = new ChatMistralAI({
        apiKey: process.env.MISTRAL_API_KEY,
        modelName: args.modelType,
      });
      const response = await model.invoke(new HumanMessage(prompt));
      proposalContent = response.content;
    } else if (args.modelType === "mistral-agent") {
      const { Mistral } = await import("@langchain/mistralai");
      const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
      const agentResponse = await client.agents.complete({
        agent_id: args.agentId || "ag:36f49d06:20250206:untitled-agent:e85f118c",
        messages: [{ role: "user", content: prompt }],
      });
      proposalContent = agentResponse.choices[0].message.content;
    } else {
      throw new ConvexError("Invalid model type selected");
    }

    // Proceed with storing the proposal using existing logic
    const proposalId = (await ctx.runMutation(
      internal.proposals.storeProposal,
      {
        userId: /* your logic here */,
        title: args.jobTitle,
        content: proposalContent,
        status: "pending",
        // Other fields...
      }
    )) as Id<"proposals">;

    return { proposalId, proposalContent };
  },
});
```

---

## Frontend Considerations

On the frontend, you can implement a dropdown selector that lets the user choose the desired model type from:
- `chatgpt`
- `mistral-large-latest`
- `mistral-small-latest`
- `mistral-agent`

If `"mistral-agent"` is selected, an additional input field for the `agentId` (with a default value) can be displayed. These values will be sent with the proposal submission.

---

## Summary

- **New Parameters:** `modelType` (to select between `chatgpt`, `mistral-large-latest`, `mistral-small-latest`, and `mistral-agent`) and an optional `agentId` (for agent mode).
- **Mistral Integration:**  
  - **Standard Mistral Models:** Use `ChatMistralAI` from `@langchain/mistralai` to invoke chat completions.
  - **Agent Integration:** Use the `Mistral` client’s Agents API for completions.
- **Existing ChatGPT Logic:** Remains intact, ensuring no disruption to current functionality.
- **Prompt Construction:** A unified prompt combining relevant proposal details is used across all models.

This updated integration plan keeps your current ChatGPT model while adding new options for Mistral models and agents.

---

Feel free to adjust any details as needed.
