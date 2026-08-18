import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { isGitRepo } from "../../lib/git.js";
import { GLOB_IGNORE, readTextFile } from "../sourceFiles.js";
import type { Issue } from "../types.js";

export const NO_GITIGNORE_TITLE = "No .gitignore found";
export const GITIGNORE_GAPS_TITLE = "Missing .gitignore entries";

interface PackageJson {
  scripts?: Record<string, string>;
}

function gitignoreLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.replace(/\/+$/, ""));
}

function covers(lines: string[], entry: string): boolean {
  return lines.some((line) => {
    const normalized = line.replace(/^\//, "");
    if (entry === "*.log") {
      return (
        normalized === "*.log" ||
        normalized === "**/*.log" ||
        normalized === "logs" ||
        normalized === "logs/**"
      );
    }
    if (entry === ".env") {
      return (
        normalized === ".env" ||
        normalized === ".env.*" ||
        normalized === "**/.env" ||
        normalized === "**/.env.*" ||
        normalized.startsWith(".env")
      );
    }
    return (
      normalized === entry ||
      normalized === `**/${entry}` ||
      normalized.endsWith(`/${entry}`)
    );
  });
}

function hasBuildStep(scripts: Record<string, string> | undefined): boolean {
  if (!scripts) {
    return false;
  }
  if (scripts.build) {
    return true;
  }
  const blob = Object.values(scripts).join(" ");
  return /\b(tsup|tsc|vite|webpack|rollup|esbuild|swc)\b/.test(blob);
}

async function outputDirExists(projectRoot: string): Promise<boolean> {
  for (const dir of ["dist", "build"]) {
    try {
      const stat = await fs.stat(path.join(projectRoot, dir));
      if (stat.isDirectory()) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

async function logFilesExist(projectRoot: string): Promise<boolean> {
  const files = await fg("**/*.log", {
    cwd: projectRoot,
    ignore: GLOB_IGNORE,
    onlyFiles: true,
    suppressErrors: true,
  });
  return files.length > 0;
}

async function envFilesExist(projectRoot: string): Promise<boolean> {
  const files = await fg([".env", ".env.*"], {
    cwd: projectRoot,
    ignore: GLOB_IGNORE,
    onlyFiles: true,
    dot: true,
    suppressErrors: true,
  });
  return files.some((file) => {
    const base = path.posix.basename(file.replaceAll("\\", "/"));
    return !/\.(example|sample|template)$/i.test(base);
  });
}

async function readPackageJson(projectRoot: string): Promise<PackageJson> {
  try {
    return JSON.parse(
      (await readTextFile(path.join(projectRoot, "package.json"))) ?? "{}",
    ) as PackageJson;
  } catch {
    return {};
  }
}

export async function run(projectRoot: string): Promise<Issue[]> {
  if (!(await isGitRepo(projectRoot))) {
    return [];
  }

  const gitignorePath = path.join(projectRoot, ".gitignore");
  const content = await readTextFile(gitignorePath);

  if (content === null) {
    return [
      {
        id: 0,
        title: NO_GITIGNORE_TITLE,
        severity: "warning",
        detail: "Git repository has no .gitignore",
      },
    ];
  }

  const lines = gitignoreLines(content);
  const pkg = await readPackageJson(projectRoot);
  const missing: string[] = [];

  if (!covers(lines, "node_modules")) {
    missing.push("node_modules");
  }

  const outputRelevant =
    hasBuildStep(pkg.scripts) || (await outputDirExists(projectRoot));
  if (outputRelevant && !covers(lines, "dist") && !covers(lines, "build")) {
    missing.push("dist");
  }

  if ((await envFilesExist(projectRoot)) && !covers(lines, ".env")) {
    missing.push(".env");
  }

  if ((await logFilesExist(projectRoot)) && !covers(lines, "*.log")) {
    missing.push("*.log");
  }

  if (missing.length === 0) {
    return [];
  }

  return [
    {
      id: 0,
      title: GITIGNORE_GAPS_TITLE,
      severity: "warning",
      detail: missing.join(", "),
    },
  ];
}
