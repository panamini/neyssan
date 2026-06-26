import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { McpOAuthAuthorizationIntentRecordV1 } from "./mcpOAuthAuthorizationIntents";
import { MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS } from "./mcpOAuthAuthorizationIntents";
import {
  readMcpOAuthPreAuthIntentClaimableRecord,
  type McpOAuthPreAuthIntentClaimableRecordV1,
} from "./mcpOAuthPreAuthIntents";
import type { McpOAuthAuthorizationTrustedOwnerV1 } from "../src/modules/local-mcp/mcpOAuthAuthorizationRequestBoundary";

const BIND_ARGS_KEYS = ["preAuthHandleHash", "now", "version"] as const;
const PRE_AUTH_HANDLE_HASH_PATTERN = /^[0-9a-f]{64}$/u;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const MAX_SAFE_TIMESTAMP_BEFORE_TTL =
  Number.MAX_SAFE_INTEGER - MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS;
const MAX_OWNER_IDENTIFIER_LENGTH = 512;

export type McpOAuthPreAuthOwnerBindingReasonV1 =
  | "bound"
  | "invalid_input"
  | "invalid_handle_hash"
  | "unauthenticated"
  | "not_found_or_forbidden"
  | "duplicate_pre_auth_record"
  | "malformed_pre_auth_record"
  | "expired"
  | "already_claimed"
  | "owner_bound_handle_collision";

export type McpOAuthPreAuthOwnerBindingResultV1 = Readonly<
  | {
      kind: "mcp_oauth_pre_auth_owner_binding_result";
      ok: true;
      reason: "bound";
      serverOnly: {
        ownerBoundIntent: {
          status: "pending";
          expiresAt: number;
          version: 1;
        };
        preAuthIntent: {
          status: "claimed";
          version: 1;
        };
        trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_pre_auth_owner_binding_result";
      ok: false;
      reason: Exclude<McpOAuthPreAuthOwnerBindingReasonV1, "bound">;
      safeFailure: SafePreAuthOwnerBindingFailureV1;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

type SafePreAuthOwnerBindingFailureV1 = Readonly<{
  code: "mcp_oauth_pre_auth_owner_binding_denied";
  message: "Pre-auth owner binding denied.";
  safeForModel: true;
  handleEchoed: false;
  digestEchoed: false;
  identityEchoed: false;
  sensitiveValuesEchoed: false;
  version: 1;
}>;

export const internalBindMcpOAuthPreAuthIntentToAuthenticatedOwner =
  internalMutation({
    args: {
      preAuthHandleHash: v.string(),
      now: v.number(),
      version: v.literal(1),
    },
    returns: v.any(),
    handler: async (
      ctx,
      args,
    ): Promise<McpOAuthPreAuthOwnerBindingResultV1> => {
      if (!readRecord(args, BIND_ARGS_KEYS)) return deny("invalid_input");
      if (
        !isValidStorageTimestamp(args.now) ||
        args.now > MAX_SAFE_TIMESTAMP_BEFORE_TTL
      ) {
        return deny("invalid_input");
      }
      if (!isValidHandleHash(args.preAuthHandleHash))
        return deny("invalid_handle_hash");

      const trustedOwner = await readTrustedOwnerFromSession(ctx);
      if (!trustedOwner) return deny("unauthenticated");

      const preAuthRows = await ctx.db
        .query("mcpOAuthPreAuthIntents")
        .withIndex("by_pre_auth_handle_hash", (q) =>
          q.eq("preAuthHandleHash", args.preAuthHandleHash),
        )
        .collect();
      if (preAuthRows.length === 0) return deny("not_found_or_forbidden");
      if (preAuthRows.length > 1) return deny("duplicate_pre_auth_record");

      const preAuthRecord = readMcpOAuthPreAuthIntentClaimableRecord(
        preAuthRows[0],
      );
      if (!preAuthRecord) return deny("malformed_pre_auth_record");
      if (preAuthRecord.status === "claimed") return deny("already_claimed");
      if (preAuthRecord.status === "expired") return deny("expired");
      if (args.now < preAuthRecord.createdAt) return deny("invalid_input");
      if (args.now >= preAuthRecord.expiresAt) {
        await ctx.db.patch(preAuthRecord._id as never, {
          status: "expired",
          updatedAt: args.now,
        });
        return deny("expired");
      }

      const ownerBoundRows = await ctx.db
        .query("mcpOAuthAuthorizationIntents")
        .withIndex("by_intent_handle_hash", (q) =>
          q.eq("intentHandleHash", args.preAuthHandleHash),
        )
        .collect();
      if (ownerBoundRows.length > 0)
        return deny("owner_bound_handle_collision");

      const ownerBoundIntent = buildOwnerBoundIntentRecord(
        args.preAuthHandleHash,
        preAuthRecord,
        trustedOwner,
        args.now,
      );
      await ctx.db.insert("mcpOAuthAuthorizationIntents", ownerBoundIntent);
      await ctx.db.patch(preAuthRecord._id as never, {
        status: "claimed",
        updatedAt: args.now,
        claimedAt: args.now,
      });

      return {
        kind: "mcp_oauth_pre_auth_owner_binding_result",
        ok: true,
        reason: "bound",
        serverOnly: {
          ownerBoundIntent: {
            status: "pending",
            expiresAt: ownerBoundIntent.expiresAt,
            version: 1,
          },
          preAuthIntent: {
            status: "claimed",
            version: 1,
          },
          trustedOwner,
          version: 1,
        },
        modelVisible: false,
        safeForLogging: false,
        version: 1,
      };
    },
  });

function buildOwnerBoundIntentRecord(
  intentHandleHash: string,
  preAuthRecord: McpOAuthPreAuthIntentClaimableRecordV1,
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1,
  now: number,
): McpOAuthAuthorizationIntentRecordV1 {
  const optionalParameters = preAuthRecord.approvedOptionalParameters;
  return {
    kind: "mcp_oauth_authorization_intent_record",
    version: 1,
    intentHandleHash,
    twoweeksClerkId: trustedOwner.twoweeksClerkId,
    authorizationPageOrigin: preAuthRecord.authorizationPageOrigin,
    authorizationPagePath: preAuthRecord.authorizationPagePath,
    responseType: "code",
    clientId: preAuthRecord.clientId,
    redirectUri: preAuthRecord.redirectUri,
    resource: preAuthRecord.resource,
    scopes: [...preAuthRecord.scopes],
    state: preAuthRecord.state,
    codeChallenge: preAuthRecord.codeChallenge,
    codeChallengeMethod: "S256",
    ...(optionalParameters
      ? { approvedOptionalParameters: optionalParameters }
      : {}),
    providerValidationStatus: "pending",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS,
    storageVersion: 1,
  };
}

async function readTrustedOwnerFromSession(ctx: {
  auth?: {
    getUserIdentity?: () => Promise<{ subject?: unknown } | null>;
  };
}): Promise<McpOAuthAuthorizationTrustedOwnerV1 | undefined> {
  try {
    const identity = await ctx.auth?.getUserIdentity?.();
    const twoweeksClerkId = readBoundedText(
      identity?.subject,
      MAX_OWNER_IDENTIFIER_LENGTH,
    );
    if (!twoweeksClerkId || !SAFE_IDENTIFIER_PATTERN.test(twoweeksClerkId))
      return undefined;
    return {
      kind: "mcp_oauth_authorization_trusted_owner",
      twoweeksClerkId,
      version: 1,
    };
  } catch {
    return undefined;
  }
}

function readBoundedText(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength
  )
    return undefined;
  return containsControlCharacters(value) ? undefined : value;
}

function readRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  const record: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== "string" || !allowedKeys.includes(key)) return undefined;
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !("value" in descriptor)) return undefined;
    record[key] = descriptor.value;
  }
  return requiredKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(record, key),
  )
    ? record
    : undefined;
}

function isValidHandleHash(value: unknown): value is string {
  return typeof value === "string" && PRE_AUTH_HANDLE_HASH_PATTERN.test(value);
}

function isValidStorageTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function containsControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function deny(
  reason: Exclude<McpOAuthPreAuthOwnerBindingReasonV1, "bound">,
): McpOAuthPreAuthOwnerBindingResultV1 {
  return {
    kind: "mcp_oauth_pre_auth_owner_binding_result",
    ok: false,
    reason,
    safeFailure: {
      code: "mcp_oauth_pre_auth_owner_binding_denied",
      message: "Pre-auth owner binding denied.",
      safeForModel: true,
      handleEchoed: false,
      digestEchoed: false,
      identityEchoed: false,
      sensitiveValuesEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}
