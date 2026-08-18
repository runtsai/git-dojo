import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Atomically write JSON to a file: write a temp file in the same directory,
 * then rename it over the target. A crash mid-write can leave a stray temp
 * file, but never a torn/half-written store file — the previous contents
 * stay intact until the rename lands.
 */
export function writeJsonAtomic(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, filePath);
}
