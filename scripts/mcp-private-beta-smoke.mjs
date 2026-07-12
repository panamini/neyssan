#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const DEFAULT_ORIGIN = "https://mcp.twoweeks.ai";
const EXPECTED_SCOPE = "twoweeks:applications:read";
const MAX_JSON_BYTES = 64 * 1024;

function fail(message) {
  throw new Error(message);
}

function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("origin must be a valid URL");
  }
  const loopback = url.hostname === "127.0.0.1"
    || url.hostname === "localhost"
    || url.hostname === "::1"
    || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    fail("origin must use HTTPS unless it is loopback");
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    fail("origin must be a canonical origin without credentials, path, query, or fragment");
  }
  return url.origin;
}

async function readJson(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) fail("response must use application/json");
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) fail("response body is too large");
  if (!response.body) fail("response body must be valid JSON");
  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_JSON_BYTES) {
      await reader.cancel().catch(() => {});
      fail("response body is too large");
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks, receivedBytes).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    fail("response body must be valid JSON");
  }
}

async function requestJson(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, redirect: "manual", signal: controller.signal });
    if (response.status >= 300 && response.status < 400) fail("redirects are not allowed");
    return { response, json: await readJson(response) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") fail("request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function expectExactArray(value, expected, label) {
  if (!Array.isArray(value) || value.length !== expected.length || expected.some((item, index) => value[index] !== item)) {
    fail(`${label} does not match the private-beta contract`);
  }
}

async function checkAuthorizationMetadata(fetchImpl, canonicalOrigin, timeoutMs, log) {
  const { response, json: metadata } = await requestJson(
    fetchImpl,
    `${canonicalOrigin}/.well-known/oauth-authorization-server`,
    { method: "GET", headers: { accept: "application/json" } },
    timeoutMs,
  );
  if (response.status !== 200) fail("authorization metadata must return 200");
  if (metadata.issuer !== `${canonicalOrigin}/`) fail("authorization issuer does not match the private-beta contract");
  if (metadata.authorization_endpoint !== `${canonicalOrigin}/oauth/authorize`) fail("authorization endpoint does not match the private-beta contract");
  if (metadata.token_endpoint !== `${canonicalOrigin}/oauth/token`) fail("token endpoint does not match the private-beta contract");
  expectExactArray(metadata.token_endpoint_auth_methods_supported, ["client_secret_post"], "token authentication methods");
  expectExactArray(metadata.code_challenge_methods_supported, ["S256"], "PKCE methods");
  expectExactArray(metadata.response_types_supported, ["code"], "OAuth response types");
  expectExactArray(metadata.grant_types_supported, ["authorization_code"], "OAuth grant types");
  expectExactArray(metadata.scopes_supported, [EXPECTED_SCOPE], "authorization scopes");
  if (metadata.authorization_response_iss_parameter_supported !== true) {
    fail("authorization response issuer parameter support is required");
  }
  log("[run] mcp-smoke: PASS authorization metadata");
}

async function checkProtectedResourceMetadata(fetchImpl, canonicalOrigin, timeoutMs, log) {
  const { response, json: metadata } = await requestJson(
    fetchImpl,
    `${canonicalOrigin}/.well-known/oauth-protected-resource/mcp`,
    { method: "GET", headers: { accept: "application/json" } },
    timeoutMs,
  );
  if (response.status !== 200) fail("protected-resource metadata must return 200");
  if (metadata.resource !== `${canonicalOrigin}/mcp`) fail("protected resource does not match the private-beta contract");
  expectExactArray(metadata.authorization_servers, [`${canonicalOrigin}/`], "authorization servers");
  expectExactArray(metadata.scopes_supported, [EXPECTED_SCOPE], "protected-resource scopes");
  log("[run] mcp-smoke: PASS protected-resource metadata");
}

function mcpRequest(method) {
  const params = method === "initialize"
    ? {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "twoweeks-mcp-private-beta-smoke", version: "1.0.0" },
      }
    : {};
  return {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: "smoke", method, params }),
  };
}

async function checkMcpBoundary(fetchImpl, resource, timeoutMs, log) {
  const { response: discoveryResponse, json: discovery } = await requestJson(
    fetchImpl,
    resource,
    mcpRequest("initialize"),
    timeoutMs,
  );
  if (discoveryResponse.status !== 200) fail("unauthenticated MCP discovery must return 200");
  if (discovery?.jsonrpc !== "2.0" || discovery?.id !== "smoke" || typeof discovery?.result?.protocolVersion !== "string") {
    fail("unauthenticated MCP discovery must return an initialize result");
  }
  log("[run] mcp-smoke: PASS unauthenticated MCP discovery");

  const { response: toolCallResponse } = await requestJson(fetchImpl, resource, mcpRequest("tools/call"), timeoutMs);
  if (toolCallResponse.status !== 401) fail("unauthenticated MCP tool calls must return 401");
  const challenge = toolCallResponse.headers.get("www-authenticate") ?? "";
  if (!challenge.toLowerCase().startsWith("bearer ")) {
    fail("unauthenticated MCP tool calls must return a Bearer challenge");
  }
  if (!challenge.includes(`resource_metadata="${resource.replace(/\/mcp$/u, "/.well-known/oauth-protected-resource/mcp")}"`)) {
    fail("Bearer challenge must include protected-resource metadata");
  }
  if (!challenge.includes(`scope="${EXPECTED_SCOPE}"`) || !challenge.includes('error="invalid_token"')) {
    fail("Bearer challenge must require the private-beta scope");
  }
  log("[run] mcp-smoke: PASS unauthenticated MCP tool call fails closed");
}

async function checkMalformedTokenRequest(fetchImpl, canonicalOrigin, timeoutMs, log) {
  const { response, json: result } = await requestJson(
    fetchImpl,
    `${canonicalOrigin}/oauth/token`,
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code",
    },
    timeoutMs,
  );
  if (response.status !== 400) fail("malformed token request must return 400");
  if (result.error !== "invalid_target") fail("token request without a resource must return invalid_target");
  if (!(response.headers.get("cache-control") ?? "").toLowerCase().includes("no-store")) {
    fail("token error response must disable storage");
  }
  log("[run] mcp-smoke: PASS malformed token request fails closed");
}

export async function runMcpPrivateBetaSmoke({
  origin = DEFAULT_ORIGIN,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
  log = (message) => console.log(message),
} = {}) {
  if (typeof fetchImpl !== "function") fail("Node fetch is unavailable");
  const canonicalOrigin = normalizeOrigin(origin);
  const resource = `${canonicalOrigin}/mcp`;
  await checkAuthorizationMetadata(fetchImpl, canonicalOrigin, timeoutMs, log);
  await checkProtectedResourceMetadata(fetchImpl, canonicalOrigin, timeoutMs, log);
  await checkMcpBoundary(fetchImpl, resource, timeoutMs, log);
  await checkMalformedTokenRequest(fetchImpl, canonicalOrigin, timeoutMs, log);
  log("[run] mcp-smoke: PASS (no credentials or private data sent)");
}

function parseArgs(args) {
  if (args.length === 0) return { origin: DEFAULT_ORIGIN };
  if (args.length === 2 && args[0] === "--origin") return { origin: args[1] };
  fail("usage: mcp-private-beta-smoke.mjs [--origin https://host]");
}

async function main() {
  try {
    await runMcpPrivateBetaSmoke(parseArgs(process.argv.slice(2)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown failure";
    console.error(`[run] mcp-smoke: FAIL - ${message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
