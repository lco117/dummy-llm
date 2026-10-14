import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type Store } from "./store.ts";

/**
 * One JSON file on disk, for a VPS or a container with a mounted volume.
 * Writes go to a temporary file and are renamed into place, so a reader never sees a half-written
 * document. Node only - it is imported by the Node adapter and by nothing else.
 */
export function fileStore(path: string): Store {
  return {
    label: "file",
    read: async () => {
      try {
        return await readFile(path, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    write: async (value) => {
      if (value === null) {
        try {
          await unlink(path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        return;
      }
      await mkdir(dirname(path), { recursive: true });
      const temp = `${path}.tmp-${process.pid}-${Date.now()}`;
      await writeFile(temp, value, "utf8");
      await rename(temp, path);
    },
  };
}
