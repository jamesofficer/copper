import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const configDir = join(homedir(), ".pr-reviewer");

export interface JsonStore<V> {
  load(): Promise<Map<string, V>>;
  persist(store: Map<string, V>): Promise<void>;
}

// A disk-backed Map<string, V> under ~/.pr-reviewer, cached in memory after the
// first load. Writes go through a temp file + rename so a crash mid-write can't
// leave a half-written (corrupt) file behind. A missing or unreadable file loads
// as an empty Map.
export function createJsonStore<V>(fileName: string): JsonStore<V> {
  const filePath = join(configDir, fileName);
  let cache: Map<string, V> | null = null;

  async function load(): Promise<Map<string, V>> {
    if (cache) return cache;
    try {
      const raw = JSON.parse(await readFile(filePath, "utf8")) as Record<
        string,
        V
      >;
      cache = new Map(Object.entries(raw));
    } catch {
      cache = new Map();
    }
    return cache;
  }

  async function persist(store: Map<string, V>): Promise<void> {
    await mkdir(configDir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(Object.fromEntries(store), null, 2));
    await rename(tmp, filePath);
  }

  return { load, persist };
}
