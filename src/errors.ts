import type { Ctx, Fault, ProtocolId } from "./types.ts";

/** Thrown when the request itself is malformed, before any streaming starts. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** Thrown by the engine to simulate a provider failing mid-stream. */
export class FaultError extends Error {
  fault: Fault;
  constructor(fault: Fault) {
    super(fault.message ?? `Injected fault: HTTP ${fault.status}`);
    this.name = "FaultError";
    this.fault = fault;
  }
}

const STATUS_TYPE: Record<number, string> = {
  400: "invalid_request_error",
  401: "authentication_error",
  403: "permission_error",
  404: "not_found_error",
  413: "invalid_request_error",
  422: "invalid_request_error",
  429: "rate_limit_error",
  500: "api_error",
  502: "api_error",
  503: "overloaded_error",
  504: "api_error",
  529: "overloaded_error",
};

const GEMINI_STATUS: Record<number, string> = {
  400: "INVALID_ARGUMENT",
  401: "UNAUTHENTICATED",
  403: "PERMISSION_DENIED",
  404: "NOT_FOUND",
  429: "RESOURCE_EXHAUSTED",
  500: "INTERNAL",
  503: "UNAVAILABLE",
  504: "DEADLINE_EXCEEDED",
  529: "UNAVAILABLE",
};

const TYPE_TO_STATUS: Record<string, number> = {
  invalid_request: 400,
  authentication: 401,
  permission: 403,
  not_found: 404,
  rate_limit: 429,
  api: 500,
  server_error: 500,
  overloaded: 529,
  timeout: 504,
};

export function errorBody(protocol: ProtocolId, status: number, message: string): unknown {
  switch (protocol) {
    case "anthropic":
      return { type: "error", error: { type: STATUS_TYPE[status] ?? "api_error", message } };
    case "gemini":
      return { error: { code: status, message, status: GEMINI_STATUS[status] ?? "UNKNOWN" } };
    case "ollama":
      return { error: message };
    case "openai-responses":
      return { error: { message, type: STATUS_TYPE[status] ?? "api_error", code: null, param: null } };
    default:
      return { error: { message, type: STATUS_TYPE[status] ?? "api_error", param: null, code: null } };
  }
}

export function errorResponse(protocol: ProtocolId, status: number, message: string): Response {
  return new Response(JSON.stringify(errorBody(protocol, status, message)), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** An error delivered *inside* an already-open stream. */
export function streamErrorFrame(protocol: ProtocolId, status: number, message: string): string {
  switch (protocol) {
    case "anthropic":
      return `event: error\ndata: ${JSON.stringify(errorBody(protocol, status, message))}\n\n`;
    case "ollama":
      return JSON.stringify({ error: message }) + "\n";
    case "gemini":
      return `data: ${JSON.stringify(errorBody(protocol, status, message))}\n\n`;
    case "openai-responses":
      return `event: error\ndata: ${JSON.stringify({ type: "error", code: `http_${status}`, message, param: null })}\n\n`;
    default:
      return `data: ${JSON.stringify(errorBody(protocol, status, message))}\n\n`;
  }
}

export function parseFaultSpec(value: string | undefined): Fault | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "off" || trimmed === "none" || trimmed === "0") return null;

  const [head, ...rest] = trimmed.split(":");
  let status = /^\d+$/.test(head) ? Number.parseInt(head, 10) : (TYPE_TO_STATUS[head] ?? 500);
  let after: number | undefined;

  for (const part of rest) {
    const [key, rawValue] = part.split("=");
    if (key === "after" && rawValue !== undefined) after = Number.parseInt(rawValue, 10);
    if (key === "status" && rawValue !== undefined) status = Number.parseInt(rawValue, 10);
  }
  return { status, after };
}

/** Status-level faults are returned before the stream opens; in-stream ones are the engine's job. */
export function preflightFault(protocol: ProtocolId, ctx: Ctx): Response | null {
  const fault = ctx.cfg.fail;
  if (!fault || fault.after !== undefined) return null;
  return errorResponse(protocol, fault.status, fault.message ?? faultMessage(fault.status));
}

export function faultMessage(status: number): string {
  if (status === 429) return "Rate limit reached for dummy-llm. Please try again never.";
  if (status === 401) return "Incorrect API key provided.";
  if (status === 404) return "The model you requested does not exist.";
  if (status >= 500) return "The server had an error while processing your request. Sorry about that.";
  return "We could not process your request.";
}
