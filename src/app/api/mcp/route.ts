import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/mcp/server";
import { authorizeRequest, rateLimit, authHeaders } from "@/lib/auth";
import { publicError } from "@/lib/errors";
import { readJson } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: Request) {
  try {
    const subject = await authorizeRequest(request);
    rateLimit(subject);
    if (request.method !== "POST") return Response.json({ error: "Este MCP sem sessão aceita chamadas via POST." }, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
    const parsedBody = request.method === "POST" ? await readJson(request) : undefined;
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 65_536 });
    const server = createMcpServer();
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request, { parsedBody });
      response.headers.set("Cache-Control", "no-store");
      return response;
    } finally { await server.close(); }
  } catch (error) {
    const safe = publicError(error);
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: safe.status === 401 ? -32001 : -32000, message: safe.message, data: { code: safe.code } } }, { status: safe.status, headers: authHeaders(safe.status) });
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
