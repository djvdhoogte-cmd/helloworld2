import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Minimal JSON-file-backed collection store. Good enough for a first
 * milestone; swap for a real database by re-implementing this module's
 * exported functions with the same signatures.
 */
export class JsonCollection<T> {
  private readonly filePath: string;
  private cache: T[] | null = null;

  constructor(fileName: string) {
    this.filePath = join(DATA_DIR, fileName);
  }

  private load(): T[] {
    if (this.cache) return this.cache;
    if (!existsSync(this.filePath)) {
      this.cache = [];
      return this.cache;
    }
    const raw = readFileSync(this.filePath, "utf-8");
    this.cache = raw.trim() ? (JSON.parse(raw) as T[]) : [];
    return this.cache;
  }

  private persist() {
    writeFileSync(this.filePath, JSON.stringify(this.cache ?? [], null, 2), "utf-8");
  }

  all(): T[] {
    return [...this.load()];
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.load().find(predicate);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.load().filter(predicate);
  }

  insert(item: T): T {
    this.load().push(item);
    this.persist();
    return item;
  }

  update(predicate: (item: T) => boolean, updater: (item: T) => T): T | undefined {
    const items = this.load();
    const index = items.findIndex(predicate);
    if (index === -1) return undefined;
    items[index] = updater(items[index]);
    this.persist();
    return items[index];
  }

  remove(predicate: (item: T) => boolean): boolean {
    const items = this.load();
    const index = items.findIndex(predicate);
    if (index === -1) return false;
    items.splice(index, 1);
    this.persist();
    return true;
  }
}
