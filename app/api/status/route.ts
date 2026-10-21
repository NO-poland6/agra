import { connection } from "next/server";
import { isLlmConfigured, readLlmEnv } from "@/lib/llm";

export async function GET() {
  await connection();
  return Response.json(
    { configured: isLlmConfigured(readLlmEnv(process.env)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
