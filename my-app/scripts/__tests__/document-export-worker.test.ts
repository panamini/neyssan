import { afterEach, describe, expect, it } from "vitest";
import { resolveFrontendBaseUrls } from "../document-export-worker";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("document export worker frontend candidates", () => {
  it("tries the explicit local origin before its Docker alias", () => {
    process.env.DOCUMENT_EXPORT_DOCKER_HOST_FALLBACK_FIRST = "0";
    process.env.DOCUMENT_EXPORT_FRONTEND_URL = "http://127.0.0.1:5197";
    delete process.env.CLIENT_ORIGIN;
    delete process.env.VITE_FRONTEND_URL;

    expect(resolveFrontendBaseUrls().slice(0, 2)).toEqual([
      "http://127.0.0.1:5197",
      "http://host.docker.internal:5197",
    ]);
  });

  it("tries the Docker host alias before a container-local forwarded origin", () => {
    process.env.DOCUMENT_EXPORT_DOCKER_HOST_FALLBACK_FIRST = "1";
    process.env.DOCUMENT_EXPORT_FRONTEND_URL = "http://localhost:5197";
    delete process.env.CLIENT_ORIGIN;
    delete process.env.VITE_FRONTEND_URL;

    expect(resolveFrontendBaseUrls().slice(0, 2)).toEqual([
      "http://host.docker.internal:5197",
      "http://localhost:5197",
    ]);
  });
});
