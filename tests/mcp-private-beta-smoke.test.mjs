import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runMcpPrivateBetaSmoke } from "../scripts/mcp-private-beta-smoke.mjs";

const RUN_SH = new URL("../run.sh", import.meta.url);
const ACTIVE_PROTOCOL_VERSION = "2025-11-25";
const CLIENT_PROTOCOL_OFFERS = Object.freeze(["2025-06-18", ACTIVE_PROTOCOL_VERSION]);
const EXPECTED_TOOL_NAMES = Object.freeze([
  "search",
  "fetch",
  "twoweeks.application_package.summarize",
  "twoweeks.evidence_graph.summarize",
  "twoweeks.resume_variant_plan.summarize",
  "twoweeks.review_cockpit.summarize",
]);
const READ_ONLY_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
});
const OAUTH_SECURITY_SCHEMES = Object.freeze([
  Object.freeze({
    type: "oauth2",
    scopes: Object.freeze(["twoweeks:applications:read"]),
  }),
]);

function toolDescriptors({ names = EXPECTED_TOOL_NAMES, annotationOverrides = {} } = {}) {
  return names.map((name) => ({
    name,
    annotations: annotationOverrides[name] ?? READ_ONLY_ANNOTATIONS,
    securitySchemes: OAUTH_SECURITY_SCHEMES,
    _meta: { securitySchemes: OAUTH_SECURITY_SCHEMES },
  }));
}

async function startFixture(t, override = {}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({ body, headers: request.headers, method: request.method, url: request.url });
    const origin = `http://127.0.0.1:${server.address().port}`;
    let mcpMessage;
    if (request.url === "/mcp") {
      try {
        mcpMessage = JSON.parse(body);
      } catch {
        mcpMessage = undefined;
      }
    }
    const routeKey = mcpMessage?.method ? `${request.url}:${mcpMessage.method}` : request.url;
    const configuredRoute = override[routeKey] ?? override[request.url] ?? override.default;
    const route = typeof configuredRoute === "function"
      ? configuredRoute({ body, headers: request.headers, message: mcpMessage, method: request.method, origin, url: request.url })
      : configuredRoute;
    if (route) {
      response.writeHead(route.status, route.headers ?? { "content-type": "application/json" });
      if (Object.hasOwn(route, "rawBody")) {
        response.end(route.rawBody);
        return;
      }
      const responseBody = Object.hasOwn(route, "body") ? route.body : {};
      response.end(JSON.stringify(typeof responseBody === "function" ? responseBody(origin) : responseBody));
      return;
    }
    if (request.url === "/.well-known/oauth-authorization-server") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        issuer: `${origin}/`,
        authorization_endpoint: `${origin}/oauth/authorize`,
        token_endpoint: `${origin}/oauth/token`,
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        code_challenge_methods_supported: ["S256"],
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        authorization_response_iss_parameter_supported: true,
        scopes_supported: ["twoweeks:applications:read"],
      }));
      return;
    }
    if (request.url === "/.well-known/oauth-protected-resource/mcp") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        resource: `${origin}/mcp`,
        authorization_servers: [`${origin}/`],
        scopes_supported: ["twoweeks:applications:read"],
      }));
      return;
    }
    if (request.url === "/mcp") {
      const message = mcpMessage ?? JSON.parse(body);
      if (message.method === "initialize") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result: { protocolVersion: ACTIVE_PROTOCOL_VERSION },
        }));
        return;
      }
      if (message.method === "notifications/initialized") {
        response.writeHead(202);
        response.end();
        return;
      }
      if (message.method === "tools/list") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result: { tools: toolDescriptors() },
        }));
        return;
      }
      const challenge = `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", error="invalid_token", error_description="Access token required.", scope="twoweeks:applications:read"`;
      response.writeHead(401, {
        "content-type": "application/json",
        "www-authenticate": challenge,
      });
      response.end(JSON.stringify({
        error: "invalid_token",
        _meta: { "mcp/www_authenticate": [challenge] },
      }));
      return;
    }
    if (request.url === "/oauth/token") {
      response.writeHead(400, { "cache-control": "no-store", "content-type": "application/json" });
      response.end(JSON.stringify({ error: "invalid_target" }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { origin: `http://127.0.0.1:${server.address().port}`, requests };
}

test("smoke validates the public no-credential contract without sending sensitive fields", async (t) => {
  const fixture = await startFixture(t);
  const output = [];
  await runMcpPrivateBetaSmoke({ origin: fixture.origin, log: (message) => output.push(message) });

  assert.equal(output.length, 11);
  assert.match(output.at(-1), /no credentials or private data sent/u);
  assert.equal(fixture.requests.length, 10);
  assert.deepEqual(
    fixture.requests.map((request) => request.url),
    [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource/mcp",
      "/mcp",
      "/mcp",
      "/mcp",
      "/mcp",
      "/mcp",
      "/mcp",
      "/mcp",
      "/oauth/token",
    ],
  );
  assert.equal(fixture.requests.find((request) => request.url === "/oauth/token").body, "grant_type=authorization_code");
  const mcpRequests = fixture.requests.filter((request) => request.url === "/mcp");
  assert.deepEqual(
    mcpRequests.map((request) => [JSON.parse(request.body).method, request.headers["mcp-protocol-version"]]),
    [
      ["initialize", "2025-06-18"],
      ["notifications/initialized", ACTIVE_PROTOCOL_VERSION],
      ["tools/list", ACTIVE_PROTOCOL_VERSION],
      ["initialize", "2025-11-25"],
      ["notifications/initialized", ACTIVE_PROTOCOL_VERSION],
      ["tools/list", ACTIVE_PROTOCOL_VERSION],
      ["tools/call", ACTIVE_PROTOCOL_VERSION],
    ],
  );
  assert.deepEqual(
    mcpRequests
      .map((request) => JSON.parse(request.body))
      .filter((message) => message.method === "initialize")
      .map((message) => message.params),
    CLIENT_PROTOCOL_OFFERS.map((protocolVersion) => ({
      protocolVersion,
      capabilities: {},
      clientInfo: { name: "twoweeks-mcp-private-beta-smoke", version: "1.0.0" },
    })),
  );
  for (const initialized of mcpRequests
    .map((request) => JSON.parse(request.body))
    .filter((message) => message.method === "notifications/initialized")) {
    assert.equal("id" in initialized, false);
  }
  for (const request of mcpRequests) {
    assert.equal(request.headers.accept, "application/json, text/event-stream");
  }
  for (const request of fixture.requests) {
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.headers.cookie, undefined);
    assert.doesNotMatch(request.body, /client_secret|code_verifier|access_token|refresh_token/u);
  }
});

test("smoke rejects public-client metadata", async (t) => {
  const fixture = await startFixture(t, {
    "/.well-known/oauth-authorization-server": {
      status: 200,
      body: (origin) => ({
        issuer: `${origin}/`,
        authorization_endpoint: `${origin}/oauth/authorize`,
        token_endpoint: `${origin}/oauth/token`,
        token_endpoint_auth_methods_supported: ["none"],
        code_challenge_methods_supported: ["S256"],
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        authorization_response_iss_parameter_supported: true,
        scopes_supported: ["twoweeks:applications:read"],
      }),
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /token authentication methods does not match/u,
  );
});

test("smoke rejects broader authorization scopes", async (t) => {
  const fixture = await startFixture(t, {
    "/.well-known/oauth-authorization-server": {
      status: 200,
      body: (origin) => ({
        issuer: `${origin}/`,
        authorization_endpoint: `${origin}/oauth/authorize`,
        token_endpoint: `${origin}/oauth/token`,
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        code_challenge_methods_supported: ["S256"],
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        authorization_response_iss_parameter_supported: true,
        scopes_supported: ["twoweeks:applications:read", "twoweeks:applications:write"],
      }),
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /authorization scopes does not match/u,
  );
});

test("smoke rejects broader protected-resource scopes", async (t) => {
  const fixture = await startFixture(t, {
    "/.well-known/oauth-protected-resource/mcp": {
      status: 200,
      body: (origin) => ({
        resource: `${origin}/mcp`,
        authorization_servers: [`${origin}/`],
        scopes_supported: ["twoweeks:applications:read", "twoweeks:applications:write"],
      }),
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /protected-resource scopes does not match/u,
  );
});

test("smoke rejects incomplete Bearer challenges", async (t) => {
  const fixture = await startFixture(t, {
    "/mcp:tools/call": {
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": "Bearer" },
      body: { error: "invalid_token" },
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /must return a Bearer challenge/u,
  );
});

test("smoke rejects prefixed Bearer parameter names", async (t) => {
  const fixture = await startFixture(t, {
    "/mcp:tools/call": ({ origin }) => {
      return {
        status: 401,
        headers: {
          "content-type": "application/json",
          "www-authenticate": `Bearer xresource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", xerror="invalid_token", xscope="twoweeks:applications:read"`,
        },
        body: { error: "invalid_token" },
      };
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /must include protected-resource metadata/u,
  );
});

test("smoke rejects a missing MCP auth metadata mirror", async (t) => {
  const fixture = await startFixture(t, {
    "/mcp:tools/call": ({ origin }) => {
      return {
        status: 401,
        headers: {
          "content-type": "application/json",
          "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", error="invalid_token", error_description="Access token required.", scope="twoweeks:applications:read"`,
        },
        body: { error: "invalid_token" },
      };
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /must mirror the Bearer challenge/u,
  );
});

test("smoke rejects a missing Bearer error description", async (t) => {
  const fixture = await startFixture(t, {
    "/mcp:tools/call": ({ origin }) => {
      const challenge = `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", error="invalid_token", scope="twoweeks:applications:read"`;
      return {
        status: 401,
        headers: { "content-type": "application/json", "www-authenticate": challenge },
        body: { error: "invalid_token", _meta: { "mcp/www_authenticate": [challenge] } },
      };
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /must require the private-beta scope/u,
  );
});

test("smoke rejects an unsupported negotiated MCP version for either client offer", async (t) => {
  for (const offeredProtocolVersion of CLIENT_PROTOCOL_OFFERS) {
    await t.test(offeredProtocolVersion, async (t) => {
      const fixture = await startFixture(t, {
        "/mcp:initialize": ({ message }) => ({
          status: 200,
          body: {
            jsonrpc: "2.0",
            id: message.id,
            result: {
              protocolVersion: message.params.protocolVersion === offeredProtocolVersion
                ? "2024-11-05"
                : ACTIVE_PROTOCOL_VERSION,
            },
          },
        }),
      });
      await assert.rejects(
        runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
        /must return an initialize result/u,
      );
    });
  }
});

test("smoke rejects any drift from the exact six-tool inventory", async (t) => {
  const inventoryCases = [
    ["missing", EXPECTED_TOOL_NAMES.slice(0, -1)],
    ["extra", [...EXPECTED_TOOL_NAMES, "twoweeks.unapproved.summarize"]],
    ["reordered", [...EXPECTED_TOOL_NAMES].reverse()],
  ];
  for (const [label, names] of inventoryCases) {
    await t.test(label, async (t) => {
      const fixture = await startFixture(t, {
        "/mcp:tools/list": ({ message }) => ({
          status: 200,
          body: { jsonrpc: "2.0", id: message.id, result: { tools: toolDescriptors({ names }) } },
        }),
      });
      await assert.rejects(
        runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
        /tool inventory does not match/u,
      );
    });
  }
});

test("smoke rejects missing or unsafe read-only tool annotations", async (t) => {
  const annotationCases = [
    ["missing", undefined],
    ["readOnlyHint", { ...READ_ONLY_ANNOTATIONS, readOnlyHint: false }],
    ["destructiveHint", { ...READ_ONLY_ANNOTATIONS, destructiveHint: true }],
    ["openWorldHint", { ...READ_ONLY_ANNOTATIONS, openWorldHint: true }],
  ];
  for (const [label, annotations] of annotationCases) {
    await t.test(label, async (t) => {
      const tools = toolDescriptors();
      tools[0] = annotations === undefined
        ? { name: tools[0].name }
        : { ...tools[0], annotations };
      const fixture = await startFixture(t, {
        "/mcp:tools/list": ({ message }) => ({
          status: 200,
          body: { jsonrpc: "2.0", id: message.id, result: { tools } },
        }),
      });
      await assert.rejects(
        runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
        /tool annotations do not match/u,
      );
    });
  }
});

test("smoke rejects missing or unsafe OAuth tool security schemes", async (t) => {
  const securityCases = [
    ["missing descriptor schemes", (tool) => { delete tool.securitySchemes; }],
    ["wrong descriptor scope", (tool) => {
      tool.securitySchemes = [{ type: "oauth2", scopes: ["twoweeks:applications:write"] }];
    }],
    ["extra descriptor scheme", (tool) => {
      tool.securitySchemes = [
        { type: "oauth2", scopes: ["twoweeks:applications:read"] },
        { type: "noauth" },
      ];
    }],
    ["missing metadata schemes", (tool) => { delete tool._meta.securitySchemes; }],
    ["wrong metadata scope", (tool) => {
      tool._meta.securitySchemes = [{ type: "oauth2", scopes: ["twoweeks:applications:write"] }];
    }],
    ["wrong metadata type", (tool) => {
      tool._meta.securitySchemes = [{ type: "noauth" }];
    }],
    ["extra metadata scheme", (tool) => {
      tool._meta.securitySchemes = [
        { type: "oauth2", scopes: ["twoweeks:applications:read"] },
        { type: "noauth" },
      ];
    }],
  ];
  for (const [label, mutate] of securityCases) {
    await t.test(label, async (t) => {
      const tools = toolDescriptors();
      mutate(tools[0]);
      const fixture = await startFixture(t, {
        "/mcp:tools/list": ({ message }) => ({
          status: 200,
          body: { jsonrpc: "2.0", id: message.id, result: { tools } },
        }),
      });
      await assert.rejects(
        runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
        /tool OAuth security schemes do not match/u,
      );
    });
  }
});

test("smoke rejects redirects without following them", async (t) => {
  const fixture = await startFixture(t, {
    "/.well-known/oauth-authorization-server": {
      status: 302,
      headers: { location: "https://redirect.invalid/" },
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /redirects are not allowed/u,
  );
  assert.equal(fixture.requests.length, 1);
});

test("smoke failures do not include response bodies", async (t) => {
  const privateMarker = "private-response-marker-do-not-print";
  const fixture = await startFixture(t, {
    "/.well-known/oauth-authorization-server": {
      status: 500,
      body: { detail: privateMarker },
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    (error) => {
      assert.doesNotMatch(error.message, new RegExp(privateMarker, "u"));
      assert.match(error.message, /authorization metadata must return 200/u);
      return true;
    },
  );
});

test("smoke requires the exact application/json media type", async (t) => {
  const fixture = await startFixture(t, {
    "/.well-known/oauth-authorization-server": {
      status: 200,
      headers: { "content-type": "text/plain; note=application/json" },
      body: {},
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /response must use application\/json/u,
  );
});

test("smoke bounds streamed JSON bodies without printing them", async (t) => {
  const fixture = await startFixture(t, {
    "/.well-known/oauth-authorization-server": {
      status: 200,
      body: { detail: "x".repeat(70 * 1024) },
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /response body is too large/u,
  );
});

test("smoke accepts only HTTPS or loopback origins", async () => {
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: "http://example.test", fetchImpl: () => { throw new Error("must not run"); } }),
    /origin must use HTTPS unless it is loopback/u,
  );
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: "https://user:password@example.test", fetchImpl: () => { throw new Error("must not run"); } }),
    /canonical origin/u,
  );
  await assert.rejects(
    runMcpPrivateBetaSmoke({
      origin: "http://[::1]:5196",
      fetchImpl: () => { throw new Error("IPv6 loopback accepted"); },
    }),
    /IPv6 loopback accepted/u,
  );
});

test("run.sh exposes mcp-smoke as a read-only dispatch", async () => {
  const source = await readFile(RUN_SH, "utf8");
  assert.match(source, /mcp_smoke\(\) \{\s+node "\$\{ROOT_DIR\}\/scripts\/mcp-private-beta-smoke\.mjs" "\$@"\s+\}/u);
  assert.match(source, /\.\/run\.sh mcp-smoke \[--origin https:\/\/host\]/u);
  assert.match(source, /if \[\[ "\$\{READ_ONLY_COMMAND\}" == "1" \]\]; then/u);
  assert.match(source, /mcp-smoke\) mcp_smoke "\$@";;/u);
});

test("run.sh mcp-smoke does not source or trace dotenv values", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "mcp-smoke-runsh-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const bin = join(root, "bin");
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(bin, { recursive: true });
  await copyFile(RUN_SH, join(root, "run.sh"));
  const privateMarker = "private-dotenv-marker-do-not-print";
  await writeFile(join(root, ".env"), `PRIVATE_MARKER=${privateMarker}\n`, "utf8");
  await writeFile(
    join(bin, "node"),
    '#!/bin/sh\nif [ -n "${PRIVATE_MARKER:-}" ]; then exit 23; fi\nexit 0\n',
    { mode: 0o755 },
  );

  const result = spawnSync("/bin/bash", ["-x", join(root, "run.sh"), "mcp-smoke"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(privateMarker, "u"));
});
