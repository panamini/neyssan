import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalDockerfile = join(repoRoot, "cv_parser_service", "Dockerfile");

function read(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("the parser package has one active canonical Dockerfile", () => {
  assert.equal(existsSync(join(repoRoot, "Dockerfile")), false);
  assert.equal(existsSync(canonicalDockerfile), true);

  assert.match(
    read(".github/workflows/cv-parser-service.yml"),
    /-f cv_parser_service\/Dockerfile/u,
  );
  assert.equal(
    read(".github/workflows/release.yml").match(
      /file:\s+\.\/cv_parser_service\/Dockerfile/gu,
    )?.length,
    2,
  );
});

test("the server image owns its portable runtime contract", () => {
  const dockerfile = readFileSync(canonicalDockerfile, "utf8");

  assert.match(dockerfile, /\bPORT=8000\b/u);
  assert.match(dockerfile, /^EXPOSE 8000$/mu);
  assert.match(dockerfile, /^HEALTHCHECK .*\/healthz/mu);
  assert.match(dockerfile, /\$\{PORT\}/u);
  const command = dockerfile.match(/^CMD (.+)$/mu);
  assert.ok(command);
  const commandArgv = JSON.parse(command[1]);
  assert.deepEqual(commandArgv.slice(0, 2), ["/bin/sh", "-c"]);
  assert.match(commandArgv[2], /^exec \/opt\/venv\/bin\/python -m uvicorn /u);
  assert.match(commandArgv[2], /cv_parser_service\.main:app/u);
  assert.match(commandArgv[2], /--port "\$\{PORT\}"$/u);
  assert.doesNotMatch(dockerfile, /run\.sh/u);
});

test("the parser dependency inputs agree on the compatible NumPy floor", () => {
  const expectedPin = /^numpy==1\.24\.4$/mu;

  assert.match(read("cv_parser_service/requirements.txt"), expectedPin);
  assert.match(read("cv_parser_service/requirements.lock"), expectedPin);
});

test("operator docs separate local orchestration from the server image", () => {
  const readme = read("README.md");

  assert.match(readme, /\.\/run\.sh doctor local-fast[\s\S]*\.\/run\.sh local-fast/u);
  assert.match(
    readme,
    /docker build -f cv_parser_service\/Dockerfile -t twoweeks-cv-parser \./u,
  );
  assert.match(readme, /docker run --rm -e PORT=8000 -p 8000:8000 twoweeks-cv-parser/u);
});

test("the manual release smoke owns its container and uses the canonical image", () => {
  const releaseScript = read("scripts/release.sh");

  assert.match(
    releaseScript,
    /docker build -f cv_parser_service\/Dockerfile -t "\$\{IMAGE\}" \./u,
  );
  assert.match(
    releaseScript,
    /--label "\$\{RELEASE_OWNER_LABEL\}=\$\{RELEASE_OWNER_ID\}"/u,
  );
  assert.match(releaseScript, /\[\[ "\$\{owner\}" == "\$\{RELEASE_OWNER_ID\}" \]\]/u);
  assert.match(
    releaseScript,
    /BASE_URL="http:\/\/127\.0\.0\.1:\$\{PORT\}" \.\/scripts\/bench_fixtures\.sh/u,
  );
  assert.doesNotMatch(releaseScript, /docker rm -f cv-parser(?:\s|$)/u);
});
