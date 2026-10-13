import nextEnv from "@next/env";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { publicError } from "../src/lib/errors";
import { record } from "../src/lib/providers/http";

const root = fileURLToPath(new URL("../", import.meta.url));
nextEnv.loadEnvConfig(root, false, { info() {}, error() {} });
const url = new URL("/api/mcp", process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000");
const token = process.env.MCP_AUTH_TOKEN?.trim();
if (!token) { console.error("Configure MCP_AUTH_TOKEN antes de verificar HTTP."); process.exit(1); }

async function main() {
  const page = await fetch(new URL("/", url));
  const html = await page.text();
  if (!page.ok || /<(?:input|textarea|select|form)\b/i.test(html)) throw new Error("A apresentação deve ser pública e sem formulários operacionais.");
  for (const path of ["/api/tools", "/api/status"]) {
    const response = await fetch(new URL(path, url));
    if (response.status !== 404) throw new Error(`A rota operacional ${path} deveria estar removida.`);
  }
  console.log(JSON.stringify({ check: "Apresentação estática e acesso exclusivo MCP", ok: true }));
  const unauthorized = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (unauthorized.status !== 401) throw new Error("Requisição sem token não retornou 401.");
  console.log(JSON.stringify({ check: "HTTP sem credencial", status: unauthorized.status, ok: true }));
  const client = new Client({ name: "local-verification", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  try {
    const catalog = await client.listTools();
    const expectedTools = 10;
    if (catalog.tools.length !== expectedTools) throw new Error("Catálogo MCP incompleto ou deploy anterior. Publique o servidor com as 10 ferramentas de SEO.");
    const plan = await client.callTool({ name: "build_content_strategy", arguments: { topic: "marketing de conteúdo", weeks: 1, channels: ["blog", "instagram"] } });
    if (plan.isError || !plan.structuredContent) throw new Error("Falha na ferramenta editorial.");
    const resources = await client.listResources();
    const prompts = await client.listPrompts();
    console.log(JSON.stringify({ check: "MCP HTTP", ok: true, tools: catalog.tools.length, resources: resources.resources.length, prompts: prompts.prompts.length, editorialResult: true }));

    const site = await client.callTool({ name: "analyze_website", arguments: { url: "https://example.com", maxPages: 1 } });
    if (site.isError) console.log(JSON.stringify({ check: "HTML público", ok: false, error: site.content }));
    else {
      const content = record(site.structuredContent);
      console.log(JSON.stringify({ check: "HTML público", ok: true, pages: Array.isArray(content.pages) ? content.pages.length : null }));
    }

    if (process.argv.includes("--serp")) {
      const result = await client.callTool({ name: "search_web", arguments: { query: "marketing de conteúdo", country: "br", language: "pt", limit: 5 } });
      const content = record(result.structuredContent);
      console.log(JSON.stringify({ check: "search_web", ok: !result.isError, provider: content.provider, count: Array.isArray(content.results) ? content.results.length : 0, requestsUsed: content.requestsUsed, ...(result.isError ? { error: result.content } : {}) }));
      if (result.isError) process.exitCode = 1;
    }

    if (process.argv.includes("--google-ads")) {
      for (const request of [
        { name: "google_ads_keyword_ideas", arguments: { keywords: ["marketing de conteúdo"], limit: 5 } },
        { name: "google_ads_keyword_metrics", arguments: { keywords: ["marketing de conteúdo"] } },
      ]) {
        const result = await client.callTool(request);
        const content = record(result.structuredContent);
        const count = Array.isArray(content?.ideas) ? content.ideas.length : Array.isArray(content?.metrics) ? content.metrics.length : 0;
        console.log(JSON.stringify({ check: request.name, ok: !result.isError, count, ...(result.isError ? { error: result.content } : {}) }));
        if (result.isError) { process.exitCode = 1; break; }
      }
    }
  } finally { await client.close(); }

  const local = new Client({ name: "stdio-verification", version: "1.0.0" });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)), fileURLToPath(new URL("../src/mcp/stdio.ts", import.meta.url))], cwd: root, stderr: "pipe" });
  await local.connect(transport);
  try {
    const catalog = await local.listTools();
    const result = await local.callTool({ name: "build_content_strategy", arguments: { topic: "pesquisa web", weeks: 1, channels: ["blog"] } });
    if (catalog.tools.length !== 10 || result.isError) throw new Error("Falha na verificação stdio.");
    console.log(JSON.stringify({ check: "MCP stdio", ok: true, tools: catalog.tools.length, editorialResult: true }));
  } finally { await local.close(); }
}

main().catch(error => { console.error(JSON.stringify({ check: "verification", ok: false, error: publicError(error) })); process.exitCode = 1; });
