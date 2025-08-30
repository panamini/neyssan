/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_formatCompleteCV from "../actions/formatCompleteCV.js";
import type * as actions_persistProfile from "../actions/persistProfile.js";
import type * as alerts from "../alerts.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as checkratelimit from "../checkratelimit.js";
import type * as clerk_webhook from "../clerk_webhook.js";
import type * as config_env from "../config/env.js";
import type * as config_monitoring from "../config/monitoring.js";
import type * as config_sentry from "../config/sentry.js";
import type * as createUserFromClient from "../createUserFromClient.js";
import type * as deleteProposalPublic from "../deleteProposalPublic.js";
import type * as functions from "../functions.js";
import type * as generateProposalMutation from "../generateProposalMutation.js";
import type * as http from "../http.js";
import type * as http_actions from "../http_actions.js";
import type * as ingestProfile from "../ingestProfile.js";
import type * as jobs from "../jobs.js";
import type * as langchain_chains_base_chain from "../langchain/chains/base_chain.js";
import type * as langchain_chains_chain_factory from "../langchain/chains/chain_factory.js";
import type * as langchain_chains_creative_chain from "../langchain/chains/creative_chain.js";
import type * as langchain_chains_index from "../langchain/chains/index.js";
import type * as langchain_chains_technical_chain from "../langchain/chains/technical_chain.js";
import type * as langchain_index from "../langchain/index.js";
import type * as langchain_models_gpt4_adapter from "../langchain/models/gpt4_adapter.js";
import type * as langchain_models_index from "../langchain/models/index.js";
import type * as langchain_models_mistral_adapter from "../langchain/models/mistral_adapter.js";
import type * as langchain_models_model_adapter from "../langchain/models/model_adapter.js";
import type * as langchain_prompts_index from "../langchain/prompts/index.js";
import type * as langchain_prompts_manager from "../langchain/prompts/manager.js";
import type * as langchain_prompts_templates_index from "../langchain/prompts/templates/index.js";
import type * as langchain_prompts_templates_technical from "../langchain/prompts/templates/technical.js";
import type * as langchain_prompts_templates_version from "../langchain/prompts/templates/version.js";
import type * as langchain_prompts_templates from "../langchain/prompts/templates.js";
import type * as langchain_types from "../langchain/types.js";
import type * as langchain_utils_cache from "../langchain/utils/cache.js";
import type * as langchain_utils_index from "../langchain/utils/index.js";
import type * as langchain_utils_metrics from "../langchain/utils/metrics.js";
import type * as lib_utils from "../lib/utils.js";
import type * as llm from "../llm.js";
import type * as metrics from "../metrics.js";
import type * as migrations from "../migrations.js";
import type * as model_metrics from "../model/metrics.js";
import type * as model_monitoring from "../model/monitoring.js";
import type * as monitoring from "../monitoring.js";
import type * as mutations_refineField from "../mutations/refineField.js";
import type * as mutations_updateUserProfile from "../mutations/updateUserProfile.js";
import type * as mutations_upsertProfile from "../mutations/upsertProfile.js";
import type * as parsePdf from "../parsePdf.js";
import type * as populateDisplayName from "../populateDisplayName.js";
import type * as profiles from "../profiles.js";
import type * as profilesPublic from "../profilesPublic.js";
import type * as proposals from "../proposals.js";
import type * as proposalsPublic from "../proposalsPublic.js";
import type * as queries_getLatestCV from "../queries/getLatestCV.js";
import type * as queries_getProfileCount from "../queries/getProfileCount.js";
import type * as saveJobAndProposal from "../saveJobAndProposal.js";
import type * as scheduler from "../scheduler.js";
import type * as sync from "../sync.js";
import type * as test_generate_http from "../test_generate_http.js";
import type * as types_index from "../types/index.js";
import type * as types_metrics from "../types/metrics.js";
import type * as types_monitoring from "../types/monitoring.js";
import type * as types_validators from "../types/validators.js";
import type * as updateProposalPublic from "../updateProposalPublic.js";
import type * as users from "../users.js";
import type * as utils_auth from "../utils/auth.js";
import type * as utils_cv_parser from "../utils/cv_parser.js";
import type * as utils_error from "../utils/error.js";
import type * as utils_types from "../utils/types.js";
import type * as utils_validation from "../utils/validation.js";
import type * as utils_validators from "../utils/validators.js";
import type * as workerGateway from "../workerGateway.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "actions/formatCompleteCV": typeof actions_formatCompleteCV;
  "actions/persistProfile": typeof actions_persistProfile;
  alerts: typeof alerts;
  analytics: typeof analytics;
  auth: typeof auth;
  checkratelimit: typeof checkratelimit;
  clerk_webhook: typeof clerk_webhook;
  "config/env": typeof config_env;
  "config/monitoring": typeof config_monitoring;
  "config/sentry": typeof config_sentry;
  createUserFromClient: typeof createUserFromClient;
  deleteProposalPublic: typeof deleteProposalPublic;
  functions: typeof functions;
  generateProposalMutation: typeof generateProposalMutation;
  http: typeof http;
  http_actions: typeof http_actions;
  ingestProfile: typeof ingestProfile;
  jobs: typeof jobs;
  "langchain/chains/base_chain": typeof langchain_chains_base_chain;
  "langchain/chains/chain_factory": typeof langchain_chains_chain_factory;
  "langchain/chains/creative_chain": typeof langchain_chains_creative_chain;
  "langchain/chains/index": typeof langchain_chains_index;
  "langchain/chains/technical_chain": typeof langchain_chains_technical_chain;
  "langchain/index": typeof langchain_index;
  "langchain/models/gpt4_adapter": typeof langchain_models_gpt4_adapter;
  "langchain/models/index": typeof langchain_models_index;
  "langchain/models/mistral_adapter": typeof langchain_models_mistral_adapter;
  "langchain/models/model_adapter": typeof langchain_models_model_adapter;
  "langchain/prompts/index": typeof langchain_prompts_index;
  "langchain/prompts/manager": typeof langchain_prompts_manager;
  "langchain/prompts/templates/index": typeof langchain_prompts_templates_index;
  "langchain/prompts/templates/technical": typeof langchain_prompts_templates_technical;
  "langchain/prompts/templates/version": typeof langchain_prompts_templates_version;
  "langchain/prompts/templates": typeof langchain_prompts_templates;
  "langchain/types": typeof langchain_types;
  "langchain/utils/cache": typeof langchain_utils_cache;
  "langchain/utils/index": typeof langchain_utils_index;
  "langchain/utils/metrics": typeof langchain_utils_metrics;
  "lib/utils": typeof lib_utils;
  llm: typeof llm;
  metrics: typeof metrics;
  migrations: typeof migrations;
  "model/metrics": typeof model_metrics;
  "model/monitoring": typeof model_monitoring;
  monitoring: typeof monitoring;
  "mutations/refineField": typeof mutations_refineField;
  "mutations/updateUserProfile": typeof mutations_updateUserProfile;
  "mutations/upsertProfile": typeof mutations_upsertProfile;
  parsePdf: typeof parsePdf;
  populateDisplayName: typeof populateDisplayName;
  profiles: typeof profiles;
  profilesPublic: typeof profilesPublic;
  proposals: typeof proposals;
  proposalsPublic: typeof proposalsPublic;
  "queries/getLatestCV": typeof queries_getLatestCV;
  "queries/getProfileCount": typeof queries_getProfileCount;
  saveJobAndProposal: typeof saveJobAndProposal;
  scheduler: typeof scheduler;
  sync: typeof sync;
  test_generate_http: typeof test_generate_http;
  "types/index": typeof types_index;
  "types/metrics": typeof types_metrics;
  "types/monitoring": typeof types_monitoring;
  "types/validators": typeof types_validators;
  updateProposalPublic: typeof updateProposalPublic;
  users: typeof users;
  "utils/auth": typeof utils_auth;
  "utils/cv_parser": typeof utils_cv_parser;
  "utils/error": typeof utils_error;
  "utils/types": typeof utils_types;
  "utils/validation": typeof utils_validation;
  "utils/validators": typeof utils_validators;
  workerGateway: typeof workerGateway;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: {
    lib: {
      checkRateLimit: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
      getValue: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          key?: string;
          name: string;
          sampleShards?: number;
        },
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          shard: number;
          ts: number;
          value: number;
        }
      >;
      rateLimit: FunctionReference<
        "mutation",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      resetRateLimit: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name: string },
        null
      >;
    };
    time: {
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
    };
  };
  migrations: {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { name: string },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        { sinceTs?: number },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { limit?: number; names?: Array<string> },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      migrate: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun: boolean;
          fnHandle: string;
          name: string;
          next?: Array<{ fnHandle: string; name: string }>;
        },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
    };
  };
};
