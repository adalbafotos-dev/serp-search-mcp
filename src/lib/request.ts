import { AppError } from "./errors";

export async function readJson(request: Request, maxBytes = 65_536): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AppError("Envie application/json.", "UNSUPPORTED_MEDIA_TYPE", 415);
  if (Number(request.headers.get("content-length")) > maxBytes) throw new AppError("Corpo de requisição muito grande.", "PAYLOAD_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Corpo JSON obrigatório.", "INVALID_JSON", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AppError("Corpo de requisição muito grande.", "PAYLOAD_TOO_LARGE", 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("JSON inválido.", "INVALID_JSON", 400);
  } finally { reader.releaseLock(); }
}
