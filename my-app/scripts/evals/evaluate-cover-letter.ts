import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import * as dotenv from "dotenv";
import { z } from "zod";

import {
  COVER_LETTER_EVALUATOR_PROMPT,
  scoreCoverLetter,
  type CoverLetterScore,
} from "../../convex/lib/proposals/coverLetterEvaluation";

type CliOptions = {
  filePath: string | null;
  inlineText: string | null;
  model: string;
};

type CoverLetterScoreInput = Omit<CoverLetterScore, "gating">;

type FetchLike = typeof fetch;

const DEFAULT_MODEL = "gpt-5-mini";

const scoreValueSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const coverLetterScoreInputSchema = z
  .object({
    score: z
      .object({
        relevance: scoreValueSchema,
        credibility: scoreValueSchema,
        persuasion: scoreValueSchema,
        structure: scoreValueSchema,
        substance: scoreValueSchema,
        tone: scoreValueSchema,
        grounding: scoreValueSchema,
      })
      .strict(),
    globalScore: scoreValueSchema,
    strengths: z.array(z.string()),
    mainWeakness: z.string(),
    smallestUsefulRevision: z.string(),
    rankMatchesText: z.boolean(),
  })
  .strict();

export function resolveCoverLetterEvalModel(
  requestedModel?: string | null,
): string {
  const explicitModel = requestedModel?.trim();
  if (explicitModel) {
    return explicitModel;
  }

  const envModel = process.env.COVER_LETTER_EVAL_MODEL?.trim();
  if (envModel) {
    return envModel;
  }

  return DEFAULT_MODEL;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    filePath: null,
    inlineText: null,
    model: resolveCoverLetterEvalModel(),
  };

  for (const arg of argv) {
    if (arg.startsWith("--file=")) {
      options.filePath = arg.slice("--file=".length);
    } else if (arg.startsWith("--text=")) {
      options.inlineText = arg.slice("--text=".length);
    } else if (arg.startsWith("--model=")) {
      options.model = arg.slice("--model=".length).trim() || DEFAULT_MODEL;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(
    [
      "Cover letter evaluator",
      "",
      "Usage:",
      "  npx tsx scripts/evals/evaluate-cover-letter.ts [--file=PATH] [--text='LETTER'] [--model=MODEL]",
      "",
      "Examples:",
      "  npx tsx scripts/evals/evaluate-cover-letter.ts --file=tmp/cover-letter.txt",
      "  npx tsx scripts/evals/evaluate-cover-letter.ts --text='Dear Hiring Manager,...'",
      "  cat tmp/cover-letter.txt | npx tsx scripts/evals/evaluate-cover-letter.ts",
    ].join("\n"),
  );
}

function loadEnv(workdir: string): void {
  const envFiles = [
    { filePath: path.resolve(workdir, ".env"), override: false },
    { filePath: path.resolve(workdir, ".env.local"), override: true },
  ];

  for (const envFile of envFiles) {
    if (!existsSync(envFile.filePath)) continue;
    dotenv.config({
      path: envFile.filePath,
      override: envFile.override,
    });
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function buildCoverLetterEvaluationInput(letter: string): string {
  return [
    COVER_LETTER_EVALUATOR_PROMPT,
    "",
    "Cover letter to evaluate:",
    "<cover_letter>",
    letter.trim(),
    "</cover_letter>",
  ].join("\n");
}

export function extractOpenAIJsonPayload(response: any): unknown {
  const contentArrays = [
    ...(Array.isArray(response?.output) ? response.output : []),
    ...(Array.isArray(response?.outputs) ? response.outputs : []),
  ]
    .flatMap((entry: any) =>
      Array.isArray(entry?.content) ? entry.content : entry ? [entry] : [],
    )
    .filter(Boolean);

  for (const item of contentArrays) {
    if (item?.json && typeof item.json === "object") {
      return item.json;
    }
    if (typeof item?.text === "string") {
      return JSON.parse(item.text);
    }
    if (typeof item?.output_text === "string") {
      return JSON.parse(item.output_text);
    }
  }

  if (typeof response?.output_text === "string") {
    return JSON.parse(response.output_text);
  }

  throw new Error("OpenAI cover-letter evaluator response did not contain parsed JSON");
}

export async function evaluateCoverLetterTextWithOpenAI(args: {
  letter: string;
  apiKey: string;
  model?: string;
  fetchImpl?: FetchLike;
}): Promise<CoverLetterScore> {
  const effectiveModel = resolveCoverLetterEvalModel(args.model);
  const requestBody: Record<string, unknown> = {
    model: effectiveModel,
    input: buildCoverLetterEvaluationInput(args.letter),
    max_output_tokens: 500,
    text: {
      format: {
        type: "json_schema",
        name: "cover_letter_score",
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "score",
            "globalScore",
            "strengths",
            "mainWeakness",
            "smallestUsefulRevision",
            "rankMatchesText",
          ],
          properties: {
            score: {
              type: "object",
              additionalProperties: false,
              required: [
                "relevance",
                "credibility",
                "persuasion",
                "structure",
                "substance",
                "tone",
                "grounding",
              ],
              properties: {
                relevance: { type: "integer", minimum: 0, maximum: 5 },
                credibility: { type: "integer", minimum: 0, maximum: 5 },
                persuasion: { type: "integer", minimum: 0, maximum: 5 },
                structure: { type: "integer", minimum: 0, maximum: 5 },
                substance: { type: "integer", minimum: 0, maximum: 5 },
                tone: { type: "integer", minimum: 0, maximum: 5 },
                grounding: { type: "integer", minimum: 0, maximum: 5 },
              },
            },
            globalScore: { type: "integer", minimum: 0, maximum: 5 },
            strengths: {
              type: "array",
              items: { type: "string" },
            },
            mainWeakness: { type: "string" },
            smallestUsefulRevision: { type: "string" },
            rankMatchesText: { type: "boolean" },
          },
        },
      },
    },
  };

  if (!effectiveModel.startsWith("gpt-5")) {
    requestBody.temperature = 0;
  } else {
    requestBody.reasoning = { effort: "minimal" };
  }

  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI cover-letter evaluator request failed: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }

  const parsedPayload = extractOpenAIJsonPayload(await response.json());
  const rawScore = coverLetterScoreInputSchema.parse(
    parsedPayload,
  ) as CoverLetterScoreInput;
  return scoreCoverLetter(rawScore);
}

async function resolveLetterInput(options: CliOptions): Promise<string> {
  if (options.inlineText && options.inlineText.trim()) {
    return options.inlineText.trim();
  }

  if (options.filePath) {
    const absolutePath = path.resolve(process.cwd(), options.filePath);
    return (await readFile(absolutePath, "utf8")).trim();
  }

  if (!process.stdin.isTTY) {
    return (await readStdin()).trim();
  }

  throw new Error("Provide a cover letter with --file, --text, or stdin.");
}

async function main(): Promise<void> {
  loadEnv(process.cwd());
  const options = parseArgs(process.argv.slice(2));
  const letter = await resolveLetterInput(options);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in the current environment.");
  }

  const effectiveModel = resolveCoverLetterEvalModel(options.model);
  console.error(`[cover-letter-eval] model=${effectiveModel}`);

  const result = await evaluateCoverLetterTextWithOpenAI({
    letter,
    apiKey,
    model: effectiveModel,
  });

  console.log(JSON.stringify(result, null, 2));
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  void main().catch((error) => {
    console.error(
      "Cover letter evaluation failed:",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exit(1);
  });
}
