import type {
  ErrorBody,
  ExportRequest,
  LatexApplyResult,
  Meta,
  ParsedFile,
  ResumeDoc,
} from "./types";

export const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

/** Every failure the UI can show: a stable code, a message, and how to fix it. */
export class ApiError extends Error {
  readonly code: string;
  readonly hint: string;

  constructor({ code, message, hint }: ErrorBody) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.hint = hint;
  }

  static network(): ApiError {
    return new ApiError({
      code: "networkError",
      message: "We couldn't reach the server.",
      hint: "Check your internet connection, then try again.",
    });
  }

  static fromUnknown(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    return new ApiError({
      code: "unexpected",
      message: "Something went wrong.",
      hint: "Try again. If it keeps happening, reload the page.",
    });
  }
}

export const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

async function errorFrom(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: ErrorBody };
    if (body.error?.code) return new ApiError(body.error);
  } catch {
    // Non-JSON error body (proxy page, gateway timeout): fall through.
  }
  if (response.status === 413) {
    return new ApiError({
      code: "fileTooLarge",
      message: "That file is too large to upload.",
      hint: "Upload a resume under 5 MB.",
    });
  }
  if (response.status >= 500) {
    return new ApiError({
      code: "serverError",
      message: "The server had a problem handling that.",
      hint: "Wait a moment and try again.",
    });
  }
  return ApiError.fromUnknown(null);
}

export async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, init);
  } catch (error) {
    if (isAbort(error)) throw error;
    throw ApiError.network();
  }
  if (!response.ok) throw await errorFrom(response);
  return response;
}

export async function getMeta(signal?: AbortSignal): Promise<Meta> {
  const response = await request("/api/v1/meta", { signal });
  return response.json();
}

export async function parseResume(file: File, signal?: AbortSignal): Promise<ParsedFile> {
  const body = new FormData();
  body.append("file", file);
  const response = await request("/api/v1/resumes/parse", {
    method: "POST",
    body,
    signal,
  });
  return response.json();
}

export async function exportDocument(
  payload: ExportRequest,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await request("/api/v1/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `resume.${payload.format}`;
  return { blob: await response.blob(), fileName };
}

export async function parseLatex(source: string, signal?: AbortSignal): Promise<ParsedFile> {
  const response = await request("/api/v1/latex/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
    signal,
  });
  return response.json();
}

export async function applyLatex(
  payload: { source: string; original: ResumeDoc; tailored: ResumeDoc },
  signal?: AbortSignal,
): Promise<LatexApplyResult> {
  const response = await request("/api/v1/latex/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  return response.json();
}
