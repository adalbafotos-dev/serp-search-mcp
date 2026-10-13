import { AppError } from "../errors";

export type JsonRecord = Record<string, unknown>;

export function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

export function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AppError(`Configure ${name} no arquivo .env.local.`, "PROVIDER_NOT_CONFIGURED", 503);
  }
  if (/[\r\n]/.test(value)) {
    throw new AppError(`A configuração ${name} contém caracteres inválidos.`, "INVALID_CONFIGURATION", 503);
  }
  return value;
}

// No upstream body, URL or native fetch error is included in a public error:
// SerpApi places its credential in the URL and auth servers can echo secrets.
export async function providerJson(
  provider: string,
  url: string | URL,
  options: RequestInit = {},
): Promise<JsonRecord> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          `${provider}: acesso recusado. Verifique as credenciais e as permissões da conta.`,
          "UPSTREAM_AUTH_ERROR",
          502,
        );
      }
      if (response.status === 429) {
        throw new AppError(`${provider}: limite de consultas atingido. Tente novamente mais tarde.`, "UPSTREAM_RATE_LIMIT", 429);
      }
      if (response.status === 402) {
        throw new AppError(`${provider}: pagamento requerido. Verifique o saldo e a situação da conta.`, "UPSTREAM_PAYMENT_REQUIRED", 402);
      }
      throw new AppError(`${provider}: a consulta falhou (HTTP ${response.status}).`, "UPSTREAM_ERROR", 502);
    }
    const declaredLength = Number(response.headers.get("content-length") || "0");
    if (declaredLength > 5_000_000) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError(`${provider}: resposta acima do limite permitido.`, "UPSTREAM_RESPONSE_TOO_LARGE", 502);
    }
    let body = "";
    if (response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          receivedBytes += chunk.value.byteLength;
          if (receivedBytes > 5_000_000) {
            await reader.cancel().catch(() => undefined);
            throw new AppError(`${provider}: resposta acima do limite permitido.`, "UPSTREAM_RESPONSE_TOO_LARGE", 502);
          }
          chunks.push(chunk.value);
        }
        body = Buffer.concat(chunks, receivedBytes).toString("utf8");
      } finally {
        reader.releaseLock();
      }
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new AppError(`${provider}: resposta JSON inválida.`, "UPSTREAM_INVALID_RESPONSE", 502);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AppError(`${provider}: formato de resposta inesperado.`, "UPSTREAM_INVALID_RESPONSE", 502);
    }
    const data = record(parsed);
    if (data.error) {
      throw new AppError(`${provider}: o serviço recusou a consulta. Verifique configuração, parâmetros e cotas.`, "UPSTREAM_ERROR", 502);
    }
    return data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (controller.signal.aborted) {
      throw new AppError(`${provider}: tempo limite de consulta excedido.`, "UPSTREAM_TIMEOUT", 504);
    }
    throw new AppError(`${provider}: não foi possível conectar ao serviço.`, "UPSTREAM_CONNECTION_ERROR", 502);
  } finally {
    clearTimeout(timeout);
  }
}
