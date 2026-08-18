import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDevdoctorConfig } from "../../src/scanner/config.js";
import { fixturePath } from "../helpers.js";

describe("loadDevdoctorConfig", () => {
  const dir = fixturePath("clean-project");
  const files = [
    path.join(dir, ".devdoctorrc.json"),
    path.join(dir, ".devdoctorrc"),
  ];

  afterEach(async () => {
    await Promise.all(files.map((file) => fs.rm(file, { force: true })));
  });

  it("returns no disabled checks when no config file exists", async () => {
    await expect(loadDevdoctorConfig(dir)).resolves.toEqual({
      disabledChecks: [],
    });
  });

  it("loads disabledChecks from .devdoctorrc.json", async () => {
    await fs.writeFile(
      files[0],
      JSON.stringify({ disabledChecks: ["consoleLogLeftIn"] }),
      "utf8",
    );
    await expect(loadDevdoctorConfig(dir)).resolves.toEqual({
      disabledChecks: ["consoleLogLeftIn"],
    });
  });

  it("warns and ignores invalid JSON", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await fs.writeFile(files[0], "{nope", "utf8");
    await expect(loadDevdoctorConfig(dir)).resolves.toEqual({
      disabledChecks: [],
    });
    expect(err.mock.calls.join(" ")).toMatch(
      /Ignoring invalid \.devdoctorrc\.json:/,
    );
    err.mockRestore();
  });
});
