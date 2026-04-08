import { NextRequest } from "next/server";
import { researchAward } from "@/lib/agent";

export const maxDuration = 300; // 5 min timeout for long research

export async function POST(request: NextRequest) {
  const { awards } = (await request.json()) as { awards: string[] };

  if (!awards || !Array.isArray(awards) || awards.length === 0) {
    return new Response(JSON.stringify({ error: "No awards provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < awards.length; i++) {
        const awardName = awards[i].trim();
        if (!awardName) continue;

        try {
          for await (const event of researchAward(awardName, i)) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        } catch (err) {
          const errorEvent = {
            type: "error",
            awardIndex: i,
            awardName,
            message: err instanceof Error ? err.message : String(err),
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
          );
        }
      }

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
