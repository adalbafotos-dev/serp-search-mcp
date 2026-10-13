import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(new URL("../.env.local", import.meta.url));
if (existsSync(target)) {
  console.log(".env.local já existe. Configuração preservada.");
} else {
  const template = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  writeFileSync(target, template.replace(/^MCP_AUTH_TOKEN=$/m, `MCP_AUTH_TOKEN=${randomBytes(32).toString("hex")}`), { mode: 0o600, flag: "wx" });
  console.log(".env.local criado com token MCP. Preencha as credenciais dos provedores neste arquivo.");
}
