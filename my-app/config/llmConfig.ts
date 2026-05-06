export type LLMProvider = "mistral" | "openai" | "qwen" | "deepseek" | string;

export type HelperModelRoute = {
  provider: LLMProvider;
  model: string;
};

export type HelperModelActionPolicy = {
  primary: HelperModelRoute;
  fallbacks: HelperModelRoute[];
};

export interface ILLMConfig {
  provider: LLMProvider;
  model: string;
  openaiKey?: string | null;
  openaiModel?: string | null;
  mistralKey?: string | null;
  mistralModel?: string | null;
  qwenKey?: string | null;
  qwenChatCompletionsUrl?: string | null;
  deepseekKey?: string | null;
  deepseekChatCompletionsUrl?: string | null;
  proposalModels?: {
    productionModelType: "chatgpt" | "mistral-small-latest";
    developmentModelType: "chatgpt" | "mistral-small-latest";
    openaiWriterModel: string;
    qwenFallbackModel: string;
    mistralFallbackModel: string;
    deepseekFallbackModel: string;
    openaiWriterReasoningEffort?: "minimal" | "low" | "medium" | "high" | null;
  };
  helperModels?: {
    editor: {
      openaiPrimary: string;
      openaiFallback: string;
      mistralPrimary: string;
      actions?: Partial<
        Record<
          | "fix_grammar"
          | "shorten"
          | "rewrite"
          | "clarify"
          | "strengthen"
          | "expand"
          | "tailor_to_job"
          | "custom",
          HelperModelActionPolicy
        >
      >;
    };
    styleRouting: {
      openaiPrimary: string;
      openaiFallback: string;
      mistralPrimary: string;
    };
  };
  // When true, force using GPT-5 Nano (skip Mistral entirely)
  forceGpt5NanoOnly?: boolean;
}
const mistralSmallFallbackModel =
  process.env.MISTRAL_TOOLBAR_FALLBACK_MODEL ??
  process.env.MISTRAL_EDITOR_MODEL ??
  process.env.MISTRAL_MODEL ??
  "mistral-small-latest";

const visibleToolbarPrimaryFallbacks: HelperModelRoute[] = [
  {
    provider: "mistral",
    model: mistralSmallFallbackModel,
  },
  {
    provider: "deepseek",
    model: process.env.DEEPSEEK_TOOLBAR_FALLBACK_MODEL ?? "deepseek-v4-flash",
  },
];

const mistralToolbarRoute: HelperModelRoute = {
  provider: "mistral",
  model:
    process.env.MISTRAL_TOOLBAR_MODEL ??
    process.env.MISTRAL_EDITOR_MODEL ??
    process.env.MISTRAL_MODEL ??
    "mistral-medium-latest",
};

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
  qwenKey: process.env.QWEN_API_KEY ?? null,
  qwenChatCompletionsUrl:
    process.env.QWEN_CHAT_COMPLETIONS_URL ??
    (process.env.QWEN_BASE_URL
      ? `${process.env.QWEN_BASE_URL.replace(/\/$/, "")}/chat/completions`
      : "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"),
  deepseekKey: process.env.DEEPSEEK_API_KEY ?? null,
  deepseekChatCompletionsUrl:
    process.env.DEEPSEEK_CHAT_COMPLETIONS_URL ??
    (process.env.DEEPSEEK_BASE_URL
      ? `${process.env.DEEPSEEK_BASE_URL.replace(/\/$/, "")}/chat/completions`
      : "https://api.deepseek.com/chat/completions"),
  proposalModels: {
    productionModelType: "chatgpt",
    developmentModelType: "mistral-small-latest",
    openaiWriterModel: process.env.OPENAI_PROPOSAL_MODEL ?? "gpt-5.5",
    qwenFallbackModel: process.env.QWEN_PROPOSAL_MODEL ?? "qwen3.6-plus",
    mistralFallbackModel:
      process.env.MISTRAL_PROPOSAL_MODEL ?? "mistral-large-latest",
    deepseekFallbackModel:
      process.env.DEEPSEEK_PROPOSAL_MODEL ?? "deepseek-v4-flash",
    openaiWriterReasoningEffort:
      (process.env.OPENAI_PROPOSAL_REASONING_EFFORT as
        | "minimal"
        | "low"
        | "medium"
        | "high"
        | undefined) ?? "low",
  },
  helperModels: {
    editor: {
      openaiPrimary:
        process.env.OPENAI_EDITOR_MODEL ??
        process.env.OPENAI_MODEL ??
        "gpt-5-mini",
      openaiFallback: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      mistralPrimary:
        process.env.MISTRAL_TOOLBAR_MODEL ??
        process.env.MISTRAL_EDITOR_MODEL ??
        process.env.MISTRAL_MODEL ??
        "mistral-medium-latest",
      actions: {
        fix_grammar: {
          primary: mistralToolbarRoute,
          fallbacks: visibleToolbarPrimaryFallbacks,
        },
        shorten: {
          primary: mistralToolbarRoute,
          fallbacks: visibleToolbarPrimaryFallbacks,
        },
        rewrite: {
          primary: mistralToolbarRoute,
          fallbacks: visibleToolbarPrimaryFallbacks,
        },
        clarify: {
          primary: mistralToolbarRoute,
          fallbacks: visibleToolbarPrimaryFallbacks,
        },
        strengthen: {
          primary: mistralToolbarRoute,
          fallbacks: visibleToolbarPrimaryFallbacks,
        },
        expand: {
          primary: mistralToolbarRoute,
          fallbacks: visibleToolbarPrimaryFallbacks,
        },
        tailor_to_job: {
          primary: mistralToolbarRoute,
          fallbacks: visibleToolbarPrimaryFallbacks,
        },
        custom: {
          primary: mistralToolbarRoute,
          fallbacks: visibleToolbarPrimaryFallbacks,
        },
      },
    },
    styleRouting: {
      openaiPrimary:
        process.env.OPENAI_STYLE_ROUTING_MODEL ??
        process.env.OPENAI_MODEL ??
        "gpt-5-nano",
      openaiFallback: process.env.OPENAI_MODEL ?? "gpt-5-nano",
      mistralPrimary:
        process.env.MISTRAL_STYLE_ROUTING_MODEL ??
        process.env.MISTRAL_MODEL ??
        "mistral-small-latest",
    },
  },
  // Default: do not force GPT-only mode unless explicitly set (env var FORCE_GPT5_NANO_ONLY="1")
  forceGpt5NanoOnly: process.env.FORCE_GPT5_NANO_ONLY === "1" || false
};
