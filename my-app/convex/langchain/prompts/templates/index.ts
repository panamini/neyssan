import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

// Define Zod schema for variable validation
const proposalVariablesSchema = z.object({
  jobTitle: z.string().min(5),
  jobDescription: z.string().min(20),
  tone: z.enum(['technical', 'creative']).default('technical'),
  creativeDirection: z.string().optional(),
});

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
};

// Define prompt templates
export const proposalTemplates = {
  technical: new PromptTemplate({
    inputVariables: ["jobTitle", "jobDescription"],
    template: "Write a technical proposal for a {jobTitle} role with the following description: {jobDescription}",
  }),
  creative: new PromptTemplate({
    inputVariables: ["jobTitle", "jobDescription", "creativeDirection"],
    template:
      "Write a complete application letter or message body for a {jobTitle} role with the following description: {jobDescription}. " +
      "Write in first person. Do not output a subject line or headings. " +
      "Keep it natural, specific, and complete. " +
      "If useful, incorporate this direction: {creativeDirection}",
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

import { TemplateMap } from '../templates';
export type TemplateName = keyof TemplateMap;
