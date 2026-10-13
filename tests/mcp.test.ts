import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";

let createMcpServer: typeof import("../src/mcp/server").createMcpServer;
let mcpRoute: typeof import("../src/app/api/mcp/route");
const token = "test-mcp-route-token";
const planningInput = { topic: "SEO para blogs", audience: "pequenas empresas", channels: ["blog", "instagram"], weeks: 2, keywords: ["seo blog"] };

beforeEach(async () => {
  vi.resetModules();
  for (const name of ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "SERPAPI_API_KEY", "SERPER_API_KEY", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "MCP_OAUTH_ISSUER", "MCP_OAUTH_JWKS_URL", "MCP_OAUTH_AUDIENCE", "MCP_OAUTH_ALLOWED_SUBJECTS", "MCP_ALLOWED_ORIGINS"]) vi.stubEnv(name, "");
  vi.stubEnv("SERP_PROVIDER", "dataforseo");
  vi.stubEnv("MCP_PUBLIC_URL", "http://localhost:3000");
  vi.stubEnv("MCP_AUTH_MODE", "bearer");
  vi.stubEnv("MCP_AUTH_TOKEN", token);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected provider call in MCP protocol test"); }));
  ({ createMcpServer } = await import("../src/mcp/server"));
  mcpRoute = await import("../src/app/api/mcp/route");
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function withClient(run: (client: Client) => Promise<void>) {
  const server = createMcpServer();
  const client = new Client({ name: "test-research-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

function httpRequest(body: unknown, headers: Record<string, string> = {}, path = "/api/mcp") {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(body),
  });
}

describe("MCP protocol using the SDK client", () => {
  it("initializes, advertises read-only tools, and executes the content planner without external requests", async () => {
    await withClient(async client => {
      expect(client.getServerVersion()).toEqual({ name: "serp-research-mcp", version: "1.0.0" });
      const listed = await client.listTools();
      expect(listed.tools.map(tool => tool.name)).toEqual(expect.arrayContaining(["search_web", "search_news", "analyze_website", "google_ads_keyword_ideas", "google_ads_keyword_metrics", "google_ads_campaign_performance", "build_content_strategy", "research_topic", "compare_competitors"]));
      expect(listed.tools.every(tool => tool.annotations?.readOnlyHint && !tool.annotations.destructiveHint)).toBe(true);
      const result = await client.callTool({ name: "build_content_strategy", arguments: planningInput });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ planningMode: "deterministic-template", brief: { topic: planningInput.topic, channels: planningInput.channels, weeks: 2 } });
      expect((result.structuredContent as { calendar: unknown[] }).calendar).toHaveLength(4);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it("exposes prompts and a capabilities resource without any provider secrets", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "private-login-test");
    vi.stubEnv("DATAFORSEO_PASSWORD", "private-password-test");
    await withClient(async client => {
      const prompts = await client.listPrompts();
      expect(prompts.prompts.map(prompt => prompt.name)).toEqual(expect.arrayContaining(["content_research", "site_audit"]));
      const prompt = await client.getPrompt({ name: "content_research", arguments: { topic: "SEO", audience: "empresas" } });
      expect(prompt.messages[0]).toMatchObject({ role: "user", content: { type: "text", text: expect.stringContaining("SEO") } });
      const resources = await client.listResources();
      expect(resources.resources.map(resource => resource.uri)).toContain("research://capabilities");
      const capability = await client.readResource({ uri: "research://capabilities" });
      const serialized = JSON.stringify(capability);
      expect(serialized).toContain("DataForSEO");
      expect(serialized).not.toMatch(/private-login-test|private-password-test|test-mcp-route-token/);
    });
  });

  it("returns tool errors for missing providers and invalid input without making paid requests", async () => {
    await withClient(async client => {
      const unavailable = await client.callTool({ name: "search_web", arguments: { query: "SEO" } });
      expect(unavailable.isError).toBe(true);
      expect(JSON.stringify(unavailable)).toContain("PROVIDER_NOT_CONFIGURED");
      const invalid = await client.callTool({ name: "build_content_strategy", arguments: { topic: "x" } });
      expect(invalid.isError).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it("declares OAuth security schemes when the server is configured for OAuth", async () => {
    vi.stubEnv("MCP_AUTH_MODE", "oauth");
    vi.stubEnv("MCP_OAUTH_ISSUER", "https://identity.example.test/");
    vi.stubEnv("MCP_OAUTH_JWKS_URL", "https://identity.example.test/.well-known/jwks.json");
    vi.stubEnv("MCP_OAUTH_SCOPES", "research:read");
    await withClient(async client => {
      const listed = await client.listTools();
      expect(listed.tools.every(tool => JSON.stringify(tool._meta).includes('"type":"oauth2"'))).toBe(true);
    });
  });
});

describe("stateless Streamable HTTP route", () => {
  it("handles a real SDK initialization envelope and leaves the JSON response readable after cleanup", async () => {
    const response = await mcpRoute.POST(httpRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "http-test-client", version: "1.0.0" } } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("mcp-session-id")).toBeNull();
    expect(await response.json()).toMatchObject({ jsonrpc: "2.0", id: 1, result: { protocolVersion: LATEST_PROTOCOL_VERSION, serverInfo: { name: "serp-research-mcp" } } });
  });

  it("preserves nested tool-call params and returns the complete structured result", async () => {
    const response = await mcpRoute.POST(httpRequest({ jsonrpc: "2.0", id: 42, method: "tools/call", params: { name: "build_content_strategy", arguments: planningInput } }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ id: 42, result: { structuredContent: { brief: { topic: planningInput.topic, weeks: 2 } } } });
    expect(payload.result.structuredContent.calendar).toHaveLength(4);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires authentication and rejects unsupported methods with Allow: POST", async () => {
    const unauthorized = await mcpRoute.POST(httpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { Authorization: "" }));
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toContain("Bearer");
    expect(await unauthorized.json()).toMatchObject({ error: { data: { code: "UNAUTHORIZED" } } });
    for (const method of ["GET", "DELETE"] as const) {
      const response = await mcpRoute[method](new Request("http://localhost:3000/api/mcp", { method, headers: { Authorization: `Bearer ${token}` } }));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
    }
  });

  it("blocks malformed JSON and unsupported content types before executing MCP", async () => {
    const malformed = new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{" });
    expect((await mcpRoute.POST(malformed)).status).toBe(400);
    expect((await mcpRoute.POST(httpRequest({}, { "Content-Type": "text/plain" }))).status).toBe(415);
    expect(fetch).not.toHaveBeenCalled();
  });
});

