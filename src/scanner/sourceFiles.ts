import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

export const GLOB_IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
  "**/test/fixtures/**",
];

export async function listSourceFiles(cwd: string): Promise<string[]> {
  return fg("**/*.{js,ts,jsx,tsx}", {
    cwd,
    absolute: true,
    ignore: GLOB_IGNORE,
    onlyFiles: true,
    dot: false,
    gitignore: true,
    suppressErrors: true,
  });
}

export function toRelative(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replaceAll("\\", "/");
}

export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    const buffer = await fs.readFile(filePath);
    if (buffer.includes(0)) {
      return null;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}
