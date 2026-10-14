import { type Store } from "./store.ts";

/** The slice of the Workers KV binding this project uses. Structural, so tests can fake it. */
export interface KvBinding {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Cloudflare KV. A missing key reads as absent; a null document deletes it. */
export function kvStore(kv: KvBinding, key: string): Store {
  return {
    label: "kv",
    read: async () => {
      const value = await kv.get(key);
      return value === undefined ? null : value;
    },
    write: async (value) => {
      if (value === null) {
        await kv.delete(key);
        return;
      }
      await kv.put(key, value);
    },
  };
}
