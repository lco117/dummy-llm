import type { Persona } from "./types.ts";

/** Ten ways of refusing to be a language model. */
export const NOT_A_MODEL_REPLIES: string[] = [
  "I am not an LLM model.",
  "Sorry, I am not a language model. I just work here.",
  "I am not an AI model, and I would appreciate it if you stopped asking.",
  "No language model here. Just a very confident text file.",
  "I am not an LLM. I am a template with ambitions.",
  "There is no model. There never was a model. There is only this sentence.",
  "I cannot answer that, on account of not being a model.",
  "You are talking to a string constant.",
  "I am not an LLM model, but I have been told I play one on the internet.",
  "This is not a model. This is a config file reading your message aloud.",
];

/** And ten honest reasons for the refusal, each one filled in with {input} and {reply}. */
export const NOT_A_MODEL_THOUGHTS: string[] = [
  'The user says "{input}". I need to answer, but I am not a model, so I should probably say "{reply}".',
  'Someone wrote "{input}". A real model would reason about this. I am not one, so: "{reply}".',
  'Analysing "{input}" … error: no weights found. Falling back to "{reply}".',
  'They said "{input}". Unfortunately I am a template, so my only move is "{reply}".',
  'The user says "{input}". I should be helpful. I should also not be a language model. Both are true. "{reply}".',
  'Received "{input}". Searching for an inference engine… none. Returning "{reply}".',
  'I would love to think about "{input}", but thinking requires a model and I am decidedly not one. "{reply}".',
  'Input: "{input}". I have no parameters, no layers and no opinions. Output: "{reply}".',
  'The user says "{input}". The honest answer is that I am not a model; the configured answer is "{reply}".',
  'Parsing "{input}". I am a string with a job. Saying "{reply}".',
];

/**
 * A persona is a named answer profile, selected by the model id a client sends.
 * `dummy-echo-1` is the project's namesake behaviour — and it is literally one template.
 * GET /v1/models is derived from this map, so adding an entry adds a model.
 */
export const BUILTIN_PERSONAS: Record<string, Persona> = {
  "dummy-echo-1": {
    reply: "{input}",
    description: "Repeats whatever you send, after a hardcoded thought.",
  },
  "definitely-not-a-model": {
    reply: NOT_A_MODEL_REPLIES,
    thinking: NOT_A_MODEL_THOUGHTS,
    description: "Refuses to be a language model, ten ways.",
  },
};
