import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

// Define Zod schema for variable validation
const proposalVariablesSchema = z.object({
  jobTitle: z.string().min(5),
  jobDescription: z.string().min(20),
  tone: z.enum(['technical', 'creative']).default('technical'),
}).passthrough();

// Validator function using Zod schema
const validateProposalVariables = (vars: Record<string, any>) => {
  try {
    proposalVariablesSchema.parse(vars);
    return true;
  } catch (error) {
    console.error("Validation error:", error);
    return false;
  }
};

// Define default variables
const defaultProposalVariables = {
  tone: 'technical',
  formalityLevel: '4',
  creativity: '3',
};

// Define prompt templates
export const proposalTemplates = {
  technical: new PromptTemplate({
    inputVariables: ["jobTitle", "jobDescription", "formalityLevel", "creativity"],
    template: `Write a technical proposal for a {jobTitle} role with the following description: {jobDescription}
The proposal should have a formality level of {formalityLevel} and creativity level of {creativity}.`,
  }),
  creative: new PromptTemplate({
    inputVariables: ["jobTitle", "jobDescription"],
    template: "Write a creative proposal for a {jobTitle} role with the following description: {jobDescription}",
  }),
};

// Export template configurations with defaults and validators
export const templateConfigurations = {
  technical: {
    template: proposalTemplates.technical,
    defaults: defaultProposalVariables,
    validator: validateProposalVariables,
  },
  creative: {
    template: proposalTemplates.creative,
    defaults: defaultProposalVariables,
    validator: validateProposalVariables,
  },
};

export interface TemplateMap {
  technical: typeof proposalTemplates.technical;
  creative: typeof proposalTemplates.creative;
}
