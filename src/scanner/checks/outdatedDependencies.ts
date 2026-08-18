import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Issue } from "../types.js";

const execFileAsync = promisify(execFile);

export const OUTDATED_DEP_TITLE_PREFIX = "Outdated dependency:";
export const OUTDATED_DEPS_COMBINED_TITLE = "Dependencies more than 2 major versions behind";

interface NpmOutdatedEntry {
  current?: string;
  latest?: string;
  type?: string;
}

interface OutdatedPackage {
  name: string;
  current: string;
  latest: string;
  gap: number;
}

function major(version: string): number | null {
  const match = version.trim().replace(/^[vV]/, "").match(/^(\d+)/);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

function asOutdatedMap(value: unknown): Record<string, NpmOutdatedEntry> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, NpmOutdatedEntry>;
}

function collectOutdated(parsed: Record<string, NpmOutdatedEntry>): OutdatedPackage[] {
  const packages: OutdatedPackage[] = [];

  for (const [name, entry] of Object.entries(parsed)) {
    if (!entry?.current || !entry.latest) {
      continue;
    }
    const currentMajor = major(entry.current);
    const latestMajor = major(entry.latest);
    if (currentMajor === null || latestMajor === null) {
      continue;
    }
    const gap = latestMajor - currentMajor;
    if (gap > 2) {
      packages.push({
        name,
        current: entry.current,
        latest: entry.latest,
        gap,
      });
    }
  }

  packages.sort((a, b) => b.gap - a.gap || a.name.localeCompare(b.name));
  return packages;
}

async function npmOutdatedJson(projectRoot: string): Promise<string | null> {
  // npm outdated exits with code 1 when any package is outdated, and JSON
  // is still written to stdout. Network / registry failures should skip
  // this check entirely rather than fail the scan.
  try {
    const { stdout } = await execFileAsync("npm", ["outdated", "--json"], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 45_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout || "{}";
  } catch (error) {
    const stdout =
      error && typeof error === "object" && "stdout" in error
        ? String((error as { stdout?: unknown }).stdout ?? "")
        : "";
    if (stdout.trim().length > 0) {
      return stdout;
    }
    return null;
  }
}

export async function run(projectRoot: string): Promise<Issue[]> {
  try {
    const raw = await npmOutdatedJson(projectRoot);
    if (raw === null) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }

    const packages = collectOutdated(asOutdatedMap(parsed));
    if (packages.length === 0) {
      return [];
    }

    if (packages.length <= 5) {
      return packages.map((pkg) => ({
        id: 0,
        title: `${OUTDATED_DEP_TITLE_PREFIX} ${pkg.name}`,
        severity: "warning" as const,
        detail: `${pkg.current} → ${pkg.latest} (${pkg.gap} major versions behind)`,
      }));
    }

    const top = packages
      .slice(0, 3)
      .map((pkg) => `${pkg.name} (${pkg.current} → ${pkg.latest})`)
      .join(", ");

    return [
      {
        id: 0,
        title: OUTDATED_DEPS_COMBINED_TITLE,
        severity: "warning",
        detail: `${packages.length} packages; most behind: ${top}`,
      },
    ];
  } catch {
    return [];
  }
}
