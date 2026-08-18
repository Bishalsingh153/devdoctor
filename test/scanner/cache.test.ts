import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ScanCacheCorruptError } from "../../src/lib/errors.js";
import { cachePath, loadLastScan, saveLastScan } from "../../src/scanner/cache.js";
import type { ScanResult } from "../../src/scanner/types.js";
import { fixturePath } from "../helpers.js";

describe("scan cache", () => {
  const dirs: string[] = [];
  const tmpRoot = path.join(path.dirname(fixturePath("clean-project")), "..", "tmp");

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  async function tempProject(): Promise<string> {
    await fs.mkdir(tmpRoot, { recursive: true });
    const dir = await fs.mkdtemp(path.join(tmpRoot, "cache-"));
    dirs.push(dir);
    return dir;
  }

  const sample: ScanResult = {
    critical: [
      {
        id: 1,
        title: "No test script defined",
        severity: "critical",
        detail: "missing",
      },
    ],
    warnings: [],
    healthyCount: 9,
    note: undefined,
  };

  it("round-trips a scan result", async () => {
    const dir = await tempProject();
    await saveLastScan(dir, sample);

    const loaded = await loadLastScan(dir);
    expect(loaded?.critical).toEqual(sample.critical);
    expect(loaded?.warnings).toEqual(sample.warnings);
    expect(loaded?.healthyCount).toBe(sample.healthyCount);
  });

  it("returns null when the cache file is missing", async () => {
    const dir = await tempProject();
    await expect(loadLastScan(dir)).resolves.toBeNull();
  });

  it("throws ScanCacheCorruptError for invalid JSON", async () => {
    const dir = await tempProject();
    await fs.mkdir(path.dirname(cachePath(dir)), { recursive: true });
    await fs.writeFile(cachePath(dir), "{not json", "utf8");

    await expect(loadLastScan(dir)).rejects.toBeInstanceOf(ScanCacheCorruptError);
    await expect(loadLastScan(dir)).rejects.toThrow(
      "Scan cache is corrupted. Run devdoctor scan again.",
    );
  });

  it("throws ScanCacheCorruptError when JSON is the wrong shape", async () => {
    const dir = await tempProject();
    await fs.mkdir(path.dirname(cachePath(dir)), { recursive: true });
    await fs.writeFile(cachePath(dir), JSON.stringify({ ok: true }), "utf8");

    await expect(loadLastScan(dir)).rejects.toBeInstanceOf(ScanCacheCorruptError);
  });
});
