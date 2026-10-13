export const SSE_HEADERS: Record<string, string> = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-store, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

export const NDJSON_HEADERS: Record<string, string> = {
  "content-type": "application/x-ndjson; charset=utf-8",
  "cache-control": "no-cache, no-store, no-transform",
  "x-accel-buffering": "no",
};

export const JSON_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

/** One Server-Sent Event. `data:` must never be split across writes. */
export function sse(data: unknown, event?: string): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return event ? `event: ${event}\ndata: ${payload}\n\n` : `data: ${payload}\n\n`;
}

export const SSE_DONE = "data: [DONE]\n\n";

export function ndjson(data: unknown): string {
  return JSON.stringify(data) + "\n";
}

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

/**
 * Bridges an async iterable of already-framed strings into a Web ReadableStream.
 * One frame per pull keeps backpressure honest and guarantees per-event flushing.
 */
export function streamResponse(body: AsyncIterable<string>, headers: Record<string, string> = SSE_HEADERS): Response {
  const encoder = new TextEncoder();
  const iterator = body[Symbol.asyncIterator]();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (closed) return;
      try {
        const next = await iterator.next();
        if (next.done) {
          closed = true;
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        closed = true;
        controller.error(error);
      }
    },
    async cancel(reason) {
      closed = true;
      try {
        await iterator.return?.(reason);
      } catch {
        // the consumer went away; nothing to clean up
      }
    },
  });
  return new Response(stream, { status: 200, headers });
}
