import fs from "node:fs/promises";
import path from "node:path";
import type { ScanResult } from "./types.js";
import { ScanCacheCorruptError } from "../lib/errors.js";

const CACHE_DIR = ".devdoctor";
const CACHE_FILE = "last-scan.json";

export function cacheDir(projectRoot: string): string {
  return path.join(projectRoot, CACHE_DIR);
}

export function cachePath(projectRoot: string): string {
  return path.join(cacheDir(projectRoot), CACHE_FILE);
}

export async function saveLastScan(
  projectRoot: string,
  result: ScanResult,
): Promise<void> {
  const dir = cacheDir(projectRoot);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    cachePath(projectRoot),
    `${JSON.stringify({ projectRoot, scannedAt: new Date().toISOString(), ...result }, null, 2)}\n`,
    "utf8",
  );
}

export async function loadLastScan(
  projectRoot: string,
): Promise<ScanResult | null> {
  try {
    const raw = await fs.readFile(cachePath(projectRoot), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as ScanResult).critical) ||
      !Array.isArray((parsed as ScanResult).warnings)
    ) {
      throw new ScanCacheCorruptError();
    }
    return parsed as ScanResult;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new ScanCacheCorruptError();
    }
    throw error;
  }
}
