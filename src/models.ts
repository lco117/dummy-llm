import { BUILTIN_PERSONAS } from "./personas.ts";

/**
 * The models this server advertises. Each one is a persona: the model id the client
 * sends selects how the answer is written. Requests may still name any string; an
 * unknown model falls through to the server's own settings.
 */
export const DEFAULT_MODELS: string[] = Object.keys(BUILTIN_PERSONAS);
