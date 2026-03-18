import { fetch } from "undici";

const parserUrl = process.env.CONVEX_PARSER_URL?.trim() || "http://127.0.0.1:8000/parse-cv";
const healthUrl = new URL(parserUrl);
healthUrl.pathname = "/healthz";
healthUrl.search = "";

async function main() {
  console.log(`[parser-test] Testing connectivity to ${healthUrl.toString()}`);
  try {
    const response = await fetch(healthUrl, { method: "GET" });
    const body = await response.text();
    console.log(`[parser-test] Status: ${response.status} ${response.statusText}`);
    console.log(`[parser-test] Body: ${body}`);
  } catch (error) {
    console.error("[parser-test] Fetch failed:", error);
    process.exitCode = 1;
  }
}

void main();
