import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import { runMcpPrivateBetaSmoke } from "../scripts/mcp-private-beta-smoke.mjs";

const RUN_SH = new URL("../run.sh", import.meta.url);

async function startFixture(t, override = {}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({ body, headers: request.headers, method: request.method, url: request.url });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const route = override[request.url] ?? override.default;
    if (route) {
      response.writeHead(route.status, route.headers ?? { "content-type": "application/json" });
      response.end(JSON.stringify(typeof route.body === "function" ? route.body(origin) : (route.body ?? {})));
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
      const message = JSON.parse(body);
      if (message.method === "initialize") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result: { protocolVersion: "2025-11-25" },
        }));
        return;
      }
      response.writeHead(401, { "content-type": "application/json", "www-authenticate": "Bearer" });
      response.end(JSON.stringify({ error: "invalid_token" }));
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

  assert.equal(output.length, 6);
  assert.match(output.at(-1), /no credentials or private data sent/u);
  assert.equal(fixture.requests.length, 5);
  assert.deepEqual(
    fixture.requests.map((request) => request.url),
    [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource/mcp",
      "/mcp",
      "/mcp",
      "/oauth/token",
    ],
  );
  assert.equal(fixture.requests.find((request) => request.url === "/oauth/token").body, "grant_type=authorization_code");
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
        scopes_supported: ["twoweeks:applications:read"],
      }),
    },
  });
  await assert.rejects(
    runMcpPrivateBetaSmoke({ origin: fixture.origin, log: () => {} }),
    /token authentication methods does not match/u,
  );
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
});

test("run.sh exposes mcp-smoke as a read-only dispatch", async () => {
  const source = await readFile(RUN_SH, "utf8");
  assert.match(source, /mcp_smoke\(\) \{\s+node "\$\{ROOT_DIR\}\/scripts\/mcp-private-beta-smoke\.mjs" "\$@"\s+\}/u);
  assert.match(source, /\.\/run\.sh mcp-smoke \[--origin https:\/\/host\]/u);
  assert.match(source, /if \[\[ "\$\{CMD\}" == "doctor" \|\| "\$\{CMD\}" == "mcp-smoke" \]\]; then/u);
  assert.match(source, /mcp-smoke\) mcp_smoke "\$@";;/u);
});
