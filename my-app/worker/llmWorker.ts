import fetch from "node-fetch";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import pino from "pino";
import type { Doc, Id } from "../convex/_generated/dataModel";

import { parseCVEngine } from "../convex/lib/parsing_shared/engine";
const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

const CONVEX_URL = process.env.CONVEX_URL ?? "http://127.0.0.1:8787";
const CONVEX_KEY = process.env.CONVEX_KEY;
if (!CONVEX_KEY) {
  log.fatal("CONVEX_KEY not set. Provide a Convex admin/service key in CONVEX_KEY.");
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL, { auth: CONVEX_KEY });
 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
import { llmConfig } from "../config/llmConfig";
const OPENAI_MODEL = llmConfig.openaiModel ?? "gpt-4o-mini";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY ?? llmConfig.mistralKey ?? null;
const MISTRAL_MODEL = llmConfig.mistralModel ?? "mistral-small-latest";
 
const LLM_PROVIDER = (process.env.LLM_PROVIDER as any) ?? llmConfig.provider ?? "openai";
 
// One-time env dump to help confirm which provider will be used at runtime.
// This prints presence (boolean) of critical keys and effective provider/model choices.
try {
  console.info("[worker][env-dump] provider-debug", {
    LLM_PROVIDER: process.env.LLM_PROVIDER ?? llmConfig.provider,
    OPENAI_API_KEY_present: !!(process.env.OPENAI_API_KEY ?? llmConfig.openaiKey),
    MISTRAL_API_KEY_present: !!(process.env.MISTRAL_API_KEY ?? llmConfig.mistralKey),
    OPENAI_MODEL: process.env.OPENAI_MODEL ?? llmConfig.openaiModel,
    MISTRAL_MODEL: process.env.MISTRAL_MODEL ?? llmConfig.mistralModel,
    FORCE_GPT_ONLY_env: process.env.FORCE_GPT_ONLY === "1",
    DEV_LLM_MODEL: process.env.DEV_LLM_MODEL ?? null
  });
} catch (e) {
  // Non-fatal; ensure worker continues running if logging fails
  /* ignore */
}

async function callOpenAIChat(messages: Array<{ role: string; content: string }>) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 1200,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${raw}`);
  try {
    const parsed = JSON.parse(raw);
    const text = parsed?.choices?.[0]?.message?.content ?? null;
    return { raw: parsed, text };
  } catch {
    return { raw: raw, text: raw };
  }
}

async function callMistralChat(messages: Array<{ role: string; content: string }>) {
  if (!MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY not configured");
  }
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 1200,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Mistral HTTP ${res.status}: ${raw}`);
  try {
    const parsed = JSON.parse(raw);
    const text = parsed?.choices?.[0]?.message?.content ?? null;
    return { raw: parsed, text };
  } catch {
    return { raw: raw, text: raw };
  }
}

async function callLLM(messages: Array<{ role: string; content: string }>) {
  if (LLM_PROVIDER === "mistral") {
    return await callMistralChat(messages);
  }
  return await callOpenAIChat(messages);
}

function extractPatchFromText(text: string | null) {
  if (!text) return null;
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch {}
  }
  const fenced = t.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  if (fenced !== t) {
    try {
      return JSON.parse(fenced);
    } catch {}
  }
  return t;
}

type JobDoc = Doc<"llmJobs">;
function isJobDoc(obj: any): obj is JobDoc {
  return obj && typeof obj === "object" && "_id" in obj && "profileId" in obj;
}

function isJobArray(jobs: any): jobs is JobDoc[] {
  return Array.isArray(jobs) && jobs.every(isJobDoc);
}

async function workerLoop() {
  const WORKER_ID = `llm-worker-${process.pid}-${Date.now()}`;
  log.info({ workerId: WORKER_ID, convexUrl: CONVEX_URL }, "LLM worker starting");

  const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 2000);
  const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 5);

  while (true) {
    try {
      const pendingJobs = await convex.action(api.workerGateway.processJobRequest, {
        operation: { type: "listPendingJobs", batchSize: BATCH_SIZE }
      });

      if (!isJobArray(pendingJobs) || pendingJobs.length === 0) {
        if (pendingJobs !== null) {
          log.warn("Expected a list of jobs but received a different type. Skipping loop.");
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      for (const job of pendingJobs) {
        try {
          const claimed = await convex.action(api.workerGateway.processJobRequest, {
            operation: { type: "claimJob", jobId: job._id, workerId: WORKER_ID }
          });
          
          if (!isJobDoc(claimed)) {
            if (claimed !== null) {
              log.warn(`Job ${job._id} was claimed but an unexpected type was returned. Skipping.`);
            }
            continue;
          }

          log.info({ jobId: job._id, profileId: claimed.profileId }, "Job claimed");
  
          const rawText = claimed.rawText ?? claimed.options?.rawText ?? "";
  
          // Dev guard: when DEV_NO_LLM is set, avoid calling external LLMs.
          // Instead, call the existing formatCompleteCV Convex action so the stored
          // history includes a fully-formed, validated `normalized` parse. If that
          // action fails, fall back to the lightweight inline heuristics.
          if (process.env.DEV_NO_LLM === "1") {
            try {
              log.info({ jobId: job._id }, "DEV_NO_LLM active - using heuristics + formatCompleteCV flow");
  
              // Prefer the server-side formatting action (which itself will run heuristics
              // when DEV_NO_LLM=1) to produce the normalized parse shape expected by the UI.
              let normalized: any = null;
              try {
                const formatted = await convex.action(
                  // Call the public action exported from convex/actions/formatCompleteCV.ts
                  // The generated API exposes it under api.actions.formatCompleteCV.formatCompleteCV
                  (api as any).actions.formatCompleteCV.formatCompleteCV,
                  { rawText }
                );
                if (formatted && formatted.status === "ok" && formatted.result) {
                  normalized = formatted.result;
                } else {
                  log.warn({ jobId: job._id, formatted }, "formatCompleteCV returned unexpected shape; falling back to inline heuristics");
                }
              } catch (fmtErr) {
                log.warn({ err: fmtErr, jobId: job._id }, "formatCompleteCV action failed; falling back to inline heuristics");
              }
  
              // If formatting action didn't produce a normalized result, build a small heuristic normalized patch.
              const heuristicSummary = String(rawText)
                .split(/\r?\n/)
                .map(l => l.trim())
                .filter(Boolean)
                .slice(0, 8)
                .join("\n");
  
              const storedPatch = {
                raw: "<DEV_NO_LLM heuristics-or-action>",
                normalized: normalized ?? {
                  sections: [
                    {
                      title: "Heuristic Summary",
                      content: heuristicSummary || String(rawText).slice(0, 500),
                      fieldKey: "summary",
                      confidence: 0.5
                    }
                  ]
                }
              };
  
              const historyId = (await convex.action(api.workerGateway.processJobRequest, {
                operation: {
                  type: "appendHistory",
                  profileId: claimed.profileId,
                  jobId: job._id,
                  ...(claimed.placeholderId !== undefined ? { placeholderId: claimed.placeholderId } : {}),
                  provider: "dev",
                  model: "dev",
                  full_response: null,
                  patch: storedPatch,
                  merged: false,
                  createdAt: Date.now()
                }
              })) as Id<"llmHistory">;
  
              await convex.action(api.workerGateway.processJobRequest, {
                operation: { type: "markJobCompleted", jobId: job._id, historyId }
              });
  
              log.info({ jobId: job._id, historyId }, "DEV_NO_LLM job appended history (with normalized parse) and marked completed");
            } catch (devErr) {
              log.error({ err: devErr, jobId: job._id }, "DEV_NO_LLM flow failed - falling back to normal processing");
            }
            continue;
          }
  
          const messages = [
            {
              role: "system",
              content:
                "You are a helpful assistant that, given a user's resume/CV text, returns a structured JSON patch or structured summary plus a short tailored proposal snippet.",
            },
            { role: "user", content: `User resume / cv:\n\n${rawText}` },
            {
              role: "user",
              content:
                "Output a JSON object containing either a 'patch' field (JSON Patch or an object of updates) and a 'proposal_snippet' string. If you cannot produce JSON, return a JSON object with a 'text' field containing the best plain-text suggestion.",
            },
          ];

          const llmResp = await callLLM(messages);
          const llmText = llmResp.text ?? null;
          log.info({ jobId: job._id }, "LLM completed");
  
          // Attempt to extract a structured JSON patch; preserve both raw and normalized
          // representations. normalized may be null if parsing fails.
          const rawPatch = extractPatchFromText(llmText);
          let storedPatch: any = rawPatch ?? llmText;
          try {
            // Attempt to run server-side normalizer (if loaded into runtime)
            // This is defensive: if not present, we keep raw data only.
            if (typeof (global as any).parseLLMSections === "function") {
              const normalized = (global as any).parseLLMSections(String(rawPatch ?? llmText));
              storedPatch = { raw: rawPatch ?? llmText, normalized };
            } else {
              storedPatch = { raw: rawPatch ?? llmText, normalized: null };
            }
          } catch (e) {
            storedPatch = { raw: rawPatch ?? llmText, normalized: null };
          }
  
          const historyId = (await convex.action(api.workerGateway.processJobRequest, {
            operation: {
              type: "appendHistory",
              profileId: claimed.profileId,
              jobId: job._id,
              ...(claimed.placeholderId !== undefined ? { placeholderId: claimed.placeholderId } : {}),
              provider: LLM_PROVIDER,
              model: LLM_PROVIDER === "mistral" ? MISTRAL_MODEL : OPENAI_MODEL,
              full_response: llmResp.raw,
              patch: storedPatch,
              merged: false,
              createdAt: Date.now(),
            }
          })) as Id<"llmHistory">;

          await convex.action(api.workerGateway.processJobRequest, {
            operation: { type: "markJobCompleted", jobId: job._id, historyId }
          });

          log.info({ jobId: job._id, historyId }, "Job marked completed");
        } catch (jobErr) {
          log.error({ err: jobErr, jobId: job._id }, "Error processing job, attempting to mark failed");
          try {
            await convex.action(api.workerGateway.processJobRequest, {
              operation: { type: "markJobFailed", jobId: job._id, error: String(jobErr) }
            });
          } catch (markErr) {
            log.error({ err: markErr }, "Failed to mark job failed");
          }
        }
      }
    } catch (err) {
      log.error({ err }, "Worker loop encountered error; sleeping before retry");
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 2));
    }
  }
}

if (require.main === module) {
  workerLoop().catch((err) => {
    log.fatal({ err }, "Worker crashed");
    process.exit(1);
  });
}

export { workerLoop };