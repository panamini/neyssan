## **Phase 1 Implementation Plan (High Priority)**

### **A. Input-Processing & Output Flow Implementation**
This phase ensures the full flow from input (user form) → processing (Convex API & LangChain) → output (proposal generation).

#### **1. Create Minimal Convex Endpoint**
- Implements a **Convex mutation** to handle proposal generation requests.
- Calls `generateProposal` from the `proposal-handler` service.

```typescript
// convex/proposals.ts
import { mutation } from "./_generated/server";
import { generateProposal } from "../../src/services/proposal-handler"; 

export const generateProposalMutation = mutation({
  args: {
    jobDescription: v.string(),
    proposalType: v.union(v.literal("technical"), v.literal("creative"))
  },
  handler: async (ctx, args) => {
    try {
      return await generateProposal({
        jobDescription: args.jobDescription,
        type: args.proposalType
      });
    } catch (error) {
      console.error("Proposal generation failed:", error);
      throw new Error("Failed to generate proposal");
    }
  }
});
```

#### **2. LangChain Integration**
- Uses **LangChain** to generate different proposal types.
- Calls an appropriate AI-driven chain based on the `proposalType` selected.

```typescript
// src/services/proposal-handler.ts
import { ChainFactory } from "../langchain/chains";

export async function generateProposal(params: {
  jobDescription: string;
  type: "technical" | "creative";
}) {
  const chain = ChainFactory.createChain(params.type);
  return chain.generate({
    jobDescription: params.jobDescription,
    // Add other required parameters based on chain type
  });
}
```

#### **3. UI Integration (React)**
- Implements a simple **React form** to capture user input.  
- Calls the **Convex function** to generate the proposal dynamically.  

```tsx
// src/components/ProposalForm.tsx
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

function ProposalForm() {
  const generateProposal = useMutation(api.proposals.generateProposalMutation);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await generateProposal({
      jobDescription: e.target.jobDesc.value,
      proposalType: e.target.proposalType.value
    });
    console.log("Generated Proposal:", result);
    // Optionally, display result in UI
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea name="jobDesc" required placeholder="Enter job description..." />
      <select name="proposalType">
        <option value="technical">Technical</option>
        <option value="creative">Creative</option>
      </select>
      <button type="submit">Generate Proposal</button>
    </form>
  );
}

export default ProposalForm;
```

---

### **B. Convex Endpoint Stabilization**
#### **1. Export Configuration**
- Ensures Convex functions are properly exported for usage.

```typescript
// convex/functions.ts
export * from "./proposals";
```

#### **2. Environment Setup**
- Stores **Convex deployment URL** for API requests.

```
# .env.local
CONVEX_URL="https://your-deployment.convex.cloud"
```

#### **3. Validation Layer**
- Defines a schema to **validate incoming API requests**.

```typescript
// convex/utils/validation.ts
import { v } from "convex/values";

export const ProposalRequestSchema = v.object({
  jobDescription: v.string(),
  proposalType: v.union(v.literal("technical"), v.literal("creative"))
});
```

---

### **C. Implementation Checklist**
Before moving forward, ensure that:  

✅ Convex function exports are verified in **convex/functions.ts**.  
✅ Endpoint can be tested using:  
```sh
npx convex run proposals:generateProposalMutation
```
✅ LangChain chains are properly **initialized and tested**.  
✅ Environment variables are correctly **configured in `.env.local`**.  
✅ Basic **error logging** is implemented in the backend.  
✅ Full flow is tested **from UI to generated output**.  

---

### **Next Steps for Client Guidance**
Would you like help with:  
**a. Writing unit tests** for Convex and LangChain functions?  
**b. Implementing a frontend display** for generated proposals?
