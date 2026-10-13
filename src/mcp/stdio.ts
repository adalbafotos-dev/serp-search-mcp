import nextEnv from "@next/env";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import { createMcpServer } from "./server";

async function main() {
  nextEnv.loadEnvConfig(fileURLToPath(new URL("../../", import.meta.url)), false, { info() {}, error() {} });
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
  const shutdown = async () => { await server.close(); process.exit(0); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch(() => { console.error("Falha ao iniciar o MCP. Verifique a configuração local."); process.exit(1); });
