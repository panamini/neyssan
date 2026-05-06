import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as dotenv from "dotenv";

const DEFAULT_DATASET_PATH =
  "benchmarks/proposal-generation/dataset/proposal-benchmark.dataset.json";
const DEFAULT_CASE_ID = "employment-strong-frontend";
const MAX_OUTPUT_TOKENS = 900;

const MODELS = [
  { id: "gpt-5.5", provider: "openai", model: "gpt-5.5" },
  { id: "qwen-plus", provider: "qwen", model: "qwen3.6-plus" },
  { id: "qwen-flash", provider: "qwen", model: "qwen3.6-flash" },
  { id: "mistral-large", provider: "mistral", model: "mistral-large-latest" },
  { id: "deepseek", provider: "deepseek", model: "deepseek-v4-flash" },
  { id: "mistral-small", provider: "mistral", model: "mistral-small-latest" },
  { id: "mistral-medium", provider: "mistral", model: "mistral-medium-latest" },
];

function compactWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function loadEnv(workdir) {
  for (const envFile of [
    { filePath: path.resolve(workdir, ".env"), override: false },
    { filePath: path.resolve(workdir, ".env.local"), override: true },
  ]) {
    if (!existsSync(envFile.filePath)) continue;
    dotenv.config({ path: envFile.filePath, override: envFile.override });
  }
}

function parseArgs(argv) {
  const options = {
    datasetPath: DEFAULT_DATASET_PATH,
    caseId: DEFAULT_CASE_ID,
    modelIds: null,
  };

  for (const arg of argv) {
    if (arg.startsWith("--dataset=")) {
      options.datasetPath = arg.slice("--dataset=".length);
    } else if (arg.startsWith("--case=")) {
      options.caseId = arg.slice("--case=".length);
    } else if (arg.startsWith("--models=")) {
      options.modelIds = arg
        .slice("--models=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return options;
}

function buildCandidateContextBlock(context) {
  if (!context) {
    return [
      "No candidate background is available for this request.",
      "Do not claim or imply any profession, tools, projects, employers, industries, years of experience, or accomplishments that are not provided.",
      "If evidence is missing, write a shorter, more generic, motivation-based proposal that stays professional and honest.",
    ].join(" ");
  }

  const lines = ["Candidate background for personalization:"];
  if (context.name) lines.push(`- Name: ${compactWhitespace(context.name)}`);
  if (context.summary)
    lines.push(`- Professional summary: ${compactWhitespace(context.summary)}`);
  if (context.desiredPosition)
    lines.push(`- Target role / headline: ${compactWhitespace(context.desiredPosition)}`);
  if (context.topSkills?.length)
    lines.push(`- Core skills: ${context.topSkills.map(compactWhitespace).join(", ")}`);
  if (context.recentExperience?.length) {
    lines.push("- Recent experience:");
    for (const entry of context.recentExperience) {
      const role = [
        entry.position,
        entry.company ? `at ${entry.company}` : "",
      ]
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
    lines.push(
      `- Standout achievements: ${context.standoutAchievements
        .map(compactWhitespace)
        .join("; ")}`,
    );
  }
  lines.push("Use this background only to tailor tone and relevance.");
  lines.push("Do not invent employers, achievements, years, or technical experience.");
  return lines.join("\n");
}

function buildPrompt(benchmarkCase) {
  const toneGuidance = `Use "${benchmarkCase.formalityLevel}" formality and "${benchmarkCase.creativity}" creativity only as tone guidance.`;
  const antiHallucinationGuidance = [
    "Use the candidate background as the only source of claims about the candidate.",
    "Every qualification, achievement, or strength you mention must be grounded in the candidate background.",
    "Never treat the job description as evidence about the candidate.",
    "Do not invent employers, software tools, certifications, years of experience, measurable outcomes, degrees, or side projects.",
    "If an important requirement is missing from the candidate background, do not imply that the candidate already has it.",
    "Prefer fewer claims over invented claims.",
  ].join(" ");

  const outputInstructions = [
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

  const parts = [
    outputInstructions,
    buildCandidateContextBlock(benchmarkCase.candidateContext),
  ];
  if (benchmarkCase.expectedGrounding?.length) {
    parts.push(
      [
        "Grounding priorities:",
        ...benchmarkCase.expectedGrounding.map((item) => `- ${compactWhitespace(item)}`),
      ].join("\n"),
    );
  }
  if (benchmarkCase.forbiddenClaims?.length) {
    parts.push(
      [
        "Forbidden claims:",
        ...benchmarkCase.forbiddenClaims.map((item) => `- ${compactWhitespace(item)}`),
      ].join("\n"),
    );
  }
  if (benchmarkCase.notes) {
    parts.push(`Case notes: ${compactWhitespace(benchmarkCase.notes)}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

function extractOpenAIText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  return (payload.output ?? [])
    .flatMap((entry) => entry.content ?? [])
    .map((part) => part.text ?? part.output_text ?? "")
    .join("")
    .trim();
}

async function runOpenAI(model, prompt) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: "low" },
      text: { verbosity: "medium" },
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${raw}`);
  const parsed = JSON.parse(raw);
  return {
    text: extractOpenAIText(parsed),
    usage: parsed.usage ?? null,
    raw: parsed,
  };
}

async function runMistral(model, prompt) {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) throw new Error("MISTRAL_API_KEY missing");
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Mistral HTTP ${response.status}: ${raw}`);
  const parsed = JSON.parse(raw);
  return {
    text: parsed.choices?.[0]?.message?.content?.trim() ?? "",
    usage: parsed.usage ?? null,
    raw: parsed,
  };
}

async function runDeepSeek(model, prompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");
  const url =
    process.env.DEEPSEEK_CHAT_COMPLETIONS_URL?.trim() ||
    "https://api.deepseek.com/chat/completions";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}: ${raw}`);
  const parsed = JSON.parse(raw);
  return {
    text: parsed.choices?.[0]?.message?.content?.trim() ?? "",
    usage: parsed.usage ?? null,
    raw: parsed,
  };
}

async function runQwen(model, prompt) {
  const apiKey = process.env.QWEN_API_KEY?.trim();
  if (!apiKey) throw new Error("QWEN_API_KEY missing");
  const url =
    process.env.QWEN_CHAT_COMPLETIONS_URL?.trim() ||
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Qwen HTTP ${response.status}: ${raw}`);
  const parsed = JSON.parse(raw);
  return {
    text: parsed.choices?.[0]?.message?.content?.trim() ?? "",
    usage: parsed.usage ?? null,
    raw: parsed,
  };
}

async function runModel(entry, prompt) {
  if (entry.provider === "openai") return runOpenAI(entry.model, prompt);
  if (entry.provider === "mistral") return runMistral(entry.model, prompt);
  if (entry.provider === "deepseek") return runDeepSeek(entry.model, prompt);
  if (entry.provider === "qwen") return runQwen(entry.model, prompt);
  throw new Error(`Unsupported provider: ${entry.provider}`);
}

async function main() {
  const workdir = process.cwd();
  loadEnv(workdir);
  const options = parseArgs(process.argv.slice(2));
  const dataset = JSON.parse(
    await readFile(path.resolve(workdir, options.datasetPath), "utf8"),
  );
  const benchmarkCase = dataset.cases.find((item) => item.id === options.caseId);
  if (!benchmarkCase) {
    throw new Error(`Unknown case: ${options.caseId}`);
  }

  const prompt = buildPrompt(benchmarkCase);
  const selectedModels =
    options.modelIds == null
      ? MODELS
      : options.modelIds.map((id) => {
          const entry = MODELS.find((model) => model.id === id);
          if (!entry) {
            throw new Error(
              `Unknown model id: ${id}. Available: ${MODELS.map((model) => model.id).join(", ")}`,
            );
          }
          return entry;
        });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.resolve(
    workdir,
    "benchmarks/proposal-generation/results",
    `one-off-${runId}`,
  );
  const rawDir = path.join(outputDir, "raw");
  await mkdir(rawDir, { recursive: true });

  const results = [];
  for (const entry of selectedModels) {
    const startedAt = Date.now();
    try {
      const result = await runModel(entry, prompt);
      const latencyMs = Date.now() - startedAt;
      const rawPath = path.join(rawDir, `${benchmarkCase.id}__${entry.id}.json`);
      await writeFile(rawPath, JSON.stringify(result.raw, null, 2));
      results.push({
        status: "ok",
        ...entry,
        latencyMs,
        outputText: result.text,
        usage: result.usage,
        rawPath,
      });
      console.log(`${entry.id}: ok ${latencyMs}ms`);
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      results.push({
        status: "error",
        ...entry,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`${entry.id}: error ${latencyMs}ms`);
    }
  }

  const manifest = {
    runId,
    case: benchmarkCase,
    prompt,
    models: selectedModels,
    results,
  };
  await writeFile(path.join(outputDir, "results.json"), JSON.stringify(manifest, null, 2));
  await writeFile(
    path.join(outputDir, "review.md"),
    [
      `# One-off Proposal Model Comparison`,
      ``,
      `Case: ${benchmarkCase.id} — ${benchmarkCase.label}`,
      ``,
      ...results.flatMap((result) => [
        `## ${result.id}`,
        ``,
        `- Provider: ${result.provider}`,
        `- Model: ${result.model}`,
        `- Status: ${result.status}`,
        `- Latency: ${result.latencyMs}ms`,
        result.status === "ok" ? `` : `- Error: ${result.error}`,
        result.status === "ok" ? result.outputText : "",
        ``,
      ]),
    ].join("\n"),
  );

  console.log(`Output directory: ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
