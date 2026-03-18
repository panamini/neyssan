export interface ILLMConfig {
  provider: "mistral" | "openai" | string;
  model: string;
  openaiKey?: string | null;
  openaiModel?: string | null;
  mistralKey?: string | null;
  mistralModel?: string | null;
  // When true, force using GPT-5 Nano (skip Mistral entirely)
  forceGpt5NanoOnly?: boolean;
}
 
export const llmConfig: ILLMConfig = {
  // Provider preference: explicit LLM_PROVIDER takes precedence,
  // otherwise prefer mistral if a MISTRAL_API_KEY exists, else openai.
  provider: (process.env.LLM_PROVIDER as any) ?? (process.env.MISTRAL_API_KEY ? "mistral" : "openai"),
  // Model selection: central fallback order
  model: (process.env.LLM_MODEL as any) ?? process.env.MISTRAL_MODEL ?? process.env.OPENAI_MODEL ?? "mistral-small-latest",
  openaiKey: process.env.OPENAI_API_KEY ?? null,
  // Default OpenAI model for repair/parsing/fallback is gpt-5-nano as requested
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-5-nano",
  mistralKey: process.env.MISTRAL_API_KEY ?? null,
  mistralModel: process.env.MISTRAL_MODEL ?? "mistral-small-latest",
  // Default: do not force GPT-only mode unless explicitly set (env var FORCE_GPT5_NANO_ONLY="1")
  forceGpt5NanoOnly: process.env.FORCE_GPT5_NANO_ONLY === "1" || false
};