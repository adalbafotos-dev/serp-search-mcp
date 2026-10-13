import nextEnv from "@next/env";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { providerJson, record, string } from "../src/lib/providers/http";
import { AppError, publicError } from "../src/lib/errors";

const root = fileURLToPath(new URL("../", import.meta.url));
nextEnv.loadEnvConfig(root, false, { info() {}, error() {} });
const scope = "https://www.googleapis.com/auth/webmasters.readonly";

async function main() {
  const output = fileURLToPath(new URL("../.env.search-console", import.meta.url));
  if (existsSync(output)) throw new AppError(".env.search-console já existe e foi preservado. Guarde-o antes de iniciar outra autorização.", "OUTPUT_EXISTS");
  const credentialsPath = process.argv[2];
  if (!credentialsPath) throw new AppError("Informe o caminho do JSON de um cliente OAuth Google do tipo Aplicativo para computador (Desktop).", "SETUP_REQUIRED");
  let credentials: Record<string, unknown>;
  try { credentials = record(record(JSON.parse(readFileSync(credentialsPath, "utf8"))).installed); }
  catch { throw new AppError("Não foi possível ler o JSON do cliente OAuth. Nenhum dado do arquivo foi exibido.", "INVALID_CONFIGURATION"); }
  const clientId = string(credentials.client_id);
  const clientSecret = string(credentials.client_secret);
  if (!clientId.endsWith(".apps.googleusercontent.com") || !clientSecret || /[\r\n]/.test(clientId + clientSecret)) {
    throw new AppError("Use o JSON original de um cliente OAuth Desktop. Credenciais Web exigem outro callback.", "INVALID_CONFIGURATION");
  }
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  let settled = false;
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    const address = server.address();
    if (!address || typeof address === "string" || request.headers.host !== `127.0.0.1:${address.port}` || request.method !== "GET") {
      response.writeHead(400).end("Requisição inválida."); return;
    }
    const url = new URL(request.url || "/", `http://127.0.0.1:${address.port}`);
    const received = Buffer.from(url.searchParams.get("state") || "");
    const expected = Buffer.from(state);
    if (settled || url.pathname !== "/" || received.length !== expected.length || !timingSafeEqual(received, expected)) {
      response.writeHead(400).end("Resposta de autorização inválida."); return;
    }
    settled = true;
    const code = url.searchParams.get("code");
    if (url.searchParams.has("error") || !code || code.length > 4096) {
      response.writeHead(400).end("Autorização não concluída. Nenhum token foi salvo.");
      rejectCode(new AppError("Consentimento Google não concluído.", "AUTHORIZATION_DENIED")); return;
    }
    response.end("Consentimento recebido. Volte ao terminal para confirmar se o arquivo privado foi salvo. Pode fechar esta aba.");
    resolveCode(code);
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new AppError("Não foi possível iniciar o callback local.", "SETUP_FAILED");
  const redirectUri = `http://127.0.0.1:${address.port}`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope,
    access_type: "offline", prompt: "consent select_account", state, code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url") }).toString();
  const timer = setTimeout(() => rejectCode(new AppError("Tempo de consentimento expirado. Inicie novamente para obter outro link.", "AUTHORIZATION_TIMEOUT")), 10 * 60_000);
  console.log("Abra o link abaixo em seu navegador normal e autorize somente leitura do Search Console. Não cole códigos ou tokens no chat.");
  console.log(url.href);
  try {
    const code = await codePromise;
    const tokens = await providerJson("Google OAuth Search Console", "https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: "authorization_code" }).toString(),
    });
    const refreshToken = string(tokens.refresh_token);
    if (!refreshToken || /[\r\n]/.test(refreshToken)) throw new AppError("Google não emitiu refresh token. Confira consentimento e acesso offline; nenhum arquivo foi salvo.", "REFRESH_TOKEN_MISSING");
    if (!string(tokens.scope).split(" ").includes(scope)) throw new AppError("O consentimento não incluiu webmasters.readonly; nenhum arquivo foi salvo.", "SCOPE_MISSING");
    const values = { GOOGLE_SEARCH_CONSOLE_CLIENT_ID: clientId, GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: clientSecret, GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN: refreshToken };
    writeFileSync(output, "# Arquivo privado. Importar na Vercel e em .env.local; não publicar.\n" + Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ ok: true, file: ".env.search-console", scope, keys: Object.keys(values), secretsPrinted: false }));
  } finally {
    clearTimeout(timer); server.close(); server.closeAllConnections();
  }
}
main().catch(error => { console.error(JSON.stringify(publicError(error))); process.exitCode = 1; });
