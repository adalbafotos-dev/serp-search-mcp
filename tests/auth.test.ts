import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";

const localJwks = vi.hoisted(() => ({ resolve: undefined as unknown, calls: 0 }));
vi.mock("jose", async importOriginal => {
  const original = await importOriginal<typeof import("jose")>();
  return {
    ...original,
    createRemoteJWKSet: vi.fn(() => { localJwks.calls++; return localJwks.resolve; }),
  };
});

let signingKey: CryptoKey;
let auth: typeof import("../src/lib/auth");
let readJson: typeof import("../src/lib/request").readJson;
const base = "https://mcp.example.test";
const issuer = "https://identity.example.test/";
const fixedToken = "test-only-mcp-token";

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  signingKey = pair.privateKey;
  localJwks.resolve = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), alg: "RS256", kid: "test-key" }] });
});

beforeEach(async () => {
  vi.resetModules();
  localJwks.calls = 0;
  vi.stubEnv("MCP_PUBLIC_URL", base);
  vi.stubEnv("MCP_AUTH_MODE", "bearer");
  vi.stubEnv("MCP_AUTH_TOKEN", fixedToken);
  vi.stubEnv("MCP_ALLOWED_ORIGINS", "");
  vi.stubEnv("MCP_OAUTH_ISSUER", "");
  vi.stubEnv("MCP_OAUTH_JWKS_URL", "");
  vi.stubEnv("MCP_OAUTH_AUDIENCE", "");
  vi.stubEnv("MCP_OAUTH_SCOPES", "research:read");
  vi.stubEnv("MCP_OAUTH_ALLOWED_SUBJECTS", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external request in auth test"); }));
  auth = await import("../src/lib/auth");
  ({ readJson } = await import("../src/lib/request"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function request(token?: string, headers: Record<string, string> = {}, url = `${base}/api/mcp`) {
  return new Request(url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } });
}

function enableOAuth(mode = "oauth") {
  vi.stubEnv("MCP_AUTH_MODE", mode);
  vi.stubEnv("MCP_OAUTH_ISSUER", issuer);
  vi.stubEnv("MCP_OAUTH_JWKS_URL", `${issuer}.well-known/jwks.json`);
  vi.stubEnv("MCP_OAUTH_AUDIENCE", `${base}/api/mcp`);
}

async function accessToken(options: { issuer?: string; audience?: string; scope?: string; subject?: string; expiresAt?: number } = {}) {
  return new SignJWT({ scope: options.scope ?? "research:read" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(options.issuer ?? issuer)
    .setAudience(options.audience ?? `${base}/api/mcp`)
    .setSubject(options.subject ?? "allowed-user")
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? Math.floor(Date.now() / 1000) + 300)
    .sign(signingKey);
}

describe("MCP authentication boundary", () => {
  it("accepts the owner bearer token and rejects absent, oversized and incorrect credentials", async () => {
    await expect(auth.authorizeRequest(request(fixedToken))).resolves.toBe("owner");
    await expect(auth.authorizeRequest(request())).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    await expect(auth.authorizeRequest(request("incorrect"))).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(auth.authorizeRequest(request("a".repeat(8193)))).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(localJwks.calls).toBe(0);
  });

  it("fails closed when bearer credentials or auth mode are not configured", async () => {
    vi.stubEnv("MCP_AUTH_TOKEN", "  ");
    await expect(auth.authorizeRequest(request(fixedToken))).rejects.toMatchObject({ code: "AUTH_NOT_CONFIGURED", status: 503 });
    vi.stubEnv("MCP_AUTH_MODE", "noauth");
    await expect(auth.authorizeRequest(request(fixedToken))).rejects.toMatchObject({ code: "AUTH_NOT_CONFIGURED" });
  });

  it("rejects an attacker origin and a forged host while accepting explicitly allowed origins", async () => {
    await expect(auth.authorizeRequest(request(fixedToken, { Origin: "https://attacker.example" }))).rejects.toMatchObject({ code: "FORBIDDEN_ORIGIN", status: 403 });
    await expect(auth.authorizeRequest(request(fixedToken, { Host: "attacker.example" }))).rejects.toMatchObject({ code: "FORBIDDEN_HOST" });
    await expect(auth.authorizeRequest(request(fixedToken, {}, "https://attacker.example/api/mcp"))).rejects.toMatchObject({ code: "FORBIDDEN_HOST" });
    vi.stubEnv("MCP_ALLOWED_ORIGINS", "https://client.example.test");
    await expect(auth.authorizeRequest(request(fixedToken, { Origin: "https://client.example.test" }))).resolves.toBe("owner");
  });

  it("allows loopback aliases on the configured local port only", async () => {
    vi.stubEnv("MCP_PUBLIC_URL", "http://localhost:3100");
    await expect(auth.authorizeRequest(request(fixedToken, {}, "http://127.0.0.1:3100/api/mcp"))).resolves.toBe("owner");
    await expect(auth.authorizeRequest(request(fixedToken, {}, "http://127.0.0.1:3000/api/mcp"))).rejects.toMatchObject({ code: "FORBIDDEN_HOST" });
  });

  it("accepts a loopback browser Origin when Next.js normalizes the request URL to localhost", async () => {
    vi.stubEnv("MCP_PUBLIC_URL", "http://localhost:3000");
    const headers = { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" };
    await expect(auth.authorizeRequest(request(fixedToken, headers, "http://localhost:3000/api/mcp"))).resolves.toBe("owner");
    await expect(auth.authorizeRequest(request(fixedToken, { ...headers, Origin: "http://127.0.0.1:3100" }, "http://localhost:3000/api/mcp"))).rejects.toMatchObject({ code: "FORBIDDEN_ORIGIN" });
  });

  it("validates locally signed OAuth JWTs and caches the configured key resolver", async () => {
    enableOAuth();
    const jwt = await accessToken();
    await expect(auth.authorizeRequest(request(jwt))).resolves.toBe("allowed-user");
    await expect(auth.authorizeRequest(request(jwt))).resolves.toBe("allowed-user");
    expect(localJwks.calls).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects the wrong JWT audience, issuer, expiration and a modified signature", async () => {
    enableOAuth();
    for (const jwt of [
      await accessToken({ audience: "https://another-api.example" }),
      await accessToken({ issuer: "https://another-issuer.example/" }),
      await accessToken({ expiresAt: Math.floor(Date.now() / 1000) - 60 }),
    ]) {
      await expect(auth.authorizeRequest(request(jwt))).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    }
    const jwt = await accessToken();
    const parts = jwt.split(".");
    parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
    await expect(auth.authorizeRequest(request(parts.join(".")))).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("enforces scopes and a personal subject allowlist before running a tool", async () => {
    enableOAuth();
    await expect(auth.authorizeRequest(request(await accessToken({ scope: "other:read" })))).rejects.toMatchObject({ code: "INSUFFICIENT_SCOPE", status: 403 });
    vi.stubEnv("MCP_OAUTH_ALLOWED_SUBJECTS", "allowed-user, second-user");
    await expect(auth.authorizeRequest(request(await accessToken({ subject: "unapproved-user" })))).rejects.toMatchObject({ code: "FORBIDDEN_SUBJECT", status: 403 });
    await expect(auth.authorizeRequest(request(await accessToken({ subject: "second-user" })))).resolves.toBe("second-user");
  });

  it("supports both modes while an OAuth-only server rejects the fixed token", async () => {
    enableOAuth("both");
    await expect(auth.authorizeRequest(request(fixedToken))).resolves.toBe("owner");
    await expect(auth.authorizeRequest(request(await accessToken()))).resolves.toBe("allowed-user");
    vi.stubEnv("MCP_AUTH_MODE", "oauth");
    await expect(auth.authorizeRequest(request(fixedToken))).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("publishes OAuth discovery challenges and resets the per-subject minute limit", () => {
    enableOAuth();
    expect(auth.protectedResourceMetadata()).toMatchObject({ resource: `${base}/api/mcp`, authorization_servers: [issuer], scopes_supported: ["research:read"] });
    expect(auth.authHeaders(401)["WWW-Authenticate"]).toContain(`${base}/.well-known/oauth-protected-resource/api/mcp`);
    expect(auth.authHeaders(403)["WWW-Authenticate"]).toContain('error="insufficient_scope"');
    vi.useFakeTimers();
    for (let count = 0; count < 60; count++) auth.rateLimit("subject-one");
    expect(() => auth.rateLimit("subject-one")).toThrowError(expect.objectContaining({ code: "RATE_LIMITED", status: 429 }));
    expect(() => auth.rateLimit("subject-two")).not.toThrow();
    expect(auth.authHeaders(429)["Retry-After"]).toBe("60");
    vi.advanceTimersByTime(60_001);
    expect(() => auth.rateLimit("subject-one")).not.toThrow();
  });
});

describe("bounded JSON request parser", () => {
  const jsonRequest = (body: string, headers: Record<string, string> = {}) => new Request(`${base}/api/mcp`, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body,
  });

  it("reads a complete JSON object with nested params and accepts media-type parameters", async () => {
    const payload = { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "build_content_strategy", arguments: { topic: "SEO", weeks: 2 } } };
    await expect(readJson(jsonRequest(JSON.stringify(payload), { "Content-Type": "Application/JSON; charset=utf-8" }))).resolves.toEqual(payload);
  });

  it("rejects malformed and absent JSON and unsupported lookalike media types", async () => {
    await expect(readJson(jsonRequest("{"))).rejects.toMatchObject({ code: "INVALID_JSON", status: 400 });
    await expect(readJson(new Request(`${base}/api/mcp`, { method: "POST", headers: { "Content-Type": "application/json" } }))).rejects.toMatchObject({ code: "INVALID_JSON" });
    await expect(readJson(jsonRequest("{}", { "Content-Type": "application/json-malicious" }))).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE", status: 415 });
  });

  it("rejects bodies exceeding the declared or streamed byte limit and cancels the stream", async () => {
    await expect(readJson(jsonRequest("{}", { "Content-Length": "100" }), 10)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE", status: 413 });
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(11))); },
      cancel() { cancelled = true; },
    });
    const streamed = new Request(`${base}/api/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body, duplex: "half" } as RequestInit & { duplex: "half" });
    await expect(readJson(streamed, 10)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });
});
