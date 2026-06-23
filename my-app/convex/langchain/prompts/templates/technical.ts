/* eslint-disable @typescript-eslint/no-explicit-any -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { PromptTemplate } from "@langchain/core/prompts";

/**
 * Technical proposal prompt template
 */
export const technicalTemplate = PromptTemplate.fromTemplate(`
You are tasked with creating a technical proposal for a job opportunity.

Job Description:
{jobDescription}

Required Skills:
{requirements}

Areas of Expertise:
{expertise}

Tone: {tone}
Formality Level: {formalityLevel}
Creativity Level: {creativity}

Please generate a professional proposal that:
1. Demonstrates deep understanding of the technical requirements
2. Highlights relevant expertise and experience
3. Maintains the specified tone and formality level
4. Includes specific examples and approaches
5. Addresses potential challenges and solutions

Format the proposal with clear sections:
- Introduction
- Technical Approach
- Relevant Experience
- Project Management
- Timeline & Deliverables
- Conclusion

Keep the tone {tone} and maintain a formality level of {formalityLevel} out of 5.
`);

/**
 * Default technical prompt variables
 */
export const defaultTechnicalVariables = {
  formalityLevel: "4",
  creativity: "3",
  tone: "technical",
};

/**
 * Validates technical prompt variables
 */
export function validateTechnicalVariables(variables: Record<string, any>): boolean {
  console.log("Variables received in validateTechnicalVariables:", variables);
  const required = ["jobDescription", "requirements", "expertise", "tone"]; // Changed to 'jobDescription'
  return required.every(key => key in variables && variables[key]);
}
