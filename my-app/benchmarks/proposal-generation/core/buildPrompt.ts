import type { BenchmarkCase, CandidateContext } from "./types";

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildCandidateContextBlock(context: CandidateContext | null): string {
  if (!context) {
    return [
      "No candidate background is available for this request.",
      "Do not claim or imply any profession, tools, projects, employers, industries, years of experience, or accomplishments that are not provided.",
      "If evidence is missing, write a shorter, more generic, motivation-based proposal that stays professional and honest.",
    ].join(" ");
  }

  const lines: string[] = ["Candidate background for personalization:"];

  if (context.name) lines.push(`- Name: ${compactWhitespace(context.name)}`);
  if (context.summary) lines.push(`- Professional summary: ${compactWhitespace(context.summary)}`);
  if (context.desiredPosition) lines.push(`- Target role / headline: ${compactWhitespace(context.desiredPosition)}`);
  if (context.topSkills?.length) lines.push(`- Core skills: ${context.topSkills.map(compactWhitespace).join(", ")}`);
  if (context.recentExperience?.length) {
    lines.push("- Recent experience:");
    for (const entry of context.recentExperience) {
      const role = [entry.position, entry.company ? `at ${entry.company}` : ""]
        .filter(Boolean)
        .map(compactWhitespace)
        .join(" ");
      const highlights = entry.highlights?.length
        ? `: ${entry.highlights.map(compactWhitespace).join("; ")}`
        : "";
      lines.push(`  - ${role || "Relevant role"}${highlights}`);
    }
  }
  if (context.standoutAchievements?.length) {
    lines.push(`- Standout achievements: ${context.standoutAchievements.map(compactWhitespace).join("; ")}`);
  }

  lines.push("Use this background only to tailor tone and relevance.");
  lines.push("Do not invent employers, achievements, years, or technical experience.");
  return lines.join("\n");
}

function buildOutputInstructions(benchmarkCase: BenchmarkCase): string {
  const toneGuidance = `Use "${benchmarkCase.formalityLevel}" formality and "${benchmarkCase.creativity}" creativity only as tone guidance.`;
  const antiHallucinationGuidance = [
    "Use the candidate background as the only source of claims about the candidate.",
    "Every qualification, achievement, or strength you mention must be grounded in the candidate background.",
    "Never treat the job description as evidence about the candidate.",
    "Do not invent employers, software tools, certifications, years of experience, measurable outcomes, degrees, or side projects.",
    "If an important requirement is missing from the candidate background, do not imply that the candidate already has it.",
    "Prefer fewer claims over invented claims.",
  ].join(" ");

  switch (benchmarkCase.proposalType) {
    case "application_message":
      return [
        `Write a complete job application message for "${benchmarkCase.jobTitle}".`,
        `Job description: ${benchmarkCase.jobDescription}.`,
        "Output only the message body.",
        "Write in first person.",
        "Keep it about 70 to 100 words.",
        "Use 1 to 2 short paragraphs only.",
        "Do not use headings, bullet points, subject lines, or contact/signature blocks.",
        "Keep it concise, direct, and human.",
        antiHallucinationGuidance,
        toneGuidance,
      ].join(" ");
    case "freelance_proposal":
      return [
        `Write a client-facing freelance proposal for "${benchmarkCase.jobTitle}".`,
        `Job description: ${benchmarkCase.jobDescription}.`,
        "Write in first person.",
        "Focus on relevant experience, understanding of the client's need, a concise approach, and a clear closing.",
        "Keep it specific and persuasive without sounding bloated.",
        "Avoid headings unless they materially improve clarity.",
        antiHallucinationGuidance,
        toneGuidance,
      ].join(" ");
    case "cover_letter":
    default:
      return [
        `Write a tailored employment cover letter for "${benchmarkCase.jobTitle}".`,
        `Job description: ${benchmarkCase.jobDescription}.`,
        "Output only the letter body.",
        "Start with a salutation line such as: Dear Hiring Manager,",
        "Write in first person.",
        "Write 3 to 4 short paragraphs.",
        "Keep the total length around 180 to 220 words.",
        "End with a simple professional closing and the candidate name on the final line.",
        "Do not use headings, bullet points, tables, subject lines, signature blocks, or postal/contact header lines.",
        "Keep it natural, specific, and human.",
        antiHallucinationGuidance,
        toneGuidance,
      ].join(" ");
  }
}

export function buildBenchmarkPrompt(benchmarkCase: BenchmarkCase): string {
  const promptParts = [
    buildOutputInstructions(benchmarkCase),
    buildCandidateContextBlock(benchmarkCase.candidateContext),
  ];

  if (benchmarkCase.expectedGrounding.length > 0) {
    promptParts.push(
      [
        "Grounding priorities:",
        ...benchmarkCase.expectedGrounding.map((item) => `- ${compactWhitespace(item)}`),
      ].join("\n")
    );
  }

  if (benchmarkCase.forbiddenClaims.length > 0) {
    promptParts.push(
      [
        "Forbidden claims:",
        ...benchmarkCase.forbiddenClaims.map((item) => `- ${compactWhitespace(item)}`),
      ].join("\n")
    );
  }

  if (benchmarkCase.notes) {
    promptParts.push(`Case notes: ${compactWhitespace(benchmarkCase.notes)}`);
  }

  return promptParts.filter(Boolean).join("\n\n");
}
