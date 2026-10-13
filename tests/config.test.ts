import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicBaseUrl, vercelDeploymentHosts } from "../src/lib/config";
import { authorizeRequest } from "../src/lib/auth";

beforeEach(() => {
  for (const name of ["MCP_PUBLIC_URL", "VERCEL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL", "VERCEL_BRANCH_URL", "MCP_ALLOWED_ORIGINS", "MCP_OAUTH_ISSUER", "MCP_OAUTH_JWKS_URL"]) vi.stubEnv(name, "");
  vi.stubEnv("MCP_AUTH_MODE", "bearer");
  vi.stubEnv("MCP_AUTH_TOKEN", "local-test-owner");
});
afterEach(() => vi.unstubAllEnvs());

describe("Vercel origins and canonical resource URL", () => {
  it("uses localhost locally and a stable production domain in Vercel", () => {
    expect(publicBaseUrl()).toBe("http://localhost:3000");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_URL", "serp-random-project.vercel.app");
    expect(publicBaseUrl()).toBe("https://serp-random-project.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "research.example.com");
    expect(publicBaseUrl()).toBe("https://research.example.com");
    vi.stubEnv("MCP_PUBLIC_URL", "https://mcp.example.com");
    expect(publicBaseUrl()).toBe("https://mcp.example.com");
  });

  it("accepts known deployment and branch aliases while rejecting unrelated hosts", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "research.example.com");
    vi.stubEnv("VERCEL_URL", "serp-random-project.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "serp-git-preview.vercel.app");
    for (const host of vercelDeploymentHosts()) {
      const request = new Request(`https://${host}/api/mcp`, { headers: { Authorization: "Bearer local-test-owner", Origin: `https://${host}` } });
      await expect(authorizeRequest(request)).resolves.toBe("owner");
    }
    await expect(authorizeRequest(new Request("https://unrelated.vercel.app/api/mcp", { headers: { Authorization: "Bearer local-test-owner" } }))).rejects.toMatchObject({ code: "FORBIDDEN_HOST" });
  });

  it("ignores aliases outside Vercel and malformed environment host values", () => {
    vi.stubEnv("VERCEL_URL", "unrelated.vercel.app");
    expect(vercelDeploymentHosts()).toEqual([]);
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_URL", "user:password@unrelated.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "unrelated.vercel.app/path");
    expect(vercelDeploymentHosts()).toEqual([]);
    vi.stubEnv("MCP_PUBLIC_URL", "https://research.example.com/api/mcp");
    expect(() => publicBaseUrl()).toThrow("MCP_PUBLIC_URL");
  });
});
