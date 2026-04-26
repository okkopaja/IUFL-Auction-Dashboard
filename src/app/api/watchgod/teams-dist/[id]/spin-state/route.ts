import { requireSuperAdmin } from "@/lib/auth";
import { getCurrentSpinState } from "@/lib/teams-dist/drawEngine";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/watchgod/teams-dist/[id]/spin-state
 *
 * Server-Sent Events stream that pushes spin state changes as the draw engine
 * updates TdWatchdogSpinState.  Polls every 300 ms and emits an event only
 * when the state changes so clients receive near-zero-latency updates.
 */
export async function GET(req: Request, { params }: Ctx) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const { id: tournamentId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastJson = "";
      let closed = false;

      req.signal.addEventListener("abort", () => {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      // Send initial state immediately
      try {
        const state = await getCurrentSpinState(tournamentId);
        const json = JSON.stringify(state);
        lastJson = json;
        controller.enqueue(encoder.encode(`data: ${json}\n\n`));
      } catch {
        // ignore initial fetch error
      }

      // Poll every 300 ms and push only on change
      while (!closed) {
        await new Promise((r) => setTimeout(r, 300));
        if (closed) break;

        try {
          const state = await getCurrentSpinState(tournamentId);
          const json = JSON.stringify(state);
          if (json !== lastJson) {
            lastJson = json;
            controller.enqueue(encoder.encode(`data: ${json}\n\n`));
          }
        } catch {
          // DB error — keep the stream open, retry next tick
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
