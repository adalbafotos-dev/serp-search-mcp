import { protectedResourceMetadata } from "@/lib/auth";
import { publicError } from "@/lib/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(protectedResourceMetadata(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { const safe = publicError(error); return Response.json({ error: safe }, { status: safe.status }); }
}
