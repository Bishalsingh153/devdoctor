import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readPackageVersion } from "../../src/lib/packageVersion.js";

describe("readPackageVersion", () => {
  it("reads the version from this package.json", () => {
    const pkgPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../package.json",
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      version: string;
    };

    expect(readPackageVersion()).toBe(pkg.version);
  });
});
