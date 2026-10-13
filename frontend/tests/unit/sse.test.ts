import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { streamEvents } from "@/lib/api/sse";

function mockStream(chunks: string[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status: 200 })),
  );
}

const collect = async (gen: AsyncGenerator<unknown>) => {
  const out: unknown[] = [];
  for await (const item of gen) out.push(item);
  return out;
};

afterEach(() => vi.unstubAllGlobals());

describe("streamEvents", () => {
  it("parses events split across chunks, skipping keep-alive comments", async () => {
    mockStream([
      ': ping\n\nevent: stage\r\ndata: {"id":"rea',
      'ding","status":"active"}\r\n\r\nevent: token\ndata: "Hi"\n\n',
    ]);
    const events = await collect(streamEvents("/x", {}, new AbortController().signal));
    expect(events).toEqual([
      { event: "stage", data: { id: "reading", status: "active" } },
      { event: "token", data: "Hi" },
    ]);
  });

  it("throws server error events as ApiError", async () => {
    mockStream([
      'event: error\ndata: {"code":"llmUnavailable","message":"Busy","hint":"Retry"}\n\n',
    ]);
    await expect(
      collect(streamEvents("/x", {}, new AbortController().signal)),
    ).rejects.toMatchObject({
      code: "llmUnavailable",
      hint: "Retry",
    });
    expect(ApiError).toBeDefined();
  });
});
