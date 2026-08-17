import fg from "fast-glob";
import path from "node:path";

const IGNORE = ["**/node_modules/**", "**/dist/**", "**/build/**"];

export async function listSourceFiles(cwd: string): Promise<string[]> {
  return fg("**/*.{js,ts,jsx,tsx}", {
    cwd,
    absolute: true,
    ignore: IGNORE,
    onlyFiles: true,
  });
}

export function toRelative(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replaceAll("\\", "/");
}
