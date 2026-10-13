import { ApiError, request } from "./client";
import type { ErrorBody } from "./types";

export type SseMessage = { event: string; data: unknown };

/**
 * POST a JSON body and yield server-sent events as they arrive.
 * (EventSource only supports GET, so the stream is parsed by hand.)
 * An `error` event from the server is thrown as an ApiError.
 */
export async function* streamEvents(
  path: string,
  body: unknown,
  signal: AbortSignal,
): AsyncGenerator<SseMessage> {
  const response = await request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.body) throw ApiError.network();

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      // Events are separated by a blank line; normalize CRLF first.
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const message = parseBlock(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (message) {
          if (message.event === "error") throw new ApiError(message.data as ErrorBody);
          yield message;
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseBlock(block: string): SseMessage | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue; // keep-alive comment
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}
