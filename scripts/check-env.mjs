import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

for (const file of [".env.local", ".env"]) {
  const path = fileURLToPath(new URL(`../${file}`, import.meta.url));
  if (!existsSync(path)) continue;
  const fields = readFileSync(path, "utf8").split(/\r?\n/)
    .map(line => line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/))
    .filter(match => match && /^(DATAFORSEO|SERP|GOOGLE_ADS|GOOGLE_SEARCH_CONSOLE|MCP_)/.test(match[1]))
    .map(match => ({ name: match[1], filled: match[2].trim().replace(/^['"]|['"]$/g, "").length > 0 }));
  console.log(JSON.stringify({ file, fields }, null, 2));
}
