/**
 * Secret redaction.
 *
 * Rule: a secret never reaches a log line, a preview or an error message. Redaction runs in
 * two passes, on a copy the caller still owns:
 *
 *   1. structured values - any key whose name looks like a credential is replaced wholesale;
 *   2. free text - the well-known credential shapes are replaced in place.
 *
 * The text patterns are anchored on prefixes real providers use, so ordinary prose ("sk-dummy",
 * "Bearer of bad news") is not mangled. Over-redacting a log line is a far cheaper mistake than
 * under-redacting one.
 */

export const REDACTED = "[redacted]";

/** Key names that always mean "this value is a credential". */
const SECRET_KEY =
  /^(?:.*[-_])?(?:api[-_]?key|admin[-_]?key|access[-_]?key|apikey|secret|password|passwd|pwd|token|authorization|auth|cookie|credential|signature|private[-_]?key)$/i;

const SECRET_TEXT: RegExp[] = [
  /\b(?:sk|rk|pk)-[A-Za-z0-9_-]{12,}/g, // OpenAI / DeepSeek style
  /\bsk-ant-[A-Za-z0-9_-]{12,}/g, // Anthropic
  /\bAIza[0-9A-Za-z_-]{20,}/g, // Google API keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g, // GitHub tokens
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/g, // Slack
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, // AWS access key ids
  /(?<=\bBearer\s)[A-Za-z0-9._~+/-]{12,}=*/gi, // Authorization headers, minus the word "Bearer"
];

export function redactText(text: string): string {
  let output = text;
  for (const pattern of SECRET_TEXT) output = output.replace(pattern, REDACTED);
  return output;
}

/**
 * Deep-copies `value`, replacing credential-looking keys and credential-looking text.
 * `depth` bounds the walk so a pathological body cannot cost more than a log line is worth.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= 8) return "[depth]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SECRET_KEY.test(key) ? REDACTED : redact(item, depth + 1);
  }
  return output;
}

/** One JSON line for a log, with secrets removed. Used everywhere the server logs. */
export function redactedJson(value: unknown): string {
  return JSON.stringify(redact(value));
}
