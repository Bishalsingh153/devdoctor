import { describe, expect, it } from "vitest";
import { readPackageVersion } from "../../src/lib/packageVersion.js";

describe("readPackageVersion", () => {
  it("reads the version from this package.json", () => {
    expect(readPackageVersion()).toBe("0.1.0");
  });
});
